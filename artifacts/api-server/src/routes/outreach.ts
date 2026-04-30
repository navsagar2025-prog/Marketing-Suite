import { Router, type IRouter } from "express";
import { and, count, eq, lte, sql } from "drizzle-orm";
import { db, outreachContactsTable, OUTREACH_TYPES, OUTREACH_STATUSES } from "@workspace/db";

const router: IRouter = Router();

function today(): string {
  return new Date().toISOString().split("T")[0]!;
}

function validateBody(body: Record<string, unknown>, requireName = true): { data: Record<string, unknown>; error?: string } {
  const data: Record<string, unknown> = {};

  if (requireName || body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return { data, error: "name is required and must be a non-empty string" };
    }
    data.name = body.name.trim();
  }

  if (requireName || body.domain !== undefined) {
    if (typeof body.domain !== "string" || !body.domain.trim()) {
      return { data, error: "domain is required and must be a non-empty string" };
    }
    data.domain = body.domain.trim();
  }

  if (body.email !== undefined) {
    if (body.email !== null && typeof body.email !== "string") {
      return { data, error: "email must be a string or null" };
    }
    data.email = body.email || null;
  }

  if (body.type !== undefined) {
    if (!OUTREACH_TYPES.includes(body.type as (typeof OUTREACH_TYPES)[number])) {
      return { data, error: `type must be one of: ${OUTREACH_TYPES.join(", ")}` };
    }
    data.type = body.type;
  }

  if (body.status !== undefined) {
    if (!OUTREACH_STATUSES.includes(body.status as (typeof OUTREACH_STATUSES)[number])) {
      return { data, error: `status must be one of: ${OUTREACH_STATUSES.join(", ")}` };
    }
    data.status = body.status;
  }

  if (body.dateSent !== undefined) {
    if (body.dateSent !== null && typeof body.dateSent !== "string") {
      return { data, error: "dateSent must be a date string (YYYY-MM-DD) or null" };
    }
    data.dateSent = body.dateSent || null;
  }

  if (body.followUpDate !== undefined) {
    if (body.followUpDate !== null && typeof body.followUpDate !== "string") {
      return { data, error: "followUpDate must be a date string (YYYY-MM-DD) or null" };
    }
    data.followUpDate = body.followUpDate || null;
  }

  if (body.notes !== undefined) {
    if (body.notes !== null && typeof body.notes !== "string") {
      return { data, error: "notes must be a string or null" };
    }
    data.notes = body.notes || null;
  }

  return { data };
}

// GET /outreach — list with optional filters
router.get("/outreach", async (req, res): Promise<void> => {
  const { status, followup_due } = req.query as { status?: string; followup_due?: string };

  const conditions = [];
  if (status && OUTREACH_STATUSES.includes(status as (typeof OUTREACH_STATUSES)[number])) {
    conditions.push(eq(outreachContactsTable.status, status));
  }
  if (followup_due === "1" || followup_due === "true") {
    conditions.push(
      and(
        lte(outreachContactsTable.followUpDate, today()),
        eq(outreachContactsTable.status, "sent")
      )!
    );
  }

  const rows = await db
    .select()
    .from(outreachContactsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${outreachContactsTable.createdAt} desc`);

  res.json(rows);
});

// GET /outreach/stats — summary counts (single query aggregated in JS)
router.get("/outreach/stats", async (_req, res): Promise<void> => {
  const todayStr = today();
  const rows = await db
    .select({ status: outreachContactsTable.status, followUpDate: outreachContactsTable.followUpDate })
    .from(outreachContactsTable);

  let totalCount = 0;
  let wonCount = 0;
  let repliedCount = 0;
  let rejectedCount = 0;
  let notSentCount = 0;
  let followupsDue = 0;

  for (const row of rows) {
    totalCount++;
    if (row.status === "won") wonCount++;
    if (row.status === "replied") repliedCount++;
    if (row.status === "rejected") rejectedCount++;
    if (row.status === "not_sent") notSentCount++;
    if (row.status === "sent" && row.followUpDate != null && row.followUpDate <= todayStr) followupsDue++;
  }

  const contacted = totalCount - notSentCount;
  const replyRate = contacted > 0 ? Math.round(((repliedCount + wonCount + rejectedCount) / contacted) * 100) : 0;

  res.json({ total: totalCount, won: wonCount, replied: repliedCount, replyRate, followupsDue });
});

// POST /outreach
router.post("/outreach", async (req, res): Promise<void> => {
  const { data, error } = validateBody(req.body as Record<string, unknown>, true);
  if (error) {
    res.status(400).json({ error });
    return;
  }

  const [created] = await db
    .insert(outreachContactsTable)
    .values({
      name: data.name as string,
      domain: data.domain as string,
      email: (data.email as string) ?? null,
      type: (data.type as string) ?? "link_request",
      status: (data.status as string) ?? "not_sent",
      dateSent: (data.dateSent as string) ?? null,
      followUpDate: (data.followUpDate as string) ?? null,
      notes: (data.notes as string) ?? null,
    })
    .returning();

  res.status(201).json(created);
});

// PATCH /outreach/:id
router.patch("/outreach/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const { data, error } = validateBody(req.body as Record<string, unknown>, false);
  if (error) {
    res.status(400).json({ error });
    return;
  }

  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  const [updated] = await db
    .update(outreachContactsTable)
    .set(data)
    .where(eq(outreachContactsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }

  res.json(updated);
});

// DELETE /outreach/:id
router.delete("/outreach/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [deleted] = await db
    .delete(outreachContactsTable)
    .where(eq(outreachContactsTable.id, id))
    .returning({ id: outreachContactsTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }

  res.json({ success: true });
});

export default router;
