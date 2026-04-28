import { Router, type IRouter } from "express";
import { eq, and, or, lte, gte, inArray, isNull } from "drizzle-orm";
import { db, sequencesTable, sequenceEnrollmentsTable, leadsTable } from "@workspace/db";
import { logger } from "../lib/logger.js";
import { getEmailProviderConfig, sendEmails } from "../lib/email-sender.js";
import { requireAdmin } from "../lib/auth.js";
import { CreateSequenceBody, UpdateSequenceBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/sequences", async (req, res): Promise<void> => {
  const sequences = await db.select().from(sequencesTable).orderBy(sequencesTable.createdAt);
  res.json(sequences);
});

router.post("/sequences", async (req, res): Promise<void> => {
  const parsed = CreateSequenceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid request" });
    return;
  }
  const { name, trigger, stepsJson, active } = parsed.data;
  const [seq] = await db.insert(sequencesTable).values({
    name: name.trim(),
    trigger,
    stepsJson: stepsJson ?? [],
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
  const parsed = UpdateSequenceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid request" });
    return;
  }
  const { name, trigger, stepsJson, active } = parsed.data;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name.trim();
  if (trigger !== undefined) updates.trigger = trigger;
  if (stepsJson !== undefined) updates.stepsJson = stepsJson;
  if (active !== undefined) updates.active = active;
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

      // Email-only: leads without a valid email are skipped.
      const leadsWithEmail = matchingLeads.filter(l => l.email && l.email.includes("@"));

      // One-time enrollment per sequence/lead (includes completed enrollments).
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

      // No exit logic: enrolled leads complete the full sequence regardless of trigger changes.
      const now = new Date();
      const dueEnrollments = await db
        .select()
        .from(sequenceEnrollmentsTable)
        .where(
          and(
            eq(sequenceEnrollmentsTable.sequenceId, seq.id),
            or(
              lte(sequenceEnrollmentsTable.nextSendAt, now),
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
