import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, campaignsTable } from "@workspace/db";
import { leadsTable } from "@workspace/db/schema";
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
import { getEmailProviderConfig, sendEmails } from "../lib/email-sender.js";

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

router.post("/campaigns/:id/send", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid campaign id" }); return; }

  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }

  if (campaign.type !== "email") {
    res.status(422).json({ error: `Only email campaigns can be sent. This campaign type is "${campaign.type}".` }); return;
  }

  const { subject, body, recipientStatuses } = req.body ?? {};
  if (!subject || typeof subject !== "string" || !subject.trim()) {
    res.status(400).json({ error: "subject is required" }); return;
  }
  if (!body || typeof body !== "string" || !body.trim()) {
    res.status(400).json({ error: "body is required" }); return;
  }

  const emailConfig = await getEmailProviderConfig();
  if (!emailConfig) {
    res.status(422).json({ error: "No email provider configured. Set one up in Settings." }); return;
  }

  const ALL_LEAD_STATUSES = ["new", "contacted", "qualified", "converted", "lost"];
  const conditions = [eq(leadsTable.websiteId, campaign.websiteId)];
  const statuses: string[] = Array.isArray(recipientStatuses) && recipientStatuses.length > 0
    ? recipientStatuses.filter((s: string) => ALL_LEAD_STATUSES.includes(s))
    : ["new", "contacted", "qualified"];
  if (statuses.length === 0) {
    res.status(400).json({ error: "No valid recipient statuses provided." }); return;
  }
  conditions.push(inArray(leadsTable.status, statuses));

  const leads = await db.select({ email: leadsTable.email }).from(leadsTable).where(and(...conditions));
  const to = leads.map(l => l.email).filter((e): e is string => !!e && e.includes("@"));

  if (to.length === 0) {
    res.status(422).json({ error: "No leads with valid email addresses match the selected filters." }); return;
  }

  const { sent } = await sendEmails(emailConfig, { to, subject: subject.trim(), body: body.trim(), campaignId: id });

  await db.update(campaignsTable).set({
    status: "active",
    sentAt: new Date(),
    sentCount: sent,
  }).where(eq(campaignsTable.id, id));

  const [updated] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
  res.json({
    ...updated,
    budget: updated.budget != null ? parseFloat(String(updated.budget)) : null,
    spend: updated.spend != null ? parseFloat(String(updated.spend)) : null,
    sent,
  });
});

router.get("/campaigns/:id/recipients", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid campaign id" }); return; }

  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }

  const { statuses } = req.query;
  const statusList = typeof statuses === "string" ? statuses.split(",") : ["new", "contacted", "qualified"];
  const validStatuses = statusList.filter(s => ["new", "contacted", "qualified", "converted", "lost"].includes(s));

  const leads = await db.select({ email: leadsTable.email, name: leadsTable.name }).from(leadsTable)
    .where(and(eq(leadsTable.websiteId, campaign.websiteId), inArray(leadsTable.status, validStatuses)));

  const count = leads.filter(l => l.email && l.email.includes("@")).length;
  res.json({ count, total: leads.length });
});

export default router;
