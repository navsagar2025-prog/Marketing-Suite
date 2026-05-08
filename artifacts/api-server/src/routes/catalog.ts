import { Router, type IRouter } from "express";
import { eq, desc, ilike, or, and, asc } from "drizzle-orm";
import { db, brandsTable, productsTable, productImagesTable, mediaAssetsTable } from "@workspace/db";
import { requireAdmin } from "../lib/auth.js";
import { callAI } from "../lib/ai-provider.js";
import { checkAndIncrementUsage } from "../lib/ai-usage.js";
import { getSetting } from "./settings.js";
import { logger } from "../lib/logger.js";

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80) || `item-${Date.now()}`;
}

async function loadProductWithImages(slugOrId: string | number) {
  const isId = typeof slugOrId === "number" || /^\d+$/.test(String(slugOrId));
  const where = isId ? eq(productsTable.id, Number(slugOrId)) : eq(productsTable.slug, String(slugOrId));
  const [product] = await db.select().from(productsTable).where(where);
  if (!product) return null;
  const images = await db.select().from(productImagesTable).where(eq(productImagesTable.productId, product.id)).orderBy(asc(productImagesTable.sortOrder));
  let brand = null;
  if (product.brandId) {
    const [b] = await db.select().from(brandsTable).where(eq(brandsTable.id, product.brandId));
    brand = b ?? null;
  }
  return { ...product, images, brand };
}

function buildJsonLd(product: Awaited<ReturnType<typeof loadProductWithImages>>, siteUrl: string) {
  if (!product) return null;
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: `P${product.id}`,
    url: `${siteUrl}/products/${product.slug}`,
    image: [product.heroImage, ...product.images.map(i => i.url)].filter(Boolean),
    category: product.category,
  };
  if (product.brand) ld.brand = { "@type": "Brand", name: product.brand.name };
  if (product.price) ld.offers = { "@type": "Offer", price: product.price, priceCurrency: "USD", availability: "https://schema.org/InStock" };
  return ld;
}

export const publicCatalogRouter: IRouter = Router();

publicCatalogRouter.get("/products", async (req, res): Promise<void> => {
  const { search, category, brand } = req.query as Record<string, string>;
  const limit = Math.max(1, Math.min(100, Number(req.query.limit ?? 50) || 50));
  const offset = Math.max(0, Number(req.query.offset ?? 0) || 0);
  const conds = [eq(productsTable.active, true)];
  if (search) conds.push(or(ilike(productsTable.name, `%${search}%`), ilike(productsTable.description, `%${search}%`))!);
  if (category) conds.push(eq(productsTable.category, category));
  if (brand) {
    const [b] = await db.select().from(brandsTable).where(eq(brandsTable.slug, brand));
    if (b) {
      conds.push(eq(productsTable.brandId, b.id));
    } else {
      res.json({ products: [], total: 0 });
      return;
    }
  }
  const where = and(...conds);
  const products = await db.select().from(productsTable).where(where).orderBy(desc(productsTable.createdAt)).limit(limit).offset(offset);
  const total = await db.$count(productsTable, where);
  res.json({ products, total });
});

publicCatalogRouter.get("/products/categories", async (_req, res): Promise<void> => {
  const rows = await db.selectDistinct({ category: productsTable.category }).from(productsTable).where(eq(productsTable.active, true));
  res.json(rows.map(r => r.category));
});

publicCatalogRouter.get("/products/:slug", async (req, res): Promise<void> => {
  const product = await loadProductWithImages(req.params.slug);
  if (!product || !product.active) { res.status(404).json({ error: "Product not found" }); return; }
  const siteUrl = (process.env.APP_URL ?? `https://${req.get("host")}`).replace(/\/$/, "");
  res.json({ ...product, jsonLd: buildJsonLd(product, siteUrl) });
});

publicCatalogRouter.get("/brands", async (_req, res): Promise<void> => {
  const brands = await db.select().from(brandsTable).orderBy(asc(brandsTable.name));
  res.json(brands);
});

