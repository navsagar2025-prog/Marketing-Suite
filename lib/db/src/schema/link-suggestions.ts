import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { websitesTable } from "./websites";

export const linkSuggestionsTable = pgTable("link_suggestions", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id").notNull().references(() => websitesTable.id, { onDelete: "cascade" }),
  sourcePage: text("source_page").notNull(),
  targetPage: text("target_page").notNull(),
  anchorText: text("anchor_text").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLinkSuggestionSchema = createInsertSchema(linkSuggestionsTable).omit({ id: true, createdAt: true });
export type InsertLinkSuggestion = z.infer<typeof insertLinkSuggestionSchema>;
export type LinkSuggestion = typeof linkSuggestionsTable.$inferSelect;
