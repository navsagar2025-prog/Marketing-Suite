import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, campaignsTable } from "@workspace/db";
import {
  ListCampaignsQueryParams,
  ListCampaignsResponse,
  CreateCampaignBody,
  GetCampaignParams,
  GetCampaignResponse,
  UpdateCampaignParams,
  UpdateCampaignBody,
  UpdateCampaignResponse,
  DeleteCampaignParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/campaigns", async (req, res): Promise<void> => {
  const query = ListCampaignsQueryParams.safeParse(req.query);
  let campaigns;
  if (query.success) {
    const conditions = [];
    if (query.data.websiteId) conditions.push(eq(campaignsTable.websiteId, query.data.websiteId));
    if (query.data.status) conditions.push(eq(campaignsTable.status, query.data.status));
    campaigns = conditions.length > 0
      ? await db.select().from(campaignsTable).where(and(...conditions)).orderBy(campaignsTable.createdAt)
      : await db.select().from(campaignsTable).orderBy(campaignsTable.createdAt);
  } else {
    campaigns = await db.select().from(campaignsTable).orderBy(campaignsTable.createdAt);
  }
  const mapped = campaigns.map(c => ({
    ...c,
    budget: c.budget != null ? parseFloat(String(c.budget)) : null,
    spend: c.spend != null ? parseFloat(String(c.spend)) : null,
  }));
  res.json(ListCampaignsResponse.parse(mapped));
});

router.post("/campaigns", async (req, res): Promise<void> => {
  const parsed = CreateCampaignBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [campaign] = await db.insert(campaignsTable).values(parsed.data).returning();
  res.status(201).json(campaign);
});

router.get("/campaigns/:id", async (req, res): Promise<void> => {
  const params = GetCampaignParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, params.data.id));
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  res.json(GetCampaignResponse.parse({
    ...campaign,
    budget: campaign.budget != null ? parseFloat(String(campaign.budget)) : null,
    spend: campaign.spend != null ? parseFloat(String(campaign.spend)) : null,
  }));
});

router.patch("/campaigns/:id", async (req, res): Promise<void> => {
  const params = UpdateCampaignParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCampaignBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [campaign] = await db.update(campaignsTable).set(parsed.data).where(eq(campaignsTable.id, params.data.id)).returning();
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  res.json(UpdateCampaignResponse.parse({
    ...campaign,
    budget: campaign.budget != null ? parseFloat(String(campaign.budget)) : null,
    spend: campaign.spend != null ? parseFloat(String(campaign.spend)) : null,
  }));
});

router.delete("/campaigns/:id", async (req, res): Promise<void> => {
  const params = DeleteCampaignParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [campaign] = await db.delete(campaignsTable).where(eq(campaignsTable.id, params.data.id)).returning();
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
