import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

export const visitorSessionsTable = pgTable("visitor_sessions", {
  visitorId: text("visitor_id").primaryKey(),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  ipHash: text("ip_hash"),
  userAgent: text("user_agent"),
}, (t) => ({
  lastSeenIdx: index("visitor_sessions_last_seen_idx").on(t.lastSeenAt),
}));

export type VisitorSession = typeof visitorSessionsTable.$inferSelect;
