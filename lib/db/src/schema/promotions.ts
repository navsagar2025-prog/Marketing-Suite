import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";

export const promotionsTable = pgTable("promotions", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  imageUrl: text("image_url"),
  ctaLabel: text("cta_label"),
  ctaUrl: text("cta_url"),
  ctaColor: text("cta_color").notNull().default("#2563eb"),
  audience: text("audience").notNull().default("all"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Promotion = typeof promotionsTable.$inferSelect;
export type InsertPromotion = typeof promotionsTable.$inferInsert;
