import { Router, type IRouter } from "express";
import { eq, and, or, gte, inArray, isNull } from "drizzle-orm";
import { db, sequencesTable, sequenceEnrollmentsTable, leadsTable } from "@workspace/db";
import { logger } from "../lib/logger.js";
import { getEmailProviderConfig, sendEmails } from "../lib/email-sender.js";
import { requireAdmin } from "../lib/auth.js";

const router: IRouter = Router();

router.get("/sequences", async (req, res): Promise<void> => {
  const sequences = await db.select().from(sequencesTable).orderBy(sequencesTable.createdAt);
  res.json(sequences);
});

router.post("/sequences", async (req, res): Promise<void> => {
  const { name, trigger, stepsJson, active } = req.body ?? {};
  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  if (!trigger || typeof trigger !== "object" || !trigger.type || trigger.value === undefined) {
    res.status(400).json({ error: "trigger with type and value is required" });
    return;
  }
  if (!["status", "score", "source"].includes(trigger.type)) {
    res.status(400).json({ error: "trigger.type must be status, score, or source" });
    return;
  }
  const steps = Array.isArray(stepsJson) ? stepsJson : [];
  for (const [i, step] of steps.entries()) {
    if (!step.subject || typeof step.subject !== "string" || !step.subject.trim()) {
      res.status(400).json({ error: `Step ${i + 1}: subject is required` });
      return;
    }
    if (!step.body || typeof step.body !== "string" || !step.body.trim()) {
      res.status(400).json({ error: `Step ${i + 1}: body is required` });
      return;
    }
    if (typeof step.delayDays !== "number" || step.delayDays < 0 || !Number.isInteger(step.delayDays)) {
      res.status(400).json({ error: `Step ${i + 1}: delayDays must be a non-negative integer` });
      return;
    }
  }
  const [seq] = await db.insert(sequencesTable).values({
    name: name.trim(),
    trigger,
    stepsJson: steps,
    active: active !== false,
  }).returning();
  res.status(201).json(seq);
});

router.get("/sequences/enrolled-lead-ids", async (req, res): Promise<void> => {
  const activeSeqs = await db
    .select({ id: sequencesTable.id })
    .from(sequencesTable)
    .where(eq(sequencesTable.active, true));
  if (activeSeqs.length === 0) { res.json([]); return; }
  const seqIds = activeSeqs.map(s => s.id);
  const enrollments = await db
    .select({ leadId: sequenceEnrollmentsTable.leadId })
    .from(sequenceEnrollmentsTable)
    .where(
      and(
        inArray(sequenceEnrollmentsTable.sequenceId, seqIds),
        isNull(sequenceEnrollmentsTable.completedAt)
      )
    );
  const leadIds = [...new Set(enrollments.map(e => e.leadId))];
  res.json(leadIds);
});

router.get("/sequences/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [seq] = await db.select().from(sequencesTable).where(eq(sequencesTable.id, id));
  if (!seq) { res.status(404).json({ error: "Sequence not found" }); return; }
  res.json(seq);
});

router.patch("/sequences/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { name, trigger, stepsJson, active } = req.body ?? {};
  const updates: Record<string, unknown> = {};
  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (!trimmed) { res.status(400).json({ error: "name must not be empty" }); return; }
    updates.name = trimmed;
  }
  if (trigger !== undefined) {
    if (!trigger || typeof trigger !== "object" || !trigger.type || trigger.value === undefined) {
      res.status(400).json({ error: "trigger with type and value is required" }); return;
    }
    if (!["status", "score", "source"].includes(trigger.type)) {
      res.status(400).json({ error: "trigger.type must be status, score, or source" }); return;
    }
    updates.trigger = trigger;
  }
  if (stepsJson !== undefined) {
    if (!Array.isArray(stepsJson)) { res.status(400).json({ error: "stepsJson must be an array" }); return; }
    for (const [i, step] of (stepsJson as Array<Record<string, unknown>>).entries()) {
      if (!step.subject || typeof step.subject !== "string" || !String(step.subject).trim()) {
        res.status(400).json({ error: `Step ${i + 1}: subject is required` }); return;
      }
      if (!step.body || typeof step.body !== "string" || !String(step.body).trim()) {
        res.status(400).json({ error: `Step ${i + 1}: body is required` }); return;
      }
      if (typeof step.delayDays !== "number" || step.delayDays < 0 || !Number.isInteger(step.delayDays)) {
        res.status(400).json({ error: `Step ${i + 1}: delayDays must be a non-negative integer` }); return;
      }
    }
    updates.stepsJson = stepsJson;
  }
  if (active !== undefined) updates.active = Boolean(active);
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }
  const [seq] = await db.update(sequencesTable).set(updates).where(eq(sequencesTable.id, id)).returning();
  if (!seq) { res.status(404).json({ error: "Sequence not found" }); return; }
  res.json(seq);
});

