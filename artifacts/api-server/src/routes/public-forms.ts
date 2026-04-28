import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, leadFormsTable, leadsTable, ipRateLimitsTable } from "@workspace/db";
import type { LeadFormField } from "@workspace/db";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FORM_DAILY_LIMIT = 10;

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

router.post("/public/forms/:formId/submit", async (req, res): Promise<void> => {
  const formId = parseInt(req.params.formId, 10);
  if (isNaN(formId)) { res.status(400).json({ error: "Invalid form" }); return; }

  const [form] = await db.select().from(leadFormsTable).where(eq(leadFormsTable.id, formId));
  if (!form || !form.active) { res.status(404).json({ error: "Form not found" }); return; }

  const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";
  const today = getTodayDate();
  const feature = `lead_form_${formId}`;

  const [rateRecord] = await db.select().from(ipRateLimitsTable).where(
    and(
      eq(ipRateLimitsTable.ip, ip),
      eq(ipRateLimitsTable.feature, feature),
      eq(ipRateLimitsTable.date, today),
    )
  );
  if (rateRecord && rateRecord.count >= FORM_DAILY_LIMIT) {
    res.status(429).json({ error: "Too many submissions. Please try again tomorrow." });
    return;
  }

  const body = req.body as Record<string, unknown>;

  if (typeof body._hp === "string" && body._hp.length > 0) {
    res.status(201).json({ ok: true });
    return;
  }

  const fields = (form.fieldsJson ?? []) as LeadFormField[];
  const enabledFields = fields.filter(f => f.enabled);

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  for (const field of enabledFields) {
    if (!field.required) continue;
    switch (field.name) {
      case "name":
        if (!name || name.length > 200) {
          res.status(400).json({ error: "Please provide your name." }); return;
        }
        break;
      case "email":
        if (!email || !EMAIL_RE.test(email) || email.length > 300) {
          res.status(400).json({ error: "Please provide a valid email address." }); return;
        }
        break;
      case "phone":
        if (!phone) {
          res.status(400).json({ error: "Please provide your phone number." }); return;
        }
        break;
      case "message":
        if (!message) {
          res.status(400).json({ error: "Please provide a message." }); return;
        }
        break;
    }
  }
  if (email && !EMAIL_RE.test(email)) {
    res.status(400).json({ error: "Please provide a valid email address." }); return;
  }
  if (message.length > 2000) {
    res.status(400).json({ error: "Message is too long." }); return;
  }

  const leadName = name || email || "Anonymous";

  try {
    await db.insert(leadsTable).values({
      websiteId: form.websiteId,
      name: leadName,
      email: email || null,
      phone: phone || null,
      source: "referral",
      status: "new",
      notes: message ? `[Form] ${message}` : "[Form]",
    });

    await db.update(leadFormsTable)
      .set({ submissionCount: sql`${leadFormsTable.submissionCount} + 1` })
      .where(eq(leadFormsTable.id, formId));

    logger.info({ formId, leadName }, "lead_form: submission created");
  } catch (err) {
    logger.error({ err, formId }, "lead_form: failed to create lead");
    res.status(500).json({ error: "Failed to save submission. Please try again." });
    return;
  }

  if (rateRecord) {
    await db.update(ipRateLimitsTable)
      .set({ count: rateRecord.count + 1, lastRequestAt: new Date() })
      .where(eq(ipRateLimitsTable.id, rateRecord.id));
  } else {
    await db.insert(ipRateLimitsTable).values({
      ip,
      feature,
      url: `/public/forms/${formId}/submit`,
      date: today,
      count: 1,
      lastRequestAt: new Date(),
    });
  }

  res.status(201).json({ ok: true });
});

export default router;
