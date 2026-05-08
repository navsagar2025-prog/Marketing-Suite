import { Router, type IRouter } from "express";
import { eq, and, asc, desc, inArray } from "drizzle-orm";
import { db, galleryImagesTable } from "@workspace/db";
import { requireAdmin } from "../lib/auth.js";

const VALID_TYPES = ["main", "secondary", "slider"] as const;

export const publicGalleryRouter: IRouter = Router();

publicGalleryRouter.get("/gallery", async (req, res): Promise<void> => {
  const { type, category, location, limit = "100" } = req.query as Record<string, string>;
  const conds = [];
  if (type && (VALID_TYPES as readonly string[]).includes(type)) conds.push(eq(galleryImagesTable.galleryType, type));
  if (category) conds.push(eq(galleryImagesTable.categoryTag, category));
  if (location) conds.push(eq(galleryImagesTable.locationTag, location));
  const where = conds.length ? and(...conds) : undefined;
  const limitN = Math.max(1, Math.min(500, Number(limit) || 200));
  const images = await db.select().from(galleryImagesTable).where(where).orderBy(asc(galleryImagesTable.sortOrder), desc(galleryImagesTable.createdAt)).limit(limitN);
  res.json(images);
});

const adminRouter: IRouter = Router();
adminRouter.use("/admin/gallery", requireAdmin);

adminRouter.get("/admin/gallery", async (req, res): Promise<void> => {
  const { type } = req.query as Record<string, string>;
  const where = type ? eq(galleryImagesTable.galleryType, type) : undefined;
  const images = await db.select().from(galleryImagesTable).where(where).orderBy(asc(galleryImagesTable.sortOrder), desc(galleryImagesTable.createdAt));
  res.json(images);
});

adminRouter.post("/admin/gallery", async (req, res): Promise<void> => {
  const b = req.body as Record<string, unknown>;
  const type = String(b.galleryType ?? "");
  if (!(VALID_TYPES as readonly string[]).includes(type)) {
    res.status(400).json({ error: `galleryType must be one of: ${VALID_TYPES.join(", ")}` });
    return;
  }
  if (Array.isArray(b.urls) && b.urls.length > 0) {
    const rows = (b.urls as string[]).map((u, i) => String(u).trim()).filter(Boolean).map((url, i) => ({
      galleryType: type,
      url,
      caption: b.caption ? String(b.caption) : null,
      categoryTag: b.categoryTag ? String(b.categoryTag) : null,
      locationTag: b.locationTag ? String(b.locationTag) : null,
      sortOrder: i,
    }));
    if (rows.length === 0) { res.status(400).json({ error: "No valid URLs" }); return; }
    const inserted = await db.insert(galleryImagesTable).values(rows).returning();
    res.status(201).json({ inserted: inserted.length, images: inserted });
    return;
  }
  const url = String(b.url ?? "").trim();
  if (!url) { res.status(400).json({ error: "url or urls required" }); return; }
  const [img] = await db.insert(galleryImagesTable).values({
    galleryType: type,
    url,
    caption: b.caption ? String(b.caption) : null,
    categoryTag: b.categoryTag ? String(b.categoryTag) : null,
    locationTag: b.locationTag ? String(b.locationTag) : null,
    sortOrder: typeof b.sortOrder === "number" ? b.sortOrder : 0,
  }).returning();
  res.status(201).json(img);
});

adminRouter.patch("/admin/gallery/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const b = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  if (b.caption !== undefined) updates.caption = b.caption === null ? null : String(b.caption);
  if (b.categoryTag !== undefined) updates.categoryTag = b.categoryTag === null ? null : String(b.categoryTag);
  if (b.locationTag !== undefined) updates.locationTag = b.locationTag === null ? null : String(b.locationTag);
  if (b.sortOrder !== undefined) updates.sortOrder = Number(b.sortOrder);
  if (b.galleryType !== undefined) {
    const t = String(b.galleryType);
    if (!(VALID_TYPES as readonly string[]).includes(t)) {
      res.status(400).json({ error: `galleryType must be one of: ${VALID_TYPES.join(", ")}` });
      return;
    }
    updates.galleryType = t;
  }
  const [img] = await db.update(galleryImagesTable).set(updates).where(eq(galleryImagesTable.id, id)).returning();
  if (!img) { res.status(404).json({ error: "Image not found" }); return; }
  res.json(img);
});

adminRouter.delete("/admin/gallery/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [d] = await db.delete(galleryImagesTable).where(eq(galleryImagesTable.id, id)).returning({ id: galleryImagesTable.id });
  if (!d) { res.status(404).json({ error: "Image not found" }); return; }
  res.json({ success: true });
});

adminRouter.post("/admin/gallery/bulk-delete", async (req, res): Promise<void> => {
  const ids = Array.isArray((req.body as { ids?: unknown[] }).ids) ? (req.body as { ids: number[] }).ids.map(Number).filter(Number.isFinite) : [];
  if (ids.length === 0) { res.status(400).json({ error: "ids required" }); return; }
  const deleted = await db.delete(galleryImagesTable).where(inArray(galleryImagesTable.id, ids)).returning({ id: galleryImagesTable.id });
  res.json({ deleted: deleted.length });
});

export default adminRouter;
