import nodemailer from "nodemailer";
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";
import { db } from "@workspace/db";
import { appSettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export type EmailProvider = "smtp" | "sendgrid" | "mailgun" | "resend" | "mailchimp";

export interface EmailProviderConfig {
  provider: EmailProvider;
  apiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  fromAddress: string;
  fromName?: string;
  /** Mailchimp Marketing API audience/list ID for syncing leads to a Mailchimp list */
  audienceId?: string;
}

export interface SendEmailOptions {
  to: string[];
  subject: string;
  body: string;
  campaignId?: number;
}

function getEncryptionKey(): Buffer {
  const raw = process.env.EMAIL_ENCRYPTION_KEY ?? process.env.SESSION_SECRET;
  if (!raw) {
    throw new Error("EMAIL_ENCRYPTION_KEY or SESSION_SECRET environment variable is required for email credential encryption. Set one to enable email provider configuration.");
  }
  return createHash("sha256").update(raw).digest();
}

const ALGO = "aes-256-gcm";
const PREFIX = "enc:";

export function encryptSecret(plaintext: string): string {
  if (!plaintext) return plaintext;
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptSecret(value: string): string {
  if (!value || !value.startsWith(PREFIX)) return value;
  try {
    const key = getEncryptionKey();
    const buf = Buffer.from(value.slice(PREFIX.length), "base64");
    const iv = buf.subarray(0, 12);
    const authTag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final("utf8");
  } catch {
    return value;
  }
}

async function getSettingValue(key: string): Promise<string | null> {
  try {
    const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, key));
    return row?.value ?? null;
  } catch {
    return null;
  }
}

async function getSecretSetting(key: string): Promise<string | null> {
  const raw = await getSettingValue(key);
  if (!raw) return null;
  return decryptSecret(raw);
}

export async function setSecretSetting(key: string, value: string): Promise<void> {
  const encrypted = encryptSecret(value);
  const existing = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, key));
  if (existing.length > 0) {
    await db.update(appSettingsTable).set({ value: encrypted }).where(eq(appSettingsTable.key, key));
  } else {
    await db.insert(appSettingsTable).values({ key, value: encrypted });
  }
}

export async function getEmailProviderConfig(): Promise<EmailProviderConfig | null> {
  const provider = await getSettingValue("email_provider") as EmailProvider | null;
  if (!provider) return null;

  const fromAddress = await getSettingValue("email_from_address") ?? "";
  const fromName = await getSettingValue("email_from_name") ?? "";

  if (provider === "smtp") {
    const smtpHost = await getSettingValue("email_smtp_host") ?? "";
    const smtpPortStr = await getSettingValue("email_smtp_port") ?? "587";
    const smtpUser = await getSettingValue("email_smtp_user") ?? "";
    const smtpPass = await getSecretSetting("email_smtp_pass") ?? "";
    if (!smtpHost || !fromAddress) return null;
    return { provider, smtpHost, smtpPort: parseInt(smtpPortStr, 10), smtpUser, smtpPass, fromAddress, fromName };
  }

  const apiKey = await getSecretSetting("email_api_key") ?? "";
  if (!apiKey || !fromAddress) return null;

  if (provider === "mailchimp") {
    const audienceId = await getSettingValue("email_mailchimp_audience_id") ?? undefined;
    return { provider, apiKey, fromAddress, fromName, audienceId };
  }

  return { provider, apiKey, fromAddress, fromName };
}

