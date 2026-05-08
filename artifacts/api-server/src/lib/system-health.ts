import os from "node:os";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { exec as execCb } from "node:child_process";
import { sql, lt, eq, and, isNotNull } from "drizzle-orm";
import {
  db,
  healthSnapshotsTable,
  pageViewsTable,
  visitorSessionsTable,
  passwordResetTokensTable,
  sessionsTable,
  clientReportsTable,
  mediaAssetsTable,
  galleryImagesTable,
} from "@workspace/db";
import { FILES_BASE_DIR } from "./path-jail.js";
import { getDbSetting } from "./ai-provider.js";

const exec = promisify(execCb);

export type SystemMetrics = {
  cpuPct: number | null;
  loadAvg: number[];
  memUsedBytes: number;
  memTotalBytes: number;
  diskUsedBytes: number | null;
  diskTotalBytes: number | null;
  uptimeSec: number;
  processRssBytes: number;
  nodeVersion: string;
  platform: string;
};

const sampleCpuPct = async (): Promise<number | null> => {
  const sample = (): { idle: number; total: number } => {
    const cpus = os.cpus();
    let idle = 0, total = 0;
    for (const c of cpus) {
      idle += c.times.idle;
      total += c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq;
    }
    return { idle, total };
  };
  const a = sample();
  await new Promise(r => setTimeout(r, 200));
  const b = sample();
  const idleDiff = b.idle - a.idle;
  const totalDiff = b.total - a.total;
  if (totalDiff <= 0) return null;
  return Math.round(((1 - idleDiff / totalDiff) * 100) * 100) / 100;
};

const readDisk = async (target: string): Promise<{ used: number; total: number } | null> => {
  try {
    const { stdout } = await exec(`df -kP ${JSON.stringify(target)}`);
    const lines = stdout.trim().split("\n");
    const last = lines[lines.length - 1];
    const parts = last.split(/\s+/);
    const totalK = Number(parts[1]);
    const usedK = Number(parts[2]);
    if (Number.isFinite(totalK) && Number.isFinite(usedK)) {
      return { used: usedK * 1024, total: totalK * 1024 };
    }
  } catch {}
  return null;
};

export const collectSystemMetrics = async (): Promise<SystemMetrics> => {
  const memTotal = os.totalmem();
  const memFree = os.freemem();
  const cpuPct = await sampleCpuPct();
  const disk = await readDisk(process.cwd());
  return {
    cpuPct,
    loadAvg: os.loadavg(),
    memUsedBytes: memTotal - memFree,
    memTotalBytes: memTotal,
    diskUsedBytes: disk?.used ?? null,
    diskTotalBytes: disk?.total ?? null,
    uptimeSec: Math.round(process.uptime()),
    processRssBytes: process.memoryUsage().rss,
    nodeVersion: process.version,
    platform: `${os.platform()} ${os.release()}`,
  };
};

export type DbTableSize = { name: string; sizeBytes: number; rowEstimate: number };

export const collectDbSizes = async (): Promise<{ totalBytes: number; tables: DbTableSize[] }> => {
  const totalRows = await db.execute<{ total: string }>(sql`select pg_database_size(current_database())::text as total`);
  const totalBytes = Number((totalRows.rows[0] as { total?: string } | undefined)?.total ?? 0);
  const tableRows = await db.execute<{ relname: string; size: string; rows: string }>(sql`
    select c.relname,
           pg_total_relation_size(c.oid)::text as size,
           coalesce(c.reltuples, 0)::text as rows
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r' and n.nspname = 'public'
    order by pg_total_relation_size(c.oid) desc
    limit 20
  `);
  const tables = (tableRows.rows as Array<{ relname: string; size: string; rows: string }>).map(r => ({
    name: r.relname,
    sizeBytes: Number(r.size),
    rowEstimate: Math.round(Number(r.rows)),
  }));
  return { totalBytes, tables };
};

const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

export const collectVisitorMetrics = async (): Promise<{ pageViews24h: number; activeVisitors: number }> => {
  const cutoff24 = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const cutoffActive = new Date(Date.now() - ACTIVE_WINDOW_MS);
  const [pv] = await db.select({ c: sql<number>`count(*)::int` }).from(pageViewsTable).where(sql`${pageViewsTable.createdAt} >= ${cutoff24} and ${pageViewsTable.confirmed} = true`);
  const [av] = await db.select({ c: sql<number>`count(*)::int` }).from(visitorSessionsTable).where(sql`${visitorSessionsTable.lastSeenAt} >= ${cutoffActive}`);
  return { pageViews24h: pv?.c ?? 0, activeVisitors: av?.c ?? 0 };
};

const safeBig = (n: number | null | undefined): number | null => {
  if (n == null || !Number.isFinite(n)) return null;
  if (n > Number.MAX_SAFE_INTEGER) return Number.MAX_SAFE_INTEGER;
  if (n < 0) return 0;
  return Math.round(n);
};

export const recordHealthSnapshot = async (): Promise<void> => {
  const m = await collectSystemMetrics();
  const db_ = await collectDbSizes();
  const v = await collectVisitorMetrics();
  await db.insert(healthSnapshotsTable).values({
    cpuPct: m.cpuPct,
    memUsedBytes: safeBig(m.memUsedBytes),
    memTotalBytes: safeBig(m.memTotalBytes),
    diskUsedBytes: safeBig(m.diskUsedBytes),
    diskTotalBytes: safeBig(m.diskTotalBytes),
    dbSizeBytes: safeBig(db_.totalBytes),
    pageViews24h: v.pageViews24h,
    activeVisitors: v.activeVisitors,
    extra: { topTables: db_.tables.slice(0, 5), uptimeSec: m.uptimeSec },
  });
  const cutoff = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
  await db.delete(healthSnapshotsTable).where(lt(healthSnapshotsTable.createdAt, cutoff));
};

