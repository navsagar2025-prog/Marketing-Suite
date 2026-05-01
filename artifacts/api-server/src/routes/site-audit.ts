import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, siteAuditsTable, siteAuditPagesTable, siteAuditIssuesTable, websitesTable } from "@workspace/db";
import * as cheerio from "cheerio";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const PAGE_LIMIT = 100;
const CONCURRENCY = 3;
const TIMEOUT_MS = 10_000;

interface RobotsTxt {
  disallowedPaths: string[];
}

async function fetchRobotsTxt(origin: string): Promise<RobotsTxt> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${origin}/robots.txt`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { disallowedPaths: [] };
    const text = await res.text();
    const disallowedPaths: string[] = [];
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.toLowerCase().startsWith("disallow:")) {
        const path = trimmed.slice("disallow:".length).trim();
        if (path) disallowedPaths.push(path);
      }
    }
    return { disallowedPaths };
  } catch {
    return { disallowedPaths: [] };
  }
}

function isDisallowed(url: string, robots: RobotsTxt, origin: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname + parsed.search;
    return robots.disallowedPaths.some((d) => path.startsWith(d));
  } catch {
    return false;
  }
}

function extractLinks(html: string, baseUrl: string, origin: string): string[] {
  const $ = cheerio.load(html);
  const links: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const resolved = new URL(href, baseUrl);
      resolved.hash = "";
      if (resolved.origin === origin && resolved.protocol.startsWith("http")) {
        links.push(resolved.href);
      }
    } catch {
      // invalid URL
    }
  });
  return links;
}

interface PageData {
  url: string;
  statusCode: number | null;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  wordCount: number | null;
  responseTimeMs: number | null;
  links: string[];
  isRedirect: boolean;
  redirectChain: number;
  hasCanonical: boolean;
  canonicalUrl: string | null;
  isNoindex: boolean;
}

async function crawlPage(url: string): Promise<PageData> {
  const start = Date.now();
  let statusCode: number | null = null;
  let title: string | null = null;
  let metaDescription: string | null = null;
  let h1: string | null = null;
  let wordCount: number | null = null;
  let responseTimeMs: number | null = null;
  let links: string[] = [];
  let isRedirect = false;
  let redirectChain = 0;
  let hasCanonical = false;
  let canonicalUrl: string | null = null;
  let isNoindex = false;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "SEO-Hub-Crawler/1.0 (site audit bot)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timer);

    responseTimeMs = Date.now() - start;
    statusCode = res.status;

    const finalUrl = res.url;
    isRedirect = finalUrl !== url;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return { url, statusCode, title, metaDescription, h1, wordCount, responseTimeMs, links, isRedirect, redirectChain, hasCanonical, canonicalUrl, isNoindex };
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    title = $("title").first().text().trim() || null;
    metaDescription = $('meta[name="description"]').attr("content")?.trim() ?? null;
    h1 = $("h1").first().text().trim() || null;

    const robotsMeta = $('meta[name="robots"]').attr("content") ?? "";
    isNoindex = robotsMeta.toLowerCase().includes("noindex");

    const canonicalEl = $('link[rel="canonical"]');
    if (canonicalEl.length) {
      hasCanonical = true;
      canonicalUrl = canonicalEl.attr("href") ?? null;
    }

    const bodyText = $("body").text().replace(/\s+/g, " ").trim();
    wordCount = bodyText ? bodyText.split(/\s+/).length : 0;

    const origin = new URL(url).origin;
    links = extractLinks(html, finalUrl, origin);
  } catch (err: unknown) {
    responseTimeMs = Date.now() - start;
    if (err instanceof Error && err.name === "AbortError") {
      statusCode = null;
    }
  }

  return { url, statusCode, title, metaDescription, h1, wordCount, responseTimeMs, links, isRedirect, redirectChain, hasCanonical, canonicalUrl, isNoindex };
}

interface PageIssue {
  issueType: string;
  severity: "critical" | "warning" | "info";
  description: string;
  recommendation: string;
}

function analysePageIssues(page: PageData): PageIssue[] {
  const issues: PageIssue[] = [];

  if (page.statusCode !== null && page.statusCode >= 400) {
    issues.push({
      issueType: "broken_link",
      severity: "critical",
      description: `Page returned HTTP ${page.statusCode}`,
      recommendation: "Fix the broken link or set up a proper redirect.",
    });
    return issues;
  }

  if (page.statusCode === null) {
    issues.push({
      issueType: "unreachable",
      severity: "critical",
      description: "Page could not be reached (timeout or connection error)",
      recommendation: "Check server health and ensure the page is accessible.",
    });
    return issues;
  }

  if (!page.title) {
    issues.push({
      issueType: "missing_title",
      severity: "critical",
      description: "Page is missing a <title> tag",
      recommendation: "Add a descriptive, keyword-rich title tag (50-60 characters).",
    });
  } else {
    if (page.title.length < 30) {
      issues.push({
        issueType: "title_too_short",
        severity: "warning",
        description: `Title tag is too short (${page.title.length} characters)`,
        recommendation: "Expand the title to 50-60 characters for better SEO.",
      });
    } else if (page.title.length > 60) {
      issues.push({
        issueType: "title_too_long",
        severity: "warning",
        description: `Title tag is too long (${page.title.length} characters) and may be truncated in SERPs`,
        recommendation: "Shorten the title to under 60 characters.",
      });
    }
  }

  if (!page.metaDescription) {
    issues.push({
      issueType: "missing_meta_description",
      severity: "warning",
      description: "Page is missing a meta description",
      recommendation: "Add a meta description of 120-160 characters to improve click-through rates.",
    });
  } else if (page.metaDescription.length > 160) {
    issues.push({
      issueType: "meta_description_too_long",
      severity: "info",
      description: `Meta description is too long (${page.metaDescription.length} characters)`,
      recommendation: "Shorten the meta description to under 160 characters.",
    });
  }

  if (!page.h1) {
    issues.push({
      issueType: "missing_h1",
      severity: "warning",
      description: "Page is missing an H1 heading",
      recommendation: "Add a single H1 heading that includes your primary keyword.",
    });
  }

  if (!page.hasCanonical) {
    issues.push({
      issueType: "missing_canonical",
      severity: "info",
      description: "Page is missing a canonical tag",
      recommendation: "Add a <link rel='canonical'> tag to prevent duplicate content issues.",
    });
  }

  if (page.isNoindex) {
    issues.push({
      issueType: "noindex",
      severity: "warning",
      description: "Page has noindex directive — will not appear in search results",
      recommendation: "Remove the noindex directive if this page should be indexed.",
    });
  }

  if (page.isRedirect) {
    issues.push({
      issueType: "redirect",
      severity: "info",
      description: "Page redirects to a different URL",
      recommendation: "Update internal links to point directly to the final destination URL.",
    });
  }

  if (page.responseTimeMs !== null && page.responseTimeMs > 3000) {
    issues.push({
      issueType: "slow_page",
      severity: "warning",
      description: `Page load time is ${(page.responseTimeMs / 1000).toFixed(1)}s (over 3s threshold)`,
      recommendation: "Optimise server response time, enable caching, and compress assets.",
    });
  }

  if (page.wordCount !== null && page.wordCount < 300 && page.statusCode === 200) {
    issues.push({
      issueType: "thin_content",
      severity: "warning",
      description: `Page has thin content (~${page.wordCount} words)`,
      recommendation: "Expand the content to at least 300 words for better search engine coverage.",
    });
  }

  return issues;
}

function calculatePageScore(issues: PageIssue[]): number {
  let score = 100;
  for (const issue of issues) {
    if (issue.severity === "critical") score -= 30;
    else if (issue.severity === "warning") score -= 10;
    else score -= 3;
  }
  return Math.max(0, score);
}

function calculateHealthScore(allIssues: PageIssue[], totalPages: number): number {
  if (totalPages === 0) return 0;
  let deductions = 0;
  for (const issue of allIssues) {
    if (issue.severity === "critical") deductions += 10;
    else if (issue.severity === "warning") deductions += 4;
    else deductions += 1;
  }
  const maxDeductions = totalPages * 30;
  const ratio = Math.min(1, deductions / (maxDeductions || 1));
  return Math.round(100 - ratio * 100);
}

async function runCrawl(auditId: number, startUrl: string): Promise<void> {
  try {
    const parsed = new URL(startUrl);
    const origin = parsed.origin;

    const robots = await fetchRobotsTxt(origin);

    const queue: string[] = [startUrl];
    const visited = new Set<string>();
    const found = new Set<string>([startUrl]);
    const allIssues: PageIssue[] = [];

    await db.update(siteAuditsTable).set({ status: "crawling", pagesFound: 1 }).where(eq(siteAuditsTable.id, auditId));

    while (queue.length > 0 && visited.size < PAGE_LIMIT) {
      const batch = queue.splice(0, CONCURRENCY);

      await Promise.all(
        batch.map(async (url) => {
          if (visited.has(url)) return;
          if (isDisallowed(url, robots, origin)) {
            visited.add(url);
            return;
          }

          visited.add(url);

          const pageData = await crawlPage(url);
          const pageIssues = analysePageIssues(pageData);
          const pageScore = calculatePageScore(pageIssues);

          allIssues.push(...pageIssues);

          await db.insert(siteAuditPagesTable).values({
            siteAuditId: auditId,
            url: pageData.url,
            statusCode: pageData.statusCode,
            title: pageData.title,
            metaDescription: pageData.metaDescription,
            h1: pageData.h1,
            wordCount: pageData.wordCount,
            responseTimeMs: pageData.responseTimeMs,
            issueCount: pageIssues.length,
            score: pageScore,
          });

          if (pageIssues.length > 0) {
            await db.insert(siteAuditIssuesTable).values(
              pageIssues.map((issue) => ({
                siteAuditId: auditId,
                pageUrl: pageData.url,
                issueType: issue.issueType,
                severity: issue.severity,
                description: issue.description,
                recommendation: issue.recommendation,
              }))
            );
          }

          for (const link of pageData.links) {
            if (!found.has(link) && found.size < PAGE_LIMIT * 2) {
              found.add(link);
              queue.push(link);
            }
          }

          await db.update(siteAuditsTable)
            .set({
              pagesCrawled: visited.size,
              pagesFound: found.size,
            })
            .where(eq(siteAuditsTable.id, auditId));
        })
      );
    }

    const healthScore = calculateHealthScore(allIssues, visited.size);

    await db.update(siteAuditsTable)
      .set({
        status: "complete",
        healthScore,
        pagesCrawled: visited.size,
        pagesFound: found.size,
        completedAt: new Date(),
      })
      .where(eq(siteAuditsTable.id, auditId));

  } catch (err) {
    logger.error({ err, auditId }, "Site crawl failed");
    await db.update(siteAuditsTable).set({ status: "failed" }).where(eq(siteAuditsTable.id, auditId));
  }
}

router.post("/audit/site/:websiteId", async (req, res): Promise<void> => {
  const websiteId = parseInt(req.params.websiteId);
  if (isNaN(websiteId)) {
    res.status(400).json({ error: "Invalid websiteId" });
    return;
  }

  const [website] = await db
    .select()
    .from(websitesTable)
    .where(eq(websitesTable.id, websiteId));

  if (!website) {
    res.status(404).json({ error: "Website not found" });
    return;
  }

  const [existingInProgress] = await db
    .select()
    .from(siteAuditsTable)
    .where(and(
      eq(siteAuditsTable.websiteId, websiteId),
      eq(siteAuditsTable.status, "crawling"),
    ))
    .limit(1);

  if (existingInProgress) {
    res.status(409).json({ error: "A crawl is already in progress for this website" });
    return;
  }

  const [audit] = await db
    .insert(siteAuditsTable)
    .values({ websiteId, status: "queued" })
    .returning();

  res.status(202).json({
    id: audit.id,
    websiteId: audit.websiteId,
    status: audit.status,
    pagesFound: audit.pagesFound,
    pagesCrawled: audit.pagesCrawled,
    healthScore: audit.healthScore,
    createdAt: audit.createdAt.toISOString(),
    completedAt: audit.completedAt?.toISOString() ?? null,
  });

  // Fire and forget
  runCrawl(audit.id, website.url).catch((err) => {
    logger.error({ err, auditId: audit.id }, "Unhandled error in runCrawl");
  });
});

router.get("/audit/site/:websiteId/status", async (req, res): Promise<void> => {
  const websiteId = parseInt(req.params.websiteId);
  if (isNaN(websiteId)) {
    res.status(400).json({ error: "Invalid websiteId" });
    return;
  }

  const [audit] = await db
    .select()
    .from(siteAuditsTable)
    .where(eq(siteAuditsTable.websiteId, websiteId))
    .orderBy(desc(siteAuditsTable.createdAt))
    .limit(1);

  if (!audit) {
    res.status(404).json({ error: "No audit found for this website" });
    return;
  }

  res.json({
    id: audit.id,
    websiteId: audit.websiteId,
    status: audit.status,
    pagesFound: audit.pagesFound,
    pagesCrawled: audit.pagesCrawled,
    healthScore: audit.healthScore,
    createdAt: audit.createdAt.toISOString(),
    completedAt: audit.completedAt?.toISOString() ?? null,
  });
});

router.get("/audit/site/:websiteId/results", async (req, res): Promise<void> => {
  const websiteId = parseInt(req.params.websiteId);
  if (isNaN(websiteId)) {
    res.status(400).json({ error: "Invalid websiteId" });
    return;
  }

  const [audit] = await db
    .select()
    .from(siteAuditsTable)
    .where(eq(siteAuditsTable.websiteId, websiteId))
    .orderBy(desc(siteAuditsTable.createdAt))
    .limit(1);

  if (!audit) {
    res.status(404).json({ error: "No audit found for this website" });
    return;
  }

  const pages = await db
    .select()
    .from(siteAuditPagesTable)
    .where(eq(siteAuditPagesTable.siteAuditId, audit.id))
    .orderBy(siteAuditPagesTable.score);

  const issues = await db
    .select()
    .from(siteAuditIssuesTable)
    .where(eq(siteAuditIssuesTable.siteAuditId, audit.id))
    .orderBy(siteAuditIssuesTable.severity);

  res.json({
    id: audit.id,
    websiteId: audit.websiteId,
    status: audit.status,
    pagesFound: audit.pagesFound,
    pagesCrawled: audit.pagesCrawled,
    healthScore: audit.healthScore,
    createdAt: audit.createdAt.toISOString(),
    completedAt: audit.completedAt?.toISOString() ?? null,
    pages: pages.map((p) => ({
      id: p.id,
      url: p.url,
      statusCode: p.statusCode,
      title: p.title,
      metaDescription: p.metaDescription,
      h1: p.h1,
      wordCount: p.wordCount,
      responseTimeMs: p.responseTimeMs,
      issueCount: p.issueCount,
      score: p.score,
      crawledAt: p.crawledAt.toISOString(),
    })),
    issues: issues.map((i) => ({
      id: i.id,
      pageUrl: i.pageUrl,
      issueType: i.issueType,
      severity: i.severity,
      description: i.description,
      recommendation: i.recommendation,
    })),
  });
});

export default router;