export async function sendEmails(config: EmailProviderConfig, opts: SendEmailOptions): Promise<{ sent: number }> {
  const { to, subject, body, campaignId } = opts;
  if (to.length === 0) return { sent: 0 };

  const campaignIdStr = campaignId != null ? String(campaignId) : undefined;

  if (config.provider === "smtp") {
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort ?? 587,
      secure: (config.smtpPort ?? 587) === 465,
      auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPass } : undefined,
    });

    const from = config.fromName ? `"${config.fromName}" <${config.fromAddress}>` : config.fromAddress;
    for (const recipient of to) {
      await transporter.sendMail({
        from,
        to: recipient,
        subject,
        text: body,
        headers: campaignIdStr ? { "X-Campaign-Id": campaignIdStr } : undefined,
      });
    }
    return { sent: to.length };
  }

  if (config.provider === "sendgrid") {
    const payload: Record<string, unknown> = {
      personalizations: to.map(email => ({ to: [{ email }] })),
      from: { email: config.fromAddress, name: config.fromName },
      subject,
      content: [{ type: "text/plain", value: body }],
    };
    if (campaignIdStr) {
      payload.custom_args = { campaign_id: campaignIdStr };
    }
    const resp = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`SendGrid error ${resp.status}: ${err}`);
    }
    return { sent: to.length };
  }

  if (config.provider === "mailgun") {
    const domain = config.fromAddress.split("@")[1] ?? "";
    let sent = 0;
    for (const recipient of to) {
      const form = new URLSearchParams();
      form.set("from", config.fromName ? `${config.fromName} <${config.fromAddress}>` : config.fromAddress);
      form.set("to", recipient);
      form.set("subject", subject);
      form.set("text", body);
      if (campaignIdStr) {
        form.set("v:campaign_id", campaignIdStr);
      }
      const resp = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`api:${config.apiKey}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });
      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Mailgun error ${resp.status}: ${err}`);
      }
      sent++;
    }
    return { sent };
  }

  if (config.provider === "resend") {
    let sent = 0;
    for (const recipient of to) {
      const payload: Record<string, unknown> = {
        from: config.fromName ? `${config.fromName} <${config.fromAddress}>` : config.fromAddress,
        to: [recipient],
        subject,
        text: body,
      };
      if (campaignIdStr) {
        payload.tags = [{ name: "campaign_id", value: campaignIdStr }];
      }
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Resend error ${resp.status}: ${err}`);
      }
      sent++;
    }
    return { sent };
  }

  if (config.provider === "mailchimp") {
    const apiKey = config.apiKey!;

    if (config.audienceId) {
      const dc = apiKey.split("-").pop() ?? "us1";
      const authHeader = `Basic ${Buffer.from(`anystring:${apiKey}`).toString("base64")}`;
      const baseUrl = `https://${dc}.api.mailchimp.com/3.0`;

      for (const recipient of to) {
        const [firstName, ...lastParts] = recipient.split("@")[0]?.split(/[._-]/) ?? [""];
        const subscriberHash = (await import("crypto")).createHash("md5").update(recipient.toLowerCase()).digest("hex");
        const memberResp = await fetch(`${baseUrl}/lists/${config.audienceId}/members/${subscriberHash}`, {
          method: "PUT",
          headers: { Authorization: authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({
            email_address: recipient,
            status_if_new: "subscribed",
            merge_fields: { FNAME: firstName ?? "", LNAME: lastParts.join(" ") },
          }),
        });
        if (!memberResp.ok) {
          const err = await memberResp.text();
          throw new Error(`Mailchimp audience sync error ${memberResp.status}: ${err}`);
        }
      }
    }

    let sent = 0;
    for (const recipient of to) {
      const resp = await fetch("https://mandrillapp.com/api/1.0/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: apiKey,
          message: {
            text: body,
            subject,
            from_email: config.fromAddress,
            from_name: config.fromName,
            to: [{ email: recipient, type: "to" }],
            metadata: campaignIdStr ? { campaign_id: campaignIdStr } : undefined,
          },
        }),
      });
      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Mailchimp/Mandrill error ${resp.status}: ${err}`);
      }
      sent++;
    }
    return { sent };
  }

  throw new Error(`Unsupported provider: ${config.provider}`);
}

export async function testEmailConnection(config: EmailProviderConfig, testTo: string): Promise<void> {
  await sendEmails(config, {
    to: [testTo],
    subject: "SEO Command — Email connection test",
    body: "This is a test email to confirm your email provider is connected correctly.",
  });
}
