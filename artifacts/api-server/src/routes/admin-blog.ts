import { Router, type IRouter } from "express";
import { eq, desc, ilike, or, and, sql } from "drizzle-orm";
import { db, blogPostsTable, mediaAssetsTable } from "@workspace/db";
import { requireAdmin } from "../lib/auth.js";
import { callAI } from "../lib/ai-provider.js";
import { checkAndIncrementUsage } from "../lib/ai-usage.js";
import { getSetting } from "./settings.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

router.use("/admin/blog", requireAdmin);

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80) || `post-${Date.now()}`;
}

function deriveStatus(publishedAt: Date | null | undefined, requested?: string | null): "draft" | "scheduled" | "published" {
  if (requested === "draft") return "draft";
  if (!publishedAt) return "draft";
  if (publishedAt.getTime() > Date.now()) return "scheduled";
  return "published";
}

const RSS_FEATURE_CAP = 5;

async function assertRssCapAvailable(excludeId?: number): Promise<void> {
  const featured = await db.select({ id: blogPostsTable.id }).from(blogPostsTable).where(eq(blogPostsTable.featuredInRss, true));
  const count = featured.filter(f => f.id !== excludeId).length;
  if (count >= RSS_FEATURE_CAP) {
    throw new Error(`Maximum of ${RSS_FEATURE_CAP} RSS-featured posts allowed`);
  }
}

router.get("/admin/blog", async (req, res): Promise<void> => {
  const { search, status, limit = "100", offset = "0" } = req.query as Record<string, string>;
  const conds = [];
  if (status) conds.push(eq(blogPostsTable.status, status));
  if (search) {
    conds.push(or(ilike(blogPostsTable.title, `%${search}%`), ilike(blogPostsTable.slug, `%${search}%`))!);
  }
  const where = conds.length ? and(...conds) : undefined;
  const posts = await db.select().from(blogPostsTable)
    .where(where)
    .orderBy(desc(blogPostsTable.featuredInRss), desc(blogPostsTable.publishedAt))
    .limit(Number(limit))
    .offset(Number(offset));
  const total = await db.$count(blogPostsTable, where);
  res.json({ posts, total });
});

router.get("/admin/blog/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [post] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.id, id));
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }
  res.json(post);
});

router.post("/admin/blog", async (req, res): Promise<void> => {
  const b = req.body as Record<string, unknown>;
  const title = String(b.title ?? "").trim();
  if (!title) { res.status(400).json({ error: "title is required" }); return; }
  const content = String(b.content ?? "").trim();
  const excerpt = String(b.excerpt ?? "").trim() || content.replace(/<[^>]+>/g, "").slice(0, 200);
  const category = String(b.category ?? "").trim() || "General";
  const slug = String(b.slug ?? "").trim() || slugify(title);

  const publishedAt = b.publishedAt ? new Date(String(b.publishedAt)) : new Date();
  if (b.publishedAt && Number.isNaN(publishedAt.getTime())) {
    res.status(400).json({ error: "Invalid publishedAt" }); return;
  }
  const status = deriveStatus(publishedAt, typeof b.status === "string" ? b.status : null);

  if (b.featuredInRss === true) {
    try { await assertRssCapAvailable(); } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Cap exceeded" }); return;
    }
  }

  try {
    const [post] = await db.insert(blogPostsTable).values({
      title, slug, excerpt, content, category,
      tags: Array.isArray(b.tags) ? (b.tags as string[]) : [],
      author: String(b.author ?? "Marketing Team"),
      seoTitle: b.seoTitle ? String(b.seoTitle) : null,
      seoDescription: b.seoDescription ? String(b.seoDescription) : null,
      readingTime: Number(b.readingTime ?? 5),
      featured: Boolean(b.featured),
      featuredImage: b.featuredImage ? String(b.featuredImage) : null,
      featuredInRss: Boolean(b.featuredInRss),
      featuredOrder: Number(b.featuredOrder ?? 0),
      status,
      publishedAt,
    }).returning();
    res.status(201).json(post);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Insert failed";
    res.status(400).json({ error: msg });
  }
});

