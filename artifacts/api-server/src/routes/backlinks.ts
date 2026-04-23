import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, backlinksTable } from "@workspace/db";
import {
  ListBacklinksQueryParams,
  ListBacklinksResponse,
  CreateBacklinkBody,
  UpdateBacklinkParams,
  UpdateBacklinkBody,
  UpdateBacklinkResponse,
  DeleteBacklinkParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/backlinks", async (req, res): Promise<void> => {
  const query = ListBacklinksQueryParams.safeParse(req.query);
  let backlinks;
  if (query.success) {
    const conditions = [];
    if (query.data.websiteId) conditions.push(eq(backlinksTable.websiteId, query.data.websiteId));
    if (query.data.status) conditions.push(eq(backlinksTable.status, query.data.status));
    backlinks = conditions.length > 0
      ? await db.select().from(backlinksTable).where(and(...conditions)).orderBy(backlinksTable.createdAt)
      : await db.select().from(backlinksTable).orderBy(backlinksTable.createdAt);
  } else {
    backlinks = await db.select().from(backlinksTable).orderBy(backlinksTable.createdAt);
  }
  res.json(ListBacklinksResponse.parse(backlinks));
});

router.post("/backlinks", async (req, res): Promise<void> => {
  const parsed = CreateBacklinkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [backlink] = await db.insert(backlinksTable).values(parsed.data).returning();
  res.status(201).json(backlink);
});

router.patch("/backlinks/:id", async (req, res): Promise<void> => {
  const params = UpdateBacklinkParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateBacklinkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [backlink] = await db.update(backlinksTable).set(parsed.data).where(eq(backlinksTable.id, params.data.id)).returning();
  if (!backlink) {
    res.status(404).json({ error: "Backlink not found" });
    return;
  }
  res.json(UpdateBacklinkResponse.parse(backlink));
});

router.delete("/backlinks/:id", async (req, res): Promise<void> => {
  const params = DeleteBacklinkParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [backlink] = await db.delete(backlinksTable).where(eq(backlinksTable.id, params.data.id)).returning();
  if (!backlink) {
    res.status(404).json({ error: "Backlink not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
