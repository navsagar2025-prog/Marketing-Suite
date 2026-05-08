import { Router, type IRouter } from "express";
import { eq, desc, ilike, or, and } from "drizzle-orm";
import { db, blogPostsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  const { category, search, featured, limit = "20", offset = "0" } = req.query as Record<string, string>;
  const conditions = [eq(blogPostsTable.status, "published")];
  if (category) conditions.push(eq(blogPostsTable.category, category));
  if (featured === "true") conditions.push(eq(blogPostsTable.featured, true));
  if (search) {
    conditions.push(or(
      ilike(blogPostsTable.title, `%${search}%`),
      ilike(blogPostsTable.excerpt, `%${search}%`)
    )!);
  }
  const posts = await db.select({
    id: blogPostsTable.id,
    title: blogPostsTable.title,
    slug: blogPostsTable.slug,
    excerpt: blogPostsTable.excerpt,
    category: blogPostsTable.category,
    tags: blogPostsTable.tags,
    author: blogPostsTable.author,
    readingTime: blogPostsTable.readingTime,
    featured: blogPostsTable.featured,
    featuredImage: blogPostsTable.featuredImage,
    publishedAt: blogPostsTable.publishedAt,
  }).from(blogPostsTable)
    .where(and(...conditions))
    .orderBy(desc(blogPostsTable.publishedAt))
    .limit(Number(limit))
    .offset(Number(offset));

  const total = await db.$count(blogPostsTable, and(...conditions));
  res.json({ posts, total, limit: Number(limit), offset: Number(offset) });
});

router.get("/categories", async (_req, res) => {
  const rows = await db.selectDistinct({ category: blogPostsTable.category })
    .from(blogPostsTable)
    .where(eq(blogPostsTable.status, "published"))
    .orderBy(blogPostsTable.category);
  res.json(rows.map(r => r.category));
});

router.get("/:slug", async (req, res) => {
  const [post] = await db.select().from(blogPostsTable)
    .where(and(eq(blogPostsTable.slug, req.params.slug), eq(blogPostsTable.status, "published")));
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }
  res.json(post);
});

export default router;
