import { Router, type IRouter, type Request } from "express";
import { db } from "@workspace/db";
import {
  appSettingsTable,
  blogPostsTable,
  productsTable,
  galleryImagesTable,
  ipRateLimitsTable,
  chatbotConversationsTable,
  type ChatbotMessage,
} from "@workspace/db/schema";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { requireAdmin, requirePermission } from "../lib/auth.js";
import { callAI, getDbSetting, setDbSetting } from "../lib/ai-provider.js";

const router: IRouter = Router();
export const adminSiteCustomizationRouter: IRouter = Router();

const SITE_CODE_KEYS = {
  head: "site_code_head_html",
  body: "site_code_body_html",
} as const;

const CHATBOT_KEYS = {
  enabled: "chatbot_enabled",
  name: "chatbot_name",
  avatar: "chatbot_avatar",
  greeting: "chatbot_greeting",
  systemPrompt: "chatbot_system_prompt",
} as const;

interface SiteCodeCache {
  head: string;
  body: string;
  loadedAt: number;
}
let siteCodeCache: SiteCodeCache | null = null;
const SITE_CODE_TTL_MS = 5 * 60_000;

async function loadSiteCode(): Promise<SiteCodeCache> {
  if (siteCodeCache && Date.now() - siteCodeCache.loadedAt < SITE_CODE_TTL_MS) {
    return siteCodeCache;
  }
  const head = (await getDbSetting(SITE_CODE_KEYS.head)) ?? "";
  const body = (await getDbSetting(SITE_CODE_KEYS.body)) ?? "";
  siteCodeCache = { head, body, loadedAt: Date.now() };
  return siteCodeCache;
}

function bustSiteCodeCache(): void {
  siteCodeCache = null;
}

router.get("/public/site-code", async (_req, res): Promise<void> => {
  const code = await loadSiteCode();
  res.set("Cache-Control", "public, max-age=60");
  res.json({ headHtml: code.head, bodyHtml: code.body });
});

adminSiteCustomizationRouter.get("/admin/site-code", requirePermission("site_code"), async (_req, res): Promise<void> => {
  const head = (await getDbSetting(SITE_CODE_KEYS.head)) ?? "";
  const body = (await getDbSetting(SITE_CODE_KEYS.body)) ?? "";
  res.json({ headHtml: head, bodyHtml: body });
});

adminSiteCustomizationRouter.put("/admin/site-code", requirePermission("site_code"), async (req, res): Promise<void> => {
  const { headHtml, bodyHtml } = (req.body ?? {}) as { headHtml?: string; bodyHtml?: string };
  if (typeof headHtml !== "string" || typeof bodyHtml !== "string") {
    res.status(400).json({ error: "headHtml and bodyHtml must be strings" });
    return;
  }
  if (headHtml.length > 50_000 || bodyHtml.length > 50_000) {
    res.status(400).json({ error: "Each snippet must be 50,000 characters or fewer" });
    return;
  }
  await setDbSetting(SITE_CODE_KEYS.head, headHtml);
  await setDbSetting(SITE_CODE_KEYS.body, bodyHtml);
  bustSiteCodeCache();
  res.json({ ok: true, headHtml, bodyHtml });
});

interface ChatbotConfig {
  enabled: boolean;
  name: string;
  avatar: string;
  greeting: string;
  systemPrompt: string;
}

const DEFAULT_CHATBOT: ChatbotConfig = {
  enabled: false,
  name: "Chat with us",
  avatar: "",
  greeting: "Hi! How can we help you today?",
  systemPrompt: "You are a friendly assistant on our marketing website. Answer visitor questions briefly and helpfully. If you don't know an answer, suggest they contact us.",
};

async function loadChatbotConfig(): Promise<ChatbotConfig> {
  const [enabled, name, avatar, greeting, systemPrompt] = await Promise.all([
    getDbSetting(CHATBOT_KEYS.enabled),
    getDbSetting(CHATBOT_KEYS.name),
    getDbSetting(CHATBOT_KEYS.avatar),
    getDbSetting(CHATBOT_KEYS.greeting),
    getDbSetting(CHATBOT_KEYS.systemPrompt),
  ]);
  return {
    enabled: enabled === "true",
    name: name ?? DEFAULT_CHATBOT.name,
    avatar: avatar ?? DEFAULT_CHATBOT.avatar,
    greeting: greeting ?? DEFAULT_CHATBOT.greeting,
    systemPrompt: systemPrompt ?? DEFAULT_CHATBOT.systemPrompt,
  };
}

