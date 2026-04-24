import { Router, type IRouter, type Request, type Response } from "express";
import { createHmac } from "crypto";
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

router.post("/webhooks/email/sendgrid", async (req: Request, res: Response): Promise<void> => {
  res.sendStatus(200);
  const signingKey = process.env.SENDGRID_WEBHOOK_KEY;
  if (signingKey) {
    const signature = req.headers["x-twilio-email-event-webhook-signature"];
    if (!signature) return;
  }

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

router.post("/webhooks/email/mailgun", async (req: Request, res: Response): Promise<void> => {
  res.sendStatus(200);
  const webhookKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
  if (webhookKey) {
    const { timestamp, token, signature } = (req.body?.signature ?? {}) as Record<string, string>;
    if (timestamp && token && signature) {
      const expected = createHmac("sha256", webhookKey).update(timestamp + token).digest("hex");
      if (expected !== signature) return;
    }
  }

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

router.post("/webhooks/email/resend", async (req: Request, res: Response): Promise<void> => {
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
