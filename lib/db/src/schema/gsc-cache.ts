import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { websitesTable } from "./websites";

export const gscCacheTable = pgTable("gsc_cache", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id").notNull().references(() => websitesTable.id, { onDelete: "cascade" }),
  dateRange: text("date_range").notNull(),
  data: jsonb("data").notNull(),
  cachedAt: timestamp("cached_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GscCache = typeof gscCacheTable.$inferSelect;
