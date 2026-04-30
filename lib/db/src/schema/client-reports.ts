import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { websitesTable } from "./websites";

export const clientReportsTable = pgTable("client_reports", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id").notNull().references(() => websitesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  dateRangeStart: text("date_range_start").notNull(),
  dateRangeEnd: text("date_range_end").notNull(),
  sections: jsonb("sections").notNull().$type<string[]>(),
  snapshot: jsonb("snapshot").notNull(),
  shareToken: text("share_token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertClientReportSchema = createInsertSchema(clientReportsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertClientReport = z.infer<typeof insertClientReportSchema>;
export type ClientReport = typeof clientReportsTable.$inferSelect;
