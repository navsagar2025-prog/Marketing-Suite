import { Router, type IRouter } from "express";
import { and, count, eq, gte, lte, sql } from "drizzle-orm";
import crypto from "node:crypto";
import {
  db,
  clientReportsTable,
  websitesTable,
  keywordsTable,
  backlinksTable,
  leadsTable,
  campaignsTable,
} from "@workspace/db";

const VALID_SECTIONS = ["seo_summary", "keywords", "backlinks", "leads", "campaigns"] as const;
type Section = (typeof VALID_SECTIONS)[number];

async function buildSnapshot(websiteId: number, dateFrom: string, dateTo: string, sections: Section[]) {
  const [website] = await db.select().from(websitesTable).where(eq(websitesTable.id, websiteId));
  if (!website) return null;

  const snapshot: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    website: {
      id: website.id,
      name: website.name,
      url: website.url,
      niche: website.niche,
      seoScore: website.seoScore,
      status: website.status,
    },
  };

  const fromDate = new Date(dateFrom);
  const toDate = new Date(dateTo);
  toDate.setHours(23, 59, 59, 999);

  if (sections.includes("keywords")) {
    const keywords = await db
      .select()
      .from(keywordsTable)
      .where(eq(keywordsTable.websiteId, websiteId))
      .orderBy(sql`current_rank asc nulls last`)
      .limit(25);

    snapshot.keywords = {
      total: keywords.length,
      topKeywords: keywords.map((k) => ({
        keyword: k.keyword,
        currentRank: k.currentRank,
        searchVolume: k.searchVolume,
        difficulty: k.difficulty,
        intent: k.intent,
        cluster: k.cluster,
        status: k.status,
      })),
    };
  }

  if (sections.includes("backlinks")) {
    const [total] = await db.select({ count: count() }).from(backlinksTable).where(eq(backlinksTable.websiteId, websiteId));
    const [secured] = await db
      .select({ count: count() })
      .from(backlinksTable)
      .where(and(eq(backlinksTable.websiteId, websiteId), eq(backlinksTable.status, "link_secured")));

    const byType = await db
      .select({ type: backlinksTable.type, count: count() })
      .from(backlinksTable)
      .where(eq(backlinksTable.websiteId, websiteId))
      .groupBy(backlinksTable.type);

    const byStatus = await db
      .select({ status: backlinksTable.status, count: count() })
      .from(backlinksTable)
      .where(eq(backlinksTable.websiteId, websiteId))
      .groupBy(backlinksTable.status);

    const recentBacklinks = await db
      .select()
      .from(backlinksTable)
      .where(
        and(
          eq(backlinksTable.websiteId, websiteId),
          gte(backlinksTable.createdAt, fromDate),
          lte(backlinksTable.createdAt, toDate)
        )
      )
      .limit(10);

    snapshot.backlinks = {
      total: total?.count ?? 0,
      secured: secured?.count ?? 0,
      byType: Object.fromEntries(byType.map((r) => [r.type, r.count])),
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r.count])),
      recentCount: recentBacklinks.length,
    };
  }

  if (sections.includes("leads")) {
    const [total] = await db.select({ count: count() }).from(leadsTable).where(eq(leadsTable.websiteId, websiteId));

    const periodLeads = await db
      .select()
      .from(leadsTable)
      .where(
        and(
          eq(leadsTable.websiteId, websiteId),
          gte(leadsTable.createdAt, fromDate),
          lte(leadsTable.createdAt, toDate)
        )
      );

    const byStatus = await db
      .select({ status: leadsTable.status, count: count() })
      .from(leadsTable)
      .where(eq(leadsTable.websiteId, websiteId))
      .groupBy(leadsTable.status);

    const bySource = await db
      .select({ source: leadsTable.source, count: count() })
      .from(leadsTable)
      .where(eq(leadsTable.websiteId, websiteId))
      .groupBy(leadsTable.source);

    snapshot.leads = {
      total: total?.count ?? 0,
      periodCount: periodLeads.length,
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r.count])),
      bySource: Object.fromEntries(bySource.map((r) => [r.source, r.count])),
    };
  }

  if (sections.includes("campaigns")) {
    const campaigns = await db
      .select()
      .from(campaignsTable)
      .where(eq(campaignsTable.websiteId, websiteId))
      .orderBy(sql`created_at desc`)
      .limit(10);

    snapshot.campaigns = {
      total: campaigns.length,
      active: campaigns.filter((c) => c.status === "active").length,
      list: campaigns.map((c) => ({
        name: c.name,
        type: c.type,
        status: c.status,
        goal: c.goal,
        impressions: c.impressions,
        clicks: c.clicks,
        conversions: c.conversions,
        budget: c.budget ? parseFloat(String(c.budget)) : null,
        spend: c.spend ? parseFloat(String(c.spend)) : null,
      })),
    };
  }

  return snapshot;
}

