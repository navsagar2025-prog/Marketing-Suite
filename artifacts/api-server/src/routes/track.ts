import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import crypto from "node:crypto";
import { db, pageViewsTable, visitorSessionsTable } from "@workspace/db";
import { logger } from "../lib/logger.js";
import { getDbSetting } from "../lib/ai-provider.js";
import { requireAdmin } from "../lib/auth.js";

const router: IRouter = Router();

const BOT_UA = /bot|crawler|spider|crawling|slurp|facebookexternalhit|preview|fetch|wget|curl|python-requests|axios|node-fetch|headless/i;
const VISITOR_COOKIE = "vsid";
const VISITOR_TTL_DAYS = 365;
const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

const isBotUa = (ua: string | undefined | null): boolean => !ua || BOT_UA.test(ua);

const hashIp = (ip: string | undefined): string | null => {
  if (!ip) return null;
  const salt = process.env.SESSION_SECRET ?? "static-salt";
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
};

const newVisitorId = (): string => crypto.randomBytes(16).toString("hex");

const readVisitorCookie = (req: Request): string | null => {
  const raw = req.headers.cookie;
  if (!raw) return null;
  const match = raw.split(";").map(s => s.trim()).find(s => s.startsWith(`${VISITOR_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(VISITOR_COOKIE.length + 1)) : null;
};

const ensureVisitor = (req: Request, res: Response): string => {
  const existing = readVisitorCookie(req);
  if (existing && /^[a-f0-9]{32}$/i.test(existing)) return existing;
  const id = newVisitorId();
  const maxAge = VISITOR_TTL_DAYS * 24 * 60 * 60;
  const secure = (req.headers["x-forwarded-proto"] ?? req.protocol) === "https" ? "; Secure" : "";
  res.append("Set-Cookie", `${VISITOR_COOKIE}=${id}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`);
  return id;
};

router.post("/track/pageview", async (req, res): Promise<void> => {
  const ua = req.headers["user-agent"] ?? "";
  if (isBotUa(ua)) { res.status(204).end(); return; }
  const path = typeof req.body?.path === "string" ? String(req.body.path).slice(0, 500) : null;
  if (!path) { res.status(400).json({ error: "path required" }); return; }
  const referrer = typeof req.body?.referrer === "string" ? String(req.body.referrer).slice(0, 500) : null;
  const visitorId = ensureVisitor(req, res);
  const ipHash = hashIp(req.ip);
  try {
    await db.insert(pageViewsTable).values({ path, referrer, ipHash, userAgent: String(ua).slice(0, 300), visitorId });
    await db.insert(visitorSessionsTable)
      .values({ visitorId, ipHash, userAgent: String(ua).slice(0, 300) })
      .onConflictDoUpdate({
        target: visitorSessionsTable.visitorId,
        set: { lastSeenAt: new Date(), ipHash, userAgent: String(ua).slice(0, 300) },
      });
  } catch (err) {
    logger.warn({ err }, "Failed to record page view");
  }
  res.status(204).end();
});

router.post("/track/heartbeat", async (req, res): Promise<void> => {
  const ua = req.headers["user-agent"] ?? "";
  if (isBotUa(ua)) { res.status(204).end(); return; }
  const visitorId = ensureVisitor(req, res);
  const ipHash = hashIp(req.ip);
  try {
    await db.insert(visitorSessionsTable)
      .values({ visitorId, ipHash, userAgent: String(ua).slice(0, 300) })
      .onConflictDoUpdate({
        target: visitorSessionsTable.visitorId,
        set: { lastSeenAt: new Date(), ipHash, userAgent: String(ua).slice(0, 300) },
      });
    const cutoff = new Date(Date.now() - 10 * 60 * 1000);
    await db
      .update(pageViewsTable)
      .set({ confirmed: true })
      .where(and(eq(pageViewsTable.visitorId, visitorId), gte(pageViewsTable.createdAt, cutoff)));
  } catch (err) {
    logger.warn({ err }, "Failed to record heartbeat");
  }
  res.status(204).end();
});

const ga4Buckets = new Map<string, { count: number; reset: number }>();
const GA4_LIMIT_PER_MIN = 30;
const GA4_MAX_BODY = 16 * 1024;

const ga4RateLimited = (key: string): boolean => {
  const now = Date.now();
  const b = ga4Buckets.get(key);
  if (!b || b.reset < now) {
    ga4Buckets.set(key, { count: 1, reset: now + 60_000 });
    return false;
  }
  b.count += 1;
  return b.count > GA4_LIMIT_PER_MIN;
};

router.post("/track/ga4", async (req, res): Promise<void> => {
  const ua = req.headers["user-agent"] ?? "";
  if (isBotUa(ua)) { res.status(204).end(); return; }
  const ipHash = hashIp(req.ip) ?? req.ip ?? "anon";
  if (ga4RateLimited(ipHash)) { res.status(429).json({ error: "Too many requests" }); return; }
  const raw = JSON.stringify(req.body ?? {});
  if (raw.length > GA4_MAX_BODY) { res.status(413).json({ error: "Payload too large" }); return; }
  const measurementId = await getDbSetting("ga4_measurement_id");
  const apiSecret = await getDbSetting("ga4_api_secret");
  if (!measurementId || !apiSecret) {
    res.status(503).json({ error: "GA4 not configured" });
    return;
  }
  const events = Array.isArray(req.body?.events) ? req.body.events : null;
  if (!events || events.length === 0 || events.length > 25) {
    res.status(400).json({ error: "events array (1-25) required" });
    return;
  }
  for (const ev of events) {
    if (typeof ev?.name !== "string" || !/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(ev.name)) {
      res.status(400).json({ error: "Invalid event name" });
      return;
    }
  }
  const visitorId = ensureVisitor(req, res);
  const clientId = typeof req.body?.client_id === "string" ? req.body.client_id : visitorId;
  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_id: clientId, events }),
    });
    if (!r.ok) {
      logger.warn({ status: r.status }, "GA4 forward failed");
      res.status(502).json({ error: "GA4 forward failed", status: r.status });
      return;
    }
    res.status(204).end();
  } catch (err) {
    logger.warn({ err }, "GA4 forward error");
    res.status(502).json({ error: "GA4 forward failed" });
  }
});

const adminTrackRouter: IRouter = Router();
adminTrackRouter.use(requireAdmin);

adminTrackRouter.get("/admin/active-visitors", async (_req, res): Promise<void> => {
  const cutoff = new Date(Date.now() - ACTIVE_WINDOW_MS);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(visitorSessionsTable)
    .where(gte(visitorSessionsTable.lastSeenAt, cutoff));
  res.json({ activeVisitors: row?.count ?? 0 });
});

adminTrackRouter.get("/admin/top-pages", async (req, res): Promise<void> => {
  const daysRaw = Number(req.query.days);
  const days = daysRaw > 0 && daysRaw <= 90 ? daysRaw : 7;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      path: pageViewsTable.path,
      views: sql<number>`count(*)::int`,
      uniqueVisitors: sql<number>`count(distinct ${pageViewsTable.visitorId})::int`,
    })
    .from(pageViewsTable)
    .where(and(gte(pageViewsTable.createdAt, cutoff), eq(pageViewsTable.confirmed, true)))
    .groupBy(pageViewsTable.path)
    .orderBy(desc(sql`count(*)`))
    .limit(20);
  res.json({ days, pages: rows });
});

export { adminTrackRouter };
export default router;
