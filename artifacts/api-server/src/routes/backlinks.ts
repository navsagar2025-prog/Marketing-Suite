import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, backlinksTable, websitesTable, outreachContactsTable } from "@workspace/db";
import { sendWebhookNotification } from "../lib/notification-webhooks.js";
import {
  ListBacklinksQueryParams,
  ListBacklinksResponse,
  CreateBacklinkBody,
  UpdateBacklinkParams,
  UpdateBacklinkBody,
  UpdateBacklinkResponse,
  DeleteBacklinkParams,
} from "@workspace/api-zod";
import { callAI } from "../lib/ai-provider.js";
import { checkAndIncrementUsage } from "../lib/ai-usage.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const VALID_TYPES = ["guest_post", "resource", "directory", "forum", "social", "other"] as const;

// ---------------------------------------------------------------------------
// AI opportunity finder
// ---------------------------------------------------------------------------
router.post("/backlinks/ai-opportunities", async (req, res): Promise<void> => {
  const { niche, websiteId, seedKeywords } = req.body as {
    niche?: string;
    websiteId?: number;
    seedKeywords?: string;
  };

  if (!niche?.trim() && !websiteId) {
    res.status(400).json({ error: "niche or websiteId is required" });
    return;
  }

  let resolvedNiche = niche?.trim() ?? "";
  let siteUrl: string | null = null;

  if (websiteId) {
    const [site] = await db
      .select({ niche: websitesTable.niche, url: websitesTable.url })
      .from(websitesTable)
      .where(eq(websitesTable.id, websiteId));
    if (site) {
      if (!resolvedNiche && site.niche) resolvedNiche = site.niche;
      siteUrl = site.url;
    }
  }

  const usageCheck = await checkAndIncrementUsage(req.user!.id, "text");
  if (!usageCheck.allowed) {
    res.status(429).json({ error: "Monthly text generation limit reached", used: usageCheck.used, limit: usageCheck.limit });
    return;
  }

  const seedClause = seedKeywords?.trim() ? ` Key topics/keywords: ${seedKeywords.trim()}.` : "";
  const siteClause = siteUrl ? ` The website is ${siteUrl}.` : "";

  const prompt = `You are an expert link building strategist. Generate 18 actionable backlink opportunities for a website in the "${resolvedNiche}" niche.${siteClause}${seedClause}

Return ONLY valid JSON: { "opportunities": [...] }

Each opportunity object must have:
- "type": one of "guest_post" | "resource" | "directory" | "forum" | "social" | "other"
- "siteCategory": short label for the kind of site (e.g. "Marketing blog", "SaaS directory", "Industry forum")
- "exampleDomain": a realistic example domain (no https://, no www) — use real, plausible domains in this niche
- "pitchAngle": one sentence describing the specific angle or hook for the outreach email
- "difficulty": integer 1–3 (1=easy, 2=medium, 3=hard)
- "estimatedDA": integer 20–80, realistic domain authority estimate
- "whyRelevant": one sentence explaining why this site/link would help SEO

Mix the types: include 5-6 guest_post, 3-4 resource, 2-3 directory, 2-3 forum, 1-2 social, 1-2 other.
Difficulty 1 entries should be directories or niche forums. Difficulty 3 entries should be high-DA editorial sites.
Be specific — generic suggestions like "find a blog in your niche" are not acceptable.`;

  try {
    const content = await callAI(prompt, { maxTokens: 3000, jsonMode: true });
    let raw: Record<string, unknown>;
    try { raw = JSON.parse(content) as Record<string, unknown>; }
    catch { raw = { opportunities: [] }; }

    const rawOps = Array.isArray(raw["opportunities"]) ? raw["opportunities"] as unknown[] : [];

    const opportunities = rawOps
      .filter((o): o is Record<string, unknown> => typeof o === "object" && o !== null)
      .map(o => ({
        type: VALID_TYPES.includes(o["type"] as typeof VALID_TYPES[number])
          ? o["type"] as typeof VALID_TYPES[number]
          : "other" as const,
        siteCategory: String(o["siteCategory"] ?? "").trim(),
        exampleDomain: String(o["exampleDomain"] ?? "").trim().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, ""),
        pitchAngle: String(o["pitchAngle"] ?? "").trim(),
        difficulty: typeof o["difficulty"] === "number" ? Math.min(3, Math.max(1, o["difficulty"])) : 2,
        estimatedDA: typeof o["estimatedDA"] === "number" ? Math.min(100, Math.max(1, o["estimatedDA"])) : 40,
        whyRelevant: String(o["whyRelevant"] ?? "").trim(),
      }))
      .filter(o => o.exampleDomain.length > 0 && o.pitchAngle.length > 0);

    res.json({ opportunities, niche: resolvedNiche });
  } catch (err) {
    logger.error({ err }, "AI backlink opportunity generation failed");
    res.status(503).json({ error: "AI generation failed. Please try again." });
  }
});