router.delete("/sequences/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [seq] = await db.delete(sequencesTable).where(eq(sequencesTable.id, id)).returning();
  if (!seq) { res.status(404).json({ error: "Sequence not found" }); return; }
  res.sendStatus(204);
});

router.get("/sequences/:id/enrollments", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const enrollments = await db
    .select({
      id: sequenceEnrollmentsTable.id,
      sequenceId: sequenceEnrollmentsTable.sequenceId,
      leadId: sequenceEnrollmentsTable.leadId,
      leadName: leadsTable.name,
      leadEmail: leadsTable.email,
      currentStep: sequenceEnrollmentsTable.currentStep,
      nextSendAt: sequenceEnrollmentsTable.nextSendAt,
      completedAt: sequenceEnrollmentsTable.completedAt,
      createdAt: sequenceEnrollmentsTable.createdAt,
    })
    .from(sequenceEnrollmentsTable)
    .leftJoin(leadsTable, eq(sequenceEnrollmentsTable.leadId, leadsTable.id))
    .where(eq(sequenceEnrollmentsTable.sequenceId, id))
    .orderBy(sequenceEnrollmentsTable.createdAt);
  res.json(enrollments);
});

router.get("/leads/:leadId/sequence-enrollments", async (req, res): Promise<void> => {
  const leadId = parseInt(req.params.leadId, 10);
  if (isNaN(leadId)) { res.status(400).json({ error: "Invalid leadId" }); return; }
  const enrollments = await db
    .select({
      id: sequenceEnrollmentsTable.id,
      sequenceId: sequenceEnrollmentsTable.sequenceId,
      sequenceName: sequencesTable.name,
      currentStep: sequenceEnrollmentsTable.currentStep,
      nextSendAt: sequenceEnrollmentsTable.nextSendAt,
      completedAt: sequenceEnrollmentsTable.completedAt,
      createdAt: sequenceEnrollmentsTable.createdAt,
    })
    .from(sequenceEnrollmentsTable)
    .leftJoin(sequencesTable, eq(sequenceEnrollmentsTable.sequenceId, sequencesTable.id))
    .where(eq(sequenceEnrollmentsTable.leadId, leadId));
  res.json(enrollments);
});