const adminRouter: IRouter = Router();
adminRouter.use("/admin/brands", requireAdmin);
adminRouter.use("/admin/products", requireAdmin);

adminRouter.get("/admin/brands", async (_req, res): Promise<void> => {
  const brands = await db.select().from(brandsTable).orderBy(asc(brandsTable.name));
  res.json(brands);
});

adminRouter.post("/admin/brands", async (req, res): Promise<void> => {
  const b = req.body as Record<string, unknown>;
  const name = String(b.name ?? "").trim();
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const slug = String(b.slug ?? "").trim() || slugify(name);
  try {
    const [brand] = await db.insert(brandsTable).values({
      name, slug,
      logoUrl: b.logoUrl ? String(b.logoUrl) : null,
      websiteUrl: b.websiteUrl ? String(b.websiteUrl) : null,
      description: b.description ? String(b.description) : null,
    }).returning();
    res.status(201).json(brand);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Insert failed" });
  }
});

adminRouter.patch("/admin/brands/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const b = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  for (const f of ["name", "slug", "logoUrl", "websiteUrl", "description"]) {
    if (b[f] !== undefined) updates[f] = b[f] === null ? null : String(b[f]);
  }
  const [brand] = await db.update(brandsTable).set(updates).where(eq(brandsTable.id, id)).returning();
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }
  res.json(brand);
});

adminRouter.delete("/admin/brands/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [d] = await db.delete(brandsTable).where(eq(brandsTable.id, id)).returning({ id: brandsTable.id });
  if (!d) { res.status(404).json({ error: "Brand not found" }); return; }
  res.json({ success: true });
});

adminRouter.get("/admin/products", async (req, res): Promise<void> => {
  const { search } = req.query as Record<string, string>;
  const limit = Math.max(1, Math.min(200, Number(req.query.limit ?? 100) || 100));
  const offset = Math.max(0, Number(req.query.offset ?? 0) || 0);
  const conds = [];
  if (search) conds.push(or(ilike(productsTable.name, `%${search}%`), ilike(productsTable.slug, `%${search}%`))!);
  const where = conds.length ? and(...conds) : undefined;
  const products = await db.select().from(productsTable).where(where).orderBy(desc(productsTable.createdAt)).limit(limit).offset(offset);
  const total = await db.$count(productsTable, where);
  res.json({ products, total });
});

adminRouter.get("/admin/products/:id", async (req, res): Promise<void> => {
  const product = await loadProductWithImages(Number(req.params.id));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(product);
});

adminRouter.post("/admin/products", async (req, res): Promise<void> => {
  const b = req.body as Record<string, unknown>;
  const name = String(b.name ?? "").trim();
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const slug = String(b.slug ?? "").trim() || slugify(name);
  try {
    const [product] = await db.insert(productsTable).values({
      name, slug,
      description: String(b.description ?? ""),
      shortDescription: b.shortDescription ? String(b.shortDescription) : null,
      price: b.price ? String(b.price) : null,
      brandId: b.brandId ? Number(b.brandId) : null,
      category: String(b.category ?? "General"),
      features: Array.isArray(b.features) ? b.features : [],
      heroImage: b.heroImage ? String(b.heroImage) : null,
      active: b.active === undefined ? true : Boolean(b.active),
    }).returning();

    if (Array.isArray(b.images) && b.images.length > 0) {
      await db.insert(productImagesTable).values((b.images as Array<Record<string, unknown>>).map((img, i) => ({
        productId: product.id,
        url: String(img.url ?? ""),
        alt: img.alt ? String(img.alt) : null,
        sortOrder: typeof img.sortOrder === "number" ? img.sortOrder : i,
      })).filter(x => x.url));
    }
    res.status(201).json(await loadProductWithImages(product.id));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Insert failed" });
  }
});

