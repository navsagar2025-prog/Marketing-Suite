import { Router, type IRouter, type Request, type Response } from "express";
import { createHmac, createVerify, timingSafeEqual } from "crypto";
import { db, campaignsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

async function incrementCampaignMetric(campaignId: number, field: "impressions" | "clicks"): Promise<void> {
  try {
    if (field === "impressions") {
      await db.update(campaignsTable)
        .set({ impressions: sql`coalesce(${campaignsTable.impressions}, 0) + 1` })
        .where(eq(campaignsTable.id, campaignId));
    } else {
      await db.update(campaignsTable)
        .set({ clicks: sql`coalesce(${campaignsTable.clicks}, 0) + 1` })
        .where(eq(campaignsTable.id, campaignId));
    }
  } catch {
  }
}

function parseCampaignId(value: unknown): number | null {
  const n = parseInt(String(value ?? ""), 10);
  return isNaN(n) ? null : n;
}

function timingSafeStringEqual(a: string, b: string): boolean {
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

/**
 * SendGrid open/click tracking webhook.
 * Security: Requires SENDGRID_WEBHOOK_KEY set in environment and
 * validates the x-twilio-email-event-webhook-signature HMAC-SHA256 against the raw body.
 * Requests are rejected with 401 when the key is not configured or signature is invalid.
 *
 * Configure SendGrid to POST to: /api/webhooks/email/sendgrid
 * Set SENDGRID_WEBHOOK_KEY to match the webhook signing key from the SendGrid dashboard.
 */
router.post("/webhooks/email/sendgrid", async (req: Request, res: Response): Promise<void> => {
  const signingKey = process.env.SENDGRID_WEBHOOK_KEY;
  if (!signingKey) {
    res.status(401).json({ error: "SENDGRID_WEBHOOK_KEY is not configured. Set it to enable SendGrid event tracking." });
    return;
  }

  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  const signature = String(req.headers["x-twilio-email-event-webhook-signature"] ?? "");
  const timestamp = String(req.headers["x-twilio-email-event-webhook-timestamp"] ?? "");
  if (!signature || !timestamp || !rawBody) {
    res.status(401).json({ error: "Missing webhook signature or timestamp." });
    return;
  }

  try {
    const verifier = createVerify("SHA256");
    verifier.update(timestamp + rawBody.toString("utf8"));
    const isValid = verifier.verify(signingKey, signature, "base64");
    if (!isValid) {
      res.status(401).json({ error: "Invalid webhook signature." });
      return;
    }
  } catch {
    res.status(401).json({ error: "Webhook signature verification failed." });
    return;
  }

  res.sendStatus(200);

  const events: unknown[] = Array.isArray(req.body) ? req.body : [];
  for (const event of events) {
    if (typeof event !== "object" || event === null) continue;
    const ev = event as Record<string, unknown>;
    const campaignId = parseCampaignId((ev.custom_args as Record<string, unknown> | undefined)?.campaign_id ?? ev.campaign_id);
    if (!campaignId) continue;
    if (ev.event === "open") {
      await incrementCampaignMetric(campaignId, "impressions");
    } else if (ev.event === "click") {
      await incrementCampaignMetric(campaignId, "clicks");
    }
  }
});

/**
 * Mailgun open/click tracking webhook.
 * Security: Requires MAILGUN_WEBHOOK_SIGNING_KEY set in environment.
 * Validates the HMAC-SHA256 signature using timestamp+token per Mailgun docs.
 * Requests are rejected with 401 when the key is not configured or signature is invalid.
 *
 * Configure Mailgun to POST to: /api/webhooks/email/mailgun
 * Set MAILGUN_WEBHOOK_SIGNING_KEY to the webhook signing key from the Mailgun dashboard.
 */
router.post("/webhooks/email/mailgun", async (req: Request, res: Response): Promise<void> => {
  const webhookKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
  if (!webhookKey) {
    res.status(401).json({ error: "MAILGUN_WEBHOOK_SIGNING_KEY is not configured. Set it to enable Mailgun event tracking." });
    return;
  }

  const { timestamp, token, signature } = (req.body?.signature ?? {}) as Record<string, string>;
  if (!timestamp || !token || !signature) {
    res.status(401).json({ error: "Missing webhook signature fields (timestamp, token, signature)." });
    return;
  }

  const expected = createHmac("sha256", webhookKey).update(timestamp + token).digest("hex");
  if (!timingSafeStringEqual(expected, signature)) {
    res.status(401).json({ error: "Invalid webhook signature." });
    return;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const eventTime = parseInt(timestamp, 10);
  if (isNaN(eventTime) || Math.abs(nowSec - eventTime) > 300) {
    res.status(401).json({ error: "Webhook timestamp is too old or invalid (replay attack prevention)." });
    return;
  }

  res.sendStatus(200);

  const eventData = (req.body?.["event-data"] ?? req.body) as Record<string, unknown> | undefined;
  if (!eventData) return;

  const userVars = (eventData["user-variables"] ?? {}) as Record<string, unknown>;
  const campaignId = parseCampaignId(userVars.campaign_id ?? eventData.campaign_id);
  if (!campaignId) return;

  const eventType = String(eventData.event ?? "");
  if (eventType === "opened") {
    await incrementCampaignMetric(campaignId, "impressions");
  } else if (eventType === "clicked") {
    await incrementCampaignMetric(campaignId, "clicks");
  }
});

/**
 * Resend open/click tracking webhook.
 * Security: Requires RESEND_WEBHOOK_SECRET set in environment.
 * Validates the svix-signature header using HMAC-SHA256 per Resend/Svix docs.
 * Requests are rejected with 401 when the key is not configured or signature is invalid.
 *
 * Configure Resend to POST to: /api/webhooks/email/resend
 * Set RESEND_WEBHOOK_SECRET to the webhook signing secret from the Resend dashboard.
 */
router.post("/webhooks/email/resend", async (req: Request, res: Response): Promise<void> => {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    res.status(401).json({ error: "RESEND_WEBHOOK_SECRET is not configured. Set it to enable Resend event tracking." });
    return;
  }

  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  const svixId = String(req.headers["svix-id"] ?? "");
  const svixTimestamp = String(req.headers["svix-timestamp"] ?? "");
  const svixSignature = String(req.headers["svix-signature"] ?? "");

  if (!svixId || !svixTimestamp || !svixSignature || !rawBody) {
    res.status(401).json({ error: "Missing svix webhook signature headers." });
    return;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const eventTime = parseInt(svixTimestamp, 10);
  if (isNaN(eventTime) || Math.abs(nowSec - eventTime) > 300) {
    res.status(401).json({ error: "Webhook timestamp is too old or invalid (replay attack prevention)." });
    return;
  }

  const toSign = `${svixId}.${svixTimestamp}.${rawBody.toString("utf8")}`;
  const secretBytes = Buffer.from(webhookSecret.replace(/^whsec_/, ""), "base64");
  const expected = "v1," + createHmac("sha256", secretBytes).update(toSign).digest("base64");

  const isValid = svixSignature.split(" ").some(sig => timingSafeStringEqual(sig, expected));
  if (!isValid) {
    res.status(401).json({ error: "Invalid webhook signature." });
    return;
  }

  res.sendStatus(200);

  const data = req.body?.data as Record<string, unknown> | undefined;
  if (!data) return;

  const tags = data.tags as Array<{ name: string; value: string }> | undefined;
  const campaignTag = tags?.find(t => t.name === "campaign_id");
  const campaignId = parseCampaignId(campaignTag?.value);
  if (!campaignId) return;

  const eventType = String(req.body?.type ?? "");
  if (eventType === "email.opened") {
    await incrementCampaignMetric(campaignId, "impressions");
  } else if (eventType === "email.clicked") {
    await incrementCampaignMetric(campaignId, "clicks");
  }
});

export default router;
