import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { appSettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../lib/auth.js";
import { testWebhook, type WebhookKind } from "../lib/notification-webhooks.js";
import { validateWebhookUrl } from "../lib/webhook-url.js";

const router: IRouter = Router();

async function getValue(key: string): Promise<string> {
  const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, key));
  return row?.value ?? "";
}

async function setValue(key: string, value: string): Promise<void> {
  if (value) {
    await db
      .insert(appSettingsTable)
      .values({ key, value })
      .onConflictDoUpdate({ target: appSettingsTable.key, set: { value, updatedAt: new Date() } });
  } else {
    await db.delete(appSettingsTable).where(eq(appSettingsTable.key, key));
  }
}

router.get("/settings/webhooks", requireAdmin, async (_req, res): Promise<void> => {
  const slack = await getValue("slack_webhook_url");
  const discord = await getValue("discord_webhook_url");
  res.json({ slackWebhookUrl: slack, discordWebhookUrl: discord });
});

router.patch("/settings/webhooks", requireAdmin, async (req, res): Promise<void> => {
  const { slackWebhookUrl, discordWebhookUrl } = req.body ?? {};
  if (typeof slackWebhookUrl === "string") {
    const trimmed = slackWebhookUrl.trim();
    if (trimmed) {
      const v = validateWebhookUrl(trimmed, "slack");
      if (!v.ok) {
        res.status(400).json({ error: `Slack webhook: ${v.reason}` });
        return;
      }
    }
    await setValue("slack_webhook_url", trimmed);
  }
  if (typeof discordWebhookUrl === "string") {
    const trimmed = discordWebhookUrl.trim();
    if (trimmed) {
      const v = validateWebhookUrl(trimmed, "discord");
      if (!v.ok) {
        res.status(400).json({ error: `Discord webhook: ${v.reason}` });
        return;
      }
    }
    await setValue("discord_webhook_url", trimmed);
  }
  res.json({ ok: true });
});

router.post("/settings/webhooks/test", requireAdmin, async (req, res): Promise<void> => {
  const { kind, url } = req.body as { kind?: WebhookKind; url?: string };
  if (!kind || !url || (kind !== "slack" && kind !== "discord")) {
    res.status(400).json({ error: "kind (slack|discord) and url are required" });
    return;
  }
  const v = validateWebhookUrl(url, kind);
  if (!v.ok) {
    res.status(400).json({ error: v.reason });
    return;
  }
  const ok = await testWebhook(kind, url);
  if (!ok) {
    res.status(502).json({ error: "Webhook delivery failed — check the URL" });
    return;
  }
  res.json({ ok: true });
});

export default router;
