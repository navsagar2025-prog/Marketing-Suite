import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq, desc, count, sum, countDistinct, and, gte } from "drizzle-orm";
import { db, staffUsersTable, ipRateLimitsTable, ipAllowlistTable, leadsTable } from "@workspace/db";
import { requireAdmin } from "../lib/auth.js";
import { runRankSnapshot } from "./keywords.js";
import { SnapshotKeywordRanksResponse } from "@workspace/api-zod";
import { calculateLeadScore, DEFAULT_SCORING_WEIGHTS, mergeWeights, type LeadScoringWeights } from "../lib/lead-scoring.js";
import { getDbSetting, setDbSetting } from "../lib/ai-provider.js";

const DAILY_LIMIT = 2;

const router: IRouter = Router();

router.use(requireAdmin);

router.get("/admin/audit-requests", async (_req, res): Promise<void> => {
  const requests = await db
    .select()
    .from(ipRateLimitsTable)
    .where(eq(ipRateLimitsTable.feature, "public_audit"))
    .orderBy(desc(ipRateLimitsTable.lastRequestAt))
    .limit(200);
  res.json(requests);
});

router.get("/admin/visitor-stats", async (_req, res): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);

  // Cutoff date for 14-day window
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 13);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const [todayStats] = await db
    .select({
      uniqueIpsToday: countDistinct(ipRateLimitsTable.ip),
      totalRequestsToday: sum(ipRateLimitsTable.count),
    })
    .from(ipRateLimitsTable)
    .where(and(
      eq(ipRateLimitsTable.date, today),
      eq(ipRateLimitsTable.feature, "public_audit"),
    ));

  const [allTimeStats] = await db
    .select({
      totalRequestsAllTime: sum(ipRateLimitsTable.count),
    })
    .from(ipRateLimitsTable)
    .where(eq(ipRateLimitsTable.feature, "public_audit"));

  const [limitedStats] = await db
    .select({
      ipsAtLimitToday: count(),
    })
    .from(ipRateLimitsTable)
    .where(and(
      eq(ipRateLimitsTable.date, today),
      eq(ipRateLimitsTable.feature, "public_audit"),
      gte(ipRateLimitsTable.count, DAILY_LIMIT),
    ));

  const dailyCounts = await db
    .select({
      date: ipRateLimitsTable.date,
      requests: sum(ipRateLimitsTable.count),
    })
    .from(ipRateLimitsTable)
    .where(and(
      eq(ipRateLimitsTable.feature, "public_audit"),
      gte(ipRateLimitsTable.date, cutoffDate),
    ))
    .groupBy(ipRateLimitsTable.date)
    .orderBy(ipRateLimitsTable.date);

  // Fill in missing dates with 0
  const dailyMap: Record<string, number> = {};
  for (const row of dailyCounts) {
    dailyMap[row.date] = Number(row.requests ?? 0);
  }
  const dailyData: { date: string; requests: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    dailyData.push({ date: dateStr, requests: dailyMap[dateStr] ?? 0 });
  }

  res.json({
    uniqueIpsToday: Number(todayStats?.uniqueIpsToday ?? 0),
    totalRequestsToday: Number(todayStats?.totalRequestsToday ?? 0),
    totalRequestsAllTime: Number(allTimeStats?.totalRequestsAllTime ?? 0),
    ipsAtLimitToday: Number(limitedStats?.ipsAtLimitToday ?? 0),
    dailyData,
  });
});

router.get("/admin/allowlist", async (_req, res): Promise<void> => {
  const entries = await db.select().from(ipAllowlistTable).orderBy(desc(ipAllowlistTable.createdAt));
  res.json(entries);
});

router.post("/admin/allowlist", async (req, res): Promise<void> => {
  const { ip, note } = req.body as { ip?: string; note?: string };
  if (!ip) {
    res.status(400).json({ error: "IP is required" });
    return;
  }
  try {
    const [entry] = await db.insert(ipAllowlistTable).values({ ip: ip.trim(), note: note?.trim() || null }).returning();
    res.status(201).json(entry);
  } catch {
    res.status(409).json({ error: "IP already in allowlist" });
  }
});

router.delete("/admin/allowlist/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "");
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [deleted] = await db.delete(ipAllowlistTable).where(eq(ipAllowlistTable.id, id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/admin/staff", async (_req, res): Promise<void> => {
  const staff = await db
    .select({ id: staffUsersTable.id, username: staffUsersTable.username, role: staffUsersTable.role, createdAt: staffUsersTable.createdAt })
    .from(staffUsersTable)
    .orderBy(staffUsersTable.createdAt);
  res.json(staff);
});

router.post("/admin/staff", async (req, res): Promise<void> => {
  const { username, password, role } = req.body as { username?: string; password?: string; role?: string };
  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }
  const validRole = role === "admin" ? "admin" : "staff";
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const [user] = await db.insert(staffUsersTable).values({
      username: username.trim().toLowerCase(),
      passwordHash,
      role: validRole,
    }).returning({ id: staffUsersTable.id, username: staffUsersTable.username, role: staffUsersTable.role, createdAt: staffUsersTable.createdAt });
    res.status(201).json(user);
  } catch {
    res.status(409).json({ error: "Username already exists" });
  }
});

router.delete("/admin/staff/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "");
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  if (req.user?.id === id) {
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }
  const [deleted] = await db.delete(staffUsersTable).where(eq(staffUsersTable.id, id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Staff user not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/admin/keywords/snapshot", async (_req, res): Promise<void> => {
  const result = await runRankSnapshot();
  res.json(SnapshotKeywordRanksResponse.parse(result));
});

async function loadScoringWeights(): Promise<LeadScoringWeights> {
  try {
    const raw = await getDbSetting("lead_scoring_config");
    if (raw) return { ...DEFAULT_SCORING_WEIGHTS, ...JSON.parse(raw) };
  } catch {
  }
  return DEFAULT_SCORING_WEIGHTS;
}

router.get("/admin/lead-scoring-config", async (_req, res): Promise<void> => {
  const weights = await loadScoringWeights();
  res.json(weights);
});

router.patch("/admin/lead-scoring-config", async (req, res): Promise<void> => {
  const current = await loadScoringWeights();
  const updated = mergeWeights(current, req.body ?? {});
  await setDbSetting("lead_scoring_config", JSON.stringify(updated));
  res.json(updated);
});

router.post("/admin/leads/recalculate-scores", async (_req, res): Promise<void> => {
  const weights = await loadScoringWeights();
  const leads = await db.select().from(leadsTable);
  let updated = 0;
  for (const lead of leads) {
    const { score, breakdown } = calculateLeadScore(
      { source: lead.source, status: lead.status, value: lead.value, createdAt: lead.createdAt },
      weights
    );
    await db.update(leadsTable).set({ score, scoreBreakdown: breakdown }).where(eq(leadsTable.id, lead.id));
    updated++;
  }
  res.json({ updated, date: new Date().toISOString().slice(0, 10) });
});

export default router;
