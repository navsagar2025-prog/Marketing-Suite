import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { mediaAssetsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { CreateMediaAssetBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/media-assets", async (req, res): Promise<void> => {
  const websiteId = req.query.websiteId ? parseInt(req.query.websiteId as string) : undefined;
  const campaignId = req.query.campaignId ? parseInt(req.query.campaignId as string) : undefined;
  const type = req.query.type as string | undefined;

  const conditions = [];
  if (websiteId) conditions.push(eq(mediaAssetsTable.websiteId, websiteId));
  if (campaignId) conditions.push(eq(mediaAssetsTable.campaignId, campaignId));
  if (type) conditions.push(eq(mediaAssetsTable.type, type));

  const assets = conditions.length > 0
    ? await db.select().from(mediaAssetsTable).where(and(...conditions)).orderBy(mediaAssetsTable.createdAt)
    : await db.select().from(mediaAssetsTable).orderBy(mediaAssetsTable.createdAt);

  res.json(assets.reverse());
});

router.post("/media-assets", async (req, res): Promise<void> => {
  const parsed = CreateMediaAssetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [asset] = await db.insert(mediaAssetsTable).values(parsed.data).returning();
  res.status(201).json(asset);
});

router.delete("/media-assets/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(mediaAssetsTable).where(eq(mediaAssetsTable.id, id));
  res.status(204).send();
});

export default router;
