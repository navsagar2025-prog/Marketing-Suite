import { Router, type IRouter } from "express";
import { db, websitesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { callAI } from "../lib/ai-provider.js";
import { checkAndIncrementUsage } from "../lib/ai-usage.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

router.post("/content-brief/generate", async (req, res): Promise<void> => {
  const { keyword, websiteId, audience } = req.body as {
    keyword?: string;
    websiteId?: number;
    audience?: string;
  };

  if (!keyword?.trim()) {
    res.status(400).json({ error: "keyword is required" });
    return;
  }

  let niche: string | null = null;
  if (websiteId) {
    const [site] = await db
      .select({ niche: websitesTable.niche })
      .from(websitesTable)
      .where(eq(websitesTable.id, websiteId));
    niche = site?.niche ?? null;
  }

  const usageCheck = await checkAndIncrementUsage(req.user!.id, "text");
  if (!usageCheck.allowed) {
    res.status(429).json({
      error: "Monthly text generation limit reached",
      used: usageCheck.used,
      limit: usageCheck.limit,
    });
    return;
  }

  const nicheClause = niche ? ` in the "${niche}" industry` : "";
  const audienceClause = audience?.trim() ? ` Target audience: ${audience.trim()}.` : "";

  const prompt = `You are a senior SEO content strategist. Generate a detailed content brief for the keyword: "${keyword.trim()}"${nicheClause}.${audienceClause}

Return ONLY valid JSON matching this exact structure:
{
  "keyword": "the exact target keyword",
  "titleOptions": ["Title option 1", "Title option 2", "Title option 3"],
  "metaDescription": "A compelling 150-160 character meta description including the keyword",
  "wordCountTarget": 1800,
  "contentType": "guide",
  "outline": [
    {
      "h2": "Section heading",
      "intent": "what this section accomplishes for the reader",
      "h3s": ["subsection 1", "subsection 2"]
    }
  ],
  "semanticKeywords": ["related term 1", "related term 2"],
  "paaQuestions": ["People Also Ask question 1", "question 2"],
  "internalLinkingTips": ["Tip about what other content to link to or from"],
  "contentAngle": "The unique differentiated angle that will make this outrank generic results",
  "estimatedReadTime": "X min read"
}

Rules:
- contentType: one of guide | listicle | comparison | tutorial | review | pillar
- wordCountTarget: 800-4000 based on keyword complexity and competition
- outline: 6-8 H2 sections minimum, each with 2-4 H3s
- semanticKeywords: 12-15 LSI terms, synonyms, related concepts Google associates with this topic
- paaQuestions: 6-8 real questions users search around this keyword
- internalLinkingTips: 2-3 practical tips about which pages to interlink
- contentAngle: one sentence describing the unique hook that differentiates this content
- Be specific and actionable — a writer should be able to produce a top-3 article from this brief alone`;

  try {
    const content = await callAI(prompt, { maxTokens: 3500, jsonMode: true });

    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(content) as Record<string, unknown>;
    } catch {
      res.status(503).json({ error: "AI returned invalid response. Please try again." });
      return;
    }

    const brief = {
      keyword: String(raw["keyword"] ?? keyword.trim()),
      titleOptions: Array.isArray(raw["titleOptions"])
        ? (raw["titleOptions"] as unknown[]).map(t => String(t)).filter(Boolean)
        : [],
      metaDescription: String(raw["metaDescription"] ?? ""),
      wordCountTarget:
        typeof raw["wordCountTarget"] === "number"
          ? Math.min(6000, Math.max(400, raw["wordCountTarget"]))
          : 1500,
      contentType: String(raw["contentType"] ?? "guide"),
      outline: Array.isArray(raw["outline"])
        ? (raw["outline"] as unknown[])
            .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
            .map(s => ({
              h2: String(s["h2"] ?? "").trim(),
              intent: String(s["intent"] ?? "").trim(),
              h3s: Array.isArray(s["h3s"])
                ? (s["h3s"] as unknown[]).map(h => String(h)).filter(Boolean)
                : [],
            }))
            .filter(s => s.h2.length > 0)
        : [],
      semanticKeywords: Array.isArray(raw["semanticKeywords"])
        ? (raw["semanticKeywords"] as unknown[]).map(k => String(k)).filter(Boolean)
        : [],
      paaQuestions: Array.isArray(raw["paaQuestions"])
        ? (raw["paaQuestions"] as unknown[]).map(q => String(q)).filter(Boolean)
        : [],
      internalLinkingTips: Array.isArray(raw["internalLinkingTips"])
        ? (raw["internalLinkingTips"] as unknown[]).map(t => String(t)).filter(Boolean)
        : [],
      contentAngle: String(raw["contentAngle"] ?? ""),
      estimatedReadTime: String(raw["estimatedReadTime"] ?? ""),
    };

    res.json(brief);
  } catch (err) {
    logger.error({ err }, "Content brief generation failed");
    res.status(503).json({ error: "AI generation failed. Please try again." });
  }
});

export default router;
