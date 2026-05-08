import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { staffUsersTable } from "./staff-users";

export const securityEventsTable = pgTable("security_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => staffUsersTable.id, { onDelete: "set null" }),
  actorId: integer("actor_id").references(() => staffUsersTable.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  target: text("target"),
  ip: text("ip"),
  userAgent: text("user_agent"),
  details: jsonb("details").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SecurityEvent = typeof securityEventsTable.$inferSelect;
