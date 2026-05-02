import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const couponsTable = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  discountType: text("discount_type").notNull().$type<"percent" | "fixed">(),
  discountValue: integer("discount_value").notNull(),
  appliesTo: text("applies_to").notNull().default("all").$type<"all" | "starter" | "growth" | "agency">(),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Coupon = typeof couponsTable.$inferSelect;
export type InsertCoupon = typeof couponsTable.$inferInsert;
