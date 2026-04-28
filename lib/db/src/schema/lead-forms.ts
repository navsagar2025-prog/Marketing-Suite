import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { websitesTable } from "./websites";

export type LeadFormField = {
  name: "name" | "email" | "phone" | "message";
  enabled: boolean;
  required: boolean;
};

export const leadFormsTable = pgTable("lead_forms", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id").notNull().references(() => websitesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  fieldsJson: jsonb("fields_json").notNull().$type<LeadFormField[]>().default([]),
  active: boolean("active").notNull().default(true),
  submissionCount: integer("submission_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
