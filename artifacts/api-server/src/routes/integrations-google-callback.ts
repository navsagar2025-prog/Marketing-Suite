/**
 * Public Google OAuth callback — no auth header (browser redirect from Google).
 * CSRF protection is via a signed state parameter (HMAC-SHA256 with SESSION_SECRET).
 */
import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { createHmac, randomBytes } from "node:crypto";
import { createCipheriv, createDecipheriv } from "node:crypto";
import { db, oauthTokensTable, gscCacheTable } from "@workspace/db";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const _rawSecret = process.env.SESSION_SECRET;
if (!_rawSecret) throw new Error("SESSION_SECRET environment variable is required");
const SESSION_SECRET: string = _rawSecret;

function getRedirectUri(): string {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  const domain = process.env.REPLIT_DEV_DOMAIN ?? "localhost:8080";
  return `https://${domain}/api/integrations/google/callback`;
}

function verifyState(state: string): Record<string, unknown> | null {
  try {
    const [b64, sig] = state.split(".");
    if (!b64 || !sig) return null;
    const expected = createHmac("sha256", SESSION_SECRET).update(b64).digest("base64url");
    if (expected !== sig) return null;
    return JSON.parse(Buffer.from(b64, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function encryptToken(token: string): string {
  const iv = randomBytes(12);
  const keyBuf = Buffer.from(createHmac("sha256", SESSION_SECRET).update("gsc-token").digest());
  const cipher = createCipheriv("aes-256-gcm", keyBuf, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

router.get("/integrations/google/callback", async (req, res): Promise<void> => {
  const { code, state: rawState, error } = req.query as Record<string, string>;

  const frontendBase = process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : "";

  const stateData = verifyState(rawState ?? "");
  const websiteId = stateData ? (stateData.websiteId as number) : 0;

  const redirectFail = (reason: string) => {
    const dest = websiteId
      ? `${frontendBase}/websites/${websiteId}?gsc=error&reason=${encodeURIComponent(reason)}`
      : `${frontendBase}/?gsc=error&reason=${encodeURIComponent(reason)}`;
    res.redirect(dest);
  };

  if (error || !code) { redirectFail(error ?? "no_code"); return; }
  if (!stateData) { redirectFail("invalid_state"); return; }

  const { userId } = stateData as { websiteId: number; userId: number };

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: getRedirectUri(),
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) { redirectFail("token_exchange"); return; }
    const tokens = await tokenRes.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    let googleEmail: string | null = null;
    try {
      const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (userRes.ok) {
        const info = await userRes.json() as { email?: string };
        googleEmail = info.email ?? null;
      }
    } catch { /* best-effort */ }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const [existing] = await db
      .select()
      .from(oauthTokensTable)
      .where(and(
        eq(oauthTokensTable.staffUserId, userId),
        eq(oauthTokensTable.websiteId, websiteId),
        eq(oauthTokensTable.provider, "google"),
      ))
      .limit(1);

    if (existing) {
      await db.update(oauthTokensTable).set({
        accessToken: encryptToken(tokens.access_token),
        refreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : existing.refreshToken,
        expiresAt,
        googleEmail,
        gscPropertyUrl: null,
      }).where(eq(oauthTokensTable.id, existing.id));
    } else {
      await db.insert(oauthTokensTable).values({
        staffUserId: userId,
        websiteId,
        provider: "google",
        accessToken: encryptToken(tokens.access_token),
        refreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
        expiresAt,
        scopes: "openid email https://www.googleapis.com/auth/webmasters.readonly",
        googleEmail,
      });
    }

    await db.delete(gscCacheTable).where(eq(gscCacheTable.websiteId, websiteId));

    res.redirect(`${frontendBase}/websites/${websiteId}?tab=search-performance&gsc=connected`);
  } catch (err) {
    logger.error({ err }, "Google OAuth callback error");
    redirectFail("internal_error");
  }
});

export default router;
