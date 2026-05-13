/**
 * Branded HTML email templates for SEO Command.
 * Colors match the marketing-hub theme:
 *   Primary (Electric Cyan): #0ea5e9
 *   Deep Navy sidebar/header: #0f172a
 *   Background: #f8fafc
 *   Card: #ffffff
 *   Border: #e2e8f0
 *   Foreground: #1e293b
 *   Muted foreground: #64748b
 */

const BRAND_PRIMARY = "#0ea5e9";
const BRAND_NAVY = "#0f172a";
const BRAND_BG = "#f8fafc";
const BRAND_CARD = "#ffffff";
const BRAND_BORDER = "#e2e8f0";
const BRAND_TEXT = "#1e293b";
const BRAND_MUTED = "#64748b";
const BRAND_SUCCESS = "#22c55e";
const BRAND_DANGER = "#ef4444";

function baseTemplate(previewText: string, bodyHtml: string, footerNote = ""): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="x-apple-disable-message-reformatting" />
<title>SEO Command</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
  body { margin: 0 !important; padding: 0 !important; background-color: ${BRAND_BG}; }
  a { color: ${BRAND_PRIMARY}; }
  @media only screen and (max-width: 600px) {
    .email-container { width: 100% !important; }
    .mobile-padding { padding: 24px 16px !important; }
    .mobile-btn { width: 100% !important; text-align: center !important; display: block !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${BRAND_BG};font-family:'Inter',Arial,sans-serif;">
  <!-- Preview text (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${previewText}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${BRAND_BG};">
    <tr>
      <td style="padding:40px 20px;">
        <table class="email-container" role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="max-width:600px;margin:0 auto;">

          <!-- Header -->
          <tr>
            <td style="background-color:${BRAND_NAVY};border-radius:8px 8px 0 0;padding:24px 40px;" class="mobile-padding">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="background-color:${BRAND_PRIMARY};border-radius:8px;width:32px;height:32px;text-align:center;vertical-align:middle;">
                          <span style="color:#ffffff;font-size:18px;font-weight:700;line-height:32px;display:block;">S</span>
                        </td>
                        <td style="padding-left:10px;vertical-align:middle;">
                          <span style="color:#ffffff;font-size:16px;font-weight:700;letter-spacing:-0.01em;font-family:'Inter',Arial,sans-serif;">SEO Command</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body card -->
          <tr>
            <td style="background-color:${BRAND_CARD};border-left:1px solid ${BRAND_BORDER};border-right:1px solid ${BRAND_BORDER};padding:40px 40px 32px 40px;" class="mobile-padding">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:${BRAND_BG};border:1px solid ${BRAND_BORDER};border-top:none;border-radius:0 0 8px 8px;padding:20px 40px;" class="mobile-padding">
              <p style="margin:0;font-size:12px;color:${BRAND_MUTED};font-family:'Inter',Arial,sans-serif;line-height:1.6;text-align:center;">
                ${footerNote || "You're receiving this email from SEO Command."}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(label: string, href: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 8px 0;">
    <tr>
      <td style="border-radius:6px;background-color:${BRAND_PRIMARY};">
        <a href="${href}" class="mobile-btn" target="_blank" style="display:inline-block;padding:12px 28px;color:#ffffff;font-family:'Inter',Arial,sans-serif;font-size:14px;font-weight:600;text-decoration:none;border-radius:6px;mso-padding-alt:12px 28px;">${label}</a>
      </td>
    </tr>
  </table>`;
}

function divider(): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:24px 0;">
    <tr><td style="border-top:1px solid ${BRAND_BORDER};font-size:0;line-height:0;">&nbsp;</td></tr>
  </table>`;
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:${BRAND_TEXT};font-family:'Inter',Arial,sans-serif;letter-spacing:-0.02em;line-height:1.3;">${text}</h1>`;
}

function h2(text: string): string {
  return `<h2 style="margin:0 0 12px 0;font-size:14px;font-weight:600;color:${BRAND_TEXT};font-family:'Inter',Arial,sans-serif;letter-spacing:0.03em;text-transform:uppercase;">${text}</h2>`;
}

function p(text: string, muted = false): string {
  return `<p style="margin:0 0 16px 0;font-size:14px;color:${muted ? BRAND_MUTED : BRAND_TEXT};font-family:'Inter',Arial,sans-serif;line-height:1.6;">${text}</p>`;
}

// ─── Individual email builders ──────────────────────────────────────────────

export function passwordResetHtml(username: string, resetLink: string): string {
  const body = `
    ${h1("Reset your password")}
    ${p(`Hello <strong>${escHtml(username)}</strong>,`)}
    ${p("We received a request to reset the password for your SEO Command account. Click the button below to choose a new password.")}
    ${ctaButton("Reset Password", resetLink)}
    ${p("This link expires in <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email — your password will not change.", true)}
    ${divider()}
    ${p("Or copy and paste this URL into your browser:", true)}
    <p style="margin:0;font-size:12px;color:${BRAND_MUTED};font-family:'Courier New',monospace;word-break:break-all;background-color:${BRAND_BG};border:1px solid ${BRAND_BORDER};border-radius:4px;padding:10px 12px;">${escHtml(resetLink)}</p>
  `;
  return baseTemplate(
    "Reset your SEO Command password — link expires in 1 hour.",
    body,
    "You're receiving this because a password reset was requested for your SEO Command account. If you didn't request this, no action is needed."
  );
}

type AlertEntry = {
  keyword: string;
  websiteName: string;
  currentRank: number;
  previousRank: number;
  delta: number;
  direction: "up" | "down";
};

export function rankAlertDigestHtml(rising: AlertEntry[], dropped: AlertEntry[]): string {
  const total = rising.length + dropped.length;
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  function rankRow(entry: AlertEntry, dir: "up" | "down"): string {
    const color = dir === "up" ? BRAND_SUCCESS : BRAND_DANGER;
    const arrow = dir === "up" ? "▲" : "▼";
    const sign = dir === "up" ? "+" : "−";
    return `<tr>
      <td style="padding:10px 12px;border-bottom:1px solid ${BRAND_BORDER};font-size:13px;font-family:'Inter',Arial,sans-serif;color:${BRAND_TEXT};font-weight:500;">${escHtml(entry.keyword)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid ${BRAND_BORDER};font-size:12px;font-family:'Inter',Arial,sans-serif;color:${BRAND_MUTED};">${escHtml(entry.websiteName)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid ${BRAND_BORDER};font-size:13px;font-family:'Inter',Arial,sans-serif;color:${BRAND_MUTED};text-align:center;">#${entry.previousRank}</td>
      <td style="padding:10px 12px;border-bottom:1px solid ${BRAND_BORDER};font-size:13px;font-family:'Inter',Arial,sans-serif;color:${BRAND_TEXT};font-weight:600;text-align:center;">#${entry.currentRank}</td>
      <td style="padding:10px 12px;border-bottom:1px solid ${BRAND_BORDER};font-size:13px;font-family:'Inter',Arial,sans-serif;color:${color};font-weight:700;text-align:center;">${arrow}&nbsp;${sign}${entry.delta}</td>
    </tr>`;
  }

  function rankTable(entries: AlertEntry[], dir: "up" | "down"): string {
    if (entries.length === 0) return `<p style="margin:0 0 4px 0;font-size:13px;color:${BRAND_MUTED};font-family:'Inter',Arial,sans-serif;font-style:italic;">None today</p>`;
    return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse;border:1px solid ${BRAND_BORDER};border-radius:6px;overflow:hidden;">
      <thead>
        <tr style="background-color:${BRAND_BG};">
          <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:${BRAND_MUTED};font-family:'Inter',Arial,sans-serif;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid ${BRAND_BORDER};">Keyword</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:${BRAND_MUTED};font-family:'Inter',Arial,sans-serif;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid ${BRAND_BORDER};">Website</th>
          <th style="padding:8px 12px;text-align:center;font-size:11px;font-weight:600;color:${BRAND_MUTED};font-family:'Inter',Arial,sans-serif;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid ${BRAND_BORDER};">Before</th>
          <th style="padding:8px 12px;text-align:center;font-size:11px;font-weight:600;color:${BRAND_MUTED};font-family:'Inter',Arial,sans-serif;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid ${BRAND_BORDER};">Now</th>
          <th style="padding:8px 12px;text-align:center;font-size:11px;font-weight:600;color:${BRAND_MUTED};font-family:'Inter',Arial,sans-serif;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid ${BRAND_BORDER};">Change</th>
        </tr>
      </thead>
      <tbody>
        ${entries.map(e => rankRow(e, dir)).join("")}
      </tbody>
    </table>`;
  }

  const body = `
    ${h1("Daily Rank Change Digest")}
    <p style="margin:0 0 24px 0;font-size:13px;color:${BRAND_MUTED};font-family:'Inter',Arial,sans-serif;">${today}</p>

    <!-- Summary pills -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 28px 0;">
      <tr>
        <td style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:10px 18px;text-align:center;margin-right:12px;">
          <span style="font-size:20px;font-weight:700;color:${BRAND_SUCCESS};font-family:'Inter',Arial,sans-serif;display:block;line-height:1;">${rising.length}</span>
          <span style="font-size:11px;color:#16a34a;font-family:'Inter',Arial,sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;">Improved</span>
        </td>
        <td style="width:12px;"></td>
        <td style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:10px 18px;text-align:center;">
          <span style="font-size:20px;font-weight:700;color:${BRAND_DANGER};font-family:'Inter',Arial,sans-serif;display:block;line-height:1;">${dropped.length}</span>
          <span style="font-size:11px;color:#dc2626;font-family:'Inter',Arial,sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;">Dropped</span>
        </td>
        <td style="width:12px;"></td>
        <td style="background-color:${BRAND_BG};border:1px solid ${BRAND_BORDER};border-radius:6px;padding:10px 18px;text-align:center;">
          <span style="font-size:20px;font-weight:700;color:${BRAND_TEXT};font-family:'Inter',Arial,sans-serif;display:block;line-height:1;">${total}</span>
          <span style="font-size:11px;color:${BRAND_MUTED};font-family:'Inter',Arial,sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;">Total Changes</span>
        </td>
      </tr>
    </table>

    ${divider()}

    <!-- Improved -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:8px;">
      <tr>
        <td style="padding:0 0 12px 0;">
          <span style="display:inline-block;background-color:#f0fdf4;border:1px solid #bbf7d0;color:#16a34a;font-size:11px;font-weight:700;font-family:'Inter',Arial,sans-serif;text-transform:uppercase;letter-spacing:0.06em;padding:3px 10px;border-radius:4px;">▲ Improved (${rising.length})</span>
        </td>
      </tr>
    </table>
    ${rankTable(rising, "up")}

    <div style="height:24px;"></div>

    <!-- Dropped -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:8px;">
      <tr>
        <td style="padding:0 0 12px 0;">
          <span style="display:inline-block;background-color:#fef2f2;border:1px solid #fecaca;color:#dc2626;font-size:11px;font-weight:700;font-family:'Inter',Arial,sans-serif;text-transform:uppercase;letter-spacing:0.06em;padding:3px 10px;border-radius:4px;">▼ Dropped (${dropped.length})</span>
        </td>
      </tr>
    </table>
    ${rankTable(dropped, "down")}

    ${divider()}
    ${p("Log in to SEO Command to view the full rank history and take action.", true)}
  `;

  return baseTemplate(
    `${rising.length} keyword${rising.length !== 1 ? "s" : ""} improved, ${dropped.length} dropped today.`,
    body,
    "You're receiving this digest because rank alert emails are enabled in Settings → Notifications."
  );
}

export function testConnectionHtml(): string {
  const body = `
    ${h1("Email connection confirmed")}
    ${p("Your email provider is connected and working correctly. SEO Command can now send transactional emails such as password resets and rank alert digests.")}
    ${divider()}
    ${h2("What happens next")}
    ${p("• Password reset emails will be delivered to staff accounts<br>• Daily rank change digests will be sent if rank alerts are enabled<br>• Campaign and sequence emails can now be delivered to your leads")}
  `;
  return baseTemplate(
    "Your SEO Command email provider is connected and working.",
    body,
    "This is a connection test email sent from SEO Command Settings."
  );
}

export function wrappedBodyHtml(subject: string, bodyText: string): string {
  const lines = bodyText.split("\n").map(l => escHtml(l));
  const formattedBody = lines
    .map(l => l.trim() === "" ? "<br>" : `<span>${l}</span><br>`)
    .join("");

  const body = `
    ${h1(escHtml(subject))}
    <div style="font-size:14px;color:${BRAND_TEXT};font-family:'Inter',Arial,sans-serif;line-height:1.7;">
      ${formattedBody}
    </div>
  `;
  return baseTemplate(subject, body, "You're receiving this email from SEO Command.");
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