router.get("/public/chatbot/config", async (_req, res): Promise<void> => {
  const c = await loadChatbotConfig();
  res.set("Cache-Control", "public, max-age=30");
  res.json({ enabled: c.enabled, name: c.name, avatar: c.avatar, greeting: c.greeting });
});

adminSiteCustomizationRouter.get("/admin/chatbot/config", requireAdmin, async (_req, res): Promise<void> => {
  const c = await loadChatbotConfig();
  res.json(c);
});

adminSiteCustomizationRouter.put("/admin/chatbot/config", requireAdmin, async (req, res): Promise<void> => {
  const body = (req.body ?? {}) as Partial<ChatbotConfig>;
  if (typeof body.enabled === "boolean") await setDbSetting(CHATBOT_KEYS.enabled, body.enabled ? "true" : "false");
  if (typeof body.name === "string") await setDbSetting(CHATBOT_KEYS.name, body.name.trim().slice(0, 80));
  if (typeof body.avatar === "string") await setDbSetting(CHATBOT_KEYS.avatar, body.avatar.trim().slice(0, 500));
  if (typeof body.greeting === "string") await setDbSetting(CHATBOT_KEYS.greeting, body.greeting.trim().slice(0, 500));
  if (typeof body.systemPrompt === "string") await setDbSetting(CHATBOT_KEYS.systemPrompt, body.systemPrompt.slice(0, 4000));
  const saved = await loadChatbotConfig();
  res.json(saved);
});

const CHAT_DAILY_LIMIT = 30;
const MAX_HISTORY = 12;

