import { Router, type IRouter } from "express";
import { eq, count, sql, gte, and, lte, desc } from "drizzle-orm";
import { db, websitesTable, keywordsTable, socialPostsTable, campaignsTable, backlinksTable, leadsTable, pageViewsTable } from "@workspace/db";
import {
  GetWebsiteAnalyticsParams,
  GetAnalyticsSummaryResponse,
  GetWebsiteAnalyticsResponse,
  GetCampaignAnalyticsResponse,
  GetLeadsFunnelResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/analytics/summary", async (req, res): Promise<void> => {
  const { from, to } = req.query as { from?: string; to?: string };
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  function dateFilter(col: typeof leadsTable.createdAt) {
    const filters = [];
    if (fromDate) filters.push(gte(col, fromDate));
    if (toDate) filters.push(lte(col, toDate));
    return filters.length ? and(...filters) : undefined;
  }

  const leadsFilter = dateFilter(leadsTable.createdAt);

  const [websites] = await db.select({ count: count() }).from(websitesTable);
  const [keywords] = await db.select({ count: count() }).from(keywordsTable);
  const leadsQ = db.select({ count: count() }).from(leadsTable);
  const [leads] = leadsFilter ? await leadsQ.where(leadsFilter) : await leadsQ;
  const [campaigns] = await db.select({ count: count() }).from(campaignsTable);
  const [activeCampaigns] = await db.select({ count: count() }).from(campaignsTable).where(eq(campaignsTable.status, "active"));
  const [backlinks] = await db.select({ count: count() }).from(backlinksTable);
  const [securedBacklinks] = await db.select({ count: count() }).from(backlinksTable).where(eq(backlinksTable.status, "link_secured"));
  const [scheduledPosts] = await db.select({ count: count() }).from(socialPostsTable).where(eq(socialPostsTable.status, "scheduled"));
  const convertedFilter = leadsFilter ? and(eq(leadsTable.status, "converted"), leadsFilter) : eq(leadsTable.status, "converted");
  const [convertedLeads] = await db.select({ count: count() }).from(leadsTable).where(convertedFilter);
  const highIntentFilter = leadsFilter ? and(gte(leadsTable.score, 70), leadsFilter) : gte(leadsTable.score, 70);
  const [highIntentLeads] = await db.select({ count: count() }).from(leadsTable).where(highIntentFilter);
  const avgSeoResult = await db.select({ avg: sql<number>`avg(seo_score)` }).from(websitesTable);

  res.json(GetAnalyticsSummaryResponse.parse({
    totalWebsites: websites?.count ?? 0,
    totalKeywords: keywords?.count ?? 0,
    totalLeads: leads?.count ?? 0,
    totalCampaigns: campaigns?.count ?? 0,
    activeCampaigns: activeCampaigns?.count ?? 0,
    totalBacklinks: backlinks?.count ?? 0,
    securedBacklinks: securedBacklinks?.count ?? 0,
    scheduledPosts: scheduledPosts?.count ?? 0,
    convertedLeads: convertedLeads?.count ?? 0,
    highIntentLeads: highIntentLeads?.count ?? 0,
    avgSeoScore: avgSeoResult[0]?.avg != null ? parseFloat(String(avgSeoResult[0].avg)) : null,
  }));
});

