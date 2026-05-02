import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, backlinksTable, websitesTable } from "@workspace/db";
import {
  ListBacklinksQueryParams,
  ListBacklinksResponse,
  CreateBacklinkBody,
  UpdateBacklinkParams,
  UpdateBacklinkBody,
  UpdateBacklinkResponse,
  DeleteBacklinkParams,
} from "@workspace/api-zod";
import { callAI } from "../lib/ai-provider.js";
import { checkAndIncrementUsage } from "../lib/ai-usage.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const VALID_TYPES = ["guest_post", "resource", "directory", "forum", "social", "other"] as const;

router.post("/backlinks/ai-opportunities", async (req, res): Promise<void> => {
  const { niche, websiteId, seedKeywords } = req.body as {
    niche?: string;
    websiteId?: number;
    seedKeywords?: string;
  };

  if (!niche?.trim() && !websiteId) {
    res.status(400).json({ error: "niche or websiteId is required" });
    return;
  }

  let resolvedNiche = niche?.trim() ?? "";
  let siteUrl: string | null = null;

  if (websiteId) {
    const [site] = await db
      .select({ niche: websitesTable.niche, url: websitesTable.url })
      .from(websitesTable)
      .where(eq(websitesTable.id, websiteId));
    if (site) {
      if (!resolvedNiche && site.niche) resolvedNiche = site.niche;
      siteUrl = site.url;
    }
  }

  const usageCheck = await checkAndIncrementUsage(req.user!.id, "text");
  if (!usageCheck.allowed) {
    res.status(429).json({ error: "Monthly text generation limit reached", used: usageCheck.used, limit: usageCheck.limit });
    return;
  }

  const seedClause = seedKeywords?.trim() ? ` Key topics/keywords: ${seedKeywords.trim()}.` : "";
  const siteClause = siteUrl ? ` The website is ${siteUrl}.` : "";

  const prompt = `You are an expert link building strategist. Generate 18 actionable backlink opportunities for a website in the "${resolvedNiche}" niche.${siteClause}${seedClause}

Return ONLY valid JSON: { "opportunities": [...] }

Each opportunity object must have:
- "type": one of "guest_post" | "resource" | "directory" | "forum" | "social" | "other"
- "siteCategory": short label for the kind of site (e.g. "Marketing blog", "SaaS directory", "Industry forum")
- "exampleDomain": a realistic example domain (no https://, no www) — use real, plausible domains in this niche
- "pitchAngle": one sentence describing the specific angle or hook for the outreach email
- "difficulty": integer 1–3 (1=easy, 2=medium, 3=hard)
- "estimatedDA": integer 20–80, realistic domain authority estimate
- "whyRelevant": one sentence explaining why this site/link would help SEO

Mix the types: include 5-6 guest_post, 3-4 resource, 2-3 directory, 2-3 forum, 1-2 social, 1-2 other.
Difficulty 1 entries should be directories or niche forums. Difficulty 3 entries should be high-DA editorial sites.
Be specific — generic suggestions like "find a blog in your niche" are not acceptable.`;

  try {
    const content = await callAI(prompt, { maxTokens: 3000, jsonMode: true });
    let raw: Record<string, unknown>;
    try { raw = JSON.parse(content) as Record<string, unknown>; }
    catch { raw = { opportunities: [] }; }

    const rawOps = Array.isArray(raw["opportunities"]) ? raw["opportunities"] as unknown[] : [];

    const opportunities = rawOps
      .filter((o): o is Record<string, unknown> => typeof o === "object" && o !== null)
      .map(o => ({
        type: VALID_TYPES.includes(o["type"] as typeof VALID_TYPES[number])
          ? o["type"] as typeof VALID_TYPES[number]
          : "other" as const,
        siteCategory: String(o["siteCategory"] ?? "").trim(),
        exampleDomain: String(o["exampleDomain"] ?? "").trim().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, ""),
        pitchAngle: String(o["pitchAngle"] ?? "").trim(),
        difficulty: typeof o["difficulty"] === "number" ? Math.min(3, Math.max(1, o["difficulty"])) : 2,
        estimatedDA: typeof o["estimatedDA"] === "number" ? Math.min(100, Math.max(1, o["estimatedDA"])) : 40,
        whyRelevant: String(o["whyRelevant"] ?? "").trim(),
      }))
      .filter(o => o.exampleDomain.length > 0 && o.pitchAngle.length > 0);

    res.json({ opportunities, niche: resolvedNiche });
  } catch (err) {
    logger.error({ err }, "AI backlink opportunity generation failed");
    res.status(503).json({ error: "AI generation failed. Please try again." });
  }
});

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