function clientIp(req: Request): string {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

router.post("/public/chat", async (req, res): Promise<void> => {
  const { message, visitorId, conversationId, pageUrl } = (req.body ?? {}) as {
    message?: string;
    visitorId?: string;
    conversationId?: number;
    pageUrl?: string;
  };
  if (!message || typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "message is required" });
    return;
  }
  if (message.length > 2000) {
    res.status(400).json({ error: "Message too long (max 2000 chars)" });
    return;
  }
  if (!visitorId || typeof visitorId !== "string" || visitorId.length > 100) {
    res.status(400).json({ error: "visitorId is required and must be <=100 chars" });
    return;
  }
  if (conversationId !== undefined && (typeof conversationId !== "number" || !Number.isInteger(conversationId) || conversationId <= 0)) {
    res.status(400).json({ error: "conversationId must be a positive integer" });
    return;
  }

  const config = await loadChatbotConfig();
  if (!config.enabled) {
    res.status(503).json({ error: "Chatbot is currently disabled" });
    return;
  }

  const ip = clientIp(req);
  const today = todayKey();
  const visitorKey = `visitor:${visitorId}`;
  const [visitorRate] = await db
    .select()
    .from(ipRateLimitsTable)
    .where(and(
      eq(ipRateLimitsTable.ip, visitorKey),
      eq(ipRateLimitsTable.feature, "public_chatbot"),
      eq(ipRateLimitsTable.date, today),
    ));
  if (visitorRate && visitorRate.count >= CHAT_DAILY_LIMIT) {
    res.status(429).json({ error: "Daily chat limit reached. Please try again tomorrow." });
    return;
  }
  const [ipRate] = await db
    .select()
    .from(ipRateLimitsTable)
    .where(and(
      eq(ipRateLimitsTable.ip, ip),
      eq(ipRateLimitsTable.feature, "public_chatbot_ip"),
      eq(ipRateLimitsTable.date, today),
    ));
  if (ipRate && ipRate.count >= CHAT_DAILY_LIMIT * 5) {
    res.status(429).json({ error: "Too many requests from this network. Please try again tomorrow." });
    return;
  }

  let conversation: { id: number; messages: ChatbotMessage[] } | null = null;
  if (conversationId) {
    const [existing] = await db
      .select()
      .from(chatbotConversationsTable)
      .where(and(eq(chatbotConversationsTable.id, conversationId), eq(chatbotConversationsTable.visitorId, visitorId)));
    if (existing) {
      conversation = { id: existing.id, messages: (existing.messages as ChatbotMessage[]) ?? [] };
    }
  }
  if (!conversation) {
    const [created] = await db
      .insert(chatbotConversationsTable)
      .values({
        visitorId,
        ip,
        userAgent: req.headers["user-agent"]?.toString().slice(0, 500) ?? null,
        pageUrl: pageUrl?.slice(0, 500) ?? null,
        messages: [],
      })
      .returning();
    conversation = { id: created.id, messages: [] };
  }

  const trimmedHistory = conversation.messages.slice(-MAX_HISTORY).map(m => ({ role: m.role, content: m.content }));
  let reply = "";
  try {
    reply = await callAI(message, {
      systemPrompt: config.systemPrompt,
      history: trimmedHistory,
      maxTokens: 800,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI failure";
    res.status(503).json({ error: msg });
    return;
  }

  const now = new Date().toISOString();
  const nextMessages: ChatbotMessage[] = [
    ...conversation.messages,
    { role: "user", content: message, at: now },
    { role: "assistant", content: reply, at: new Date().toISOString() },
  ];

  await db
    .update(chatbotConversationsTable)
    .set({ messages: nextMessages })
    .where(eq(chatbotConversationsTable.id, conversation.id));

  if (visitorRate) {
    await db
      .update(ipRateLimitsTable)
      .set({ count: visitorRate.count + 1, lastRequestAt: new Date() })
      .where(eq(ipRateLimitsTable.id, visitorRate.id));
  } else {
    await db.insert(ipRateLimitsTable).values({
      ip: visitorKey,
      feature: "public_chatbot",
      date: today,
      count: 1,
      lastRequestAt: new Date(),
    });
  }

  if (ipRate) {
    await db
      .update(ipRateLimitsTable)
      .set({ count: ipRate.count + 1, lastRequestAt: new Date() })
      .where(eq(ipRateLimitsTable.id, ipRate.id));
  } else {
    await db.insert(ipRateLimitsTable).values({
      ip,
      feature: "public_chatbot_ip",
      date: today,
      count: 1,
      lastRequestAt: new Date(),
    });
  }

  res.json({ reply, conversationId: conversation.id });
});

adminSiteCustomizationRouter.get("/admin/chatbot/conversations", requireAdmin, async (req, res): Promise<void> => {
  const limit = Math.min(parseInt(String(req.query.limit ?? "50")) || 50, 200);
  const offset = Math.max(parseInt(String(req.query.offset ?? "0")) || 0, 0);
  const rows = await db
    .select()
    .from(chatbotConversationsTable)
    .orderBy(desc(chatbotConversationsTable.updatedAt))
    .limit(limit)
    .offset(offset);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(chatbotConversationsTable);
  res.json({ conversations: rows, total: count });
});

adminSiteCustomizationRouter.get("/admin/chatbot/conversations/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db.select().from(chatbotConversationsTable).where(eq(chatbotConversationsTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

adminSiteCustomizationRouter.delete("/admin/chatbot/conversations/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(chatbotConversationsTable).where(eq(chatbotConversationsTable.id, id));
  res.json({ ok: true });
});

interface MissingItem {
  type: "blog" | "product" | "gallery";
  id: number;
  title: string;
  hasTitle: boolean;
  hasDescription: boolean;
}

async function findMissingBlog(): Promise<MissingItem[]> {
  const rows = await db
    .select({ id: blogPostsTable.id, title: blogPostsTable.title, seoTitle: blogPostsTable.seoTitle, seoDescription: blogPostsTable.seoDescription })
    .from(blogPostsTable)
    .where(or(
      isNull(blogPostsTable.seoTitle),
      eq(blogPostsTable.seoTitle, ""),
      isNull(blogPostsTable.seoDescription),
      eq(blogPostsTable.seoDescription, ""),
    ));
  return rows.map(r => ({ type: "blog" as const, id: r.id, title: r.title, hasTitle: !!r.seoTitle, hasDescription: !!r.seoDescription }));
}

async function findMissingProduct(): Promise<MissingItem[]> {
  const rows = await db
    .select({ id: productsTable.id, title: productsTable.name, seoTitle: productsTable.seoTitle, seoDescription: productsTable.seoDescription })
    .from(productsTable)
    .where(or(
      isNull(productsTable.seoTitle),
      eq(productsTable.seoTitle, ""),
      isNull(productsTable.seoDescription),
      eq(productsTable.seoDescription, ""),
    ));
  return rows.map(r => ({ type: "product" as const, id: r.id, title: r.title, hasTitle: !!r.seoTitle, hasDescription: !!r.seoDescription }));
}

async function findMissingGallery(): Promise<MissingItem[]> {
  const rows = await db
    .select({ id: galleryImagesTable.id, caption: galleryImagesTable.caption, seoTitle: galleryImagesTable.seoTitle, seoDescription: galleryImagesTable.seoDescription })
    .from(galleryImagesTable)
    .where(or(
      isNull(galleryImagesTable.seoTitle),
      eq(galleryImagesTable.seoTitle, ""),
      isNull(galleryImagesTable.seoDescription),
      eq(galleryImagesTable.seoDescription, ""),
    ));
  return rows.map(r => ({ type: "gallery" as const, id: r.id, title: r.caption ?? `Gallery #${r.id}`, hasTitle: !!r.seoTitle, hasDescription: !!r.seoDescription }));
}

adminSiteCustomizationRouter.get("/admin/seo-fill/scan", requireAdmin, async (_req, res): Promise<void> => {
  const [blog, product, gallery] = await Promise.all([findMissingBlog(), findMissingProduct(), findMissingGallery()]);
  res.json({
    counts: { blog: blog.length, product: product.length, gallery: gallery.length, total: blog.length + product.length + gallery.length },
    samples: {
      blog: blog.slice(0, 5),
      product: product.slice(0, 5),
      gallery: gallery.slice(0, 5),
    },
  });
});

interface FillResult {
  type: "blog" | "product" | "gallery";
  id: number;
  title: string;
  oldTitle: string | null;
  oldDescription: string | null;
  newTitle: string;
  newDescription: string;
  status: "ok" | "error" | "skipped";
  error?: string;
}

const META_BATCH_LIMIT = 25;

async function generateMeta(content: { title: string; body: string }): Promise<{ title: string; description: string }> {
  const prompt = `Write an SEO-optimized meta title and meta description for this content.

Title: ${content.title}
Content excerpt: ${content.body.slice(0, 800)}

Rules:
- Meta title: 50-60 characters
- Meta description: 150-160 characters, compelling, with a call to action
Return ONLY valid JSON: {"title":"...","description":"..."}`;

  const raw = await callAI(prompt, { maxTokens: 400, jsonMode: true });
  let parsed: { title?: string; description?: string } = {};
  try { parsed = JSON.parse(raw); } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) { try { parsed = JSON.parse(m[0]); } catch { /* noop */ } }
  }
  return {
    title: (parsed.title ?? "").toString().slice(0, 70),
    description: (parsed.description ?? "").toString().slice(0, 200),
  };
}

