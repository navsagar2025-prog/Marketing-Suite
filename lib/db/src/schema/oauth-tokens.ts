import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { staffUsersTable } from "./staff-users";
import { websitesTable } from "./websites";

export const oauthTokensTable = pgTable("oauth_tokens", {
  id: serial("id").primaryKey(),
  staffUserId: integer("staff_user_id").notNull().references(() => staffUsersTable.id, { onDelete: "cascade" }),
  websiteId: integer("website_id").references(() => websitesTable.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  scopes: text("scopes"),
  gscPropertyUrl: text("gsc_property_url"),
  ga4PropertyId: text("ga4_property_id"),
  googleEmail: text("google_email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type OauthToken = typeof oauthTokensTable.$inferSelect;
