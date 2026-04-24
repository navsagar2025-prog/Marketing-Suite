import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const ipAllowlistTable = pgTable("ip_allowlist", {
  id: serial("id").primaryKey(),
  ip: text("ip").notNull().unique(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type IpAllowlistEntry = typeof ipAllowlistTable.$inferSelect;
