import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, keywordsTable } from "@workspace/db";
import {
  ListKeywordsQueryParams,
  ListKeywordsResponse,
  CreateKeywordBody,
  UpdateKeywordParams,
  UpdateKeywordBody,
  UpdateKeywordResponse,
  DeleteKeywordParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/keywords", async (req, res): Promise<void> => {
  const query = ListKeywordsQueryParams.safeParse(req.query);
  let keywords;
  if (query.success && query.data.websiteId) {
    keywords = await db.select().from(keywordsTable).where(eq(keywordsTable.websiteId, query.data.websiteId)).orderBy(keywordsTable.createdAt);
  } else {
    keywords = await db.select().from(keywordsTable).orderBy(keywordsTable.createdAt);
  }
  res.json(ListKeywordsResponse.parse(keywords));
});

router.post("/keywords", async (req, res): Promise<void> => {
  const parsed = CreateKeywordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [keyword] = await db.insert(keywordsTable).values(parsed.data).returning();
  res.status(201).json(keyword);
});

router.patch("/keywords/:id", async (req, res): Promise<void> => {
  const params = UpdateKeywordParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateKeywordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [keyword] = await db.update(keywordsTable).set(parsed.data).where(eq(keywordsTable.id, params.data.id)).returning();
  if (!keyword) {
    res.status(404).json({ error: "Keyword not found" });
    return;
  }
  res.json(UpdateKeywordResponse.parse(keyword));
});

router.delete("/keywords/:id", async (req, res): Promise<void> => {
  const params = DeleteKeywordParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [keyword] = await db.delete(keywordsTable).where(eq(keywordsTable.id, params.data.id)).returning();
  if (!keyword) {
    res.status(404).json({ error: "Keyword not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
