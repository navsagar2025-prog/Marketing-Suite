/**
 * Authenticated Google / GSC integration routes.
 * The public callback route lives in integrations-google-callback.ts.
 */
import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { createHmac, randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { db, oauthTokensTable, gscCacheTable } from "@workspace/db";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-secret";

const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/webmasters.readonly",
];

function getRedirectUri(): string {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  const domain = process.env.REPLIT_DEV_DOMAIN ?? "localhost:8080";
  return `https://${domain}/api/integrations/google/callback`;
}

function signState(payload: object): string {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json).toString("base64url");
  const sig = createHmac("sha256", SESSION_SECRET).update(b64).digest("base64url");
  return `${b64}.${sig}`;
}

function decryptToken(encrypted: string): string {
  const buf = Buffer.from(encrypted, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const keyBuf = Buffer.from(createHmac("sha256", SESSION_SECRET).update("gsc-token").digest());
  const decipher = createDecipheriv("aes-256-gcm", keyBuf, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data) + decipher.final("utf8");
}

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
  const data = await res.json() as { access_token: string; expires_in: number };
  return { accessToken: data.access_token, expiresAt: new Date(Date.now() + data.expires_in * 1000) };
}

function encryptToken(token: string): string {
  const iv = randomBytes(12);
  const keyBuf = Buffer.from(createHmac("sha256", SESSION_SECRET).update("gsc-token").digest());
  const cipher = createCipheriv("aes-256-gcm", keyBuf, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

async function getValidAccessToken(tokenRow: typeof oauthTokensTable.$inferSelect): Promise<string> {
  const isExpired = tokenRow.expiresAt && tokenRow.expiresAt.getTime() < Date.now() + 30_000;
  if (!isExpired) return decryptToken(tokenRow.accessToken);
  if (!tokenRow.refreshToken) throw new Error("Token expired and no refresh token — please reconnect Google Search Console.");
  const { accessToken, expiresAt } = await refreshAccessToken(decryptToken(tokenRow.refreshToken));
  await db.update(oauthTokensTable).set({ accessToken: encryptToken(accessToken), expiresAt }).where(eq(oauthTokensTable.id, tokenRow.id));
  return accessToken;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /integrations/google/auth
 * Returns the Google OAuth authorization URL as JSON.
 * The frontend fetches this with the Bearer token, then navigates the browser to the returned URL.
 * This keeps the route behind requireAuth while avoiding the problem of browser navigation
 * (which cannot attach Authorization headers).
 */
router.get("/integrations/google/auth", async (req, res): Promise<void> => {
  if (!GOOGLE_CLIENT_ID) {
    res.status(503).json({ error: "Google OAuth is not configured. Ask your admin to set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.", configured: false });
    return;
  }
  const websiteId = parseInt(req.query.websiteId as string);
  if (isNaN(websiteId)) { res.status(400).json({ error: "websiteId is required" }); return; }

  const state = signState({ websiteId, userId: req.user!.id, nonce: randomBytes(8).toString("hex") });
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  res.json({ authUrl });
});

/** GET /integrations/google/status/:websiteId */
router.get("/integrations/google/status/:websiteId", async (req, res): Promise<void> => {
  const websiteId = parseInt(req.params.websiteId);
  if (isNaN(websiteId)) { res.status(400).json({ error: "Invalid websiteId" }); return; }

  const [token] = await db
    .select()
    .from(oauthTokensTable)
    .where(and(
      eq(oauthTokensTable.staffUserId, req.user!.id),
      eq(oauthTokensTable.websiteId, websiteId),
      eq(oauthTokensTable.provider, "google"),
    ))
    .limit(1);

  res.json({
    connected: !!token,
    email: token?.googleEmail ?? null,
    propertyUrl: token?.gscPropertyUrl ?? null,
    configured: !!GOOGLE_CLIENT_ID,
  });
});

/** GET /integrations/google/properties/:websiteId — list available GSC properties */
router.get("/integrations/google/properties/:websiteId", async (req, res): Promise<void> => {
  const websiteId = parseInt(req.params.websiteId);
  if (isNaN(websiteId)) { res.status(400).json({ error: "Invalid websiteId" }); return; }

  const [token] = await db
    .select()
    .from(oauthTokensTable)
    .where(and(
      eq(oauthTokensTable.staffUserId, req.user!.id),
      eq(oauthTokensTable.websiteId, websiteId),
      eq(oauthTokensTable.provider, "google"),
    ))
    .limit(1);

  if (!token) { res.status(404).json({ error: "Google not connected for this website" }); return; }

  try {
    const accessToken = await getValidAccessToken(token);
    const gscRes = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!gscRes.ok) throw new Error(`GSC API error: ${gscRes.status}`);
    const data = await gscRes.json() as { siteEntry?: Array<{ siteUrl: string; permissionLevel: string }> };
    res.json(data.siteEntry ?? []);
  } catch (err) {
    logger.error({ err }, "Failed to list GSC properties");
    res.status(502).json({ error: "Failed to fetch properties from Google Search Console" });
  }
});

/** POST /integrations/google/properties/connect — select a GSC property for a website */
router.post("/integrations/google/properties/connect", async (req, res): Promise<void> => {
  const { websiteId, propertyUrl } = req.body as { websiteId?: number; propertyUrl?: string };
  if (!websiteId || !propertyUrl) { res.status(400).json({ error: "websiteId and propertyUrl are required" }); return; }

  const [token] = await db
    .select()
    .from(oauthTokensTable)
    .where(and(
      eq(oauthTokensTable.staffUserId, req.user!.id),
      eq(oauthTokensTable.websiteId, websiteId),
      eq(oauthTokensTable.provider, "google"),
    ))
    .limit(1);

  if (!token) { res.status(404).json({ error: "Google not connected for this website" }); return; }
  await db.update(oauthTokensTable).set({ gscPropertyUrl: propertyUrl }).where(eq(oauthTokensTable.id, token.id));
  await db.delete(gscCacheTable).where(eq(gscCacheTable.websiteId, websiteId));
  res.json({ success: true, propertyUrl });
});

/** DELETE /integrations/google/disconnect/:websiteId */
router.delete("/integrations/google/disconnect/:websiteId", async (req, res): Promise<void> => {
  const websiteId = parseInt(req.params.websiteId);
  if (isNaN(websiteId)) { res.status(400).json({ error: "Invalid websiteId" }); return; }

  await db.delete(oauthTokensTable).where(and(
    eq(oauthTokensTable.staffUserId, req.user!.id),
    eq(oauthTokensTable.websiteId, websiteId),
    eq(oauthTokensTable.provider, "google"),
  ));
  await db.delete(gscCacheTable).where(eq(gscCacheTable.websiteId, websiteId));
  res.json({ success: true });
});

// ─── Search Performance Data ─────────────────────────────────────────────────

const DATE_RANGES: Record<string, number> = { "7days": 7, "28days": 28, "90days": 90 };
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function fetchGscAnalytics(
  accessToken: string,
  propertyUrl: string,
  startDate: string,
  endDate: string,
  dimensions: string[],
  rowLimit = 50,
): Promise<Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }>> {
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(propertyUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ startDate, endDate, dimensions, rowLimit, startRow: 0 }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GSC searchAnalytics.query failed (${res.status}): ${body}`);
  }
  const data = await res.json() as { rows?: Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }> };
  return data.rows ?? [];
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function sumRows(rows: Array<{ clicks: number; impressions: number; ctr: number; position: number }>) {
  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
  const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0);
  const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
  const avgPosition = rows.length > 0 ? rows.reduce((s, r) => s + r.position, 0) / rows.length : 0;
  return { clicks: totalClicks, impressions: totalImpressions, ctr: avgCtr, avgPosition };
}

/** GET /integrations/google/gsc/:websiteId?dateRange=28days */
router.get("/integrations/google/gsc/:websiteId", async (req, res): Promise<void> => {
  const websiteId = parseInt(req.params.websiteId);
  if (isNaN(websiteId)) { res.status(400).json({ error: "Invalid websiteId" }); return; }

  const dateRange = (req.query.dateRange as string) ?? "28days";
  if (!DATE_RANGES[dateRange]) { res.status(400).json({ error: "dateRange must be 7days, 28days, or 90days" }); return; }

  const [token] = await db
    .select()
    .from(oauthTokensTable)
    .where(and(
      eq(oauthTokensTable.staffUserId, req.user!.id),
      eq(oauthTokensTable.websiteId, websiteId),
      eq(oauthTokensTable.provider, "google"),
    ))
    .limit(1);

  if (!token) { res.status(404).json({ error: "Google Search Console is not connected" }); return; }
  if (!token.gscPropertyUrl) { res.status(400).json({ error: "No GSC property selected. Please select a property first." }); return; }

  // Serve from 1-hour cache
  const [cached] = await db
    .select()
    .from(gscCacheTable)
    .where(and(eq(gscCacheTable.websiteId, websiteId), eq(gscCacheTable.dateRange, dateRange)))
    .orderBy(desc(gscCacheTable.cachedAt))
    .limit(1);

  if (cached && Date.now() - cached.cachedAt.getTime() < CACHE_TTL_MS) {
    res.json(cached.data);
    return;
  }

  try {
    const accessToken = await getValidAccessToken(token);
    const days = DATE_RANGES[dateRange];
    const endDate = formatDate(new Date());
    const startDate = formatDate(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
    const priorEnd = formatDate(new Date(Date.now() - (days + 1) * 24 * 60 * 60 * 1000));
    const priorStart = formatDate(new Date(Date.now() - (days * 2 + 1) * 24 * 60 * 60 * 1000));

    const [queryRows, pageRows, queryRowsPrior, allPositionRows] = await Promise.all([
      fetchGscAnalytics(accessToken, token.gscPropertyUrl, startDate, endDate, ["query"], 50),
      fetchGscAnalytics(accessToken, token.gscPropertyUrl, startDate, endDate, ["page"], 50),
      fetchGscAnalytics(accessToken, token.gscPropertyUrl, priorStart, priorEnd, ["query"], 50),
      fetchGscAnalytics(accessToken, token.gscPropertyUrl, startDate, endDate, ["query"], 1000),
    ]);

    const summary = sumRows(queryRows);
    const prior = sumRows(queryRowsPrior);
    const pct = (a: number, b: number) => b === 0 ? null : ((a - b) / b) * 100;

    const positionDistribution = [
      { bucket: "1-3", count: allPositionRows.filter(r => r.position <= 3).length },
      { bucket: "4-10", count: allPositionRows.filter(r => r.position > 3 && r.position <= 10).length },
      { bucket: "11-20", count: allPositionRows.filter(r => r.position > 10 && r.position <= 20).length },
      { bucket: "21+", count: allPositionRows.filter(r => r.position > 20).length },
    ];

    const responseData = {
      summary: {
        clicks: summary.clicks,
        impressions: summary.impressions,
        ctr: summary.ctr,
        avgPosition: summary.avgPosition,
        clicksDelta: pct(summary.clicks, prior.clicks),
        impressionsDelta: pct(summary.impressions, prior.impressions),
        ctrDelta: pct(summary.ctr, prior.ctr),
        positionDelta: prior.avgPosition === 0 ? null : summary.avgPosition - prior.avgPosition,
      },
      queries: queryRows.map(r => ({
        query: r.keys[0], clicks: r.clicks, impressions: r.impressions,
        ctr: r.ctr, position: Math.round(r.position * 10) / 10,
      })),
      pages: pageRows.map(r => ({
        page: r.keys[0], clicks: r.clicks, impressions: r.impressions,
        ctr: r.ctr, position: Math.round(r.position * 10) / 10,
      })),
      positionDistribution,
      dateRange,
      cachedAt: new Date().toISOString(),
    };

    if (cached) {
      await db.update(gscCacheTable).set({ data: responseData, cachedAt: new Date() }).where(eq(gscCacheTable.id, cached.id));
    } else {
      await db.insert(gscCacheTable).values({ websiteId, dateRange, data: responseData });
    }

    res.json(responseData);
  } catch (err) {
    logger.error({ err }, "GSC data fetch error");
    res.status(502).json({ error: "Failed to fetch data from Google Search Console. Your connection may have expired — try reconnecting." });
  }
});

export default router;