router.patch("/admin/blog/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Post not found" }); return; }
  const b = req.body as Record<string, unknown>;

  const updates: Record<string, unknown> = {};
  const stringFields = ["title", "slug", "excerpt", "content", "category", "author", "seoTitle", "seoDescription", "featuredImage"] as const;
  for (const f of stringFields) {
    if (b[f] !== undefined) updates[f] = b[f] === null ? null : String(b[f]);
  }
  if (b.tags !== undefined) updates.tags = Array.isArray(b.tags) ? b.tags : [];
  if (b.readingTime !== undefined) updates.readingTime = Number(b.readingTime);
  if (b.featured !== undefined) updates.featured = Boolean(b.featured);
  if (b.featuredInRss !== undefined) {
    const next = Boolean(b.featuredInRss);
    if (next && !existing.featuredInRss) {
      try { await assertRssCapAvailable(id); } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "Cap exceeded" }); return;
      }
    }
    updates.featuredInRss = next;
  }
  if (b.featuredOrder !== undefined) updates.featuredOrder = Number(b.featuredOrder);

  let nextPublishedAt: Date | null | undefined;
  if (b.publishedAt !== undefined) {
    nextPublishedAt = b.publishedAt ? new Date(String(b.publishedAt)) : null;
    if (nextPublishedAt && Number.isNaN(nextPublishedAt.getTime())) {
      res.status(400).json({ error: "Invalid publishedAt" }); return;
    }
    updates.publishedAt = nextPublishedAt ?? new Date();
  }
  if (b.status !== undefined || b.publishedAt !== undefined) {
    const at = nextPublishedAt ?? existing.publishedAt;
    updates.status = deriveStatus(at, typeof b.status === "string" ? b.status : null);
  }

  try {
    const [post] = await db.update(blogPostsTable).set(updates).where(eq(blogPostsTable.id, id)).returning();
    res.json(post);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Update failed";
    res.status(400).json({ error: msg });
  }
});

router.patch("/admin/blog/:id/featured-rss", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { featuredInRss, featuredOrder } = req.body as { featuredInRss?: boolean; featuredOrder?: number };

  if (featuredInRss === true) {
    try { await assertRssCapAvailable(id); } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Cap exceeded" }); return;
    }
  }

  const [post] = await db.update(blogPostsTable)
    .set({
      ...(featuredInRss !== undefined ? { featuredInRss } : {}),
      ...(featuredOrder !== undefined ? { featuredOrder: Number(featuredOrder) } : {}),
    })
    .where(eq(blogPostsTable.id, id))
    .returning();
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }
  res.json(post);
});

router.delete("/admin/blog/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [deleted] = await db.delete(blogPostsTable).where(eq(blogPostsTable.id, id)).returning({ id: blogPostsTable.id });
  if (!deleted) { res.status(404).json({ error: "Post not found" }); return; }
  res.json({ success: true });
});

router.post("/admin/blog/:id/generate-hero", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [post] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.id, id));
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }

  const apiKey = getSetting("fal_api_key");
  if (!apiKey) {
    res.status(503).json({ error: "Fal.ai API key not configured. Please add it in Settings." });
    return;
  }

  const usage = await checkAndIncrementUsage(req.user!.id, "image");
  if (!usage.allowed) {
    res.status(429).json({ error: "Monthly image generation limit reached", used: usage.used, limit: usage.limit, type: "image" });
    return;
  }

  let imagePrompt = `Editorial blog hero image for an article titled "${post.title}". ${post.excerpt}. Modern, clean, professional, photographic style, no text overlay.`;
  try {
    const refined = await callAI(`Write a single-line image generation prompt (under 60 words) for a blog hero image. Article title: "${post.title}". Excerpt: ${post.excerpt}. Return ONLY the prompt text, no quotes.`, { maxTokens: 200 });
    if (refined && refined.trim().length > 0) imagePrompt = refined.trim();
  } catch (err) {
    logger.warn({ err }, "Hero prompt refinement failed, using fallback");
  }

  try {
    const submitRes = await fetch("https://queue.fal.run/fal-ai/flux/schnell", {
      method: "POST",
      headers: { Authorization: `Key ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: imagePrompt, image_size: "landscape_16_9", num_inference_steps: 4, num_images: 1, enable_safety_checker: true }),
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

    await db.insert(mediaAssetsTable).values({ url, type: "image", prompt: imagePrompt, aspectRatio: "16:9" });
    const [updated] = await db.update(blogPostsTable).set({ featuredImage: url }).where(eq(blogPostsTable.id, id)).returning();
    res.json({ post: updated, imageUrl: url, prompt: imagePrompt });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Hero image generation failed";
    res.status(500).json({ error: msg });
  }
});

export async function publishScheduledPosts(): Promise<{ published: number }> {
  const result = await db.update(blogPostsTable)
    .set({ status: "published" })
    .where(and(eq(blogPostsTable.status, "scheduled"), sql`${blogPostsTable.publishedAt} <= now()`))
    .returning({ id: blogPostsTable.id });
  return { published: result.length };
}

export default router;
