import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, healthSnapshotsTable } from "@workspace/db";
import { HealthCheckResponse } from "@workspace/api-zod";
import { requireAdmin } from "../lib/auth.js";
import { getDbSetting, setDbSetting } from "../lib/ai-provider.js";
import {
  collectSystemMetrics,
  collectDbSizes,
  collectVisitorMetrics,
  recordHealthSnapshot,
  scanOrphanedFiles,
  purgeExpiredTokens,
} from "../lib/system-health.js";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

const adminHealth: IRouter = Router();
adminHealth.use(requireAdmin);

adminHealth.get("/admin/system-health", async (_req, res): Promise<void> => {
  const [metrics, dbSizes, visitors, autoSetting, ga4MeasurementId, ga4ApiSecret] = await Promise.all([
    collectSystemMetrics(),
    collectDbSizes(),
    collectVisitorMetrics(),
    getDbSetting("auto_cleanup_enabled"),
    getDbSetting("ga4_measurement_id"),
    getDbSetting("ga4_api_secret"),
  ]);
  res.json({
    metrics,
    db: dbSizes,
    visitors,
    autoCleanupEnabled: autoSetting === "true",
    ga4Configured: Boolean(ga4MeasurementId && ga4ApiSecret),
  });
});

adminHealth.get("/admin/system-health/snapshots", async (_req, res): Promise<void> => {
  const rows = await db.select().from(healthSnapshotsTable).orderBy(desc(healthSnapshotsTable.createdAt)).limit(60);
  res.json(rows);
});

adminHealth.post("/admin/system-health/snapshot", async (_req, res): Promise<void> => {
  await recordHealthSnapshot();
  res.json({ ok: true });
});

adminHealth.post("/admin/system-health/cleanup-files", async (req, res): Promise<void> => {
  const execute = Boolean(req.body?.execute);
  const result = await scanOrphanedFiles(execute);
  res.json({ executed: execute, ...result });
});

adminHealth.post("/admin/system-health/purge-tokens", async (req, res): Promise<void> => {
  const execute = Boolean(req.body?.execute);
  const includeShareTokens = Boolean(req.body?.includeShareTokens);
  const result = await purgeExpiredTokens(execute, includeShareTokens);
  res.json({ executed: execute, includedShareTokens: includeShareTokens, ...result });
});

adminHealth.post("/admin/system-health/auto-cleanup", async (req, res): Promise<void> => {
  const enabled = Boolean(req.body?.enabled);
  await setDbSetting("auto_cleanup_enabled", enabled ? "true" : "false");
  res.json({ enabled });
});

adminHealth.post("/admin/system-health/ga4-config", async (req, res): Promise<void> => {
  const measurementId = typeof req.body?.measurementId === "string" ? req.body.measurementId.trim() : "";
  const apiSecret = typeof req.body?.apiSecret === "string" ? req.body.apiSecret.trim() : "";
  if (measurementId) await setDbSetting("ga4_measurement_id", measurementId);
  if (apiSecret) await setDbSetting("ga4_api_secret", apiSecret);
  if (!measurementId && req.body?.measurementId === "") await setDbSetting("ga4_measurement_id", "");
  if (!apiSecret && req.body?.apiSecret === "") await setDbSetting("ga4_api_secret", "");
  res.json({ ok: true });
});

export { adminHealth };
export default router;
