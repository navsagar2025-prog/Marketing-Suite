import { Router, type IRouter } from "express";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
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

router.get("/leads/export.csv", async (req, res): Promise<void> => {
  const { status, from, to } = req.query as { status?: string; from?: string; to?: string };

  const conditions = [];

  if (status) {
    const statuses = status.split(",").map(s => s.trim()).filter(Boolean);
    if (statuses.length === 1) {
      conditions.push(eq(leadsTable.status, statuses[0]));
    } else if (statuses.length > 1) {
      conditions.push(inArray(leadsTable.status, statuses));
    }
  }

  if (from) {
    const fromDate = new Date(from);
    if (!isNaN(fromDate.getTime())) {
      fromDate.setHours(0, 0, 0, 0);
      conditions.push(gte(leadsTable.createdAt, fromDate));
    }
  }

  if (to) {
    const toDate = new Date(to);
    if (!isNaN(toDate.getTime())) {
      toDate.setHours(23, 59, 59, 999);
      conditions.push(lte(leadsTable.createdAt, toDate));
    }
  }

  function escapeCsv(val: string | null | undefined): string {
    if (val == null) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  // Notes summary: single text field in the schema — emit "1 note" if set, "" if empty.
  // (Schema does not support a multi-entry notes log; company field also absent from schema.)
  function notesSummary(notes: string | null | undefined): string {
    if (!notes || !notes.trim()) return "";
    return "1 note";
  }

  const filename = `leads-export-${new Date().toISOString().split("T")[0]}.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Transfer-Encoding", "chunked");

  // Company column required by spec — field not in the data model so emitted empty.
  const headers = ["Name", "Email", "Phone", "Company", "Source", "Status", "Score", "Value", "Notes", "Created Date", "Last Updated"];
  res.write(headers.join(",") + "\n");

  // Batch-fetch in pages of 500 so we never hold the full table in memory,
  // satisfying the "large exports without timing out (streamed response)" requirement.
  const BATCH = 500;
  let batchOffset = 0;
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  while (true) {
    const batch = await db
      .select()
      .from(leadsTable)
      .where(where)
      .orderBy(leadsTable.id)
      .limit(BATCH)
      .offset(batchOffset);

    for (const l of batch) {
      const row = [
        escapeCsv(l.name),
        escapeCsv(l.email),
        escapeCsv(l.phone),
        "",                       // company — not in schema
        l.source,
        l.status,
        l.score ?? "",
        l.value != null ? parseFloat(String(l.value)).toFixed(2) : "",
        notesSummary(l.notes),
        new Date(l.createdAt).toISOString().split("T")[0],
        new Date(l.updatedAt).toISOString().split("T")[0],
      ];
      res.write(row.join(",") + "\n");
    }

    if (batch.length < BATCH) break;
    batchOffset += BATCH;
  }

  res.end();
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
