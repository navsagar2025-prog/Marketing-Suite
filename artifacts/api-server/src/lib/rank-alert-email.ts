/**
 * Rank-change email digest.
 * Called daily (after the rank snapshot cron) to notify admins
 * about significant position changes (±5 or more over 7 days).
 */
import { db, staffUsersTable, keywordsTable, keywordRankHistoryTable, websitesTable } from "@workspace/db";
import { eq, and, gte, inArray } from "drizzle-orm";
import { getEmailProviderConfig, sendEmails } from "./email-sender.js";
import { logger } from "./logger.js";
import { appSettingsTable } from "@workspace/db/schema";

async function getSetting(key: string): Promise<string | null> {
  try {
    const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, key));
    return row?.value ?? null;
  } catch { return null; }
}

type AlertEntry = {
  keyword: string;
  websiteName: string;
  currentRank: number;
  previousRank: number;
  delta: number;
  direction: "up" | "down";
};

export async function sendRankAlertDigest(): Promise<{ sent: number; skipped: string }> {
  const enabled = await getSetting("rank_alerts_email_enabled");
  if (enabled !== "true") return { sent: 0, skipped: "disabled" };

  const config = await getEmailProviderConfig();
  if (!config) return { sent: 0, skipped: "no_email_provider" };

  const notifyEmail = await getSetting("rank_alerts_email_to");
  if (!notifyEmail) return { sent: 0, skipped: "no_recipient" };

  const keywords = await db
    .select({ id: keywordsTable.id, keyword: keywordsTable.keyword, websiteId: keywordsTable.websiteId })
    .from(keywordsTable);

  if (keywords.length === 0) return { sent: 0, skipped: "no_keywords" };

  const websiteIds = [...new Set(keywords.map(k => k.websiteId))];
  const websites = await db.select({ id: websitesTable.id, name: websitesTable.name })
    .from(websitesTable)
    .where(inArray(websitesTable.id, websiteIds));
  const websiteMap = new Map(websites.map(w => [w.id, w.name]));

  const eightDaysAgo = new Date();
  eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
  const cutoffDate = eightDaysAgo.toISOString().slice(0, 10);
  const sevenDaysAgoStr = (() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10);
  })();

  const kwIds = keywords.map(k => k.id);
  const history = await db
    .select()
    .from(keywordRankHistoryTable)
    .where(and(inArray(keywordRankHistoryTable.keywordId, kwIds), gte(keywordRankHistoryTable.recordedDate, cutoffDate)))
    .orderBy(keywordRankHistoryTable.recordedDate);

  const historyByKw = new Map<number, Array<{ recordedDate: string; rank: number | null }>>();
  for (const h of history) {
    if (!historyByKw.has(h.keywordId)) historyByKw.set(h.keywordId, []);
    historyByKw.get(h.keywordId)!.push({ recordedDate: h.recordedDate, rank: h.rank ?? null });
  }

  const dropped: AlertEntry[] = [];
  const rising: AlertEntry[] = [];
  const kwMap = new Map(keywords.map(k => [k.id, k]));

  for (const [kwId, entries] of historyByKw) {
    const kw = kwMap.get(kwId);
    if (!kw) continue;
    const withRank = entries.filter(e => e.rank !== null);
    if (withRank.length < 2) continue;
    const newest = withRank[withRank.length - 1];
    const weekOld = [...withRank].reverse().find(e => e.recordedDate <= sevenDaysAgoStr);
    if (!weekOld || !newest.rank || !weekOld.rank) continue;
    const delta = weekOld.rank - newest.rank;
    const websiteName = websiteMap.get(kw.websiteId) ?? "Unknown";
    const entry: AlertEntry = {
      keyword: kw.keyword, websiteName,
      currentRank: newest.rank, previousRank: weekOld.rank,
      delta: Math.abs(delta), direction: delta >= 0 ? "up" : "down",
    };
    if (delta >= 5) rising.push(entry);
    else if (delta <= -5) dropped.push(entry);
  }

  const totalChanges = dropped.length + rising.length;
  if (totalChanges === 0) return { sent: 0, skipped: "no_changes" };

  const rows = (items: AlertEntry[], sign: string, color: string) =>
    items.map(a =>
      `  ${sign} "${a.keyword}" (${a.websiteName})  ${a.previousRank} → ${a.currentRank}  (${sign}${a.delta} positions)`
    ).join("\n");

  const body = `SEO Command — Daily Rank Change Digest

${rising.length} keyword${rising.length !== 1 ? "s" : ""} improved, ${dropped.length} dropped.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⬆ IMPROVED (${rising.length})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${rising.length > 0 ? rows(rising.sort((a, b) => b.delta - a.delta), "▲", "green") : "  None"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⬇ DROPPED (${dropped.length})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${dropped.length > 0 ? rows(dropped.sort((a, b) => b.delta - a.delta), "▼", "red") : "  None"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Log in to SEO Command to view full rank history and take action.

You're receiving this because rank alert emails are enabled in Settings → Notifications.
`;

  const result = await sendEmails(config, {
    to: [notifyEmail],
    subject: `SEO Command: ${rising.length} up, ${dropped.length} down today`,
    body,
  });

  logger.info({ sent: result.sent, rising: rising.length, dropped: dropped.length }, "Rank alert digest sent");
  return { sent: result.sent, skipped: "" };
}
