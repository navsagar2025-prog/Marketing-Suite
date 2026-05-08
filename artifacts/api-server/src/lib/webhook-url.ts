const SLACK_HOSTS = new Set(["hooks.slack.com"]);
const DISCORD_HOSTS = new Set(["discord.com", "discordapp.com", "canary.discord.com", "ptb.discord.com"]);
const DISCORD_PATH_RE = /^\/api\/webhooks\/\d+\/[\w-]+\/?$/;
const SLACK_PATH_RE = /^\/services\/[A-Z0-9]+\/[A-Z0-9]+\/[A-Za-z0-9]+\/?$/;

export type WebhookKind = "slack" | "discord";

export interface WebhookValidationResult {
  ok: boolean;
  reason?: string;
  kind?: WebhookKind;
}

export function validateWebhookUrl(raw: string, expected?: WebhookKind): WebhookValidationResult {
  if (!raw || typeof raw !== "string") return { ok: false, reason: "URL is required" };

  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }

  if (url.protocol !== "https:") return { ok: false, reason: "URL must use HTTPS" };

  const host = url.hostname.toLowerCase();

  let kind: WebhookKind | undefined;
  if (SLACK_HOSTS.has(host) && SLACK_PATH_RE.test(url.pathname)) {
    kind = "slack";
  } else if (DISCORD_HOSTS.has(host) && DISCORD_PATH_RE.test(url.pathname)) {
    kind = "discord";
  } else {
    return {
      ok: false,
      reason: "Only official Slack (hooks.slack.com/services/…) and Discord (discord.com/api/webhooks/…) URLs are allowed",
    };
  }

  if (expected && expected !== kind) {
    return { ok: false, reason: `URL is a ${kind} webhook, not ${expected}` };
  }

  if (url.username || url.password) return { ok: false, reason: "Credentials are not allowed in URL" };
  if (url.search || url.hash) return { ok: false, reason: "Query string and fragment are not allowed" };

  return { ok: true, kind };
}
