import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, siteAuditsTable, siteAuditPagesTable, siteAuditIssuesTable, websitesTable, staffUsersTable } from "@workspace/db";
import * as cheerio from "cheerio";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const DEFAULT_PAGE_LIMIT = 100;
const AGENCY_PAGE_LIMIT = 500;
const CONCURRENCY = 3;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECT_CHAIN = 10;

// ─── SSRF protection ─────────────────────────────────────────────────────────

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^0\./,
  /^localhost$/i,
];

function isPrivateHost(hostname: string): boolean {
  return PRIVATE_IP_PATTERNS.some((re) => re.test(hostname));
}

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!parsed.protocol.startsWith("http")) return false;
    if (isPrivateHost(parsed.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

// ─── robots.txt ──────────────────────────────────────────────────────────────

interface RobotsTxt {
  disallowedPaths: string[];
}

async function fetchRobotsTxt(origin: string): Promise<RobotsTxt> {
  const robotsUrl = `${origin}/robots.txt`;
  if (!isSafeUrl(robotsUrl)) return { disallowedPaths: [] };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(robotsUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { disallowedPaths: [] };
    const text = await res.text();
    const disallowedPaths: string[] = [];
    let inAnyAgent = false;
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.toLowerCase().startsWith("user-agent:")) {
        const agent = trimmed.slice("user-agent:".length).trim();
        inAnyAgent = agent === "*" || agent.toLowerCase().includes("bot");
      }
      if (inAnyAgent && trimmed.toLowerCase().startsWith("disallow:")) {
        const path = trimmed.slice("disallow:".length).trim();
        if (path) disallowedPaths.push(path);
      }
    }
    return { disallowedPaths };
  } catch {
    return { disallowedPaths: [] };
  }
}

function isRobotsDisallowed(url: string, robots: RobotsTxt): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname + parsed.search;
    return robots.disallowedPaths.some((d) => d !== "/" && path.startsWith(d));
  } catch {
    return false;
  }
}

// ─── Link extraction ──────────────────────────────────────────────────────────

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
      // invalid URL — skip
    }
  });
  return links;
}

// ─── Page crawl (manual redirect following for chain detection) ───────────────

interface PageData {
  url: string;
  finalUrl: string;
  statusCode: number | null;
  title: string | null;
  h1Count: number;
  h1First: string | null;
  metaDescription: string | null;
  wordCount: number | null;
  responseTimeMs: number | null;
  links: string[];
  redirectChain: number;
  hasCanonical: boolean;
  canonicalUrl: string | null;
  isNoindex: boolean;
  imagesWithoutAlt: number;
}

async function crawlPage(url: string): Promise<PageData> {
  const start = Date.now();
  let statusCode: number | null = null;
  let title: string | null = null;
  let h1Count = 0;
  let h1First: string | null = null;
  let metaDescription: string | null = null;
  let wordCount: number | null = null;
  let responseTimeMs: number | null = null;
  let links: string[] = [];
  let redirectChain = 0;
  let hasCanonical = false;
  let canonicalUrl: string | null = null;
  let isNoindex = false;
  let imagesWithoutAlt = 0;
  let currentUrl = url;

  try {
    // Manual redirect following to count chain depth
    while (redirectChain <= MAX_REDIRECT_CHAIN) {
      if (!isSafeUrl(currentUrl)) {
        statusCode = 403;
        break;
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent": "SEO-Hub-Crawler/1.0 (site audit bot)",
          "Accept": "text/html,application/xhtml+xml",
        },
      });
      clearTimeout(timer);
      responseTimeMs = Date.now() - start;
      statusCode = res.status;

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) break;
        redirectChain++;
        try {
          currentUrl = new URL(location, currentUrl).href;
        } catch {
          break;
        }
        continue;
      }

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html")) break;

      const html = await res.text();
      const $ = cheerio.load(html);

      title = $("title").first().text().trim() || null;
      metaDescription = $('meta[name="description"]').attr("content")?.trim() ?? null;

      const h1s = $("h1");
      h1Count = h1s.length;
      h1First = h1s.first().text().trim() || null;

      const robotsMeta = $('meta[name="robots"]').attr("content") ?? "";
      isNoindex = robotsMeta.toLowerCase().includes("noindex");

      const canonicalEl = $('link[rel="canonical"]');
      if (canonicalEl.length) {
        hasCanonical = true;
        canonicalUrl = canonicalEl.attr("href") ?? null;
      }

      const bodyText = $("body").text().replace(/\s+/g, " ").trim();
      wordCount = bodyText ? bodyText.split(/\s+/).length : 0;

      $("img").each((_, el) => {
        const alt = $(el).attr("alt");
        if (alt === undefined || alt === null) {
          imagesWithoutAlt++;
        }
      });

      const origin = new URL(url).origin;
      links = extractLinks(html, currentUrl, origin);
      break;
    }
  } catch (err: unknown) {
    responseTimeMs = Date.now() - start;
    if (err instanceof Error && err.name === "AbortError") {
      statusCode = null;
    }
  }

  return {
    url,
    finalUrl: currentUrl,
    statusCode,
    title,
    h1Count,
    h1First,
    metaDescription,
    wordCount,
    responseTimeMs,
    links,
    redirectChain,
    hasCanonical,
    canonicalUrl,
    isNoindex,
    imagesWithoutAlt,
  };
}

