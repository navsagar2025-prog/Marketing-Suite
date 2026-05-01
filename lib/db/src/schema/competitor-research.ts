import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { staffUsersTable } from "./staff-users";

export const competitorResearchSessionsTable = pgTable("competitor_research_sessions", {
  id: serial("id").primaryKey(),
  staffUserId: integer("staff_user_id").notNull().references(() => staffUsersTable.id, { onDelete: "cascade" }),
  domain: text("domain").notNull(),
  result: jsonb("result").notNull().default({}),
  cachedUntil: timestamp("cached_until", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCompetitorResearchSessionSchema = createInsertSchema(competitorResearchSessionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertCompetitorResearchSession = z.infer<typeof insertCompetitorResearchSessionSchema>;
export type CompetitorResearchSession = typeof competitorResearchSessionsTable.$inferSelect;
