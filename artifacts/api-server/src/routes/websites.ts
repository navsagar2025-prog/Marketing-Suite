import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, websitesTable, seoAuditsTable, linkSuggestionsTable } from "@workspace/db";
import { callAI } from "../lib/ai-provider.js";
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
import { crawlUrl } from "../crawler.js";

const router: IRouter = Router();

router.get("/websites", async (req, res): Promise<void> => {
  const websites = await db.select().from(websitesTable).orderBy(websitesTable.createdAt);
  res.json(ListWebsitesResponse.parse(websites));
});

router.post("/websites/detect", async (req, res): Promise<void> => {
  const { url } = req.body as { url?: string };
  if (!url) {
    res.status(400).json({ error: "url is required" });
    return;
  }
  try {
    const crawled = await crawlUrl(url);
    const prompt = `You are an SEO expert. Based on the following crawled page data, determine:
1. The website name (from title or domain)
2. The niche/industry (e.g., "Health & Fitness", "E-commerce", "Tech Blog")
3. A preliminary SEO score (0-100) based on the meta data quality
4. A brief description (1 sentence)

Crawled data:
- URL: ${crawled.url}
- Title: ${crawled.title ?? "None"}
- Meta Description: ${crawled.metaDescription ?? "None"}
- H1 Tags: ${crawled.h1Tags.slice(0, 3).join(", ") || "None"}
- Word Count: ${crawled.wordCount}
- Has Canonical: ${crawled.hasCanonical}
- Has Viewport: ${crawled.hasViewport}
- OG Title: ${crawled.ogTitle ?? "None"}

Return ONLY valid JSON: { "name": "...", "niche": "...", "seoScore": 0-100, "description": "..." }`;

    let result = { name: crawled.title ?? new URL(url).hostname, niche: "General", seoScore: null as number | null, description: null as string | null };
    try {
      const content = await callAI(prompt, { maxTokens: 512 });
      const parsed = JSON.parse(content);
      result = {
        name: parsed.name || result.name,
        niche: parsed.niche || result.niche,
        seoScore: typeof parsed.seoScore === "number" ? parsed.seoScore : null,
        description: parsed.description || null,
      };
    } catch {
      // use defaults
    }
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Detection failed";
    res.status(500).json({ error: message });
  }
});

router.post("/websites", async (req, res): Promise<void> => {
  const parsed = CreateWebsiteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  let { name, niche, url, seoScore, status, notes } = parsed.data;

  if (!name || !niche) {
    try {
      const crawled = await crawlUrl(url);
      const prompt = `You are an SEO expert. Based on the following crawled page data, determine:
1. The website name (from title or domain)
2. The niche/industry (e.g., "Health & Fitness", "E-commerce", "Tech Blog")
3. A preliminary SEO score (0-100) based on the meta data quality

Crawled data:
- URL: ${crawled.url}
- Title: ${crawled.title ?? "None"}
- Meta Description: ${crawled.metaDescription ?? "None"}
- H1 Tags: ${crawled.h1Tags.slice(0, 3).join(", ") || "None"}
- Word Count: ${crawled.wordCount}

Return ONLY valid JSON: { "name": "...", "niche": "...", "seoScore": 0-100 }`;
      try {
        const content = await callAI(prompt, { maxTokens: 256 });
        const ai = JSON.parse(content);
        if (!name && ai.name) name = ai.name;
        if (!niche && ai.niche) niche = ai.niche;
        if (seoScore == null && typeof ai.seoScore === "number") seoScore = ai.seoScore;
      } catch {
        // use defaults
      }
    } catch {
      // crawl failed - use fallback values
    }
  }

  const insertData = {
    name: name ?? new URL(url).hostname.replace("www.", ""),
    url,
    niche: niche ?? "General",
    seoScore: seoScore ?? null,
    status: status ?? "active",
    notes: notes ?? null,
  };

  const [website] = await db.insert(websitesTable).values(insertData).returning();
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

router.get("/websites/:id/audits", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "");
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const audits = await db
    .select()
    .from(seoAuditsTable)
    .where(eq(seoAuditsTable.websiteId, id))
    .orderBy(desc(seoAuditsTable.crawledAt));

  const formatted = audits.map(a => ({
    id: a.id,
    websiteId: a.websiteId,
    score: a.score,
    issues: a.issuesJson as unknown[],
    crawledAt: a.crawledAt,
  }));
  res.json(formatted);
});