const router: IRouter = Router();

router.get("/reports", async (_req, res): Promise<void> => {
  const reports = await db
    .select({
      id: clientReportsTable.id,
      websiteId: clientReportsTable.websiteId,
      title: clientReportsTable.title,
      dateRangeStart: clientReportsTable.dateRangeStart,
      dateRangeEnd: clientReportsTable.dateRangeEnd,
      sections: clientReportsTable.sections,
      shareToken: clientReportsTable.shareToken,
      createdAt: clientReportsTable.createdAt,
      websiteName: websitesTable.name,
      websiteUrl: websitesTable.url,
    })
    .from(clientReportsTable)
    .leftJoin(websitesTable, eq(clientReportsTable.websiteId, websitesTable.id))
    .orderBy(sql`${clientReportsTable.createdAt} desc`);

  res.json(reports);
});

router.get("/reports/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid report ID" });
    return;
  }
  const [report] = await db
    .select()
    .from(clientReportsTable)
    .where(eq(clientReportsTable.id, id));

  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  res.json(report);
});

router.post("/reports", async (req, res): Promise<void> => {
  const body = req.body as Record<string, unknown>;

  const websiteId = typeof body.websiteId === "number" ? body.websiteId : parseInt(String(body.websiteId ?? ""), 10);
  if (!websiteId || isNaN(websiteId)) {
    res.status(400).json({ error: "websiteId is required" });
    return;
  }

  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : null;
  if (!title) {
    res.status(400).json({ error: "title is required" });
    return;
  }

  const dateRangeStart = typeof body.dateRangeStart === "string" && body.dateRangeStart ? body.dateRangeStart : null;
  const dateRangeEnd = typeof body.dateRangeEnd === "string" && body.dateRangeEnd ? body.dateRangeEnd : null;
  if (!dateRangeStart || !dateRangeEnd) {
    res.status(400).json({ error: "dateRangeStart and dateRangeEnd are required (YYYY-MM-DD)" });
    return;
  }

  const rawSections = Array.isArray(body.sections) ? body.sections : [];
  const sections = rawSections.filter((s): s is Section => VALID_SECTIONS.includes(s as Section));
  if (sections.length === 0) {
    res.status(400).json({ error: `At least one section required. Valid: ${VALID_SECTIONS.join(", ")}` });
    return;
  }

  const snapshot = await buildSnapshot(websiteId, dateRangeStart, dateRangeEnd, sections);
  if (!snapshot) {
    res.status(404).json({ error: "Website not found" });
    return;
  }

  const shareToken = crypto.randomBytes(24).toString("hex");

  const [report] = await db
    .insert(clientReportsTable)
    .values({ websiteId, title, dateRangeStart, dateRangeEnd, sections, snapshot, shareToken })
    .returning();

  res.status(201).json(report);
});

router.delete("/reports/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid report ID" });
    return;
  }
  const [deleted] = await db
    .delete(clientReportsTable)
    .where(eq(clientReportsTable.id, id))
    .returning({ id: clientReportsTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  res.json({ success: true });
});

router.post("/reports/:id/regenerate", async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid report ID" });
    return;
  }
  const [existing] = await db.select().from(clientReportsTable).where(eq(clientReportsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  const sections = existing.sections as string[];
  const validSections = sections.filter((s): s is Section => VALID_SECTIONS.includes(s as Section));
  const snapshot = await buildSnapshot(existing.websiteId, existing.dateRangeStart, existing.dateRangeEnd, validSections);
  if (!snapshot) {
    res.status(404).json({ error: "Associated website not found" });
    return;
  }

  const [updated] = await db
    .update(clientReportsTable)
    .set({ snapshot, updatedAt: new Date() })
    .where(eq(clientReportsTable.id, id))
    .returning();

  res.json(updated);
});

export default router;