adminSiteCustomizationRouter.post("/admin/seo-fill/run", requireAdmin, async (req, res): Promise<void> => {
  const body = (req.body ?? {}) as {
    types?: string[];
    dryRun?: boolean;
    limit?: number;
    cursor?: { blog?: number; product?: number; gallery?: number };
  };
  const types = Array.isArray(body.types) && body.types.length > 0 ? body.types : ["blog", "product", "gallery"];
  const dryRun = body.dryRun === true;
  const limit = Math.min(Math.max(parseInt(String(body.limit ?? META_BATCH_LIMIT)) || META_BATCH_LIMIT, 1), META_BATCH_LIMIT);
  const cursor = body.cursor ?? {};

  const queue: Array<{ type: "blog" | "product" | "gallery"; id: number }> = [];
  if (types.includes("blog")) {
    const items = await findMissingBlog();
    items
      .filter(i => i.id > (cursor.blog ?? 0))
      .sort((a, b) => a.id - b.id)
      .forEach(i => queue.push({ type: "blog", id: i.id }));
  }
  if (types.includes("product")) {
    const items = await findMissingProduct();
    items
      .filter(i => i.id > (cursor.product ?? 0))
      .sort((a, b) => a.id - b.id)
      .forEach(i => queue.push({ type: "product", id: i.id }));
  }
  if (types.includes("gallery")) {
    const items = await findMissingGallery();
    items
      .filter(i => i.id > (cursor.gallery ?? 0))
      .sort((a, b) => a.id - b.id)
      .forEach(i => queue.push({ type: "gallery", id: i.id }));
  }

  const slice = queue.slice(0, limit);
  const results: FillResult[] = [];

  for (const item of slice) {
    try {
      let title = "";
      let bodyText = "";
      let oldTitle: string | null = null;
      let oldDescription: string | null = null;

      if (item.type === "blog") {
        const [row] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.id, item.id));
        if (!row) { results.push({ type: item.type, id: item.id, title: "?", oldTitle: null, oldDescription: null, newTitle: "", newDescription: "", status: "error", error: "Not found" }); continue; }
        title = row.title; bodyText = row.excerpt + " " + row.content; oldTitle = row.seoTitle; oldDescription = row.seoDescription;
      } else if (item.type === "product") {
        const [row] = await db.select().from(productsTable).where(eq(productsTable.id, item.id));
        if (!row) { results.push({ type: item.type, id: item.id, title: "?", oldTitle: null, oldDescription: null, newTitle: "", newDescription: "", status: "error", error: "Not found" }); continue; }
        title = row.name; bodyText = (row.shortDescription ?? "") + " " + row.description; oldTitle = row.seoTitle; oldDescription = row.seoDescription;
      } else {
        const [row] = await db.select().from(galleryImagesTable).where(eq(galleryImagesTable.id, item.id));
        if (!row) { results.push({ type: item.type, id: item.id, title: "?", oldTitle: null, oldDescription: null, newTitle: "", newDescription: "", status: "error", error: "Not found" }); continue; }
        title = row.caption ?? `Gallery image ${row.id}`; bodyText = `${row.categoryTag ?? ""} ${row.locationTag ?? ""}`.trim() || title; oldTitle = row.seoTitle; oldDescription = row.seoDescription;
      }

      const meta = await generateMeta({ title, body: bodyText });
      const newTitle = oldTitle && oldTitle.trim() ? oldTitle : meta.title;
      const newDescription = oldDescription && oldDescription.trim() ? oldDescription : meta.description;

      if (!dryRun) {
        if (item.type === "blog") {
          await db.update(blogPostsTable).set({ seoTitle: newTitle, seoDescription: newDescription }).where(eq(blogPostsTable.id, item.id));
        } else if (item.type === "product") {
          await db.update(productsTable).set({ seoTitle: newTitle, seoDescription: newDescription }).where(eq(productsTable.id, item.id));
        } else {
          await db.update(galleryImagesTable).set({ seoTitle: newTitle, seoDescription: newDescription }).where(eq(galleryImagesTable.id, item.id));
        }
      }

      results.push({ type: item.type, id: item.id, title, oldTitle, oldDescription, newTitle, newDescription, status: "ok" });
    } catch (err) {
      results.push({ type: item.type, id: item.id, title: "?", oldTitle: null, oldDescription: null, newTitle: "", newDescription: "", status: "error", error: err instanceof Error ? err.message : "Failed" });
    }
  }

  const nextCursor: { blog?: number; product?: number; gallery?: number } = { ...cursor };
  for (const r of slice) {
    const prev = nextCursor[r.type] ?? 0;
    if (r.id > prev) nextCursor[r.type] = r.id;
  }

  res.json({
    processed: results.length,
    remaining: Math.max(queue.length - slice.length, 0),
    results,
    dryRun,
    nextCursor,
  });
});

export default router;
