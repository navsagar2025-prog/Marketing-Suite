import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const ipRateLimitsTable = pgTable("ip_rate_limits", {
  id: serial("id").primaryKey(),
  ip: text("ip").notNull(),
  feature: text("feature").notNull().default("public_audit"),
  url: text("url"),
  date: text("date").notNull(),
  count: integer("count").notNull().default(1),
  lastRequestAt: timestamp("last_request_at", { withTimezone: true }).notNull().defaultNow(),
});

export type IpRateLimit = typeof ipRateLimitsTable.$inferSelect;
