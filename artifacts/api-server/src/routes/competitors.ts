import { Router, type IRouter } from "express";
import { eq, and, desc, inArray } from "drizzle-orm";
import { db, competitorResearchSessionsTable, keywordsTable, websitesTable } from "@workspace/db";
import { RunCompetitorAnalysisBody } from "@workspace/api-zod";
import { callAI } from "../lib/ai-provider.js";
import { checkAndIncrementUsage } from "../lib/ai-usage.js";

const router: IRouter = Router();

function normalizeDomain(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "");
  s = s.replace(/^www\./, "");
  s = s.replace(/\/.*$/, "");
  return s;
}

router.post("/competitors/analyse", async (req, res): Promise<void> => {
  const userId = req.user!.id;

  const parsed = RunCompetitorAnalysisBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const domain = normalizeDomain(parsed.data.domain);
  if (!domain || !domain.includes(".")) {
    res.status(400).json({ error: "Please enter a valid domain (e.g. semrush.com)" });
    return;
  }

  const now = new Date();

  const [ownCached] = await db
    .select()
    .from(competitorResearchSessionsTable)
    .where(
      and(
        eq(competitorResearchSessionsTable.staffUserId, userId),
        eq(competitorResearchSessionsTable.domain, domain),
      )
    )
    .orderBy(desc(competitorResearchSessionsTable.createdAt))
    .limit(1);

  if (ownCached && ownCached.cachedUntil > now) {
    const result = ownCached.result as Record<string, unknown>;
    res.json({
      sessionId: ownCached.id,
      domain: ownCached.domain,
      fromCache: true,
      ...result,
      createdAt: ownCached.createdAt.toISOString(),
    });
    return;
  }

  const usageCheck = await checkAndIncrementUsage(userId, "text");
  if (!usageCheck.allowed) {
    res.status(429).json({ error: "Monthly text generation limit reached", used: usageCheck.used, limit: usageCheck.limit });
    return;
  }

  const userWebsites = await db
    .select({ id: websitesTable.id })
    .from(websitesTable);
  const websiteIds = userWebsites.map(w => w.id);

  const trackedKeywords = websiteIds.length > 0
    ? await db
        .select({ keyword: keywordsTable.keyword })
        .from(keywordsTable)
        .where(inArray(keywordsTable.websiteId, websiteIds))
        .limit(50)
    : [];

  const trackedList = trackedKeywords.map(k => k.keyword);
  const trackedContext = trackedList.length > 0
    ? `The user is already tracking these keywords: ${trackedList.slice(0, 30).join(", ")}. Use this to identify genuine gap opportunities they are NOT targeting.`
    : "The user has no tracked keywords yet — identify the most impactful beginner gap opportunities.";

  const prompt = `You are a senior SEO analyst who has deeply studied the domain "${domain}".

Produce a structured competitor analysis in JSON. ${trackedContext}

Return ONLY valid JSON with this exact structure (no markdown, no code blocks):
{
  "domainOverview": {
    "authority": <integer 0-100 estimated domain authority>,
    "trafficBand": <one of: "<10K", "10K-100K", "100K-1M", "1M+">,
    "niche": "<primary niche, 3-6 words>",
    "industry": "<broad industry, 2-4 words>",
    "summary": "<2-3 sentence strategic summary of how this domain acquires organic traffic>"
  },
  "keywordThemes": [
    {
      "theme": "<keyword cluster theme, 2-5 words>",
      "difficulty": <integer 0-100>,
      "intent": <one of: "informational", "commercial", "navigational", "transactional">,
      "volumeBand": <one of: "<100", "100-1K", "1K-10K", "10K+">,
      "description": "<1-2 sentence description of this theme and why the domain targets it>"
    }
  ],
  "contentTopics": [
    {
      "topic": "<specific content topic or page type, 3-8 words>",
      "description": "<1-2 sentence description of likely traffic driver and user intent>"
    }
  ],
  "gapOpportunities": [
    {
      "keyword": "<specific keyword phrase, 2-5 words>",
      "difficulty": <integer 0-100>,
      "intent": <one of: "informational", "commercial", "navigational", "transactional">,
      "volumeBand": <one of: "<100", "100-1K", "1K-10K", "10K+">,
      "rationale": "<1 sentence: why this is a good gap opportunity>"
    }
  ]
}

Requirements:
- keywordThemes: exactly 12 items, mix of difficulties (easy 10-30, medium 30-60, hard 60+)
- contentTopics: exactly 9 items, specific page types or article angles the domain likely ranks for
- gapOpportunities: exactly 10 items, prioritise low-to-medium difficulty keywords not in the user's tracked list
- All estimates are clearly AI-based, use realistic ballpark figures for the actual domain
- Be specific to "${domain}" — not generic SEO advice`;

  let aiResult: {
    domainOverview: {
      authority: number;
      trafficBand: string;
      niche: string;
      industry: string;
      summary: string;
    };
    keywordThemes: Array<{
      theme: string;
      difficulty: number;
      intent: string;
      volumeBand: string;
      description: string;
    }>;
    contentTopics: Array<{ topic: string; description: string }>;
    gapOpportunities: Array<{
      keyword: string;
      difficulty: number;
      intent: string;
      volumeBand: string;
      rationale: string;
    }>;
  };

  try {
    const raw = await callAI(prompt, { maxTokens: 3000, jsonMode: true });
    const text = typeof raw === "string" ? raw : JSON.stringify(raw);
    aiResult = JSON.parse(text);

    if (!aiResult?.domainOverview || !Array.isArray(aiResult.keywordThemes)) {
      throw new Error("Malformed AI response");
    }
  } catch {
    res.status(503).json({ error: "AI analysis failed — please try again" });
    return;
  }

  const cachedUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const resultPayload = {
    domainOverview: aiResult.domainOverview,
    keywordThemes: Array.isArray(aiResult.keywordThemes) ? aiResult.keywordThemes : [],
    contentTopics: Array.isArray(aiResult.contentTopics) ? aiResult.contentTopics : [],
    gapOpportunities: Array.isArray(aiResult.gapOpportunities) ? aiResult.gapOpportunities : [],
  };

  const [session] = await db
    .insert(competitorResearchSessionsTable)
    .values({
      staffUserId: userId,
      domain,
      result: resultPayload,
      cachedUntil,
    })
    .returning();

  res.json({
    sessionId: session.id,
    domain: session.domain,
    fromCache: false,
    ...resultPayload,
    createdAt: session.createdAt.toISOString(),
  });
});

router.get("/competitors/history", async (req, res): Promise<void> => {
  const userId = req.user!.id;

  const sessions = await db
    .select()
    .from(competitorResearchSessionsTable)
    .where(eq(competitorResearchSessionsTable.staffUserId, userId))
    .orderBy(desc(competitorResearchSessionsTable.createdAt))
    .limit(5);

  const history = sessions.map(s => {
    const result = s.result as Record<string, unknown>;
    return {
      id: s.id,
      domain: s.domain,
      domainOverview: result.domainOverview,
      keywordThemes: result.keywordThemes ?? [],
      contentTopics: result.contentTopics ?? [],
      gapOpportunities: result.gapOpportunities ?? [],
      cachedUntil: s.cachedUntil.toISOString(),
      createdAt: s.createdAt.toISOString(),
    };
  });

  res.json(history);
});

export default router;