router.get("/analytics/website/:id", async (req, res): Promise<void> => {
  const params = GetWebsiteAnalyticsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { id } = params.data;
  const [website] = await db.select().from(websitesTable).where(eq(websitesTable.id, id));
  if (!website) {
    res.status(404).json({ error: "Website not found" });
    return;
  }
  const [keywordsCount] = await db.select({ count: count() }).from(keywordsTable).where(eq(keywordsTable.websiteId, id));
  const [topRankKeywords] = await db.select({ count: count() }).from(keywordsTable).where(sql`${keywordsTable.websiteId} = ${id} AND ${keywordsTable.currentRank} <= 10 AND ${keywordsTable.currentRank} IS NOT NULL`);
  const [activeCampaigns] = await db.select({ count: count() }).from(campaignsTable).where(sql`${campaignsTable.websiteId} = ${id} AND ${campaignsTable.status} = 'active'`);
  const [totalLeads] = await db.select({ count: count() }).from(leadsTable).where(eq(leadsTable.websiteId, id));
  const [convertedLeads] = await db.select({ count: count() }).from(leadsTable).where(sql`${leadsTable.websiteId} = ${id} AND ${leadsTable.status} = 'converted'`);
  const [scheduledPosts] = await db.select({ count: count() }).from(socialPostsTable).where(sql`${socialPostsTable.websiteId} = ${id} AND ${socialPostsTable.status} = 'scheduled'`);
  const [backlinkOpportunities] = await db.select({ count: count() }).from(backlinksTable).where(eq(backlinksTable.websiteId, id));
  const [securedBacklinks] = await db.select({ count: count() }).from(backlinksTable).where(sql`${backlinksTable.websiteId} = ${id} AND ${backlinksTable.status} = 'link_secured'`);

  res.json(GetWebsiteAnalyticsResponse.parse({
    websiteId: website.id,
    name: website.name,
    url: website.url,
    seoScore: website.seoScore,
    keywordsTracked: keywordsCount?.count ?? 0,
    topRankKeywords: topRankKeywords?.count ?? 0,
    activeCampaigns: activeCampaigns?.count ?? 0,
    totalLeads: totalLeads?.count ?? 0,
    convertedLeads: convertedLeads?.count ?? 0,
    scheduledPosts: scheduledPosts?.count ?? 0,
    backlinkOpportunities: backlinkOpportunities?.count ?? 0,
    securedBacklinks: securedBacklinks?.count ?? 0,
  }));
});

router.get("/analytics/campaigns", async (_req, res): Promise<void> => {
  const campaigns = await db.select().from(campaignsTable).orderBy(campaignsTable.createdAt);
  const result = await Promise.all(campaigns.map(async (c) => {
    const [leadsCount] = await db.select({ count: count() }).from(leadsTable).where(eq(leadsTable.campaignId, c.id));
    const impressions = c.impressions ?? 0;
    const clicks = c.clicks ?? 0;
    const conversions = c.conversions ?? 0;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : null;
    const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : null;
    return {
      campaignId: c.id,
      name: c.name,
      type: c.type,
      status: c.status,
      budget: c.budget ? parseFloat(String(c.budget)) : null,
      spend: c.spend ? parseFloat(String(c.spend)) : null,
      impressions: c.impressions,
      clicks: c.clicks,
      conversions: c.conversions,
      leads: leadsCount?.count ?? 0,
      ctr,
      conversionRate,
    };
  }));
  res.json(GetCampaignAnalyticsResponse.parse(result));
});

router.get("/analytics/leads-funnel", async (_req, res): Promise<void> => {
  const [newLeads] = await db.select({ count: count() }).from(leadsTable).where(eq(leadsTable.status, "new"));
  const [contacted] = await db.select({ count: count() }).from(leadsTable).where(eq(leadsTable.status, "contacted"));
  const [qualified] = await db.select({ count: count() }).from(leadsTable).where(eq(leadsTable.status, "qualified"));
  const [converted] = await db.select({ count: count() }).from(leadsTable).where(eq(leadsTable.status, "converted"));
  const [lost] = await db.select({ count: count() }).from(leadsTable).where(eq(leadsTable.status, "lost"));
  const totalValueResult = await db.select({ total: sql<number>`sum(cast(value as numeric))` }).from(leadsTable).where(eq(leadsTable.status, "converted"));

  res.json(GetLeadsFunnelResponse.parse({
    newLeads: newLeads?.count ?? 0,
    contacted: contacted?.count ?? 0,
    qualified: qualified?.count ?? 0,
    converted: converted?.count ?? 0,
    lost: lost?.count ?? 0,
    totalValue: totalValueResult[0]?.total != null ? parseFloat(String(totalValueResult[0].total)) : null,
  }));
});

