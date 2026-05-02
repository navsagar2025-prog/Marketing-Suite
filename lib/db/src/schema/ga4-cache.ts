import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { websitesTable } from "./websites";

export const ga4CacheTable = pgTable("ga4_cache", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id").notNull().references(() => websitesTable.id, { onDelete: "cascade" }),
  cacheKey: text("cache_key").notNull(),
  data: jsonb("data").notNull(),
  cachedAt: timestamp("cached_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Ga4Cache = typeof ga4CacheTable.$inferSelect;
