import { Router, type IRouter } from "express";
import { eq, count, sql, gte } from "drizzle-orm";
import { db, websitesTable, keywordsTable, socialPostsTable, campaignsTable, backlinksTable, leadsTable } from "@workspace/db";
import {
  GetWebsiteAnalyticsParams,
  GetAnalyticsSummaryResponse,
  GetWebsiteAnalyticsResponse,
  GetCampaignAnalyticsResponse,
  GetLeadsFunnelResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/analytics/summary", async (_req, res): Promise<void> => {
  const [websites] = await db.select({ count: count() }).from(websitesTable);
  const [keywords] = await db.select({ count: count() }).from(keywordsTable);
  const [leads] = await db.select({ count: count() }).from(leadsTable);
  const [campaigns] = await db.select({ count: count() }).from(campaignsTable);
  const [activeCampaigns] = await db.select({ count: count() }).from(campaignsTable).where(eq(campaignsTable.status, "active"));
  const [backlinks] = await db.select({ count: count() }).from(backlinksTable);
  const [securedBacklinks] = await db.select({ count: count() }).from(backlinksTable).where(eq(backlinksTable.status, "link_secured"));
  const [scheduledPosts] = await db.select({ count: count() }).from(socialPostsTable).where(eq(socialPostsTable.status, "scheduled"));
  const [convertedLeads] = await db.select({ count: count() }).from(leadsTable).where(eq(leadsTable.status, "converted"));
  const [highIntentLeads] = await db.select({ count: count() }).from(leadsTable).where(gte(leadsTable.score, 70));
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

export default router;
