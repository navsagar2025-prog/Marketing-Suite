import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { pagespeedResultsTable, websitesTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { recordPagespeedForWebsite, type Strategy } from "../lib/pagespeed.js";

const router: IRouter = Router();

router.get("/websites/:id/pagespeed", async (req, res): Promise<void> => {
  const websiteId = parseInt(req.params.id);
  if (!Number.isFinite(websiteId)) {
    res.status(400).json({ error: "Invalid website id" });
    return;
  }
  const strategy = (req.query.strategy === "desktop" ? "desktop" : "mobile") as Strategy;
  const limit = Math.min(parseInt(String(req.query.limit ?? "60")) || 60, 365);

  const rows = await db
    .select()
    .from(pagespeedResultsTable)
    .where(and(eq(pagespeedResultsTable.websiteId, websiteId), eq(pagespeedResultsTable.strategy, strategy)))
    .orderBy(desc(pagespeedResultsTable.recordedAt))
    .limit(limit);

  res.json({ results: rows.reverse() });
});

router.post("/websites/:id/pagespeed/run", async (req, res): Promise<void> => {
  const websiteId = parseInt(req.params.id);
  if (!Number.isFinite(websiteId)) {
    res.status(400).json({ error: "Invalid website id" });
    return;
  }
  const [website] = await db.select().from(websitesTable).where(eq(websitesTable.id, websiteId));
  if (!website) {
    res.status(404).json({ error: "Website not found" });
    return;
  }
  const strategy = (req.body?.strategy === "desktop" ? "desktop" : "mobile") as Strategy;
  await recordPagespeedForWebsite(website.id, website.url, strategy);
  const [latest] = await db
    .select()
    .from(pagespeedResultsTable)
    .where(and(eq(pagespeedResultsTable.websiteId, websiteId), eq(pagespeedResultsTable.strategy, strategy)))
    .orderBy(desc(pagespeedResultsTable.recordedAt))
    .limit(1);
  res.json({ ok: true, latest });
});

export default router;
