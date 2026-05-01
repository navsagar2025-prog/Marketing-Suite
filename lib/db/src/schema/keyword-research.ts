import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { staffUsersTable } from "./staff-users";
import { websitesTable } from "./websites";

export const keywordResearchSessionsTable = pgTable("keyword_research_sessions", {
  id: serial("id").primaryKey(),
  staffUserId: integer("staff_user_id").notNull().references(() => staffUsersTable.id, { onDelete: "cascade" }),
  websiteId: integer("website_id").references(() => websitesTable.id, { onDelete: "set null" }),
  seedInput: text("seed_input").notNull(),
  suggestions: jsonb("suggestions").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertKeywordResearchSessionSchema = createInsertSchema(keywordResearchSessionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertKeywordResearchSession = z.infer<typeof insertKeywordResearchSessionSchema>;
export type KeywordResearchSession = typeof keywordResearchSessionsTable.$inferSelect;
