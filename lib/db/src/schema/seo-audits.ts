import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { websitesTable } from "./websites";

export const seoAuditsTable = pgTable("seo_audits", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id").notNull().references(() => websitesTable.id, { onDelete: "cascade" }),
  score: integer("score").notNull(),
  issuesJson: jsonb("issues_json").notNull().default("[]"),
  crawledData: jsonb("crawled_data"),
  crawledAt: timestamp("crawled_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSeoAuditSchema = createInsertSchema(seoAuditsTable).omit({ id: true, crawledAt: true });
export type InsertSeoAudit = z.infer<typeof insertSeoAuditSchema>;
export type SeoAudit = typeof seoAuditsTable.$inferSelect;
