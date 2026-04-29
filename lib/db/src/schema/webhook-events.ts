import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";

export const webhookEventsTable = pgTable("webhook_events", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull(),
  eventType: text("event_type").notNull(),
  eventId: text("event_id"),
  status: text("status").notNull().default("received"),
  payload: jsonb("payload"),
  error: text("error"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WebhookEvent = typeof webhookEventsTable.$inferSelect;
