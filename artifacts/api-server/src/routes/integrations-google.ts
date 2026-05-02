/**
 * Authenticated Google / GSC integration routes.
 * The public callback route lives in integrations-google-callback.ts.
 */
import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { createHmac, randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { db, oauthTokensTable, gscCacheTable, ga4CacheTable, keywordsTable, keywordRankHistoryTable } from "@workspace/db";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const _rawSecret = process.env.SESSION_SECRET;
if (!_rawSecret) throw new Error("SESSION_SECRET environment variable is required");
const SESSION_SECRET: string = _rawSecret;

const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
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
    ga4PropertyId: token?.ga4PropertyId ?? null,
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
  const body: Record<string, unknown> = { startDate, endDate, rowLimit, startRow: 0 };
  if (dimensions.length > 0) body.dimensions = dimensions;
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(propertyUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const body2 = await res.text();
    throw new Error(`GSC searchAnalytics.query failed (${res.status}): ${body2}`);
  }
  const data = await res.json() as { rows?: Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }> };
  return data.rows ?? [];
}

/** Fetch property-level totals (no dimensions = aggregate over whole property) */
async function fetchGscPropertyTotals(
  accessToken: string,
  propertyUrl: string,
  startDate: string,
  endDate: string,
): Promise<{ clicks: number; impressions: number; ctr: number; position: number }> {
  const rows = await fetchGscAnalytics(accessToken, propertyUrl, startDate, endDate, []);
  if (rows.length === 0) return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  const r = rows[0];
  return { clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position };
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** GET /integrations/google/gsc/:websiteId?dateRange=28days */
router.get("/integrations/google/gsc/:websiteId", async (req, res): Promise<void> => {
  const websiteId = parseInt(req.params.websiteId);
  if (isNaN(websiteId)) { res.status(400).json({ error: "Invalid websiteId" }); return; }

  const dateRange = (req.query.dateRange as string) ?? "28days";
  if (!DATE_RANGES[dateRange]) { res.status(400).json({ error: "dateRange must be 7days, 28days, or 90days" }); return; }
  const forceRefresh = req.query.refresh === "true";

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

  if (!forceRefresh && cached && Date.now() - cached.cachedAt.getTime() < CACHE_TTL_MS) {
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

    // Fetch property-level totals (no dimensions) for accurate summary metrics,
    // plus per-query/page rows (limited) for the tables, plus wide query set for position distribution.
    const [totals, priorTotals, queryRows, pageRows, allPositionRows] = await Promise.all([
      fetchGscPropertyTotals(accessToken, token.gscPropertyUrl, startDate, endDate),
      fetchGscPropertyTotals(accessToken, token.gscPropertyUrl, priorStart, priorEnd),
      fetchGscAnalytics(accessToken, token.gscPropertyUrl, startDate, endDate, ["query"], 50),
      fetchGscAnalytics(accessToken, token.gscPropertyUrl, startDate, endDate, ["page"], 50),
      fetchGscAnalytics(accessToken, token.gscPropertyUrl, startDate, endDate, ["query"], 1000),
    ]);

    const pct = (a: number, b: number) => b === 0 ? null : ((a - b) / b) * 100;

    const positionDistribution = [
      { bucket: "1-3", count: allPositionRows.filter(r => r.position <= 3).length },
      { bucket: "4-10", count: allPositionRows.filter(r => r.position > 3 && r.position <= 10).length },
      { bucket: "11-20", count: allPositionRows.filter(r => r.position > 10 && r.position <= 20).length },
      { bucket: "21+", count: allPositionRows.filter(r => r.position > 20).length },
    ];

    const responseData = {
      summary: {
        clicks: totals.clicks,
        impressions: totals.impressions,
        ctr: totals.ctr,
        avgPosition: Math.round(totals.position * 10) / 10,
        clicksDelta: pct(totals.clicks, priorTotals.clicks),
        impressionsDelta: pct(totals.impressions, priorTotals.impressions),
        ctrDelta: pct(totals.ctr, priorTotals.ctr),
        positionDelta: priorTotals.position === 0 ? null : Math.round((totals.position - priorTotals.position) * 10) / 10,
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

// ─── GA4 Analytics ───────────────────────────────────────────────────────────

const GA4_DATE_RANGES: Record<string, string> = { "7d": "7daysAgo", "30d": "30daysAgo", "90d": "90daysAgo" };

function normalizeGa4PropertyId(id: string): string {
  const stripped = id.trim().replace(/^properties\//i, "");
  return `properties/${stripped}`;
}

async function runGa4Report(
  accessToken: string,
  propertyId: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/${propertyId}:runReport`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GA4 API error (${res.status}): ${text}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

// TTL per date-range shorthand (ms)
const GA4_CACHE_TTL: Record<string, number> = {
  "7d":  15 * 60 * 1000,        // 15 minutes
  "30d": 60 * 60 * 1000,        // 1 hour
  "90d": 4  * 60 * 60 * 1000,   // 4 hours
};
const GA4_EXPLICIT_TTL = 60 * 60 * 1000; // 1 hour for explicit date ranges

/** POST /integrations/google/ga4/:websiteId/property — save GA4 Property ID */
router.post("/integrations/google/ga4/:websiteId/property", async (req, res): Promise<void> => {
  const websiteId = parseInt(req.params.websiteId);
  if (isNaN(websiteId)) { res.status(400).json({ error: "Invalid websiteId" }); return; }

  const { ga4PropertyId } = req.body as { ga4PropertyId?: string };

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

  const normalized = ga4PropertyId?.trim() ? normalizeGa4PropertyId(ga4PropertyId) : null;
  await db.update(oauthTokensTable).set({ ga4PropertyId: normalized }).where(eq(oauthTokensTable.id, token.id));
  // Invalidate all cached GA4 data for this website when the property ID changes
  await db.delete(ga4CacheTable).where(eq(ga4CacheTable.websiteId, websiteId));
  res.json({ success: true, ga4PropertyId: normalized });
});

/** GET /integrations/google/ga4/:websiteId — fetch GA4 report data */
router.get("/integrations/google/ga4/:websiteId", async (req, res): Promise<void> => {
  const websiteId = parseInt(req.params.websiteId);
  if (isNaN(websiteId)) { res.status(400).json({ error: "Invalid websiteId" }); return; }

  const forceRefresh = req.query.refresh === "true";

  // Support explicit startDate/endDate params OR the convenience dateRange shorthand
  let startDate: string;
  let endDate = "today";
  let dateRange: string | undefined;
  let cacheTtl: number;
  const explicitStart = req.query.startDate as string | undefined;
  const explicitEnd = req.query.endDate as string | undefined;
  if (explicitStart) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(explicitStart)) {
      res.status(400).json({ error: "startDate must be in YYYY-MM-DD format" }); return;
    }
    startDate = explicitStart;
    if (explicitEnd) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(explicitEnd)) {
        res.status(400).json({ error: "endDate must be in YYYY-MM-DD format" }); return;
      }
      endDate = explicitEnd;
    }
    cacheTtl = GA4_EXPLICIT_TTL;
  } else {
    dateRange = (req.query.dateRange as string) ?? "30d";
    const resolved = GA4_DATE_RANGES[dateRange];
    if (!resolved) { res.status(400).json({ error: "dateRange must be 7d, 30d, or 90d" }); return; }
    startDate = resolved;
    cacheTtl = GA4_CACHE_TTL[dateRange] ?? GA4_EXPLICIT_TTL;
  }

  // Cache key: prefer dateRange shorthand, fall back to explicit date string
  const cacheKey = dateRange ? `dr:${dateRange}` : `sd:${startDate}:${endDate}`;

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
  if (!token.ga4PropertyId) { res.status(400).json({ error: "GA4_PROPERTY_NOT_SET", message: "No GA4 property configured. Enter your GA4 Property ID in Settings." }); return; }

  // Check cache (skip on forceRefresh)
  const [cached] = await db
    .select()
    .from(ga4CacheTable)
    .where(and(eq(ga4CacheTable.websiteId, websiteId), eq(ga4CacheTable.cacheKey, cacheKey)))
    .orderBy(desc(ga4CacheTable.cachedAt))
    .limit(1);

  if (!forceRefresh && cached && Date.now() - cached.cachedAt.getTime() < cacheTtl) {
    res.json(cached.data);
    return;
  }

  const propertyId = token.ga4PropertyId;
  const dateRangeParam = [{ startDate, endDate }];

  try {
    const accessToken = await getValidAccessToken(token);

    const [summaryData, topPagesData, sourcesData, devicesData] = await Promise.all([
      runGa4Report(accessToken, propertyId, {
        dateRanges: dateRangeParam,
        metrics: [
          { name: "sessions" },
          { name: "activeUsers" },
          { name: "bounceRate" },
          { name: "averageSessionDuration" },
        ],
      }),
      runGa4Report(accessToken, propertyId, {
        dateRanges: dateRangeParam,
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 10,
      }),
      runGa4Report(accessToken, propertyId, {
        dateRanges: dateRangeParam,
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      }),
      runGa4Report(accessToken, propertyId, {
        dateRanges: dateRangeParam,
        dimensions: [{ name: "deviceCategory" }],
        metrics: [{ name: "sessions" }],
      }),
    ]);

    type Ga4Row = { dimensionValues?: Array<{ value: string }>; metricValues: Array<{ value: string }> };
    const summaryRows = (summaryData.rows as Ga4Row[] | undefined) ?? [];
    const summaryRow = summaryRows[0];
    const sessions = summaryRow ? parseInt(summaryRow.metricValues[0]?.value ?? "0", 10) : 0;
    const users = summaryRow ? parseInt(summaryRow.metricValues[1]?.value ?? "0", 10) : 0;
    const bounceRate = summaryRow ? parseFloat(summaryRow.metricValues[2]?.value ?? "0") : 0;
    const avgSessionDuration = summaryRow ? parseFloat(summaryRow.metricValues[3]?.value ?? "0") : 0;

    const topPagesRows = (topPagesData.rows as Ga4Row[] | undefined) ?? [];
    const topPages = topPagesRows.map(r => ({
      page: r.dimensionValues?.[0]?.value ?? "",
      sessions: parseInt(r.metricValues[0]?.value ?? "0", 10),
    }));

    const sourcesRows = (sourcesData.rows as Ga4Row[] | undefined) ?? [];
    const totalSourceSessions = sourcesRows.reduce((s, r) => s + parseInt(r.metricValues[0]?.value ?? "0", 10), 0);
    const trafficSources = sourcesRows.map(r => {
      const sess = parseInt(r.metricValues[0]?.value ?? "0", 10);
      return {
        channel: r.dimensionValues?.[0]?.value ?? "Unknown",
        sessions: sess,
        percentage: totalSourceSessions > 0 ? Math.round((sess / totalSourceSessions) * 1000) / 10 : 0,
      };
    });

    const devicesRows = (devicesData.rows as Ga4Row[] | undefined) ?? [];
    const totalDeviceSessions = devicesRows.reduce((s, r) => s + parseInt(r.metricValues[0]?.value ?? "0", 10), 0);
    const devices = devicesRows.map(r => {
      const sess = parseInt(r.metricValues[0]?.value ?? "0", 10);
      return {
        category: r.dimensionValues?.[0]?.value ?? "Unknown",
        sessions: sess,
        percentage: totalDeviceSessions > 0 ? Math.round((sess / totalDeviceSessions) * 1000) / 10 : 0,
      };
    });

    const now = new Date();
    const responseData = {
      summary: { sessions, users, bounceRate: Math.round(bounceRate * 1000) / 10, avgSessionDuration: Math.round(avgSessionDuration) },
      topPages,
      trafficSources,
      devices,
      dateRange: dateRange ?? `${startDate}:${endDate}`,
      ga4PropertyId: propertyId,
      cachedAt: now.toISOString(),
    };

    // Upsert into cache
    if (cached) {
      await db.update(ga4CacheTable)
        .set({ data: responseData, cachedAt: now })
        .where(eq(ga4CacheTable.id, cached.id));
    } else {
      await db.insert(ga4CacheTable).values({ websiteId, cacheKey, data: responseData });
    }

    res.json(responseData);
  } catch (err) {
    logger.error({ err }, "GA4 data fetch error");
    res.status(502).json({ error: "Failed to fetch data from Google Analytics 4. Your connection may have expired or the property ID is incorrect — try reconnecting." });
  }
});

/** POST /integrations/google/keywords-sync/:websiteId — pull live positions from GSC into tracked keywords */
router.post("/integrations/google/keywords-sync/:websiteId", async (req, res): Promise<void> => {
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

  if (!token) { res.status(404).json({ error: "Google Search Console is not connected for this website" }); return; }
  if (!token.gscPropertyUrl) { res.status(400).json({ error: "No GSC property selected. Please select a property first." }); return; }

  try {
    const accessToken = await getValidAccessToken(token);
    const endDate = formatDate(new Date());
    const startDate = formatDate(new Date(Date.now() - 28 * 24 * 60 * 60 * 1000));

    const gscRows = await fetchGscAnalytics(accessToken, token.gscPropertyUrl, startDate, endDate, ["query"], 1000);

    const gscMap = new Map<string, number>();
    for (const row of gscRows) {
      if (row.keys[0]) gscMap.set(row.keys[0].toLowerCase().trim(), Math.round(row.position));
    }

    const trackedKeywords = await db.select().from(keywordsTable).where(eq(keywordsTable.websiteId, websiteId));
    const today = new Date().toISOString().slice(0, 10);

    let updated = 0;
    let notFound = 0;

    for (const kw of trackedKeywords) {
      const gscPosition = gscMap.get(kw.keyword.toLowerCase().trim());
      if (gscPosition !== undefined) {
        await db.update(keywordsTable).set({ currentRank: gscPosition }).where(eq(keywordsTable.id, kw.id));
        await db
          .insert(keywordRankHistoryTable)
          .values({ keywordId: kw.id, rank: gscPosition, recordedDate: today })
          .onConflictDoUpdate({ target: [keywordRankHistoryTable.keywordId, keywordRankHistoryTable.recordedDate], set: { rank: gscPosition } });
        updated++;
      } else {
        notFound++;
      }
    }

    res.json({ updated, notFound, total: trackedKeywords.length, date: today });
  } catch (err) {
    logger.error({ err }, "GSC keywords sync error");
    res.status(502).json({ error: "Failed to sync from Google Search Console. Your connection may have expired — try reconnecting." });
  }
});

export default router;
