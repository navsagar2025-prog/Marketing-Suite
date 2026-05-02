import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { and, eq, sql } from "drizzle-orm";
import { db, utmLinksTable, abVariantsTable, clientReportsTable, websitesTable, blogPostsTable } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(
  express.json({
    verify: (req, _res, buf) => {
      if (
        req.url?.startsWith("/api/webhooks/email/") ||
        req.url?.startsWith("/api/webhooks/stripe") ||
        req.url?.startsWith("/api/webhooks/razorpay")
      ) {
        (req as typeof req & { rawBody: Buffer }).rawBody = buf;
      }
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

// Public UTM redirect — at root /r/:id so the tracked URL is short and clean
app.get("/r/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).send("Invalid link ID");
    return;
  }
  let link;
  try {
    const [row] = await db.update(utmLinksTable)
      .set({ clicks: sql`${utmLinksTable.clicks} + 1` })
      .where(eq(utmLinksTable.id, id))
      .returning({
        destinationUrl: utmLinksTable.destinationUrl,
        source: utmLinksTable.source,
        medium: utmLinksTable.medium,
        campaign: utmLinksTable.campaign,
        term: utmLinksTable.term,
        content: utmLinksTable.content,
      });
    link = row;
  } catch {
    res.status(500).send("Internal error");
    return;
  }
  if (!link) {
    res.status(404).send("Link not found");
    return;
  }
  // Enforce http/https only (schema validates at creation; double-check at redirect time)
  if (!/^https?:\/\//i.test(link.destinationUrl)) {
    res.status(400).send("Invalid redirect target");
    return;
  }
  try {
    const url = new URL(link.destinationUrl);
    url.searchParams.set("utm_source", link.source);
    url.searchParams.set("utm_medium", link.medium);
    url.searchParams.set("utm_campaign", link.campaign);
    if (link.term) url.searchParams.set("utm_term", link.term);
    if (link.content) url.searchParams.set("utm_content", link.content);
    res.redirect(302, url.toString());
  } catch {
    res.status(500).send("Could not build redirect URL");
  }
});

// Public A/B tracking endpoint — GET or POST /track/ab/:testId/:variantId?event=impression|click
// Supports both POST (programmatic) and GET (pixel/link-based tracking)
async function handleAbTrack(req: import("express").Request, res: import("express").Response): Promise<void> {
  const testId = parseInt(req.params.testId, 10);
  const variantId = parseInt(req.params.variantId, 10);
  const event = req.query.event === "click" ? "click" : "impression";
  if (isNaN(testId) || isNaN(variantId)) {
    res.status(400).json({ error: "Invalid ids" });
    return;
  }
  try {
    const updateField = event === "click"
      ? { clicks: sql`${abVariantsTable.clicks} + 1` }
      : { impressions: sql`${abVariantsTable.impressions} + 1` };
    const [updated] = await db.update(abVariantsTable)
      .set(updateField)
      .where(and(eq(abVariantsTable.id, variantId), eq(abVariantsTable.testId, testId)))
      .returning({ id: abVariantsTable.id, impressions: abVariantsTable.impressions, clicks: abVariantsTable.clicks });
    if (!updated) { res.status(404).json({ error: "Variant not found" }); return; }
    res.json({ ok: true, event, ...updated });
  } catch {
    res.status(500).json({ error: "Internal error" });
  }
}
app.get("/track/ab/:testId/:variantId", handleAbTrack);
app.post("/track/ab/:testId/:variantId", handleAbTrack);

// Public client report by share token — no auth required
app.get("/public/report/:token", async (req, res): Promise<void> => {
  const token = req.params.token;
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Invalid token" });
    return;
  }
  const [report] = await db
    .select({
      id: clientReportsTable.id,
      title: clientReportsTable.title,
      dateRangeStart: clientReportsTable.dateRangeStart,
      dateRangeEnd: clientReportsTable.dateRangeEnd,
      sections: clientReportsTable.sections,
      snapshot: clientReportsTable.snapshot,
      createdAt: clientReportsTable.createdAt,
      websiteName: websitesTable.name,
      websiteUrl: websitesTable.url,
    })
    .from(clientReportsTable)
    .leftJoin(websitesTable, eq(clientReportsTable.websiteId, websitesTable.id))
    .where(eq(clientReportsTable.shareToken, token));

  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  res.json(report);
});

// ── SEO: robots.txt ─────────────────────────────────────────────────────────
app.get("/robots.txt", (req, res): void => {
  const siteUrl = (process.env.APP_URL ?? `https://${req.get("host")}`).replace(/\/$/, "");
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api",
    "Disallow: /api/",
    "Disallow: /dashboard",
    "Disallow: /websites",
    "Disallow: /keywords",
    "Disallow: /competitors",
    "Disallow: /social",
    "Disallow: /calendar",
    "Disallow: /campaigns",
    "Disallow: /backlinks",
    "Disallow: /leads",
    "Disallow: /conversations",
    "Disallow: /analytics",
    "Disallow: /ai",
    "Disallow: /media",
    "Disallow: /utm-builder",
    "Disallow: /ab-tests",
    "Disallow: /outreach",
    "Disallow: /reports",
    "Disallow: /settings",
    "Disallow: /admin",
    "",
    `Sitemap: ${siteUrl}/sitemap.xml`,
  ].join("\n");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.send(body);
});

// ── SEO: sitemap.xml ─────────────────────────────────────────────────────────
app.get("/sitemap.xml", async (req, res): Promise<void> => {
  const siteUrl = (process.env.APP_URL ?? `https://${req.get("host")}`).replace(/\/$/, "");
  const today = new Date().toISOString().split("T")[0]!;

  const staticEntries = [
    { loc: "/", changefreq: "daily", priority: "1.0", lastmod: today },
    { loc: "/pricing", changefreq: "weekly", priority: "0.8", lastmod: today },
    { loc: "/report", changefreq: "weekly", priority: "0.9", lastmod: today },
    { loc: "/blog", changefreq: "daily", priority: "0.8", lastmod: today },
  ];

  let blogEntries: { loc: string; changefreq: string; priority: string; lastmod: string }[] = [];
  try {
    const posts = await db
      .select({ slug: blogPostsTable.slug, updatedAt: blogPostsTable.updatedAt })
      .from(blogPostsTable)
      .where(eq(blogPostsTable.status, "published"));
    blogEntries = posts.map((p) => ({
      loc: `/blog/${p.slug}`,
      lastmod: p.updatedAt.toISOString().split("T")[0]!,
      changefreq: "weekly",
      priority: "0.7",
    }));
  } catch {
    // DB unavailable — serve static routes only
  }

  const allEntries = [...staticEntries, ...blogEntries];

  const urlsXml = allEntries
    .map(
      (e) =>
        `  <url>\n    <loc>${siteUrl}${e.loc}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlsXml}\n</urlset>`;

  res.setHeader("Content-Type", "text/xml; charset=utf-8");
  res.send(xml);
});

app.use("/api", router);

export default app;