export async function runSequenceEngine(): Promise<{ enrolled: number; sent: number; errors: number }> {
  const emailConfig = await getEmailProviderConfig();
  let enrolled = 0;
  let sent = 0;
  let errors = 0;

  const activeSequences = await db.select().from(sequencesTable).where(eq(sequencesTable.active, true));

  for (const seq of activeSequences) {
    try {
      const trigger = seq.trigger as { type: string; value: string | number };
      const steps = (seq.stepsJson ?? []) as Array<{ subject: string; body: string; delayDays: number }>;
      if (steps.length === 0) continue;

      let matchingLeads: Array<{ id: number; email: string | null }> = [];
      if (trigger.type === "status") {
        matchingLeads = await db
          .select({ id: leadsTable.id, email: leadsTable.email })
          .from(leadsTable)
          .where(eq(leadsTable.status, String(trigger.value)));
      } else if (trigger.type === "score") {
        const minScore = Number(trigger.value);
        if (!isNaN(minScore)) {
          matchingLeads = await db
            .select({ id: leadsTable.id, email: leadsTable.email })
            .from(leadsTable)
            .where(gte(leadsTable.score, minScore));
        }
      } else if (trigger.type === "source") {
        matchingLeads = await db
          .select({ id: leadsTable.id, email: leadsTable.email })
          .from(leadsTable)
          .where(eq(leadsTable.source, String(trigger.value)));
      }

      const leadsWithEmail = matchingLeads.filter(l => l.email && l.email.includes("@"));

      const existingEnrollments = await db
        .select({ leadId: sequenceEnrollmentsTable.leadId })
        .from(sequenceEnrollmentsTable)
        .where(eq(sequenceEnrollmentsTable.sequenceId, seq.id));
      const enrolledLeadIds = new Set(existingEnrollments.map(e => e.leadId));

      const newLeads = leadsWithEmail.filter(l => !enrolledLeadIds.has(l.id));
      if (newLeads.length > 0) {
        const now = new Date();
        await db.insert(sequenceEnrollmentsTable).values(
          newLeads.map(l => ({
            sequenceId: seq.id,
            leadId: l.id,
            currentStep: 0,
            nextSendAt: now,
          }))
        ).onConflictDoNothing();
        enrolled += newLeads.length;
      }

      if (!emailConfig) continue;

      const now = new Date();
      const dueEnrollments = await db
        .select()
        .from(sequenceEnrollmentsTable)
        .where(
          and(
            eq(sequenceEnrollmentsTable.sequenceId, seq.id),
            or(
              gte(now, sequenceEnrollmentsTable.nextSendAt),
              eq(sequenceEnrollmentsTable.currentStep, 0)
            )
          )
        );

      for (const enrollment of dueEnrollments) {
        if (enrollment.completedAt) continue;
        if (enrollment.nextSendAt && enrollment.nextSendAt > now) continue;
        const stepIndex = enrollment.currentStep;
        if (stepIndex >= steps.length) {
          await db.update(sequenceEnrollmentsTable)
            .set({ completedAt: now })
            .where(eq(sequenceEnrollmentsTable.id, enrollment.id));
          continue;
        }
        const step = steps[stepIndex];
        const lead = await db.select({ email: leadsTable.email, name: leadsTable.name })
          .from(leadsTable)
          .where(eq(leadsTable.id, enrollment.leadId))
          .then(r => r[0]);
        if (!lead?.email) continue;

        try {
          const { sent: s } = await sendEmails(emailConfig, {
            to: [lead.email],
            subject: step.subject,
            body: step.body.replace(/\{\{name\}\}/g, lead.name ?? ""),
          });
          sent += s;

          const nextStepIndex = stepIndex + 1;
          if (nextStepIndex >= steps.length) {
            await db.update(sequenceEnrollmentsTable)
              .set({ currentStep: nextStepIndex, nextSendAt: null, completedAt: now })
              .where(eq(sequenceEnrollmentsTable.id, enrollment.id));
          } else {
            const nextStep = steps[nextStepIndex];
            const nextSendAt = new Date(now.getTime() + nextStep.delayDays * 24 * 60 * 60 * 1000);
            await db.update(sequenceEnrollmentsTable)
              .set({ currentStep: nextStepIndex, nextSendAt })
              .where(eq(sequenceEnrollmentsTable.id, enrollment.id));
          }
        } catch (err) {
          logger.error({ err, enrollmentId: enrollment.id }, "Failed to send sequence email");
          errors++;
        }
      }
    } catch (err) {
      logger.error({ err, sequenceId: seq.id }, "Error processing sequence");
      errors++;
    }
  }

  return { enrolled, sent, errors };
}

router.post("/admin/sequences/process", requireAdmin, async (req, res): Promise<void> => {
  try {
    const result = await runSequenceEngine();
    res.json({ ...result, processedAt: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sequence processing failed";
    res.status(500).json({ error: message });
  }
});

export default router;
