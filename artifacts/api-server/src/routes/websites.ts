import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, websitesTable } from "@workspace/db";
import {
  ListWebsitesResponse,
  CreateWebsiteBody,
  GetWebsiteParams,
  GetWebsiteResponse,
  UpdateWebsiteParams,
  UpdateWebsiteBody,
  UpdateWebsiteResponse,
  DeleteWebsiteParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/websites", async (req, res): Promise<void> => {
  const websites = await db.select().from(websitesTable).orderBy(websitesTable.createdAt);
  res.json(ListWebsitesResponse.parse(websites));
});

router.post("/websites", async (req, res): Promise<void> => {
  const parsed = CreateWebsiteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [website] = await db.insert(websitesTable).values(parsed.data).returning();
  res.status(201).json(GetWebsiteResponse.parse(website));
});

router.get("/websites/:id", async (req, res): Promise<void> => {
  const params = GetWebsiteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [website] = await db.select().from(websitesTable).where(eq(websitesTable.id, params.data.id));
  if (!website) {
    res.status(404).json({ error: "Website not found" });
    return;
  }
  res.json(GetWebsiteResponse.parse(website));
});

router.patch("/websites/:id", async (req, res): Promise<void> => {
  const params = UpdateWebsiteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateWebsiteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [website] = await db.update(websitesTable).set(parsed.data).where(eq(websitesTable.id, params.data.id)).returning();
  if (!website) {
    res.status(404).json({ error: "Website not found" });
    return;
  }
  res.json(UpdateWebsiteResponse.parse(website));
});

router.delete("/websites/:id", async (req, res): Promise<void> => {
  const params = DeleteWebsiteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [website] = await db.delete(websitesTable).where(eq(websitesTable.id, params.data.id)).returning();
  if (!website) {
    res.status(404).json({ error: "Website not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
