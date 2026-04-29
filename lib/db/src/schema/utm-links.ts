import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { websitesTable } from "./websites";

export const utmLinksTable = pgTable("utm_links", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id").references(() => websitesTable.id, { onDelete: "set null" }),
  destinationUrl: text("destination_url").notNull(),
  source: text("source").notNull(),
  medium: text("medium").notNull(),
  campaign: text("campaign").notNull(),
  term: text("term"),
  content: text("content"),
  label: text("label"),
  clicks: integer("clicks").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUtmLinkSchema = createInsertSchema(utmLinksTable, {
  destinationUrl: z.string().url().refine((u) => /^https?:\/\//i.test(u), {
    message: "Destination URL must start with http:// or https://",
  }),
}).omit({ id: true, clicks: true, createdAt: true, updatedAt: true });

export type InsertUtmLink = z.infer<typeof insertUtmLinkSchema>;
export type UtmLink = typeof utmLinksTable.$inferSelect;
