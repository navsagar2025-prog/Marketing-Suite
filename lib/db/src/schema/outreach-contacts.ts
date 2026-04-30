import { pgTable, text, serial, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const OUTREACH_TYPES = ["guest_post", "link_request", "partnership", "pr"] as const;
export const OUTREACH_STATUSES = ["not_sent", "sent", "opened", "replied", "rejected", "won"] as const;

export type OutreachType = (typeof OUTREACH_TYPES)[number];
export type OutreachStatus = (typeof OUTREACH_STATUSES)[number];

export const outreachContactsTable = pgTable("outreach_contacts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  domain: text("domain").notNull(),
  email: text("email"),
  type: text("type").notNull().default("link_request"),
  status: text("status").notNull().default("not_sent"),
  dateSent: date("date_sent"),
  followUpDate: date("follow_up_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOutreachContactSchema = createInsertSchema(outreachContactsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOutreachContact = z.infer<typeof insertOutreachContactSchema>;
export type OutreachContact = typeof outreachContactsTable.$inferSelect;
