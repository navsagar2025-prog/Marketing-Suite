import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { websitesTable } from "./websites";
import { outreachContactsTable } from "./outreach-contacts";

export const backlinksTable = pgTable("backlinks", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id").notNull().references(() => websitesTable.id, { onDelete: "cascade" }),
  outreachContactId: integer("outreach_contact_id").references(() => outreachContactsTable.id, { onDelete: "set null" }),
  prospectUrl: text("prospect_url").notNull(),
  prospectDomain: text("prospect_domain").notNull(),
  contactEmail: text("contact_email"),
  status: text("status").notNull().default("not_contacted"),
  domainAuthority: integer("domain_authority"),
  type: text("type").notNull().default("guest_post"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBacklinkSchema = createInsertSchema(backlinksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBacklink = z.infer<typeof insertBacklinkSchema>;
export type Backlink = typeof backlinksTable.$inferSelect;
