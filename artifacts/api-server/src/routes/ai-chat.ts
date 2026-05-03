import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  websitesTable,
  keywordsTable,
  backlinksTable,
  siteAuditsTable,
  leadsTable,
} from "@workspace/db/schema";
import { desc, sql, eq, and, gte, isNotNull } from "drizzle-orm";
import { callAI } from "../lib/ai-provider.js";
import { checkAndIncrementUsage } from "../lib/ai-usage.js";

const router: IRouter = Router();

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function userCan(user: { role?: string; permissions?: string[] | null } | undefined, module: string): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.permissions == null) return true;
  return user.permissions.includes(module);
}

async function buildContextSummary(user: { role?: string; permissions?: string[] | null } | undefined): Promise<string> {
  const sections: string[] = [];
  const canKeywords = userCan(user, "keywords");
  const canBacklinks = userCan(user, "backlinks");
  const canLeads = userCan(user, "leads");
  const canWebsites = userCan(user, "websites");
  const canAnalytics = userCan(user, "analytics");
  if (!canWebsites && !canKeywords) {
    return "(no accessible data — your account does not have permission to view websites or keywords)";
  }

  const websites = canWebsites
    ? await db
        .select({
          id: websitesTable.id,
          name: websitesTable.name,
          url: websitesTable.url,
          seoScore: websitesTable.seoScore,
          niche: websitesTable.niche,
        })
        .from(websitesTable)
        .limit(20)
    : [];

  if (websites.length > 0) {
    sections.push(
      `WEBSITES (${websites.length}):\n` +
        websites
          .map(
            (w) =>
              `- #${w.id} "${w.name}" (${w.url}) niche=${w.niche} seoScore=${w.seoScore ?? "n/a"}`
          )
          .join("\n")
    );
  }

  if (canKeywords) {
  const keywordStats = await db
    .select({
      total: sql<number>`count(*)::int`,
      ranking: sql<number>`count(*) filter (where ${keywordsTable.currentRank} is not null)::int`,
      topTen: sql<number>`count(*) filter (where ${keywordsTable.currentRank} between 1 and 10)::int`,
      topThree: sql<number>`count(*) filter (where ${keywordsTable.currentRank} between 1 and 3)::int`,
    })
    .from(keywordsTable);
  const ks = keywordStats[0];
  sections.push(
    `KEYWORDS: ${ks.total} tracked, ${ks.ranking} ranking, ${ks.topTen} in top 10, ${ks.topThree} in top 3`
  );

  const topKeywords = await db
    .select({
      keyword: keywordsTable.keyword,
      rank: keywordsTable.currentRank,
      volume: keywordsTable.searchVolume,
      websiteId: keywordsTable.websiteId,
    })
    .from(keywordsTable)
    .where(isNotNull(keywordsTable.currentRank))
    .orderBy(keywordsTable.currentRank)
    .limit(15);

  if (topKeywords.length > 0) {
    sections.push(
      `TOP KEYWORDS BY RANK:\n` +
        topKeywords
          .map(
            (k) =>
              `- "${k.keyword}" rank=${k.rank} volume=${k.volume ?? "n/a"} (website #${k.websiteId})`
          )
          .join("\n")
    );
  }

  }

  if (canBacklinks) {
  const recentBacklinks = await db
    .select({
      total: sql<number>`count(*)::int`,
    })
    .from(backlinksTable);
  if (recentBacklinks[0]?.total) {
    sections.push(`BACKLINKS: ${recentBacklinks[0].total} total tracked`);
  }
  }

  if (canWebsites) {
  const recentAudits = await db
    .select({
      websiteId: siteAuditsTable.websiteId,
      status: siteAuditsTable.status,
      healthScore: siteAuditsTable.healthScore,
      pagesCrawled: siteAuditsTable.pagesCrawled,
      createdAt: siteAuditsTable.createdAt,
    })
    .from(siteAuditsTable)
    .orderBy(desc(siteAuditsTable.createdAt))
    .limit(5);

  if (recentAudits.length > 0) {
    sections.push(
      `RECENT SITE AUDITS:\n` +
        recentAudits
          .map(
            (a) =>
              `- website #${a.websiteId} status=${a.status} health=${a.healthScore ?? "n/a"} pages=${a.pagesCrawled} on ${a.createdAt.toISOString().slice(0, 10)}`
          )
          .join("\n")
    );
  }

  }

  if (canLeads) {
  const leadStats = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(leadsTable);
  if (leadStats[0]?.total) {
    sections.push(`LEADS: ${leadStats[0].total} in pipeline`);
  }
  }

  if (canKeywords) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentMovers = await db.execute(sql`
    with latest as (
      select keyword_id, max(recorded_date) as d
      from keyword_rank_history
      group by keyword_id
    ),
    prev as (
      select h.keyword_id, h.rank as old_rank
      from keyword_rank_history h
      where h.recorded_date < ${since.toISOString().slice(0, 10)}
      order by h.recorded_date desc
    )
    select k.keyword, h.rank as new_rank
    from latest l
    join keyword_rank_history h on h.keyword_id = l.keyword_id and h.recorded_date = l.d
    join keywords k on k.id = l.keyword_id
    where h.rank is not null
    limit 5
  `);
  if (Array.isArray(recentMovers.rows) && recentMovers.rows.length > 0) {
    sections.push(
      `RECENT RANKING DATA (latest):\n` +
        recentMovers.rows
          .map((r: any) => `- "${r.keyword}" current rank=${r.new_rank}`)
          .join("\n")
    );
  }
  }

  return sections.join("\n\n");
}

router.post("/ai/chat", async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const usageCheck = await checkAndIncrementUsage(userId, "text");
  if (!usageCheck.allowed) {
    res.status(429).json({
      error: "Monthly text generation limit reached",
      used: usageCheck.used,
      limit: usageCheck.limit,
      type: "text",
    });
    return;
  }

  const { messages } = req.body as { messages?: ChatMessage[] };

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }

  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== "user" || !lastMessage.content) {
    res.status(400).json({ error: "Last message must be from user" });
    return;
  }

  const trimmedHistory = messages.slice(-10);

  let contextSummary = "";
  try {
    contextSummary = await buildContextSummary(req.user);
  } catch {
    contextSummary = "(context unavailable)";
  }

  const historyText = trimmedHistory
    .slice(0, -1)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  const systemPrompt = `You are an SEO data analyst assistant for a marketing platform. You help the user understand their SEO data, suggest improvements, and answer questions about their websites, keywords, rankings, backlinks, and audits.

Use the LIVE DATA below as the source of truth. If the answer isn't in the data, say so plainly. Be concise (2-5 sentences typically). Use bullet points for lists. Never invent numbers.

LIVE DATA:
${contextSummary}

${historyText ? `CONVERSATION SO FAR:\n${historyText}\n` : ""}`;

  const fullPrompt = `${systemPrompt}\n\nUser: ${lastMessage.content}\n\nAssistant:`;

  try {
    const reply = await callAI(fullPrompt, { maxTokens: 800 });
    res.json({ reply });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI generation failed";
    res.status(503).json({ error: message });
  }
});

export default router;
