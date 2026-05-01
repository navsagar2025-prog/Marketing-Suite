import { Router, type IRouter } from "express";
import { eq, and, gte, desc } from "drizzle-orm";
import { db, keywordsTable, keywordRankHistoryTable, keywordResearchSessionsTable } from "@workspace/db";
import {
  ListKeywordsQueryParams,
  ListKeywordsResponse,
  CreateKeywordBody,
  UpdateKeywordParams,
  UpdateKeywordBody,
  UpdateKeywordResponse,
  DeleteKeywordParams,
  GetKeywordRankHistoryParams,
  GetKeywordRankHistoryQueryParams,
  GetKeywordRankHistoryResponse,
  ResearchKeywordsBody,
  ResearchKeywordsResponse,
} from "@workspace/api-zod";
import { callAI } from "../lib/ai-provider.js";
import { checkAndIncrementUsage } from "../lib/ai-usage.js";

const router: IRouter = Router();

router.get("/keywords", async (req, res): Promise<void> => {
  const query = ListKeywordsQueryParams.safeParse(req.query);
  let keywords;
  if (query.success && query.data.websiteId) {
    keywords = await db.select().from(keywordsTable).where(eq(keywordsTable.websiteId, query.data.websiteId)).orderBy(keywordsTable.createdAt);
  } else {
    keywords = await db.select().from(keywordsTable).orderBy(keywordsTable.createdAt);
  }
  res.json(ListKeywordsResponse.parse(keywords));
});

router.post("/keywords", async (req, res): Promise<void> => {
  const parsed = CreateKeywordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [keyword] = await db.insert(keywordsTable).values(parsed.data).returning();
  res.status(201).json(keyword);
});


router.get("/keywords/research/history", async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const sessions = await db
    .select()
    .from(keywordResearchSessionsTable)
    .where(eq(keywordResearchSessionsTable.staffUserId, userId))
    .orderBy(desc(keywordResearchSessionsTable.createdAt))
    .limit(5);
  res.json(sessions);
});

router.post("/keywords/research", async (req, res): Promise<void> => {
  const userId = req.user!.id;

  const usageCheck = await checkAndIncrementUsage(userId, "text");
  if (!usageCheck.allowed) {
    res.status(429).json({ error: "Monthly text generation limit reached", used: usageCheck.used, limit: usageCheck.limit });
    return;
  }

  const parsed = ResearchKeywordsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { seedInput, websiteId } = parsed.data;

  const isUrl = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+/.test(seedInput);
  const inputType = isUrl ? "competitor domain" : "seed keyword or topic";

  const prompt = `You are a senior SEO strategist. A user has provided a ${inputType}: "${seedInput}".

Generate 18 high-value keyword ideas that someone targeting this ${inputType} should consider.

For each keyword, provide:
- keyword: the exact keyword phrase (2-5 words, realistic search queries)
- volumeBand: estimated monthly search volume. Use ONLY one of: "<100", "100-1K", "1K-10K", "10K+"
- difficulty: integer 0-100 (0=very easy, 100=impossible). Include a mix — some easy long-tails (difficulty 10-30), some medium (30-60), some hard (60-85)
- intent: ONLY one of: "informational", "commercial", "navigational", "transactional"
- contentAngle: one sentence describing what type of content ranks for this keyword and why it's valuable

Rules:
- Include a mix of short-tail and long-tail keywords
- Include informational AND commercial/transactional keywords
- Prioritise keywords where a business could realistically rank
- Make keyword phrases specific and natural-sounding
- Do NOT include the seed input itself as a suggestion

Return ONLY a valid JSON object like:
{"suggestions": [...]}`;

  try {
    const content = await callAI(prompt, { maxTokens: 3000, jsonMode: true });
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(content) as Record<string, unknown>;
    } catch {
      raw = { suggestions: [] };
    }

    const rawSuggestions = Array.isArray(raw["suggestions"]) ? (raw["suggestions"] as unknown[]) : [];
    const validVolumeBands = ["<100", "100-1K", "1K-10K", "10K+"] as const;
    const validIntents = ["informational", "commercial", "navigational", "transactional"] as const;

    const suggestions = rawSuggestions
      .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null && typeof (s as Record<string, unknown>)["keyword"] === "string")
      .map((s) => ({
        keyword: (s["keyword"] as string).trim(),
        volumeBand: (validVolumeBands as readonly string[]).includes(s["volumeBand"] as string)
          ? (s["volumeBand"] as typeof validVolumeBands[number])
          : "100-1K" as const,
        difficulty: typeof s["difficulty"] === "number" ? Math.min(100, Math.max(0, s["difficulty"])) : 50,
        intent: (validIntents as readonly string[]).includes(s["intent"] as string)
          ? (s["intent"] as typeof validIntents[number])
          : "informational" as const,
        contentAngle: typeof s["contentAngle"] === "string" ? s["contentAngle"] : "",
      }))
      .filter((s) => s.keyword.length > 0);

    const [session] = await db
      .insert(keywordResearchSessionsTable)
      .values({
        staffUserId: userId,
        websiteId: websiteId ?? null,
        seedInput,
        suggestions,
      })
      .returning();

    res.json({ sessionId: session!.id, seedInput, suggestions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI generation failed";
    res.status(503).json({ error: message });
  }
});

