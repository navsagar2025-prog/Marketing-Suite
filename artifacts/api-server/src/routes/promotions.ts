import { Router, type IRouter } from "express";
import { eq, and, lte, gte, or, isNull, desc } from "drizzle-orm";
import { db, promotionsTable } from "@workspace/db";
import { requireAdmin, isAuthedRequest } from "../lib/auth.js";

function isSafeCtaUrl(u: unknown): boolean {
  if (u === null || u === undefined || u === "") return true;
  if (typeof u !== "string") return false;
  const s = u.trim();
  if (s.startsWith("/") && !s.startsWith("//")) return true;
  return /^https?:\/\//i.test(s);
}

const VALID_KINDS = ["banner", "popup"] as const;
const VALID_AUDIENCE = ["all", "loggedIn"] as const;

export const publicPromotionsRouter: IRouter = Router();

publicPromotionsRouter.get("/promotions/active", async (req, res): Promise<void> => {
  const now = new Date();
  const isAuthed = await isAuthedRequest(req);
  const audience: "all" | "loggedIn" = isAuthed ? "loggedIn" : "all";
  const audienceFilter = audience === "loggedIn"
    ? or(eq(promotionsTable.audience, "all"), eq(promotionsTable.audience, "loggedIn"))!
    : eq(promotionsTable.audience, "all");
  const where = and(
    eq(promotionsTable.active, true),
    lte(promotionsTable.startsAt, now),
    or(isNull(promotionsTable.endsAt), gte(promotionsTable.endsAt, now))!,
    audienceFilter,
  );
  const promos = await db.select().from(promotionsTable).where(where).orderBy(desc(promotionsTable.startsAt));
  res.json(promos);
});

const adminRouter: IRouter = Router();
adminRouter.use("/admin/promotions", requireAdmin);

adminRouter.get("/admin/promotions", async (_req, res): Promise<void> => {
  const promos = await db.select().from(promotionsTable).orderBy(desc(promotionsTable.startsAt));
  res.json(promos);
});

function parseDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

adminRouter.post("/admin/promotions", async (req, res): Promise<void> => {
  const b = req.body as Record<string, unknown>;
  const kind = String(b.kind ?? "");
  if (!(VALID_KINDS as readonly string[]).includes(kind)) {
    res.status(400).json({ error: `kind must be one of: ${VALID_KINDS.join(", ")}` }); return;
  }
  const title = String(b.title ?? "").trim();
  if (!title) { res.status(400).json({ error: "title is required" }); return; }
  const audience = String(b.audience ?? "all");
  if (!(VALID_AUDIENCE as readonly string[]).includes(audience)) {
    res.status(400).json({ error: `audience must be one of: ${VALID_AUDIENCE.join(", ")}` }); return;
  }
  const startsAt = parseDate(b.startsAt) ?? new Date();
  const endsAt = b.endsAt ? parseDate(b.endsAt) : null;
  if (b.endsAt && !endsAt) { res.status(400).json({ error: "Invalid endsAt" }); return; }
  if (endsAt && endsAt <= startsAt) { res.status(400).json({ error: "endsAt must be after startsAt" }); return; }
  if (!isSafeCtaUrl(b.ctaUrl)) { res.status(400).json({ error: "ctaUrl must be http(s) or a relative path" }); return; }
  if (!isSafeCtaUrl(b.imageUrl)) { res.status(400).json({ error: "imageUrl must be http(s) or a relative path" }); return; }

  const [promo] = await db.insert(promotionsTable).values({
    kind, title,
    body: String(b.body ?? ""),
    imageUrl: b.imageUrl ? String(b.imageUrl) : null,
    ctaLabel: b.ctaLabel ? String(b.ctaLabel) : null,
    ctaUrl: b.ctaUrl ? String(b.ctaUrl) : null,
    ctaColor: b.ctaColor ? String(b.ctaColor) : "#2563eb",
    audience,
    startsAt,
    endsAt,
    active: b.active === undefined ? true : Boolean(b.active),
  }).returning();
  res.status(201).json(promo);
});

adminRouter.patch("/admin/promotions/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const b = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  for (const f of ["title", "body", "imageUrl", "ctaLabel", "ctaUrl", "ctaColor"] as const) {
    if (b[f] !== undefined) updates[f] = b[f] === null ? null : String(b[f]);
  }
  if (b.kind !== undefined) {
    if (!(VALID_KINDS as readonly string[]).includes(String(b.kind))) {
      res.status(400).json({ error: `kind must be one of: ${VALID_KINDS.join(", ")}` }); return;
    }
    updates.kind = String(b.kind);
  }
  if (b.audience !== undefined) {
    if (!(VALID_AUDIENCE as readonly string[]).includes(String(b.audience))) {
      res.status(400).json({ error: `audience must be one of: ${VALID_AUDIENCE.join(", ")}` }); return;
    }
    updates.audience = String(b.audience);
  }
  if (b.ctaUrl !== undefined && !isSafeCtaUrl(b.ctaUrl)) { res.status(400).json({ error: "ctaUrl must be http(s) or a relative path" }); return; }
  if (b.imageUrl !== undefined && !isSafeCtaUrl(b.imageUrl)) { res.status(400).json({ error: "imageUrl must be http(s) or a relative path" }); return; }
  if (b.active !== undefined) updates.active = Boolean(b.active);
  if (b.startsAt !== undefined) {
    const d = parseDate(b.startsAt);
    if (!d) { res.status(400).json({ error: "Invalid startsAt" }); return; }
    updates.startsAt = d;
  }
  if (b.endsAt !== undefined) {
    const d = b.endsAt === null ? null : parseDate(b.endsAt);
    if (b.endsAt !== null && !d) { res.status(400).json({ error: "Invalid endsAt" }); return; }
    updates.endsAt = d;
  }
  if ("startsAt" in updates || "endsAt" in updates) {
    const [existing] = await db.select().from(promotionsTable).where(eq(promotionsTable.id, id));
    if (!existing) { res.status(404).json({ error: "Promotion not found" }); return; }
    const finalStarts = (updates.startsAt as Date | undefined) ?? existing.startsAt;
    const finalEnds = "endsAt" in updates ? (updates.endsAt as Date | null) : existing.endsAt;
    if (finalStarts && finalEnds && finalEnds <= finalStarts) {
      res.status(400).json({ error: "endsAt must be after startsAt" }); return;
    }
  }
  const [promo] = await db.update(promotionsTable).set(updates).where(eq(promotionsTable.id, id)).returning();
  if (!promo) { res.status(404).json({ error: "Promotion not found" }); return; }
  res.json(promo);
});

adminRouter.delete("/admin/promotions/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [d] = await db.delete(promotionsTable).where(eq(promotionsTable.id, id)).returning({ id: promotionsTable.id });
  if (!d) { res.status(404).json({ error: "Promotion not found" }); return; }
  res.json({ success: true });
});

export default adminRouter;
