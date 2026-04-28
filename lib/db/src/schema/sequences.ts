import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { leadsTable } from "./leads";

export const sequencesTable = pgTable("sequences", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  trigger: jsonb("trigger").notNull().$type<{ type: "status" | "score" | "source"; value: string | number }>(),
  stepsJson: jsonb("steps_json").notNull().$type<Array<{ subject: string; body: string; delayDays: number }>>().default([]),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sequenceEnrollmentsTable = pgTable("sequence_enrollments", {
  id: serial("id").primaryKey(),
  sequenceId: integer("sequence_id").notNull().references(() => sequencesTable.id, { onDelete: "cascade" }),
  leadId: integer("lead_id").notNull().references(() => leadsTable.id, { onDelete: "cascade" }),
  currentStep: integer("current_step").notNull().default(0),
  nextSendAt: timestamp("next_send_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
