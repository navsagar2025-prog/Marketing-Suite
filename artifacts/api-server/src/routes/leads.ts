import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, leadsTable } from "@workspace/db";
import {
  ListLeadsQueryParams,
  ListLeadsResponse,
  CreateLeadBody,
  UpdateLeadParams,
  UpdateLeadBody,
  UpdateLeadResponse,
  DeleteLeadParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/leads", async (req, res): Promise<void> => {
  const query = ListLeadsQueryParams.safeParse(req.query);
  let leads;
  if (query.success) {
    const conditions = [];
    if (query.data.websiteId) conditions.push(eq(leadsTable.websiteId, query.data.websiteId));
    if (query.data.campaignId) conditions.push(eq(leadsTable.campaignId, query.data.campaignId));
    if (query.data.status) conditions.push(eq(leadsTable.status, query.data.status));
    leads = conditions.length > 0
      ? await db.select().from(leadsTable).where(and(...conditions)).orderBy(leadsTable.createdAt)
      : await db.select().from(leadsTable).orderBy(leadsTable.createdAt);
  } else {
    leads = await db.select().from(leadsTable).orderBy(leadsTable.createdAt);
  }
  const mapped = leads.map(l => ({
    ...l,
    value: l.value != null ? parseFloat(String(l.value)) : null,
  }));
  res.json(ListLeadsResponse.parse(mapped));
});

router.post("/leads", async (req, res): Promise<void> => {
  const parsed = CreateLeadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [lead] = await db.insert(leadsTable).values(parsed.data).returning();
  res.status(201).json(lead);
});

router.patch("/leads/:id", async (req, res): Promise<void> => {
  const params = UpdateLeadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateLeadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [lead] = await db.update(leadsTable).set(parsed.data).where(eq(leadsTable.id, params.data.id)).returning();
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  res.json(UpdateLeadResponse.parse({
    ...lead,
    value: lead.value != null ? parseFloat(String(lead.value)) : null,
  }));
});

router.delete("/leads/:id", async (req, res): Promise<void> => {
  const params = DeleteLeadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [lead] = await db.delete(leadsTable).where(eq(leadsTable.id, params.data.id)).returning();
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