// ─── Issue detection ─────────────────────────────────────────────────────────

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
      recommendation: "Fix or remove the broken link, or set up a proper redirect.",
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

  if (page.redirectChain > 1) {
    issues.push({
      issueType: "redirect_chain",
      severity: "warning",
      description: `Redirect chain detected (${page.redirectChain} hops before reaching final URL)`,
      recommendation: "Consolidate redirect chains into a single direct 301 to the final destination URL.",
    });
  } else if (page.redirectChain === 1) {
    issues.push({
      issueType: "redirect",
      severity: "info",
      description: "Page redirects to a different URL",
      recommendation: "Update internal links to point directly to the final destination URL.",
    });
  }

  if (!page.title) {
    issues.push({
      issueType: "missing_title",
      severity: "critical",
      description: "Page is missing a <title> tag",
      recommendation: "Add a descriptive, keyword-rich title tag (50-60 characters).",
    });
  } else if (page.title.length < 30) {
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

  if (page.h1Count === 0) {
    issues.push({
      issueType: "missing_h1",
      severity: "warning",
      description: "Page is missing an H1 heading",
      recommendation: "Add a single H1 heading that includes your primary keyword.",
    });
  } else if (page.h1Count > 1) {
    issues.push({
      issueType: "multiple_h1",
      severity: "warning",
      description: `Page has ${page.h1Count} H1 headings (should have exactly one)`,
      recommendation: "Reduce to a single H1 heading that clearly defines the page topic.",
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

  if (page.imagesWithoutAlt > 0) {
    issues.push({
      issueType: "missing_alt_text",
      severity: "warning",
      description: `Page has ${page.imagesWithoutAlt} image${page.imagesWithoutAlt !== 1 ? "s" : ""} missing alt text`,
      recommendation: "Add descriptive alt text to all images for accessibility and image SEO.",
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

function calculateHealthScore(totalIssues: number, totalPages: number): number {
  if (totalPages === 0) return 0;
  const avgIssuesPerPage = totalIssues / totalPages;
  const score = Math.round(100 - Math.min(100, avgIssuesPerPage * 12));
  return Math.max(0, score);
}

// ─── Main crawl runner ────────────────────────────────────────────────────────

async function runCrawl(auditId: number, startUrl: string, pageLimit: number): Promise<void> {
  try {
    const parsed = new URL(startUrl);
    const origin = parsed.origin;

    if (!isSafeUrl(startUrl)) {
      await db.update(siteAuditsTable).set({ status: "failed" }).where(eq(siteAuditsTable.id, auditId));
      return;
    }

    const robots = await fetchRobotsTxt(origin);

    const queue: string[] = [startUrl];
    const visited = new Set<string>();
    const found = new Set<string>([startUrl]);

    // Track titles and meta descriptions for duplicate detection
    const titleMap = new Map<string, string[]>(); // title → urls
    const metaMap = new Map<string, string[]>(); // meta → urls

    let totalIssueCount = 0;

    await db.update(siteAuditsTable).set({ status: "crawling", pagesFound: 1 }).where(eq(siteAuditsTable.id, auditId));

    while (queue.length > 0 && visited.size < pageLimit) {
      const batch = queue.splice(0, CONCURRENCY);

      await Promise.all(
        batch.map(async (url) => {
          if (visited.has(url)) return;
          visited.add(url);

          const isBlocked = isRobotsDisallowed(url, robots);

          if (isBlocked) {
            // Record as an issue, not silently skip
            await db.insert(siteAuditPagesTable).values({
              siteAuditId: auditId,
              url,
              statusCode: null,
              title: null,
              metaDescription: null,
              h1: null,
              wordCount: null,
              responseTimeMs: null,
              issueCount: 1,
              score: 70,
            });

            await db.insert(siteAuditIssuesTable).values({
              siteAuditId: auditId,
              pageUrl: url,
              issueType: "robots_blocked",
              severity: "info",
              description: "Page is blocked by robots.txt and cannot be crawled",
              recommendation: "If this page should be indexed, remove the Disallow rule from robots.txt.",
            });

            totalIssueCount++;

            await db.update(siteAuditsTable)
              .set({ pagesCrawled: visited.size, pagesFound: found.size, healthScore: calculateHealthScore(totalIssueCount, visited.size) })
              .where(eq(siteAuditsTable.id, auditId));
            return;
          }

          const pageData = await crawlPage(url);
          const pageIssues = analysePageIssues(pageData);
          const pageScore = calculatePageScore(pageIssues);

          // Track for duplicate detection
          if (pageData.title) {
            const normalised = pageData.title.trim().toLowerCase();
            const existing = titleMap.get(normalised) ?? [];
            existing.push(url);
            titleMap.set(normalised, existing);
          }
          if (pageData.metaDescription) {
            const normalised = pageData.metaDescription.trim().toLowerCase();
            const existing = metaMap.get(normalised) ?? [];
            existing.push(url);
            metaMap.set(normalised, existing);
          }

          totalIssueCount += pageIssues.length;

          await db.insert(siteAuditPagesTable).values({
            siteAuditId: auditId,
            url: pageData.url,
            statusCode: pageData.statusCode,
            title: pageData.title,
            metaDescription: pageData.metaDescription,
            h1: pageData.h1First,
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

          // Add newly discovered links to queue
          for (const link of pageData.links) {
            if (!found.has(link) && found.size < pageLimit * 3) {
              found.add(link);
              queue.push(link);
            }
          }

          await db.update(siteAuditsTable)
            .set({ pagesCrawled: visited.size, pagesFound: found.size, healthScore: calculateHealthScore(totalIssueCount, visited.size) })
            .where(eq(siteAuditsTable.id, auditId));
        })
      );
    }

    // ── Post-crawl: duplicate title detection ──────────────────────────────
    const dupTitleIssues: Array<{ pageUrl: string; siteAuditId: number; issueType: string; severity: "critical" | "warning" | "info"; description: string; recommendation: string }> = [];
    for (const [title, urls] of titleMap.entries()) {
      if (urls.length > 1) {
        for (const pageUrl of urls) {
          dupTitleIssues.push({
            siteAuditId: auditId,
            pageUrl,
            issueType: "duplicate_title",
            severity: "warning",
            description: `Duplicate title tag shared with ${urls.length - 1} other page(s): "${title.slice(0, 60)}${title.length > 60 ? "…" : ""}"`,
            recommendation: "Give each page a unique title tag that accurately describes its specific content.",
          });
        }
      }
    }

    // ── Post-crawl: duplicate meta description detection ──────────────────
    const dupMetaIssues: typeof dupTitleIssues = [];
    for (const [meta, urls] of metaMap.entries()) {
      if (urls.length > 1) {
        for (const pageUrl of urls) {
          dupMetaIssues.push({
            siteAuditId: auditId,
            pageUrl,
            issueType: "duplicate_meta_description",
            severity: "warning",
            description: `Duplicate meta description shared with ${urls.length - 1} other page(s)`,
            recommendation: "Write a unique meta description for each page that accurately summarises the page content.",
          });
        }
      }
    }

    const allPostIssues = [...dupTitleIssues, ...dupMetaIssues];
    if (allPostIssues.length > 0) {
      await db.insert(siteAuditIssuesTable).values(allPostIssues);
      totalIssueCount += allPostIssues.length;

      // Update page issue counts for pages with duplicate issues
      const pageUrlsWithDups = new Set(allPostIssues.map((i) => i.pageUrl));
      for (const pageUrl of pageUrlsWithDups) {
        const dupCount = allPostIssues.filter((i) => i.pageUrl === pageUrl).length;
        // Update issue count for this page row
        const [existingPage] = await db
          .select({ id: siteAuditPagesTable.id, issueCount: siteAuditPagesTable.issueCount })
          .from(siteAuditPagesTable)
          .where(and(
            eq(siteAuditPagesTable.siteAuditId, auditId),
            eq(siteAuditPagesTable.url, pageUrl),
          ))
          .limit(1);
        if (existingPage) {
          await db.update(siteAuditPagesTable)
            .set({ issueCount: existingPage.issueCount + dupCount })
            .where(eq(siteAuditPagesTable.id, existingPage.id));
        }
      }
    }

    const finalHealthScore = calculateHealthScore(totalIssueCount, visited.size);

    await db.update(siteAuditsTable)
      .set({
        status: "complete",
        healthScore: finalHealthScore,
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

// ─── Routes ───────────────────────────────────────────────────────────────────

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

  if (!isSafeUrl(website.url)) {
    res.status(400).json({ error: "Website URL is not a valid public URL" });
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

  // Determine page limit based on user's plan
  const userId = req.user!.id;
  const [staffUser] = await db.select({ plan: staffUsersTable.plan }).from(staffUsersTable).where(eq(staffUsersTable.id, userId));
  const plan = staffUser?.plan ?? "starter";
  const pageLimit = plan === "agency" ? AGENCY_PAGE_LIMIT : DEFAULT_PAGE_LIMIT;

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
  runCrawl(audit.id, website.url, pageLimit).catch((err) => {
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
