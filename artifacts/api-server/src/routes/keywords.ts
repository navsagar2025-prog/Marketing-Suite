import { Router, type IRouter } from "express";
import { eq, and, gte } from "drizzle-orm";
import { db, keywordsTable, keywordRankHistoryTable } from "@workspace/db";
import {
  ListKeywordsQueryParams,
  ListKeywordsResponse,
  CreateKeywordBody,
  UpdateKeywordParams,
  UpdateKeywordBody,
  UpdateKeywordResponse,
  DeleteKeywordParams,
  GetKeywordRankHistoryParams,
  GetKeywordRankHistoryQueryParams,
  GetKeywordRankHistoryResponse,
  SnapshotKeywordRanksResponse,
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

router.post("/keywords/snapshot", async (req, res): Promise<void> => {
  const result = await runRankSnapshot();
  res.json(SnapshotKeywordRanksResponse.parse(result));
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

router.get("/keywords/:id/history", async (req, res): Promise<void> => {
  const params = GetKeywordRankHistoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const queryParsed = GetKeywordRankHistoryQueryParams.safeParse(req.query);
  const days = queryParsed.success && queryParsed.data.days ? queryParsed.data.days : 90;

  const [keyword] = await db.select({ id: keywordsTable.id }).from(keywordsTable).where(eq(keywordsTable.id, params.data.id));
  if (!keyword) {
    res.status(404).json({ error: "Keyword not found" });
    return;
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const history = await db
    .select()
    .from(keywordRankHistoryTable)
    .where(
      and(
        eq(keywordRankHistoryTable.keywordId, params.data.id),
        gte(keywordRankHistoryTable.recordedDate, cutoffDate),
      ),
    )
    .orderBy(keywordRankHistoryTable.recordedDate);

  res.json(GetKeywordRankHistoryResponse.parse(history));
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

export async function runRankSnapshot(): Promise<{ snapshotted: number; skipped: number; date: string }> {
  const today = new Date().toISOString().slice(0, 10);
  const keywords = await db.select().from(keywordsTable);
  let snapshotted = 0;
  let skipped = 0;
  for (const kw of keywords) {
    try {
      const result = await db
        .insert(keywordRankHistoryTable)
        .values({ keywordId: kw.id, rank: kw.currentRank ?? null, recordedDate: today })
        .onConflictDoNothing()
        .returning();
      if (result.length > 0) {
        snapshotted++;
      } else {
        skipped++;
      }
    } catch {
      skipped++;
    }
  }
  return { snapshotted, skipped, date: today };
}

export default router;