// ---------------------------------------------------------------------------
// AI outreach email generator
// ---------------------------------------------------------------------------
router.post("/backlinks/ai-outreach-email", async (req, res): Promise<void> => {
  const { domain, type, pitchAngle, siteUrl, recipientName } = req.body as {
    domain?: string;
    type?: string;
    pitchAngle?: string;
    siteUrl?: string;
    recipientName?: string;
  };

  if (!domain?.trim()) {
    res.status(400).json({ error: "domain is required" });
    return;
  }

  const usageCheck = await checkAndIncrementUsage(req.user!.id, "text");
  if (!usageCheck.allowed) {
    res.status(429).json({ error: "Monthly text generation limit reached", used: usageCheck.used, limit: usageCheck.limit });
    return;
  }

  const typeLabel = (type ?? "link request").replace(/_/g, " ");
  const recipientClause = recipientName?.trim() ? `Address it to ${recipientName.trim()}.` : "Use a generic greeting like 'Hi there' or 'Hello'.";
  const siteClause = siteUrl?.trim() ? `My website is ${siteUrl.trim()}.` : "";
  const pitchClause = pitchAngle?.trim() ? `Pitch angle: ${pitchAngle.trim()}` : "";

  const prompt = `Write a short, professional outreach email for a ${typeLabel} link building request to ${domain}.
${siteClause} ${pitchClause} ${recipientClause}

Rules:
- Keep it under 150 words
- Sound human, friendly, and specific — not spammy
- Lead with value, not the ask
- End with a clear, single call-to-action
- Do not use clichéd openers like "I hope this email finds you well"

Return ONLY valid JSON: { "subject": "...", "body": "..." }
The body should use plain text with line breaks (\\n) between paragraphs. No HTML.`;

  try {
    const content = await callAI(prompt, { maxTokens: 600, jsonMode: true });
    let parsed: { subject?: string; body?: string };
    try { parsed = JSON.parse(content) as { subject?: string; body?: string }; }
    catch { parsed = {}; }

    res.json({
      subject: parsed.subject?.trim() ?? `Link building opportunity — ${domain}`,
      body: parsed.body?.trim() ?? content.trim(),
    });
  } catch (err) {
    logger.error({ err }, "AI outreach email generation failed");
    res.status(503).json({ error: "AI generation failed. Please try again." });
  }
});

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------
router.get("/backlinks/export.csv", async (req, res): Promise<void> => {
  const { websiteId } = req.query as { websiteId?: string };

  const conditions = [];
  if (websiteId) conditions.push(eq(backlinksTable.websiteId, parseInt(websiteId)));

  const rows = conditions.length > 0
    ? await db.select().from(backlinksTable).where(and(...conditions)).orderBy(backlinksTable.createdAt)
    : await db.select().from(backlinksTable).orderBy(backlinksTable.createdAt);

  const header = "id,websiteId,prospectDomain,prospectUrl,type,status,domainAuthority,contactEmail,notes,createdAt";
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map(r =>
    [r.id, r.websiteId, r.prospectDomain, r.prospectUrl, r.type, r.status, r.domainAuthority ?? "", r.contactEmail ?? "", r.notes ?? "", r.createdAt.toISOString()].map(escape).join(",")
  );

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="backlinks.csv"');
  res.send([header, ...lines].join("\n"));
});

