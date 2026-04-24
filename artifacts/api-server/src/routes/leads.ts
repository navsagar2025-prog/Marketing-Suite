import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, leadsTable } from "@workspace/db";
import { calculateLeadScore, DEFAULT_SCORING_WEIGHTS, type LeadScoringWeights } from "../lib/lead-scoring.js";
import { getDbSetting } from "../lib/ai-provider.js";
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

async function getScoringWeights(): Promise<LeadScoringWeights> {
  try {
    const raw = await getDbSetting("lead_scoring_config");
    if (raw) return { ...DEFAULT_SCORING_WEIGHTS, ...JSON.parse(raw) };
  } catch {
  }
  return DEFAULT_SCORING_WEIGHTS;
}

function mapLead(l: typeof leadsTable.$inferSelect) {
  return {
    ...l,
    value: l.value != null ? parseFloat(String(l.value)) : null,
    score: l.score ?? null,
    scoreBreakdown: (l.scoreBreakdown as object | null) ?? null,
  };
}

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
  res.json(ListLeadsResponse.parse(leads.map(mapLead)));
});

router.post("/leads", async (req, res): Promise<void> => {
  const parsed = CreateLeadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const weights = await getScoringWeights();
  const { score, breakdown } = calculateLeadScore(
    { source: parsed.data.source ?? "organic", status: parsed.data.status ?? "new", value: parsed.data.value, createdAt: new Date() },
    weights
  );
  const [lead] = await db.insert(leadsTable).values({ ...parsed.data, score, scoreBreakdown: breakdown }).returning();
  res.status(201).json(mapLead(lead));
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
  const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  const merged = { ...existing, ...parsed.data };
  const weights = await getScoringWeights();
  const { score, breakdown } = calculateLeadScore(
    { source: merged.source, status: merged.status, value: merged.value, createdAt: merged.createdAt },
    weights
  );
  const [lead] = await db.update(leadsTable)
    .set({ ...parsed.data, score, scoreBreakdown: breakdown })
    .where(eq(leadsTable.id, params.data.id))
    .returning();
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  res.json(UpdateLeadResponse.parse(mapLead(lead)));
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
