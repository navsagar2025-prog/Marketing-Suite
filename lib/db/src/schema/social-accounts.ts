import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { staffUsersTable } from "./staff-users";

export const socialAccountsTable = pgTable("social_accounts", {
  id: serial("id").primaryKey(),
  staffUserId: integer("staff_user_id").notNull().references(() => staffUsersTable.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  platformUserId: text("platform_user_id"),
  platformUsername: text("platform_username"),
  platformPageId: text("platform_page_id"),
  platformPageName: text("platform_page_name"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenExpiry: timestamp("token_expiry", { withTimezone: true }),
  scopes: text("scopes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type SocialAccount = typeof socialAccountsTable.$inferSelect;
