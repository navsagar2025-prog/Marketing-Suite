import { db } from "@workspace/db";
import { appSettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";
import { validateWebhookUrl, type WebhookKind } from "./webhook-url.js";

export type { WebhookKind };

async function getSettingValue(key: string): Promise<string | null> {
  try {
    const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, key));
    return row?.value ?? null;
  } catch {
    return null;
  }
}

async function postSlack(url: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    return res.ok;
  } catch (err) {
    logger.warn({ err }, "Slack webhook post failed");
    return false;
  }
}

async function postDiscord(url: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text.slice(0, 1900) }),
    });
    return res.ok;
  } catch (err) {
    logger.warn({ err }, "Discord webhook post failed");
    return false;
  }
}

export async function sendWebhookNotification(text: string): Promise<{ slack: boolean; discord: boolean }> {
  const result = { slack: false, discord: false };
  const slackUrl = await getSettingValue("slack_webhook_url");
  const discordUrl = await getSettingValue("discord_webhook_url");

  if (slackUrl && validateWebhookUrl(slackUrl, "slack").ok) {
    result.slack = await postSlack(slackUrl, text);
  } else if (slackUrl) {
    logger.warn({ host: safeHost(slackUrl) }, "Skipping Slack webhook — URL failed validation");
  }
  if (discordUrl && validateWebhookUrl(discordUrl, "discord").ok) {
    result.discord = await postDiscord(discordUrl, text);
  } else if (discordUrl) {
    logger.warn({ host: safeHost(discordUrl) }, "Skipping Discord webhook — URL failed validation");
  }
  return result;
}

function safeHost(u: string): string {
  try { return new URL(u).hostname; } catch { return "invalid"; }
}

export async function testWebhook(kind: WebhookKind, url: string): Promise<boolean> {
  const v = validateWebhookUrl(url, kind);
  if (!v.ok) return false;
  const message = `:white_check_mark: SEO Command — webhook test successful! You'll get rank changes, audit results, and backlink alerts here.`;
  if (kind === "slack") return postSlack(url, message);
  return postDiscord(url, message);
}
