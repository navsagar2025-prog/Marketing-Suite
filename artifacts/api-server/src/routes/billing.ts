import { Router, type IRouter } from "express";
import { eq, count, sql } from "drizzle-orm";
import { db, staffUsersTable, websitesTable, keywordsTable, campaignsTable, aiUsageTable } from "@workspace/db";

const router: IRouter = Router();

export const PLAN_META = {
  starter: {
    name: "Starter",
    monthlyPrice: 999,
    limits: { websites: 1, keywords: 25, campaigns: 1, aiGenerations: 50 },
  },
  growth: {
    name: "Growth",
    monthlyPrice: 2499,
    limits: { websites: 5, keywords: 200, campaigns: -1, aiGenerations: 300 },
  },
  agency: {
    name: "Agency",
    monthlyPrice: 5999,
    limits: { websites: -1, keywords: -1, campaigns: -1, aiGenerations: 1000 },
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
    limits: meta.limits,
    usage,
  });
});

export default router;
