import { pgTable, text, serial, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const abTestTypeEnum = pgEnum("ab_test_type", ["headline", "cta", "meta_description", "ad_copy"]);
export const abTestStatusEnum = pgEnum("ab_test_status", ["active", "closed"]);

export const abTestsTable = pgTable("ab_tests", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: abTestTypeEnum("type").notNull(),
  status: abTestStatusEnum("status").notNull().default("active"),
  winnerThreshold: integer("winner_threshold").notNull().default(100),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const abVariantsTable = pgTable("ab_variants", {
  id: serial("id").primaryKey(),
  testId: integer("test_id").notNull().references(() => abTestsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  content: text("content").notNull(),
  impressions: integer("impressions").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAbTestSchema = createInsertSchema(abTestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAbVariantSchema = createInsertSchema(abVariantsTable).omit({ id: true, impressions: true, clicks: true, createdAt: true });

export type InsertAbTest = z.infer<typeof insertAbTestSchema>;
export type InsertAbVariant = z.infer<typeof insertAbVariantSchema>;
export type AbTest = typeof abTestsTable.$inferSelect;
export type AbVariant = typeof abVariantsTable.$inferSelect;
