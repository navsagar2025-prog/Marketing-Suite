import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { websitesTable } from "./websites";
import { campaignsTable } from "./campaigns";

export const mediaAssetsTable = pgTable("media_assets", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id").references(() => websitesTable.id, { onDelete: "set null" }),
  campaignId: integer("campaign_id").references(() => campaignsTable.id, { onDelete: "set null" }),
  url: text("url").notNull(),
  type: text("type").notNull(),
  prompt: text("prompt").notNull(),
  aspectRatio: text("aspect_ratio"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMediaAssetSchema = createInsertSchema(mediaAssetsTable).omit({ id: true, createdAt: true });
export type InsertMediaAsset = z.infer<typeof insertMediaAssetSchema>;
export type MediaAsset = typeof mediaAssetsTable.$inferSelect;
