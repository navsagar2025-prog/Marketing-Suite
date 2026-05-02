import { Router, type IRouter } from "express";
import { eq, and, gte, lte, inArray, desc, sql, count } from "drizzle-orm";
import { db, leadsTable, leadNotesTable } from "@workspace/db";
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
  ListLeadNotesParams,
  CreateLeadNoteParams,
  CreateLeadNoteBody,
  UpdateLeadNoteParams,
  UpdateLeadNoteBody,
  DeleteLeadNoteParams,
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

function escapeCsv(val: string | null | undefined): string {
  if (val == null) return "";
  let str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

router.get("/leads/export.csv", async (req, res): Promise<void> => {
  const { status, from, to } = req.query as { status?: string; from?: string; to?: string };
  const conditions = [];

  if (status) {
    const statuses = status.split(",").map(s => s.trim()).filter(Boolean);
    if (statuses.length === 1) conditions.push(eq(leadsTable.status, statuses[0]));
    else if (statuses.length > 1) conditions.push(inArray(leadsTable.status, statuses));
  }
  if (from) {
    const d = new Date(from);
    if (!isNaN(d.getTime())) { d.setHours(0, 0, 0, 0); conditions.push(gte(leadsTable.createdAt, d)); }
  }
  if (to) {
    const d = new Date(to);
    if (!isNaN(d.getTime())) { d.setHours(23, 59, 59, 999); conditions.push(lte(leadsTable.createdAt, d)); }
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const filename = `leads-export-${new Date().toISOString().split("T")[0]}.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const HEADERS = ["Name", "Email", "Phone", "Company", "Source", "Status", "Score", "Value", "Notes Count", "Created Date", "Last Updated"];
  res.write(HEADERS.join(",") + "\n");

  const BATCH = 500;
  let batchOffset = 0;

  while (true) {
    const batch = await db
      .select()
      .from(leadsTable)
      .where(where)
      .orderBy(leadsTable.id)
      .limit(BATCH)
      .offset(batchOffset);

    const batchIds = batch.map(l => l.id);
    const notesAgg = batchIds.length > 0
      ? await db
          .select({ leadId: leadNotesTable.leadId, cnt: count(leadNotesTable.id) })
          .from(leadNotesTable)
          .where(inArray(leadNotesTable.leadId, batchIds))
          .groupBy(leadNotesTable.leadId)
      : [];
    const noteCountMap = new Map(notesAgg.map(r => [r.leadId, r.cnt]));

    for (const l of batch) {
      const n = noteCountMap.get(l.id) ?? 0;
      const row = [
        escapeCsv(l.name),
        escapeCsv(l.email),
        escapeCsv(l.phone),
        escapeCsv(l.company),
        escapeCsv(l.source),
        escapeCsv(l.status),
        l.score ?? "",
        l.value != null ? parseFloat(String(l.value)).toFixed(2) : "",
        n > 0 ? `${n} note${n !== 1 ? "s" : ""}` : "",
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
  const { notes: _notes, ...leadData } = parsed.data;
  const [lead] = await db.insert(leadsTable).values({ ...leadData, score, scoreBreakdown: breakdown }).returning();
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
  const { notes: _notes2, ...updateData } = parsed.data;
  const [lead] = await db.update(leadsTable)
    .set({ ...updateData, score, scoreBreakdown: breakdown })
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

// ─── Lead Notes ───────────────────────────────────────────────────────────────

router.get("/leads/:leadId/notes", async (req, res): Promise<void> => {
  const params = ListLeadNotesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, params.data.leadId));
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  const notes = await db
    .select()
    .from(leadNotesTable)
    .where(eq(leadNotesTable.leadId, params.data.leadId))
    .orderBy(desc(leadNotesTable.pinned), desc(leadNotesTable.createdAt));
  res.json(notes);
});

router.post("/leads/:leadId/notes", async (req, res): Promise<void> => {
  const params = CreateLeadNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateLeadNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, params.data.leadId));
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  const authorName = req.user?.username ?? "Admin";
  const staffUserId = req.user?.id ?? null;
  const [note] = await db.insert(leadNotesTable).values({
    leadId: params.data.leadId,
    body: parsed.data.body,
    authorName,
    staffUserId,
  }).returning();
  res.status(201).json(note);
});

router.patch("/leads/:leadId/notes/:noteId", async (req, res): Promise<void> => {
  const params = UpdateLeadNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateLeadNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(leadNotesTable)
    .where(and(eq(leadNotesTable.id, params.data.noteId), eq(leadNotesTable.leadId, params.data.leadId)));
  if (!existing) {
    res.status(404).json({ error: "Note not found" });
    return;
  }
  const [note] = await db
    .update(leadNotesTable)
    .set({ pinned: parsed.data.pinned })
    .where(eq(leadNotesTable.id, params.data.noteId))
    .returning();
  res.json(note);
});

router.delete("/leads/:leadId/notes/:noteId", async (req, res): Promise<void> => {
  const params = DeleteLeadNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(leadNotesTable)
    .where(and(eq(leadNotesTable.id, params.data.noteId), eq(leadNotesTable.leadId, params.data.leadId)));
  if (!existing) {
    res.status(404).json({ error: "Note not found" });
    return;
  }
  const isAuthor = req.user?.id != null && existing.staffUserId === req.user.id;
  const isAdmin = req.user?.role === "admin";
  if (!isAuthor && !isAdmin) {
    res.status(403).json({ error: "Only the note author or an admin can delete this note" });
    return;
  }
  await db
    .delete(leadNotesTable)
    .where(eq(leadNotesTable.id, params.data.noteId));
  res.sendStatus(204);
});

export default router;
