import { pgTable, serial, timestamp, integer, bigint, doublePrecision, jsonb, index } from "drizzle-orm/pg-core";

export const healthSnapshotsTable = pgTable("health_snapshots", {
  id: serial("id").primaryKey(),
  cpuPct: doublePrecision("cpu_pct"),
  memUsedBytes: bigint("mem_used_bytes", { mode: "number" }),
  memTotalBytes: bigint("mem_total_bytes", { mode: "number" }),
  diskUsedBytes: bigint("disk_used_bytes", { mode: "number" }),
  diskTotalBytes: bigint("disk_total_bytes", { mode: "number" }),
  dbSizeBytes: bigint("db_size_bytes", { mode: "number" }),
  pageViews24h: integer("page_views_24h"),
  activeVisitors: integer("active_visitors"),
  extra: jsonb("extra"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  createdAtIdx: index("health_snapshots_created_at_idx").on(t.createdAt),
}));

export type HealthSnapshot = typeof healthSnapshotsTable.$inferSelect;
