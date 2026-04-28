import { Router, type IRouter } from "express";
import { eq, desc, ilike, or, and, sql } from "drizzle-orm";
import { db, kbArticlesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  const { category, search, limit = "50", offset = "0" } = req.query as Record<string, string>;
  const conditions = [eq(kbArticlesTable.status, "published")];
  if (category) conditions.push(eq(kbArticlesTable.category, category));
  if (search) {
    conditions.push(or(
      ilike(kbArticlesTable.title, `%${search}%`),
      ilike(kbArticlesTable.excerpt, `%${search}%`)
    )!);
  }
  const articles = await db.select({
    id: kbArticlesTable.id,
    title: kbArticlesTable.title,
    slug: kbArticlesTable.slug,
    excerpt: kbArticlesTable.excerpt,
    category: kbArticlesTable.category,
    subcategory: kbArticlesTable.subcategory,
    tags: kbArticlesTable.tags,
    helpful: kbArticlesTable.helpful,
    createdAt: kbArticlesTable.createdAt,
  }).from(kbArticlesTable)
    .where(and(...conditions))
    .orderBy(desc(kbArticlesTable.helpful), desc(kbArticlesTable.createdAt))
    .limit(Number(limit))
    .offset(Number(offset));

  const total = await db.$count(kbArticlesTable, and(...conditions));
  res.json({ articles, total });
});

router.get("/categories", async (_req, res) => {
  const rows = await db.selectDistinct({ category: kbArticlesTable.category, subcategory: kbArticlesTable.subcategory })
    .from(kbArticlesTable)
    .where(eq(kbArticlesTable.status, "published"))
    .orderBy(kbArticlesTable.category, kbArticlesTable.subcategory);
  const grouped: Record<string, string[]> = {};
  for (const r of rows) {
    if (!grouped[r.category]) grouped[r.category] = [];
    if (r.subcategory && !grouped[r.category].includes(r.subcategory)) {
      grouped[r.category].push(r.subcategory);
    }
  }
  res.json(grouped);
});

router.get("/:slug", async (req, res) => {
  const [article] = await db.select().from(kbArticlesTable)
    .where(and(eq(kbArticlesTable.slug, req.params.slug), eq(kbArticlesTable.status, "published")));
  if (!article) { res.status(404).json({ error: "Article not found" }); return; }
  res.json(article);
});

router.post("/:slug/helpful", async (req, res) => {
  const { vote } = req.body as { vote: "yes" | "no" };
  const [article] = await db.select({ id: kbArticlesTable.id }).from(kbArticlesTable)
    .where(eq(kbArticlesTable.slug, req.params.slug));
  if (!article) { res.status(404).json({ error: "Article not found" }); return; }
  if (vote === "yes") {
    await db.update(kbArticlesTable).set({ helpful: sql`${kbArticlesTable.helpful} + 1` }).where(eq(kbArticlesTable.id, article.id));
  } else {
    await db.update(kbArticlesTable).set({ notHelpful: sql`${kbArticlesTable.notHelpful} + 1` }).where(eq(kbArticlesTable.id, article.id));
  }
  res.json({ success: true });
});

export default router;
