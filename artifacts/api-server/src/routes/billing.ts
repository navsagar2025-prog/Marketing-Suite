import { Router, type IRouter } from "express";
import { eq, count, sql, desc } from "drizzle-orm";
import { db, staffUsersTable, websitesTable, keywordsTable, campaignsTable, aiUsageTable, couponsTable } from "@workspace/db";
import { requireAdmin } from "../lib/auth.js";

const router: IRouter = Router();

export const PLAN_META = {
  starter: {
    name: "Starter",
    monthlyPrice: 5999,
    annualPrice: 4499,
    limits: { websites: 1, keywords: 5, campaigns: 1, aiGenerations: 50 },
  },
  growth: {
    name: "Growth",
    monthlyPrice: 8999,
    annualPrice: 6749,
    limits: { websites: 1, keywords: 10, campaigns: -1, aiGenerations: 300 },
  },
  agency: {
    name: "Agency",
    monthlyPrice: 15999,
    annualPrice: 11999,
    limits: { websites: 1, keywords: 20, campaigns: -1, aiGenerations: 1000 },
  },
} as const;

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

router.get("/billing/me", async (req, res): Promise<void> => {
  const userId = req.user!.id;

  const [user] = await db
    .select({ plan: staffUsersTable.plan })
    .from(staffUsersTable)
    .where(eq(staffUsersTable.id, userId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const plan = (user.plan ?? "starter") as keyof typeof PLAN_META;
  const meta = PLAN_META[plan];

  const [[websiteRow], [keywordRow], [campaignRow], aiUsageRows] = await Promise.all([
    db.select({ c: count() }).from(websitesTable),
    db.select({ c: count() }).from(keywordsTable),
    db.select({ c: count() }).from(campaignsTable),
    db
      .select({ count: sql<number>`COALESCE(sum(${aiUsageTable.count}), 0)` })
      .from(aiUsageTable)
      .where(
        sql`${aiUsageTable.userId} = ${userId} AND ${aiUsageTable.yearMonth} = ${currentYearMonth()} AND ${aiUsageTable.type} = 'text'`
      ),
  ]);

  const usage = {
    websites: Number(websiteRow?.c ?? 0),
    keywords: Number(keywordRow?.c ?? 0),
    campaigns: Number(campaignRow?.c ?? 0),
    aiGenerations: Number(aiUsageRows[0]?.count ?? 0),
  };

  res.json({
    plan,
    planName: meta.name,
    monthlyPrice: meta.monthlyPrice,
    annualPrice: meta.annualPrice,
    limits: meta.limits,
    usage,
  });
});

router.post("/billing/validate-coupon", async (req, res): Promise<void> => {
  const { code, plan } = req.body as { code?: string; plan?: string };
  if (!code) {
    res.status(400).json({ error: "Coupon code is required" });
    return;
  }
  const [coupon] = await db
    .select()
    .from(couponsTable)
    .where(eq(couponsTable.code, code.toUpperCase().trim()));

  if (!coupon || !coupon.isActive) {
    res.status(404).json({ error: "Invalid or expired coupon code" });
    return;
  }
  if (coupon.expiresAt && new Date() > coupon.expiresAt) {
    res.status(400).json({ error: "This coupon has expired" });
    return;
  }
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    res.status(400).json({ error: "This coupon has reached its usage limit" });
    return;
  }
  if (coupon.appliesTo !== "all" && plan && coupon.appliesTo !== plan) {
    res.status(400).json({ error: `This coupon only applies to the ${coupon.appliesTo} plan` });
    return;
  }

  res.json({
    valid: true,
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    appliesTo: coupon.appliesTo,
  });
});

router.get("/billing/coupons", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(couponsTable).orderBy(desc(couponsTable.createdAt));
  res.json(rows);
});

router.post("/billing/coupons", requireAdmin, async (req, res): Promise<void> => {
  const { code, discountType, discountValue, appliesTo, maxUses, expiresAt } = req.body as {
    code?: string;
    discountType?: string;
    discountValue?: number;
    appliesTo?: string;
    maxUses?: number | null;
    expiresAt?: string | null;
  };

  if (!code || !discountType || discountValue === undefined) {
    res.status(400).json({ error: "code, discountType, and discountValue are required" });
    return;
  }
  if (!["percent", "fixed"].includes(discountType)) {
    res.status(400).json({ error: "discountType must be 'percent' or 'fixed'" });
    return;
  }
  if (discountType === "percent" && (discountValue < 1 || discountValue > 100)) {
    res.status(400).json({ error: "Percent discount must be between 1 and 100" });
    return;
  }

  try {
    const [coupon] = await db
      .insert(couponsTable)
      .values({
        code: code.toUpperCase().trim(),
        discountType: discountType as "percent" | "fixed",
        discountValue,
        appliesTo: (appliesTo ?? "all") as "all" | "starter" | "growth" | "agency",
        maxUses: maxUses ?? null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: true,
      })
      .returning();
    res.status(201).json(coupon);
  } catch {
    res.status(409).json({ error: "A coupon with that code already exists" });
  }
});

router.patch("/billing/coupons/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { isActive, maxUses, expiresAt } = req.body as {
    isActive?: boolean;
    maxUses?: number | null;
    expiresAt?: string | null;
  };

  const updates: Record<string, unknown> = {};
  if (typeof isActive === "boolean") updates.isActive = isActive;
  if (maxUses !== undefined) updates.maxUses = maxUses;
  if (expiresAt !== undefined) updates.expiresAt = expiresAt ? new Date(expiresAt) : null;

  const [updated] = await db
    .update(couponsTable)
    .set(updates)
    .where(eq(couponsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Coupon not found" });
    return;
  }
  res.json(updated);
});

router.delete("/billing/coupons/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [deleted] = await db.delete(couponsTable).where(eq(couponsTable.id, id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Coupon not found" });
    return;
  }
  res.json({ success: true });
});

export default router;
