import { Router, type IRouter } from "express";
import { db, websitesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { callAI } from "../lib/ai-provider.js";
import { checkAndIncrementUsage } from "../lib/ai-usage.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

/** POST /local-seo/keywords — AI-powered local keyword suggestions */
router.post("/local-seo/keywords", async (req, res): Promise<void> => {
  const { topic, location, websiteId } = req.body as {
    topic?: string;
    location?: string;
    websiteId?: number;
  };

  if (!topic?.trim()) {
    res.status(400).json({ error: "topic is required" });
    return;
  }

  let niche: string | null = null;
  if (websiteId) {
    const [site] = await db.select({ niche: websitesTable.niche }).from(websitesTable).where(eq(websitesTable.id, websiteId));
    niche = site?.niche ?? null;
  }

  const usageCheck = await checkAndIncrementUsage(req.user!.id, "text");
  if (!usageCheck.allowed) {
    res.status(429).json({ error: "Monthly text generation limit reached", used: usageCheck.used, limit: usageCheck.limit });
    return;
  }

  const locClause = location?.trim() ? ` targeting the location "${location.trim()}"` : "";
  const nicheClause = niche ? ` in the "${niche}" niche` : "";

  const prompt = `You are a local SEO expert. Generate 20 high-value local keyword ideas for a business about "${topic.trim()}"${nicheClause}${locClause}.

Focus specifically on:
- "[service] + [city/location]" patterns (e.g. "plumber near me", "dentist in Austin")
- "best [service] [location]" searches
- "near me" and "nearby" variants
- Hyper-local and neighbourhood-level terms
- Service + review terms ("top rated", "affordable", "emergency")

For each keyword provide:
- keyword: the exact phrase someone would type
- intent: one of "transactional" | "informational" | "navigational"
- volumeBand: one of "<100" | "100-1K" | "1K-10K" | "10K+"
- difficulty: 0-100 integer (local keywords tend to be easier, 10-40)
- tip: one short sentence on what content/page would rank for this

Return ONLY valid JSON: {"suggestions": [...]}`;

  try {
    const content = await callAI(prompt, { maxTokens: 2500, jsonMode: true });
    let raw: Record<string, unknown>;
    try { raw = JSON.parse(content) as Record<string, unknown>; }
    catch { raw = { suggestions: [] }; }

    const rawSuggestions = Array.isArray(raw["suggestions"]) ? raw["suggestions"] as unknown[] : [];
    const validVolumes = ["<100", "100-1K", "1K-10K", "10K+"] as const;
    const validIntents = ["transactional", "informational", "navigational"] as const;

    const suggestions = rawSuggestions
      .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
      .map(s => ({
        keyword: String(s["keyword"] ?? "").trim(),
        intent: validIntents.includes(s["intent"] as typeof validIntents[number])
          ? s["intent"] as typeof validIntents[number] : "transactional" as const,
        volumeBand: validVolumes.includes(s["volumeBand"] as typeof validVolumes[number])
          ? s["volumeBand"] as typeof validVolumes[number] : "100-1K" as const,
        difficulty: typeof s["difficulty"] === "number" ? Math.min(100, Math.max(0, s["difficulty"])) : 25,
        tip: String(s["tip"] ?? ""),
      }))
      .filter(s => s.keyword.length > 0);

    res.json({ suggestions, topic: topic.trim(), location: location?.trim() ?? null });
  } catch (err) {
    logger.error({ err }, "Local SEO keyword generation failed");
    res.status(503).json({ error: "AI generation failed. Please try again." });
  }
});

export default router;