// Traffic trend: daily page views + unique visitors over a date range
router.get("/analytics/traffic-trend", async (req, res): Promise<void> => {
  const daysRaw = Number(req.query.days);
  const days = daysRaw > 0 && daysRaw <= 365 ? daysRaw : 30;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      date: sql<string>`date_trunc('day', ${pageViewsTable.createdAt})::date::text`,
      views: sql<number>`count(*)::int`,
      visitors: sql<number>`count(distinct ${pageViewsTable.visitorId})::int`,
    })
    .from(pageViewsTable)
    .where(and(gte(pageViewsTable.createdAt, cutoff), eq(pageViewsTable.confirmed, true)))
    .groupBy(sql`date_trunc('day', ${pageViewsTable.createdAt})`)
    .orderBy(sql`date_trunc('day', ${pageViewsTable.createdAt})`);

  // Fill in missing days with 0
  const byDate = new Map(rows.map(r => [r.date, r]));
  const filled: { date: string; views: number; visitors: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().split("T")[0];
    const row = byDate.get(key);
    filled.push({ date: key, views: row?.views ?? 0, visitors: row?.visitors ?? 0 });
  }

  res.json({ days, trend: filled });
});

// Traffic sources: parse referrers into channels
router.get("/analytics/traffic-sources", async (req, res): Promise<void> => {
  const daysRaw = Number(req.query.days);
  const days = daysRaw > 0 && daysRaw <= 365 ? daysRaw : 30;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      referrer: pageViewsTable.referrer,
      views: sql<number>`count(*)::int`,
    })
    .from(pageViewsTable)
    .where(and(gte(pageViewsTable.createdAt, cutoff), eq(pageViewsTable.confirmed, true)))
    .groupBy(pageViewsTable.referrer)
    .orderBy(desc(sql`count(*)`))
    .limit(200);

  const SOCIAL = /facebook|twitter|x\.com|instagram|linkedin|youtube|tiktok|pinterest|reddit|snapchat/i;
  const SEARCH = /google|bing|yahoo|duckduckgo|baidu|yandex|ecosia|brave/i;

  const channels: Record<string, number> = {
    Organic: 0,
    Direct: 0,
    Social: 0,
    Referral: 0,
    Email: 0,
  };

  for (const row of rows) {
    const ref = row.referrer;
    const n = row.views;
    if (!ref) {
      channels["Direct"] += n;
    } else if (SEARCH.test(ref)) {
      channels["Organic"] += n;
    } else if (SOCIAL.test(ref)) {
      channels["Social"] += n;
    } else if (/mail\.|email|newsletter/i.test(ref)) {
      channels["Email"] += n;
    } else {
      channels["Referral"] += n;
    }
  }

  const sources = Object.entries(channels)
    .map(([channel, views]) => ({ channel, views }))
    .filter(s => s.views > 0)
    .sort((a, b) => b.views - a.views);

  res.json({ days, sources });
});

// Top pages for analytics (non-admin, uses same confirmed data)
router.get("/analytics/top-pages", async (req, res): Promise<void> => {
  const daysRaw = Number(req.query.days);
  const days = daysRaw > 0 && daysRaw <= 365 ? daysRaw : 30;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      path: pageViewsTable.path,
      views: sql<number>`count(*)::int`,
      visitors: sql<number>`count(distinct ${pageViewsTable.visitorId})::int`,
    })
    .from(pageViewsTable)
    .where(and(gte(pageViewsTable.createdAt, cutoff), eq(pageViewsTable.confirmed, true)))
    .groupBy(pageViewsTable.path)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  res.json({ days, pages: rows });
});

export default router;
