import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, socialPostsTable } from "@workspace/db";
import {
  ListSocialPostsQueryParams,
  ListSocialPostsResponse,
  CreateSocialPostBody,
  UpdateSocialPostParams,
  UpdateSocialPostBody,
  UpdateSocialPostResponse,
  DeleteSocialPostParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/social-posts", async (req, res): Promise<void> => {
  const query = ListSocialPostsQueryParams.safeParse(req.query);
  let posts;
  if (query.success) {
    const conditions = [];
    if (query.data.websiteId) conditions.push(eq(socialPostsTable.websiteId, query.data.websiteId));
    if (query.data.platform) conditions.push(eq(socialPostsTable.platform, query.data.platform));
    if (query.data.status) conditions.push(eq(socialPostsTable.status, query.data.status));
    posts = conditions.length > 0
      ? await db.select().from(socialPostsTable).where(and(...conditions)).orderBy(socialPostsTable.createdAt)
      : await db.select().from(socialPostsTable).orderBy(socialPostsTable.createdAt);
  } else {
    posts = await db.select().from(socialPostsTable).orderBy(socialPostsTable.createdAt);
  }
  res.json(ListSocialPostsResponse.parse(posts));
});

router.post("/social-posts", async (req, res): Promise<void> => {
  const parsed = CreateSocialPostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [post] = await db.insert(socialPostsTable).values(parsed.data).returning();
  res.status(201).json(post);
});

router.patch("/social-posts/:id", async (req, res): Promise<void> => {
  const params = UpdateSocialPostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateSocialPostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [post] = await db.update(socialPostsTable).set(parsed.data).where(eq(socialPostsTable.id, params.data.id)).returning();
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  res.json(UpdateSocialPostResponse.parse(post));
});

router.delete("/social-posts/:id", async (req, res): Promise<void> => {
  const params = DeleteSocialPostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [post] = await db.delete(socialPostsTable).where(eq(socialPostsTable.id, params.data.id)).returning();
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