router.post("/websites/:id/audit", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "");
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [website] = await db.select().from(websitesTable).where(eq(websitesTable.id, id));
  if (!website) {
    res.status(404).json({ error: "Website not found" });
    return;
  }

  let crawled;
  try {
    crawled = await crawlUrl(website.url);
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
H3 Tags (${crawled.h3Tags.length}): listed
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
    const aiContent = await callAI(prompt, { maxTokens: 3000 });
    const parsed = JSON.parse(aiContent);
    score = typeof parsed.score === "number" ? Math.max(0, Math.min(100, parsed.score)) : 50;
    issues = Array.isArray(parsed.issues) ? parsed.issues : [];
  } catch {
    // fallback: generate basic issues from crawled data
    const basicIssues = [];
    if (!crawled.title) basicIssues.push({ id: "missing-title", severity: "critical", category: "Meta Tags", title: "Missing Page Title", description: "The page has no title tag.", recommendation: "Add a descriptive title tag (50-60 characters).", currentValue: null });
    if (!crawled.metaDescription) basicIssues.push({ id: "missing-meta-desc", severity: "critical", category: "Meta Tags", title: "Missing Meta Description", description: "No meta description found.", recommendation: "Add a compelling meta description (150-160 characters).", currentValue: null });
    if (crawled.h1Tags.length === 0) basicIssues.push({ id: "missing-h1", severity: "critical", category: "Content", title: "Missing H1 Tag", description: "No H1 heading found.", recommendation: "Add exactly one H1 tag with your primary keyword.", currentValue: null });
    issues = basicIssues;
    score = Math.max(0, 100 - basicIssues.length * 15);
  }

  const [audit] = await db.insert(seoAuditsTable).values({
    websiteId: id,
    score,
    issuesJson: issues,
    crawledData: crawled as unknown as Record<string, unknown>,
  }).returning();

  await db.update(websitesTable).set({ seoScore: score }).where(eq(websitesTable.id, id));

  res.json({
    id: audit.id,
    websiteId: audit.websiteId,
    score: audit.score,
    issues: audit.issuesJson,
    crawledAt: audit.crawledAt,
  });
});

router.get("/websites/:id/link-suggestions", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "");
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [website] = await db.select().from(websitesTable).where(eq(websitesTable.id, id));
  if (!website) {
    res.status(404).json({ error: "Website not found" });
    return;
  }
  const suggestions = await db
    .select()
    .from(linkSuggestionsTable)
    .where(eq(linkSuggestionsTable.websiteId, id))
    .orderBy(desc(linkSuggestionsTable.createdAt));
  res.json(suggestions);
});

