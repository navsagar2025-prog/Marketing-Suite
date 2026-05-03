import { db } from "@workspace/db";
import { appSettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";

export type WebhookKind = "slack" | "discord";

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

  if (slackUrl && slackUrl.startsWith("http")) {
    result.slack = await postSlack(slackUrl, text);
  }
  if (discordUrl && discordUrl.startsWith("http")) {
    result.discord = await postDiscord(discordUrl, text);
  }
  return result;
}

export async function testWebhook(kind: WebhookKind, url: string): Promise<boolean> {
  const message = `:white_check_mark: SEO Command — webhook test successful! You'll get rank changes, audit results, and backlink alerts here.`;
  if (kind === "slack") return postSlack(url, message);
  return postDiscord(url, message);
}
