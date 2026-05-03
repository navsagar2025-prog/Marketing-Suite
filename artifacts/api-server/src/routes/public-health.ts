import { Router, type IRouter } from "express";
import { db, websitesTable, keywordsTable, backlinksTable, siteAuditsTable } from "@workspace/db";
import { eq, sql, desc, and, gte, isNotNull } from "drizzle-orm";
import crypto from "node:crypto";
import { requireAuth, requirePermission } from "../lib/auth.js";

const router: IRouter = Router();
const websitesPermission = requirePermission("websites");

router.get("/public/health/:token", async (req, res): Promise<void> => {
  const token = req.params.token;
  if (!token || token.length < 16) {
    res.status(400).json({ error: "Invalid token" });
    return;
  }

  const [website] = await db
    .select()
    .from(websitesTable)
    .where(eq(websitesTable.publicShareToken, token));

  if (!website) {
    res.status(404).json({ error: "Health dashboard not found" });
    return;
  }

  const [kwStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      ranking: sql<number>`count(*) filter (where ${keywordsTable.currentRank} is not null)::int`,
      topThree: sql<number>`count(*) filter (where ${keywordsTable.currentRank} between 1 and 3)::int`,
      topTen: sql<number>`count(*) filter (where ${keywordsTable.currentRank} between 1 and 10)::int`,
      avgRank: sql<number>`coalesce(round(avg(${keywordsTable.currentRank}) filter (where ${keywordsTable.currentRank} is not null))::int, 0)`,
    })
    .from(keywordsTable)
    .where(eq(keywordsTable.websiteId, website.id));

  const topKeywords = await db
    .select({
      keyword: keywordsTable.keyword,
      rank: keywordsTable.currentRank,
      volume: keywordsTable.searchVolume,
    })
    .from(keywordsTable)
    .where(and(eq(keywordsTable.websiteId, website.id), isNotNull(keywordsTable.currentRank)))
    .orderBy(keywordsTable.currentRank)
    .limit(10);

  const [blStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      newLast30: sql<number>`count(*) filter (where ${backlinksTable.createdAt} >= now() - interval '30 days')::int`,
    })
    .from(backlinksTable)
    .where(eq(backlinksTable.websiteId, website.id));

  const [latestAudit] = await db
    .select()
    .from(siteAuditsTable)
    .where(and(eq(siteAuditsTable.websiteId, website.id), eq(siteAuditsTable.status, "complete")))
    .orderBy(desc(siteAuditsTable.completedAt))
    .limit(1);

  res.json({
    website: {
      name: website.name,
      url: website.url,
      niche: website.niche,
      seoScore: website.seoScore,
    },
    keywords: kwStats,
    topKeywords,
    backlinks: blStats,
    siteAudit: latestAudit
      ? {
          healthScore: latestAudit.healthScore,
          pagesCrawled: latestAudit.pagesCrawled,
          completedAt: latestAudit.completedAt,
        }
      : null,
    generatedAt: new Date().toISOString(),
  });
});

router.post("/websites/:id/share", requireAuth, websitesPermission, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [website] = await db.select().from(websitesTable).where(eq(websitesTable.id, id));
  if (!website) {
    res.status(404).json({ error: "Website not found" });
    return;
  }
  let token = website.publicShareToken;
  if (!token) {
    token = crypto.randomBytes(24).toString("hex");
    await db.update(websitesTable).set({ publicShareToken: token }).where(eq(websitesTable.id, id));
  }
  res.json({ token });
});

router.delete("/websites/:id/share", requireAuth, websitesPermission, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.update(websitesTable).set({ publicShareToken: null }).where(eq(websitesTable.id, id));
  res.json({ ok: true });
});

export default router;