router.post("/websites/:id/link-suggestions", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "");
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [website] = await db.select().from(websitesTable).where(eq(websitesTable.id, id));
  if (!website) {
    res.status(404).json({ error: "Website not found" });
    return;
  }

  const allAudits = await db
    .select()
    .from(seoAuditsTable)
    .where(eq(seoAuditsTable.websiteId, id))
    .orderBy(desc(seoAuditsTable.crawledAt))
    .limit(10);

  if (allAudits.length === 0 || !allAudits.some(a => a.crawledData)) {
    res.status(404).json({ error: "No audit data found. Please run an SEO audit first." });
    return;
  }

  type CrawledPage = {
    url: string;
    title?: string;
    metaDescription?: string;
    h1Tags?: string[];
    h2Tags?: string[];
    h3Tags?: string[];
    wordCount?: number;
    internalLinks?: number;
  };

  const seenUrls = new Set<string>();
  const pages: CrawledPage[] = [];

  for (const audit of allAudits) {
    if (!audit.crawledData) continue;
    const crawled = audit.crawledData as Record<string, unknown>;
    const url = crawled.url as string | undefined;
    if (!url || seenUrls.has(url)) continue;
    seenUrls.add(url);
    pages.push({
      url,
      title: crawled.title as string | undefined,
      metaDescription: crawled.metaDescription as string | undefined,
      h1Tags: crawled.h1Tags as string[] | undefined,
      h2Tags: crawled.h2Tags as string[] | undefined,
      h3Tags: crawled.h3Tags as string[] | undefined,
      wordCount: crawled.wordCount as number | undefined,
      internalLinks: crawled.internalLinks as number | undefined,
    });
  }

  if (pages.length === 0) {
    res.status(404).json({ error: "No crawled page data found in audit history." });
    return;
  }

  const pagesText = pages.map((p, i) => {
    const h2s = (p.h2Tags ?? []).slice(0, 5);
    const h3s = (p.h3Tags ?? []).slice(0, 5);
    return [
      `Page ${i + 1}:`,
      `  URL: ${p.url}`,
      `  Title: ${p.title ?? "No title"}`,
      `  Meta Description: ${p.metaDescription ?? "None"}`,
      `  H1: ${(p.h1Tags ?? []).slice(0, 2).join(" | ") || "None"}`,
      h2s.length ? `  H2 Headings: ${h2s.join(" | ")}` : null,
      h3s.length ? `  H3 Headings: ${h3s.join(" | ")}` : null,
      p.wordCount ? `  Word Count: ${p.wordCount}` : null,
      p.internalLinks !== undefined ? `  Existing Internal Links: ${p.internalLinks}` : null,
    ].filter(Boolean).join("\n");
  }).join("\n\n");

  const niche = website.niche ?? "General";
  const websiteUrl = website.url;
  const prompt = `You are an expert SEO consultant specializing in internal link strategy for a "${niche}" website.

Website: "${website.name}" (${websiteUrl})
Crawled pages from SEO audit history (${pages.length} page${pages.length > 1 ? "s" : ""} crawled):

${pagesText}

Your task: Generate 6-10 specific internal link recommendations. For each recommendation:
- sourcePage: the URL (or section/topic area) where the link should be ADDED
- targetPage: the URL (or section/topic area) the link should POINT TO  
- anchorText: the exact text that should be hyperlinked (keyword-rich, natural)
- reason: a concise 1-sentence explanation of the SEO benefit

Rules:
- If only one page was crawled, use the page's H2/H3 headings to identify distinct topic sections and suggest cross-linking between those sections and likely related pages on the site
- Use the site's niche, headings, and meta description to infer what other pages likely exist (e.g., /blog, /services, /about, /contact, category pages)
- Prioritize linking high-value pages to each other and from high-traffic sections to conversion pages
- Use natural, keyword-rich anchor text — never "click here" or "read more"
- Each source→target pair should be unique

Return ONLY valid JSON in this format:
{
  "suggestions": [
    {
      "sourcePage": "<URL or section>",
      "targetPage": "<URL or section>",
      "anchorText": "<exact anchor text>",
      "reason": "<1-sentence SEO benefit>"
    }
  ]
}`;

  let suggestions: Array<{ sourcePage: string; targetPage: string; anchorText: string; reason: string }> = [];

  try {
    const content = await callAI(prompt, { maxTokens: 2048 });
    let parsed: { suggestions?: typeof suggestions } = { suggestions: [] };
    try {
      parsed = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); } catch { /* fallback */ }
      }
    }
    const raw = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
    const seen = new Set<string>();
    suggestions = raw.filter((s): s is { sourcePage: string; targetPage: string; anchorText: string; reason: string } => {
      if (
        typeof s !== "object" || s === null ||
        typeof s.sourcePage !== "string" || !s.sourcePage.trim() ||
        typeof s.targetPage !== "string" || !s.targetPage.trim() ||
        typeof s.anchorText !== "string" || !s.anchorText.trim() ||
        typeof s.reason !== "string" || !s.reason.trim()
      ) return false;
      const key = `${s.sourcePage.trim()}|${s.targetPage.trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI generation failed";
    res.status(503).json({ error: message });
    return;
  }

  await db.delete(linkSuggestionsTable).where(eq(linkSuggestionsTable.websiteId, id));

  if (suggestions.length === 0) {
    res.json([]);
    return;
  }

  const inserted = await db
    .insert(linkSuggestionsTable)
    .values(suggestions.map(s => ({
      websiteId: id,
      sourcePage: s.sourcePage.trim(),
      targetPage: s.targetPage.trim(),
      anchorText: s.anchorText.trim(),
      reason: s.reason.trim(),
    })))
    .returning();

  res.json(inserted);
});

export default router;
