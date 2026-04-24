import nodemailer from "nodemailer";
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
}

export interface SendEmailOptions {
  to: string[];
  subject: string;
  body: string;
}

async function getSettingValue(key: string): Promise<string | null> {
  try {
    const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, key));
    return row?.value ?? null;
  } catch {
    return null;
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
    const smtpPass = await getSettingValue("email_smtp_pass") ?? "";
    if (!smtpHost || !fromAddress) return null;
    return { provider, smtpHost, smtpPort: parseInt(smtpPortStr, 10), smtpUser, smtpPass, fromAddress, fromName };
  }

  const apiKey = await getSettingValue("email_api_key") ?? "";
  if (!apiKey || !fromAddress) return null;
  return { provider, apiKey, fromAddress, fromName };
}

export async function sendEmails(config: EmailProviderConfig, opts: SendEmailOptions): Promise<{ sent: number }> {
  const { to, subject, body } = opts;
  if (to.length === 0) return { sent: 0 };

  if (config.provider === "smtp") {
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort ?? 587,
      secure: (config.smtpPort ?? 587) === 465,
      auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPass } : undefined,
    });

    const from = config.fromName ? `"${config.fromName}" <${config.fromAddress}>` : config.fromAddress;
    for (const recipient of to) {
      await transporter.sendMail({ from, to: recipient, subject, text: body });
    }
    return { sent: to.length };
  }

  if (config.provider === "sendgrid") {
    const resp = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: to.map(email => ({ to: [{ email }] })),
        from: { email: config.fromAddress, name: config.fromName },
        subject,
        content: [{ type: "text/plain", value: body }],
      }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`SendGrid error ${resp.status}: ${err}`);
    }
    return { sent: to.length };
  }

  if (config.provider === "mailgun") {
    const domain = config.fromAddress.split("@")[1] ?? "";
    const form = new URLSearchParams();
    form.set("from", config.fromName ? `${config.fromName} <${config.fromAddress}>` : config.fromAddress);
    form.set("to", to.join(","));
    form.set("subject", subject);
    form.set("text", body);
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
    return { sent: to.length };
  }

  if (config.provider === "resend") {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.fromName ? `${config.fromName} <${config.fromAddress}>` : config.fromAddress,
        to,
        subject,
        text: body,
      }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Resend error ${resp.status}: ${err}`);
    }
    return { sent: to.length };
  }

  if (config.provider === "mailchimp") {
    for (const recipient of to) {
      const resp = await fetch("https://mandrillapp.com/api/1.0/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: config.apiKey,
          message: {
            text: body,
            subject,
            from_email: config.fromAddress,
            from_name: config.fromName,
            to: [{ email: recipient, type: "to" }],
          },
        }),
      });
      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Mailchimp/Mandrill error ${resp.status}: ${err}`);
      }
    }
    return { sent: to.length };
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
