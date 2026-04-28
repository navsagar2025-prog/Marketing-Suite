import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { websitesTable } from "./websites";

export const competitorAnalysesTable = pgTable("competitor_analyses", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id").notNull().references(() => websitesTable.id, { onDelete: "cascade" }),
  competitorUrl: text("competitor_url").notNull(),
  analysisJson: jsonb("analysis_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCompetitorAnalysisSchema = createInsertSchema(competitorAnalysesTable).omit({ id: true, createdAt: true });
export type InsertCompetitorAnalysis = z.infer<typeof insertCompetitorAnalysisSchema>;
export type CompetitorAnalysis = typeof competitorAnalysesTable.$inferSelect;
