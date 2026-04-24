import { Router, type IRouter } from "express";
import { db, leadsTable, websitesTable, ipRateLimitsTable } from "@workspace/db";
import { asc, and, eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACT_DAILY_LIMIT = 5;

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

router.post("/contact/public", async (req, res): Promise<void> => {
  const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";
  const today = getTodayDate();

  const [rateRecord] = await db
    .select()
    .from(ipRateLimitsTable)
    .where(and(
      eq(ipRateLimitsTable.ip, ip),
      eq(ipRateLimitsTable.feature, "public_contact"),
      eq(ipRateLimitsTable.date, today),
    ));

  if (rateRecord && rateRecord.count >= CONTACT_DAILY_LIMIT) {
    res.status(429).json({ error: "Too many contact requests. Please try again tomorrow." });
    return;
  }

  const body = req.body as { name?: unknown; email?: unknown; message?: unknown };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!name || name.length > 200) {
    res.status(400).json({ error: "Please provide your name." });
    return;
  }
  if (!email || !EMAIL_RE.test(email) || email.length > 300) {
    res.status(400).json({ error: "Please provide a valid email address." });
    return;
  }
  if (message.length > 2000) {
    res.status(400).json({ error: "Message is too long." });
    return;
  }

  const [firstWebsite] = await db
    .select({ id: websitesTable.id })
    .from(websitesTable)
    .orderBy(asc(websitesTable.id))
    .limit(1);

  if (!firstWebsite) {
    logger.warn({ name, email }, "public_contact: no website found — lead not persisted");
  } else {
    await db.insert(leadsTable).values({
      websiteId: firstWebsite.id,
      name,
      email,
      source: "rate-limit-contact",
      status: "new",
      notes: message ? `Message: ${message}` : undefined,
    });
  }

  if (rateRecord) {
    await db
      .update(ipRateLimitsTable)
      .set({ count: rateRecord.count + 1, lastRequestAt: new Date() })
      .where(eq(ipRateLimitsTable.id, rateRecord.id));
  } else {
    await db.insert(ipRateLimitsTable).values({
      ip,
      feature: "public_contact",
      url: "",
      date: today,
      count: 1,
      lastRequestAt: new Date(),
    });
  }

  res.status(201).json({ ok: true });
});

export default router;
