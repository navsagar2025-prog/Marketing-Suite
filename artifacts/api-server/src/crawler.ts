import * as cheerio from "cheerio";
import dns from "node:dns/promises";

const PRIVATE_IP_PATTERNS = [
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^127\.\d+\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/,
  /^::1$/,
  /^fc[0-9a-f]{2}:/i,
  /^fd[0-9a-f]{2}:/i,
  /^fe80:/i,
];

async function assertNotPrivateUrl(urlStr: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new Error("Invalid URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http and https URLs are allowed");
  }
  const hostname = parsed.hostname;
  if (PRIVATE_IP_PATTERNS.some(p => p.test(hostname))) {
    throw new Error("Requests to private/internal addresses are not allowed");
  }
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    for (const { address } of addresses) {
      if (PRIVATE_IP_PATTERNS.some(p => p.test(address))) {
        throw new Error("Requests to private/internal addresses are not allowed");
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("private")) throw err;
    // DNS lookup failure — let the fetch proceed and fail naturally
  }
}

export interface CrawledData {
  url: string;
  title: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  robotsMeta: string | null;
  h1Tags: string[];
  h2Tags: string[];
  h3Tags: string[];
  imagesTotal: number;
  imagesMissingAlt: number;
  imagesWithAlt: { src: string; alt: string }[];
  wordCount: number;
  internalLinks: number;
  externalLinks: number;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  lang: string | null;
  hasViewport: boolean;
  hasCanonical: boolean;
  schemaTypes: string[];
  titleLength: number;
  metaDescriptionLength: number;
}

const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 15000;

async function fetchWithSafeRedirects(url: string): Promise<{ response: Response; finalUrl: string }> {
  let currentUrl = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertNotPrivateUrl(currentUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(currentUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SEOAuditBot/1.0)",
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "manual",
      });
    } finally {
      clearTimeout(timeout);
    }
    const status = response.status;
    if (status >= 300 && status < 400) {
      if (hop === MAX_REDIRECTS) {
        throw new Error("Too many redirects");
      }
      const location = response.headers.get("location");
      if (!location) {
        throw new Error("Redirect with no Location header");
      }
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    if (!response.ok) {
      throw new Error(`HTTP ${status}`);
    }
    return { response, finalUrl: currentUrl };
  }
  throw new Error("Too many redirects");
}

export async function crawlUrl(url: string): Promise<CrawledData> {
  await assertNotPrivateUrl(url);

  let html: string;
  let finalUrl: string;
  try {
    const result = await fetchWithSafeRedirects(url);
    html = await result.response.text();
    finalUrl = result.finalUrl;
  } catch (err) {
    throw err;
  }

  const $ = cheerio.load(html);

  const title = $("title").first().text().trim() || null;
  const metaDescription = $('meta[name="description"]').attr("content")?.trim() || null;
  const canonicalUrl = $('link[rel="canonical"]').attr("href")?.trim() || null;
  const robotsMeta = $('meta[name="robots"]').attr("content")?.trim() || null;
  const lang = $("html").attr("lang")?.trim() || null;
  const hasViewport = $('meta[name="viewport"]').length > 0;
  const hasCanonical = $('link[rel="canonical"]').length > 0;

  const h1Tags: string[] = [];
  $("h1").each((_, el) => { h1Tags.push($(el).text().trim()); });

  const h2Tags: string[] = [];
  $("h2").each((_, el) => { h2Tags.push($(el).text().trim()); });

  const h3Tags: string[] = [];
  $("h3").each((_, el) => { h3Tags.push($(el).text().trim()); });

  const imagesWithAlt: { src: string; alt: string }[] = [];
  let imagesMissingAlt = 0;
  $("img").each((_, el) => {
    const src = $(el).attr("src") || "";
    const alt = $(el).attr("alt");
    if (alt === undefined || alt === null || alt === "") {
      imagesMissingAlt++;
    } else {
      imagesWithAlt.push({ src, alt: alt.trim() });
    }
  });
  const imagesTotal = imagesWithAlt.length + imagesMissingAlt;

  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const wordCount = bodyText ? bodyText.split(" ").filter(Boolean).length : 0;

  let internalLinks = 0;
  let externalLinks = 0;
  try {
    const baseHost = new URL(finalUrl).hostname;
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      if (href.startsWith("http")) {
        try {
          const linkHost = new URL(href).hostname;
          if (linkHost === baseHost) internalLinks++;
          else externalLinks++;
        } catch {
          internalLinks++;
        }
      } else if (href.startsWith("/") || href.startsWith("#") || href.startsWith(".")) {
        internalLinks++;
      }
    });
  } catch {
    // ignore URL parse errors
  }

  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim() || null;
  const ogDescription = $('meta[property="og:description"]').attr("content")?.trim() || null;
  const ogImage = $('meta[property="og:image"]').attr("content")?.trim() || null;

  const schemaTypes: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).text());
      const type = json["@type"];
      if (type) schemaTypes.push(Array.isArray(type) ? type.join(",") : String(type));
    } catch {
      // ignore
    }
  });

  return {
    url: finalUrl,
    title,
    metaDescription,
    canonicalUrl,
    robotsMeta,
    h1Tags,
    h2Tags,
    h3Tags,
    imagesTotal,
    imagesMissingAlt,
    imagesWithAlt,
    wordCount,
    internalLinks,
    externalLinks,
    ogTitle,
    ogDescription,
    ogImage,
    lang,
    hasViewport,
    hasCanonical,
    schemaTypes,
    titleLength: title?.length ?? 0,
    metaDescriptionLength: metaDescription?.length ?? 0,
  };
}
