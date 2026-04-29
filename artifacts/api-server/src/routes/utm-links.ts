import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, utmLinksTable, insertUtmLinkSchema } from "@workspace/db";

const router: IRouter = Router();

router.get("/utm-links", async (_req, res): Promise<void> => {
  const links = await db.select().from(utmLinksTable).orderBy(desc(utmLinksTable.createdAt));
  res.json(links);
});

router.post("/utm-links", async (req, res): Promise<void> => {
  const parsed = insertUtmLinkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: String(parsed.error) });
    return;
  }
  const [link] = await db.insert(utmLinksTable).values(parsed.data).returning();
  res.status(201).json(link);
});

router.delete("/utm-links/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [deleted] = await db.delete(utmLinksTable).where(eq(utmLinksTable.id, id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "UTM link not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
