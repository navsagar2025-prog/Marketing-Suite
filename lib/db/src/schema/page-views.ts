import { pgTable, text, serial, timestamp, boolean, index } from "drizzle-orm/pg-core";

export const pageViewsTable = pgTable("page_views", {
  id: serial("id").primaryKey(),
  path: text("path").notNull(),
  referrer: text("referrer"),
  ipHash: text("ip_hash"),
  userAgent: text("user_agent"),
  visitorId: text("visitor_id"),
  country: text("country"),
  confirmed: boolean("confirmed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  createdAtIdx: index("page_views_created_at_idx").on(t.createdAt),
  pathIdx: index("page_views_path_idx").on(t.path),
  confirmedIdx: index("page_views_confirmed_idx").on(t.confirmed),
}));

export type PageView = typeof pageViewsTable.$inferSelect;