router.patch("/keywords/:id", async (req, res): Promise<void> => {
  const params = UpdateKeywordParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateKeywordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [keyword] = await db.update(keywordsTable).set(parsed.data).where(eq(keywordsTable.id, params.data.id)).returning();
  if (!keyword) {
    res.status(404).json({ error: "Keyword not found" });
    return;
  }
  res.json(UpdateKeywordResponse.parse(keyword));
});

router.get("/keywords/:id/history", async (req, res): Promise<void> => {
  const params = GetKeywordRankHistoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const queryParsed = GetKeywordRankHistoryQueryParams.safeParse(req.query);
  const rawDays = queryParsed.success && queryParsed.data.days ? queryParsed.data.days : 90;
  const days = Math.min(Math.max(rawDays, 1), 365);

  const [keyword] = await db.select({ id: keywordsTable.id }).from(keywordsTable).where(eq(keywordsTable.id, params.data.id));
  if (!keyword) {
    res.status(404).json({ error: "Keyword not found" });
    return;
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const history = await db
    .select()
    .from(keywordRankHistoryTable)
    .where(
      and(
        eq(keywordRankHistoryTable.keywordId, params.data.id),
        gte(keywordRankHistoryTable.recordedDate, cutoffDate),
      ),
    )
    .orderBy(keywordRankHistoryTable.recordedDate);

  res.json(GetKeywordRankHistoryResponse.parse(history));
});

router.delete("/keywords/:id", async (req, res): Promise<void> => {
  const params = DeleteKeywordParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [keyword] = await db.delete(keywordsTable).where(eq(keywordsTable.id, params.data.id)).returning();
  if (!keyword) {
    res.status(404).json({ error: "Keyword not found" });
    return;
  }
  res.sendStatus(204);
});

export async function runRankSnapshot(): Promise<{ snapshotted: number; skipped: number; failed: number; date: string }> {
  const today = new Date().toISOString().slice(0, 10);
  const keywords = await db.select().from(keywordsTable);
  let snapshotted = 0;
  let skipped = 0;
  let failed = 0;
  for (const kw of keywords) {
    try {
      const result = await db
        .insert(keywordRankHistoryTable)
        .values({ keywordId: kw.id, rank: kw.currentRank ?? null, recordedDate: today })
        .onConflictDoNothing()
        .returning();
      if (result.length > 0) {
        snapshotted++;
      } else {
        skipped++;
      }
    } catch (err) {
      failed++;
      const { logger } = await import("../lib/logger.js");
      logger.error({ keywordId: kw.id, err }, "Keyword snapshot failed for keyword");
    }
  }
  return { snapshotted, skipped, failed, date: today };
}

export default router;
