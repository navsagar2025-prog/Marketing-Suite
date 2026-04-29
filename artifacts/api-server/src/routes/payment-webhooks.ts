import { Router, type IRouter, type Request, type Response } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@workspace/db";
import { webhookEventsTable, appSettingsTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { decryptSecret } from "../lib/email-sender.js";
import { requireAdmin } from "../lib/auth.js";

const router: IRouter = Router();

async function getEncryptedSetting(key: string): Promise<string | null> {
  try {
    const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, key));
    if (!row?.value) return null;
    return decryptSecret(row.value);
  } catch {
    return null;
  }
}

async function logWebhookEvent(opts: {
  provider: string;
  eventType: string;
  eventId?: string | null;
  status: string;
  payload?: unknown;
  error?: string | null;
}): Promise<void> {
  try {
    await db.insert(webhookEventsTable).values({
      provider: opts.provider,
      eventType: opts.eventType,
      eventId: opts.eventId ?? null,
      status: opts.status,
      payload: opts.payload ?? null,
      error: opts.error ?? null,
    });
  } catch (err) {
    console.error("[payment-webhooks] Failed to log webhook event:", err instanceof Error ? err.message : err);
  }
}

/**
 * Verify Stripe webhook signature per https://stripe.com/docs/webhooks/signatures
 * The stripe-signature header format: t=<timestamp>,v1=<sig1>,v1=<sig2>,...
 * Signed payload: "<timestamp>.<rawBody>"
 */
function verifyStripeSignature(rawBody: Buffer, signatureHeader: string, secret: string): { valid: boolean; timestamp: number; eventType?: string; eventId?: string } {
  const parts: Record<string, string[]> = {};
  for (const part of signatureHeader.split(",")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx);
    const val = part.slice(idx + 1);
    if (!parts[key]) parts[key] = [];
    parts[key].push(val);
  }
  const timestamp = parseInt(parts["t"]?.[0] ?? "", 10);
  if (isNaN(timestamp)) return { valid: false, timestamp: 0 };

  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - timestamp) > 300) return { valid: false, timestamp };

  const signedPayload = `${timestamp}.${rawBody.toString("utf8")}`;
  const expected = createHmac("sha256", secret).update(signedPayload).digest("hex");
  const signatures = parts["v1"] ?? [];
  const valid = signatures.some(sig => {
    try {
      const eBuf = Buffer.from(expected, "hex");
      const sBuf = Buffer.from(sig, "hex");
      if (eBuf.length !== sBuf.length) return false;
      return timingSafeEqual(eBuf, sBuf);
    } catch {
      return false;
    }
  });
  return { valid, timestamp };
}

/**
 * Stripe webhook endpoint.
 * Verifies the stripe-signature header using HMAC-SHA256 with the stored stripe_webhook_secret.
 * POST /api/webhooks/stripe
 */
router.post("/webhooks/stripe", async (req: Request, res: Response): Promise<void> => {
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  const signatureHeader = String(req.headers["stripe-signature"] ?? "");

  if (!rawBody) {
    res.status(400).json({ error: "Missing request body." });
    return;
  }
  if (!signatureHeader) {
    res.status(401).json({ error: "Missing stripe-signature header." });
    return;
  }

  const webhookSecret = await getEncryptedSetting("stripe_webhook_secret");
  if (!webhookSecret) {
    console.warn("[payment-webhooks] Stripe webhook received but stripe_webhook_secret is not configured.");
    res.status(401).json({ error: "Stripe webhook secret is not configured. Set it in Settings → Payment." });
    return;
  }

  const { valid } = verifyStripeSignature(rawBody, signatureHeader, webhookSecret);
  if (!valid) {
    console.error("[payment-webhooks] Stripe signature verification failed.");
    await logWebhookEvent({
      provider: "stripe",
      eventType: "unknown",
      status: "failed",
      error: "Signature verification failed or timestamp too old.",
    });
    res.status(401).json({ error: "Invalid Stripe webhook signature." });
    return;
  }

  res.sendStatus(200);

  let body: Record<string, unknown> = {};
  try {
    body = (typeof req.body === "object" && req.body !== null) ? req.body as Record<string, unknown> : {};
  } catch { /* ignore */ }

  const eventType = String(body.type ?? "unknown");
  const eventId = String(body.id ?? "");

  await logWebhookEvent({
    provider: "stripe",
    eventType,
    eventId: eventId || null,
    status: "received",
    payload: { type: eventType, id: eventId, created: body.created },
  });

  console.info(`[payment-webhooks] Stripe event received: ${eventType} (${eventId})`);
});

function timingSafeStringEqual(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a, "utf8");
    const bBuf = Buffer.from(b, "utf8");
    if (aBuf.length !== bBuf.length) return false;
    return timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

/**
 * Razorpay webhook endpoint.
 * Verifies the x-razorpay-signature header using HMAC-SHA256 of the raw body
 * with the stored razorpay_key_secret.
 * POST /api/webhooks/razorpay
 */
router.post("/webhooks/razorpay", async (req: Request, res: Response): Promise<void> => {
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  const signature = String(req.headers["x-razorpay-signature"] ?? "");

  if (!rawBody) {
    res.status(400).json({ error: "Missing request body." });
    return;
  }
  if (!signature) {
    res.status(401).json({ error: "Missing x-razorpay-signature header." });
    return;
  }

  const keySecret = await getEncryptedSetting("razorpay_key_secret");
  if (!keySecret) {
    console.warn("[payment-webhooks] Razorpay webhook received but razorpay_key_secret is not configured.");
    res.status(401).json({ error: "Razorpay key secret is not configured. Set it in Settings → Payment." });
    return;
  }

  const expected = createHmac("sha256", keySecret).update(rawBody).digest("hex");
  if (!timingSafeStringEqual(expected, signature)) {
    console.error("[payment-webhooks] Razorpay signature verification failed.");
    await logWebhookEvent({
      provider: "razorpay",
      eventType: "unknown",
      status: "failed",
      error: "Signature verification failed.",
    });
    res.status(401).json({ error: "Invalid Razorpay webhook signature." });
    return;
  }

  res.sendStatus(200);

  const body = req.body as Record<string, unknown>;
  const eventType = String(body.event ?? "unknown");
  const eventId = body.payload
    ? String((body.payload as Record<string, unknown>)?.payment?.entity?.id ?? "")
    : undefined;

  await logWebhookEvent({
    provider: "razorpay",
    eventType,
    eventId: eventId || null,
    status: "received",
    payload: { event: eventType, account_id: body.account_id },
  });

  console.info(`[payment-webhooks] Razorpay event received: ${eventType}`);
});

/**
 * GET /api/settings/payment/webhook-events
 * Returns the last 100 webhook events for admin review (admin only).
 */
router.get("/settings/payment/webhook-events", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const events = await db
    .select()
    .from(webhookEventsTable)
    .orderBy(desc(webhookEventsTable.receivedAt))
    .limit(100);
  res.json(events);
});

export default router;
