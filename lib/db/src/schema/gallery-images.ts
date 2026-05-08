import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const galleryImagesTable = pgTable("gallery_images", {
  id: serial("id").primaryKey(),
  galleryType: text("gallery_type").notNull(),
  url: text("url").notNull(),
  caption: text("caption"),
  categoryTag: text("category_tag"),
  locationTag: text("location_tag"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GalleryImage = typeof galleryImagesTable.$inferSelect;
export type InsertGalleryImage = typeof galleryImagesTable.$inferInsert;
