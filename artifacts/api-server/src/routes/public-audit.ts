import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, ipRateLimitsTable, ipAllowlistTable } from "@workspace/db";
import { crawlUrl } from "../crawler.js";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

const DAILY_LIMIT = 2;

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

router.post("/audit/public", async (req, res): Promise<void> => {
  const { url } = req.body as { url?: string };
  if (!url) {
    res.status(400).json({ error: "url is required" });
    return;
  }

  const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";
  const today = getTodayDate();

  const [allowlistEntry] = await db
    .select()
    .from(ipAllowlistTable)
    .where(eq(ipAllowlistTable.ip, ip));

  if (!allowlistEntry) {
    const [rateRecord] = await db
      .select()
      .from(ipRateLimitsTable)
      .where(and(
        eq(ipRateLimitsTable.ip, ip),
        eq(ipRateLimitsTable.feature, "public_audit"),
        eq(ipRateLimitsTable.date, today),
      ));

    if (rateRecord && rateRecord.count >= DAILY_LIMIT) {
      res.status(429).json({
        error: "rate_limit_exceeded",
        message: "Free report limit reached. Contact us to unlock.",
      });
      return;
    }
  }

  let crawled;
  try {
    crawled = await crawlUrl(url);
  } catch (err) {
    res.status(500).json({ error: `Crawl failed: ${err instanceof Error ? err.message : "Unknown error"}` });
    return;
  }

  const crawlSummary = `
URL: ${crawled.url}
Title: ${crawled.title ?? "MISSING"} (${crawled.titleLength} chars)
Meta Description: ${crawled.metaDescription ?? "MISSING"} (${crawled.metaDescriptionLength} chars)
Canonical URL: ${crawled.canonicalUrl ?? "MISSING"}
Robots Meta: ${crawled.robotsMeta ?? "Not set"}
H1 Tags (${crawled.h1Tags.length}): ${crawled.h1Tags.slice(0, 3).join(" | ") || "NONE"}
H2 Tags (${crawled.h2Tags.length}): ${crawled.h2Tags.slice(0, 5).join(" | ") || "NONE"}
Images Total: ${crawled.imagesTotal}, Missing Alt: ${crawled.imagesMissingAlt}
Word Count: ${crawled.wordCount}
Internal Links: ${crawled.internalLinks}, External Links: ${crawled.externalLinks}
OG Title: ${crawled.ogTitle ?? "MISSING"}
OG Description: ${crawled.ogDescription ?? "MISSING"}
OG Image: ${crawled.ogImage ?? "MISSING"}
Language (lang attr): ${crawled.lang ?? "MISSING"}
Has Viewport Meta: ${crawled.hasViewport}
Has Canonical: ${crawled.hasCanonical}
Schema.org Types: ${crawled.schemaTypes.join(", ") || "None"}
`.trim();

  const prompt = `You are an expert SEO auditor. Analyze the following crawled page data and return a comprehensive SEO audit.

${crawlSummary}

Return ONLY valid JSON in this exact structure:
{
  "score": <integer 0-100>,
  "issues": [
    {
      "id": "<unique-slug>",
      "severity": "<critical|warning|info>",
      "category": "<Meta Tags|Content|Technical|Links|Images|Social|Schema>",
      "title": "<short issue title>",
      "description": "<plain English explanation of the problem>",
      "recommendation": "<specific actionable fix>",
      "currentValue": "<current value or null>"
    }
  ]
}

Score criteria: 90-100 = excellent, 70-89 = good, 50-69 = needs work, below 50 = poor.
Include issues for: missing/short title, missing/short meta description, missing H1 or multiple H1s, missing alt text on images, missing canonical, missing OG tags, thin content (< 300 words), missing lang attribute, missing viewport, no schema markup.
Order issues by severity (critical first, then warning, then info).`;

  let score = 50;
  let issues: unknown[] = [];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      max_completion_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });
    const content = response.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(content);
    score = typeof parsed.score === "number" ? Math.max(0, Math.min(100, parsed.score)) : 50;
    issues = Array.isArray(parsed.issues) ? parsed.issues : [];
  } catch {
    const basicIssues = [];
    if (!crawled.title) basicIssues.push({ id: "missing-title", severity: "critical", category: "Meta Tags", title: "Missing Page Title", description: "The page has no title tag.", recommendation: "Add a descriptive title tag (50-60 characters).", currentValue: null });
    if (!crawled.metaDescription) basicIssues.push({ id: "missing-meta-desc", severity: "critical", category: "Meta Tags", title: "Missing Meta Description", description: "No meta description found.", recommendation: "Add a compelling meta description (150-160 characters).", currentValue: null });
    if (crawled.h1Tags.length === 0) basicIssues.push({ id: "missing-h1", severity: "critical", category: "Content", title: "Missing H1 Tag", description: "No H1 heading found.", recommendation: "Add exactly one H1 tag with your primary keyword.", currentValue: null });
    issues = basicIssues;
    score = Math.max(0, 100 - basicIssues.length * 15);
  }

  if (!allowlistEntry) {
    const [existing] = await db
      .select()
      .from(ipRateLimitsTable)
      .where(and(
        eq(ipRateLimitsTable.ip, ip),
        eq(ipRateLimitsTable.feature, "public_audit"),
        eq(ipRateLimitsTable.date, today),
      ));

    if (existing) {
      await db
        .update(ipRateLimitsTable)
        .set({ count: existing.count + 1, url, lastRequestAt: new Date() })
        .where(eq(ipRateLimitsTable.id, existing.id));
    } else {
      await db.insert(ipRateLimitsTable).values({
        ip,
        feature: "public_audit",
        url,
        date: today,
        count: 1,
        lastRequestAt: new Date(),
      });
    }
  }

  res.json({ score, issues, url: crawled.url });
});

export default router;