// ---------------------------------------------------------------------------
// CSV import
// ---------------------------------------------------------------------------
router.post("/backlinks/import", async (req, res): Promise<void> => {
  const { websiteId, csv } = req.body as { websiteId?: number; csv?: string };

  if (!websiteId || !csv?.trim()) {
    res.status(400).json({ error: "websiteId and csv are required" });
    return;
  }

  const lines = csv.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) {
    res.status(400).json({ error: "CSV must have a header row and at least one data row" });
    return;
  }

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuote = !inQuote; }
      } else if (ch === "," && !inQuote) {
        result.push(cur); cur = "";
      } else {
        cur += ch;
      }
    }
    result.push(cur);
    return result;
  };

  const headers = parseRow(lines[0]!).map(h => h.toLowerCase().trim());
  const col = (row: string[], name: string): string => {
    const i = headers.indexOf(name);
    return i >= 0 ? (row[i] ?? "").trim() : "";
  };

  const toInsert = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseRow(lines[i]!);
    const domain = col(row, "prospectdomain") || col(row, "domain");
    const url = col(row, "prospecturl") || col(row, "url");

    if (!domain && !url) {
      errors.push(`Row ${i + 1}: missing domain or url — skipped`);
      continue;
    }

    const resolvedDomain = domain || new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
    const resolvedUrl = url || `https://${domain}`;
    const rawDa = col(row, "domainauthority") || col(row, "da");
    const da = rawDa ? parseInt(rawDa) : null;
    const rawType = col(row, "type");
    const validType = VALID_TYPES.includes(rawType as typeof VALID_TYPES[number]) ? rawType : "other";

    toInsert.push({
      websiteId,
      prospectDomain: resolvedDomain,
      prospectUrl: resolvedUrl,
      type: validType,
      status: col(row, "status") || "not_contacted",
      domainAuthority: (da != null && !isNaN(da)) ? da : null,
      contactEmail: col(row, "contactemail") || col(row, "email") || null,
      notes: col(row, "notes") || null,
    });
  }

  if (toInsert.length === 0) {
    res.status(400).json({ error: "No valid rows found in CSV", details: errors });
    return;
  }

  const inserted = await db.insert(backlinksTable).values(toInsert).returning({ id: backlinksTable.id });

  res.status(201).json({ imported: inserted.length, skipped: errors.length, errors });
});

// ---------------------------------------------------------------------------
// List (with joined outreach contact info)
// ---------------------------------------------------------------------------
router.get("/backlinks", async (req, res): Promise<void> => {
  const query = ListBacklinksQueryParams.safeParse(req.query);
  const conditions = [];
  if (query.success) {
    if (query.data.websiteId) conditions.push(eq(backlinksTable.websiteId, query.data.websiteId));
    if (query.data.status) conditions.push(eq(backlinksTable.status, query.data.status));
  }

  const rows = await db
    .select({
      id: backlinksTable.id,
      websiteId: backlinksTable.websiteId,
      outreachContactId: backlinksTable.outreachContactId,
      prospectUrl: backlinksTable.prospectUrl,
      prospectDomain: backlinksTable.prospectDomain,
      contactEmail: backlinksTable.contactEmail,
      status: backlinksTable.status,
      domainAuthority: backlinksTable.domainAuthority,
      type: backlinksTable.type,
      notes: backlinksTable.notes,
      createdAt: backlinksTable.createdAt,
      updatedAt: backlinksTable.updatedAt,
      outreachContactName: outreachContactsTable.name,
      outreachContactStatus: outreachContactsTable.status,
      outreachContactEmail: outreachContactsTable.email,
    })
    .from(backlinksTable)
    .leftJoin(outreachContactsTable, eq(backlinksTable.outreachContactId, outreachContactsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(backlinksTable.createdAt);

  const result = rows.map(r => ({
    id: r.id,
    websiteId: r.websiteId,
    outreachContactId: r.outreachContactId,
    prospectUrl: r.prospectUrl,
    prospectDomain: r.prospectDomain,
    contactEmail: r.contactEmail,
    status: r.status,
    domainAuthority: r.domainAuthority,
    type: r.type,
    notes: r.notes,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    outreachContact: r.outreachContactName
      ? { id: r.outreachContactId!, name: r.outreachContactName, status: r.outreachContactStatus!, email: r.outreachContactEmail }
      : null,
  }));

  res.json(ListBacklinksResponse.parse(result));
});

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------
router.post("/backlinks", async (req, res): Promise<void> => {
  const parsed = CreateBacklinkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [backlink] = await db.insert(backlinksTable).values(parsed.data).returning();
  void sendWebhookNotification(
    `:link: New backlink tracked — ${backlink.prospectUrl} (DA ${backlink.domainAuthority ?? "?"}, status: ${backlink.status})`
  );
  res.status(201).json(backlink);
});

// ---------------------------------------------------------------------------
// Update (status, notes, type, outreachContactId)
// ---------------------------------------------------------------------------
router.patch("/backlinks/:id", async (req, res): Promise<void> => {
  const params = UpdateBacklinkParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateBacklinkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [backlink] = await db
    .update(backlinksTable)
    .set(parsed.data)
    .where(eq(backlinksTable.id, params.data.id))
    .returning();
  if (!backlink) {
    res.status(404).json({ error: "Backlink not found" });
    return;
  }
  res.json(UpdateBacklinkResponse.parse(backlink));
});

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------
router.delete("/backlinks/:id", async (req, res): Promise<void> => {
  const params = DeleteBacklinkParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [backlink] = await db.delete(backlinksTable).where(eq(backlinksTable.id, params.data.id)).returning();
  if (!backlink) {
    res.status(404).json({ error: "Backlink not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
