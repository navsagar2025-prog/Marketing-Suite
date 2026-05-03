import { db } from "@workspace/db";
import { pagespeedResultsTable, websitesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";

export type Strategy = "mobile" | "desktop";

type LighthouseAudit = { numericValue?: number; displayValue?: string; score?: number | null };

type PsiResponse = {
  lighthouseResult?: {
    categories?: Record<string, { score?: number | null }>;
    audits?: Record<string, LighthouseAudit>;
  };
  loadingExperience?: {
    metrics?: Record<string, { percentile?: number }>;
  };
};

const round = (v: number | undefined | null): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;

const score100 = (v: number | undefined | null): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.round(v * 100) : null;

export async function fetchPagespeed(url: string, strategy: Strategy): Promise<{
  performanceScore: number | null;
  accessibilityScore: number | null;
  bestPracticesScore: number | null;
  seoScore: number | null;
  lcpMs: number | null;
  fcpMs: number | null;
  clsScore: number | null;
  inpMs: number | null;
  ttfbMs: number | null;
  speedIndexMs: number | null;
}> {
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY ?? process.env.PAGESPEED_API_KEY;
  const params = new URLSearchParams({
    url,
    strategy,
    category: "performance",
  });
  params.append("category", "accessibility");
  params.append("category", "best-practices");
  params.append("category", "seo");
  if (apiKey) params.set("key", apiKey);

  const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PageSpeed API error ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as PsiResponse;
  const cats = data.lighthouseResult?.categories ?? {};
  const audits = data.lighthouseResult?.audits ?? {};
  const fieldMetrics = data.loadingExperience?.metrics ?? {};

  return {
    performanceScore: score100(cats.performance?.score ?? null),
    accessibilityScore: score100(cats.accessibility?.score ?? null),
    bestPracticesScore: score100(cats["best-practices"]?.score ?? null),
    seoScore: score100(cats.seo?.score ?? null),
    lcpMs: round(audits["largest-contentful-paint"]?.numericValue),
    fcpMs: round(audits["first-contentful-paint"]?.numericValue),
    clsScore: typeof audits["cumulative-layout-shift"]?.numericValue === "number"
      ? Math.round(audits["cumulative-layout-shift"]!.numericValue! * 1000) / 1000
      : null,
    inpMs: round(fieldMetrics["INTERACTION_TO_NEXT_PAINT"]?.percentile),
    ttfbMs: round(audits["server-response-time"]?.numericValue),
    speedIndexMs: round(audits["speed-index"]?.numericValue),
  };
}

export async function recordPagespeedForWebsite(websiteId: number, url: string, strategy: Strategy): Promise<void> {
  try {
    const m = await fetchPagespeed(url, strategy);
    await db.insert(pagespeedResultsTable).values({
      websiteId,
      strategy,
      ...m,
    });
    logger.info({ websiteId, strategy, score: m.performanceScore }, "PageSpeed recorded");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.insert(pagespeedResultsTable).values({
      websiteId,
      strategy,
      performanceScore: null,
      accessibilityScore: null,
      bestPracticesScore: null,
      seoScore: null,
      lcpMs: null,
      fcpMs: null,
      clsScore: null,
      inpMs: null,
      ttfbMs: null,
      speedIndexMs: null,
      error: msg.slice(0, 500),
    });
    logger.warn({ websiteId, strategy, err: msg }, "PageSpeed recording failed");
  }
}

export async function runDailyPagespeedScan(): Promise<{ scanned: number }> {
  const sites = await db.select({ id: websitesTable.id, url: websitesTable.url }).from(websitesTable);
  let scanned = 0;
  for (const s of sites) {
    if (!s.url) continue;
    await recordPagespeedForWebsite(s.id, s.url, "mobile");
    scanned += 1;
  }
  return { scanned };
}
