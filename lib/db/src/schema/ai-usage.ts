import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { staffUsersTable } from "./staff-users";

export const aiUsageTable = pgTable("ai_usage", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => staffUsersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  yearMonth: text("year_month").notNull(),
  count: integer("count").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("ai_usage_user_type_month").on(t.userId, t.type, t.yearMonth),
]);

export type AiUsageRow = typeof aiUsageTable.$inferSelect;
