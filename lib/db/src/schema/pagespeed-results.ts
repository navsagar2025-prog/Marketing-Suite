import { pgTable, serial, integer, timestamp, real, text } from "drizzle-orm/pg-core";
import { websitesTable } from "./websites";

export const pagespeedResultsTable = pgTable("pagespeed_results", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id").notNull().references(() => websitesTable.id, { onDelete: "cascade" }),
  strategy: text("strategy").notNull(),
  performanceScore: integer("performance_score"),
  accessibilityScore: integer("accessibility_score"),
  bestPracticesScore: integer("best_practices_score"),
  seoScore: integer("seo_score"),
  lcpMs: real("lcp_ms"),
  fcpMs: real("fcp_ms"),
  clsScore: real("cls_score"),
  inpMs: real("inp_ms"),
  ttfbMs: real("ttfb_ms"),
  speedIndexMs: real("speed_index_ms"),
  error: text("error"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PagespeedResult = typeof pagespeedResultsTable.$inferSelect;