const collectDiskFiles = async (root: string): Promise<string[]> => {
  const out: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.isFile()) out.push(full);
    }
  };
  await walk(root);
  return out;
};

const collectDbFileRefs = async (): Promise<Set<string>> => {
  const refs = new Set<string>();
  const add = (u: string | null | undefined): void => {
    if (!u) return;
    const m = u.match(/\/([a-zA-Z0-9._\-/]+)$/);
    if (m) refs.add(path.basename(u));
    refs.add(u);
  };
  const media = await db.select({ url: mediaAssetsTable.url }).from(mediaAssetsTable);
  media.forEach(m => add(m.url));
  const gallery = await db.select({ url: galleryImagesTable.url }).from(galleryImagesTable);
  gallery.forEach(g => add(g.url));
  return refs;
};

export type CleanupReport = { orphanedFiles: { count: number; sampleNames: string[]; freedBytes: number } };

export const scanOrphanedFiles = async (execute: boolean): Promise<CleanupReport> => {
  let root = FILES_BASE_DIR;
  try { await fs.access(root); } catch { return { orphanedFiles: { count: 0, sampleNames: [], freedBytes: 0 } }; }
  const allFiles = await collectDiskFiles(root);
  const dbRefs = await collectDbFileRefs();
  const orphans: { full: string; bytes: number }[] = [];
  for (const f of allFiles) {
    const base = path.basename(f);
    const rel = path.relative(root, f);
    if (dbRefs.has(base) || dbRefs.has(rel) || dbRefs.has(f)) continue;
    try {
      const st = await fs.stat(f);
      const ageMs = Date.now() - st.mtimeMs;
      if (ageMs < 7 * 24 * 60 * 60 * 1000) continue;
      orphans.push({ full: f, bytes: st.size });
    } catch {}
  }
  let freedBytes = 0;
  if (execute) {
    for (const o of orphans) {
      try { await fs.unlink(o.full); freedBytes += o.bytes; } catch {}
    }
  } else {
    freedBytes = orphans.reduce((s, o) => s + o.bytes, 0);
  }
  return {
    orphanedFiles: {
      count: orphans.length,
      sampleNames: orphans.slice(0, 10).map(o => path.basename(o.full)),
      freedBytes,
    },
  };
};

export type TokenSweep = { passwordResetTokens: number; sessions: number; pageViews: number; visitorSessions: number; shareTokens: number };

export const purgeExpiredTokens = async (execute: boolean): Promise<TokenSweep> => {
  const now = new Date();
  const pageViewCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const visitorCutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const shareCutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

  const [prtCount] = await db.select({ c: sql<number>`count(*)::int` }).from(passwordResetTokensTable).where(sql`${passwordResetTokensTable.expiresAt} < ${now} or ${passwordResetTokensTable.used} = true`);
  const [sessCount] = await db.select({ c: sql<number>`count(*)::int` }).from(sessionsTable).where(sql`${sessionsTable.expiresAt} < ${now} or ${sessionsTable.revokedAt} is not null`);
  const [pvCount] = await db.select({ c: sql<number>`count(*)::int` }).from(pageViewsTable).where(sql`${pageViewsTable.createdAt} < ${pageViewCutoff}`);
  const [vsCount] = await db.select({ c: sql<number>`count(*)::int` }).from(visitorSessionsTable).where(sql`${visitorSessionsTable.lastSeenAt} < ${visitorCutoff}`);
  const [shareCount] = await db.select({ c: sql<number>`count(*)::int` }).from(clientReportsTable).where(sql`${clientReportsTable.createdAt} < ${shareCutoff}`);

  if (execute) {
    await db.delete(passwordResetTokensTable).where(sql`${passwordResetTokensTable.expiresAt} < ${now} or ${passwordResetTokensTable.used} = true`);
    await db.delete(sessionsTable).where(sql`${sessionsTable.expiresAt} < ${now} or ${sessionsTable.revokedAt} is not null`);
    await db.delete(pageViewsTable).where(sql`${pageViewsTable.createdAt} < ${pageViewCutoff}`);
    await db.delete(visitorSessionsTable).where(sql`${visitorSessionsTable.lastSeenAt} < ${visitorCutoff}`);
    await db.delete(clientReportsTable).where(sql`${clientReportsTable.createdAt} < ${shareCutoff}`);
  }

  return {
    passwordResetTokens: prtCount?.c ?? 0,
    sessions: sessCount?.c ?? 0,
    pageViews: pvCount?.c ?? 0,
    visitorSessions: vsCount?.c ?? 0,
    shareTokens: shareCount?.c ?? 0,
  };
};

export const runDailyHealthMaintenance = async (): Promise<void> => {
  await recordHealthSnapshot();
  const auto = await getDbSetting("auto_cleanup_enabled");
  if (auto === "true") {
    await purgeExpiredTokens(true);
    await scanOrphanedFiles(true);
  }
};

void and; void eq; void isNotNull;