adminRouter.patch("/admin/products/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const b = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  for (const f of ["name", "slug", "description", "shortDescription", "price", "category", "heroImage"] as const) {
    if (b[f] !== undefined) updates[f] = b[f] === null ? null : String(b[f]);
  }
  if (b.brandId !== undefined) updates.brandId = b.brandId === null ? null : Number(b.brandId);
  if (b.features !== undefined) updates.features = Array.isArray(b.features) ? b.features : [];
  if (b.active !== undefined) updates.active = Boolean(b.active);
  try {
    const [product] = await db.update(productsTable).set(updates).where(eq(productsTable.id, id)).returning();
    if (!product) { res.status(404).json({ error: "Product not found" }); return; }
    if (Array.isArray(b.images)) {
      await db.delete(productImagesTable).where(eq(productImagesTable.productId, id));
      const imgs = (b.images as Array<Record<string, unknown>>).map((img, i) => ({
        productId: id,
        url: String(img.url ?? ""),
        alt: img.alt ? String(img.alt) : null,
        sortOrder: typeof img.sortOrder === "number" ? img.sortOrder : i,
      })).filter(x => x.url);
      if (imgs.length > 0) await db.insert(productImagesTable).values(imgs);
    }
    res.json(await loadProductWithImages(id));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Update failed" });
  }
});

adminRouter.delete("/admin/products/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [d] = await db.delete(productsTable).where(eq(productsTable.id, id)).returning({ id: productsTable.id });
  if (!d) { res.status(404).json({ error: "Product not found" }); return; }
  res.json({ success: true });
});

adminRouter.post("/admin/products/:id/generate-hero", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }

  const apiKey = getSetting("fal_api_key");
  if (!apiKey) { res.status(503).json({ error: "Fal.ai API key not configured. Please add it in Settings." }); return; }

  const usage = await checkAndIncrementUsage(req.user!.id, "image");
  if (!usage.allowed) {
    res.status(429).json({ error: "Monthly image generation limit reached", used: usage.used, limit: usage.limit, type: "image" });
    return;
  }

  let imagePrompt = `Professional product hero photo of "${product.name}". ${product.shortDescription ?? product.description.slice(0, 200)}. Studio lighting, clean white background, photorealistic, no text overlay.`;
  try {
    const refined = await callAI(`Write a single-line image generation prompt (under 60 words) for a product hero photo. Product: "${product.name}". Description: ${product.shortDescription ?? product.description}. Return ONLY the prompt text, no quotes.`, { maxTokens: 200 });
    if (refined && refined.trim().length > 0) imagePrompt = refined.trim();
  } catch (err) {
    logger.warn({ err }, "Product hero prompt refinement failed");
  }

  try {
    const submitRes = await fetch("https://queue.fal.run/fal-ai/flux/schnell", {
      method: "POST",
      headers: { Authorization: `Key ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: imagePrompt, image_size: "square_hd", num_inference_steps: 4, num_images: 1, enable_safety_checker: true }),
    });
    if (!submitRes.ok) throw new Error(`Fal submit ${submitRes.status}`);
    const { request_id } = await submitRes.json() as { request_id: string };

    let url: string | null = null;
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const stRes = await fetch(`https://queue.fal.run/fal-ai/flux/schnell/requests/${request_id}/status`, { headers: { Authorization: `Key ${apiKey}` } });
      if (!stRes.ok) continue;
      const st = await stRes.json() as { status: string };
      if (st.status === "COMPLETED") {
        const r2 = await fetch(`https://queue.fal.run/fal-ai/flux/schnell/requests/${request_id}`, { headers: { Authorization: `Key ${apiKey}` } });
        const data = await r2.json() as { images?: Array<{ url: string }> };
        url = data.images?.[0]?.url ?? null;
        break;
      }
      if (st.status === "FAILED") throw new Error("Fal generation failed");
    }
    if (!url) throw new Error("Hero image generation timed out");

    await db.insert(mediaAssetsTable).values({ url, type: "image", prompt: imagePrompt, aspectRatio: "1:1" });
    const [updated] = await db.update(productsTable).set({ heroImage: url }).where(eq(productsTable.id, id)).returning();
    res.json({ product: updated, imageUrl: url, prompt: imagePrompt });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Hero image generation failed" });
  }
});

export default adminRouter;
