import { pgTable, text, serial, timestamp, integer, date, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { websitesTable } from "./websites";

export const keywordsTable = pgTable("keywords", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id").notNull().references(() => websitesTable.id, { onDelete: "cascade" }),
  keyword: text("keyword").notNull(),
  currentRank: integer("current_rank"),
  searchVolume: integer("search_volume"),
  difficulty: integer("difficulty"),
  status: text("status").notNull().default("tracking"),
  notes: text("notes"),
  cluster: text("cluster"),
  intent: text("intent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const keywordRankHistoryTable = pgTable(
  "keyword_rank_history",
  {
    id: serial("id").primaryKey(),
    keywordId: integer("keyword_id").notNull().references(() => keywordsTable.id, { onDelete: "cascade" }),
    rank: integer("rank"),
    recordedDate: date("recorded_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("keyword_rank_history_keyword_date_uniq").on(t.keywordId, t.recordedDate)],
);

export const insertKeywordSchema = createInsertSchema(keywordsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertKeyword = z.infer<typeof insertKeywordSchema>;
export type Keyword = typeof keywordsTable.$inferSelect;
export type KeywordRankHistory = typeof keywordRankHistoryTable.$inferSelect;
