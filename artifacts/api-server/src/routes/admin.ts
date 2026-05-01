import { Router, type IRouter } from "express";
import { ALL_MODULES } from "@workspace/api-zod";
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
    .select({
      id: staffUsersTable.id,
      username: staffUsersTable.username,
      role: staffUsersTable.role,
      permissions: staffUsersTable.permissions,
      plan: staffUsersTable.plan,
      createdAt: staffUsersTable.createdAt,
    })
    .from(staffUsersTable)
    .orderBy(staffUsersTable.createdAt);
  res.json(staff);
});

router.post("/admin/staff", async (req, res): Promise<void> => {
  const { username, password, role, permissions } = req.body as {
    username?: string; password?: string; role?: string; permissions?: string[] | null;
  };
  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }
  const validRole = role === "admin" ? "admin" : "staff";
  const passwordHash = await bcrypt.hash(password, 12);
  // Validate permissions against known module keys
  if (Array.isArray(permissions)) {
    const invalidKeys = permissions.filter(p => !(ALL_MODULES as readonly string[]).includes(p));
    if (invalidKeys.length > 0) {
      res.status(400).json({ error: `Invalid permission keys: ${invalidKeys.join(", ")}` });
      return;
    }
  }
  // Admin users always get null permissions (full access). Staff get the provided list (deduplicated) or null (full access).
  const resolvedPermissions: string[] | null = validRole === "admin" ? null : (Array.isArray(permissions) ? [...new Set(permissions)] : null);
  try {
    const [user] = await db.insert(staffUsersTable).values({
      username: username.trim().toLowerCase(),
      passwordHash,
      role: validRole,
      permissions: resolvedPermissions,
    }).returning({
      id: staffUsersTable.id,
      username: staffUsersTable.username,
      role: staffUsersTable.role,
      permissions: staffUsersTable.permissions,
      createdAt: staffUsersTable.createdAt,
    });
    res.status(201).json(user);
  } catch {
    res.status(409).json({ error: "Username already exists" });
  }
});

router.patch("/admin/users/:id/permissions", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "");
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  // Fetch target user to guard against updating admin accounts
  const [targetUser] = await db.select({ role: staffUsersTable.role }).from(staffUsersTable).where(eq(staffUsersTable.id, id));
  if (!targetUser) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (targetUser.role === "admin") {
    res.status(400).json({ error: "Cannot set permissions on admin accounts — admins always have full access" });
    return;
  }

  const { permissions } = req.body as { permissions?: string[] | null };
  if (Array.isArray(permissions)) {
    const invalidKeys = permissions.filter(p => !(ALL_MODULES as readonly string[]).includes(p));
    if (invalidKeys.length > 0) {
      res.status(400).json({ error: `Invalid permission keys: ${invalidKeys.join(", ")}` });
      return;
    }
  }
  // Deduplicate permission keys before persisting
  const resolvedPermissions = Array.isArray(permissions) ? [...new Set(permissions)] : null;
  const [updated] = await db
    .update(staffUsersTable)
    .set({ permissions: resolvedPermissions })
    .where(eq(staffUsersTable.id, id))
    .returning({
      id: staffUsersTable.id,
      username: staffUsersTable.username,
      role: staffUsersTable.role,
      permissions: staffUsersTable.permissions,
      createdAt: staffUsersTable.createdAt,
    });
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(updated);
});

const VALID_PLANS = ["starter", "growth", "agency"] as const;
type Plan = typeof VALID_PLANS[number];

router.patch("/admin/staff/:id/plan", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "");
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const { plan } = req.body as { plan?: string };
  if (!plan || !(VALID_PLANS as readonly string[]).includes(plan)) {
    res.status(400).json({ error: `Plan must be one of: ${VALID_PLANS.join(", ")}` });
    return;
  }
  const [updated] = await db
    .update(staffUsersTable)
    .set({ plan: plan as Plan })
    .where(eq(staffUsersTable.id, id))
    .returning({
      id: staffUsersTable.id,
      username: staffUsersTable.username,
      role: staffUsersTable.role,
      plan: staffUsersTable.plan,
      createdAt: staffUsersTable.createdAt,
    });
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(updated);
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

export interface OnboardingStepConfig {
  id: string;
  label: string;
  href: string;
  enabled: boolean;
}

export const DEFAULT_ONBOARDING_STEPS: OnboardingStepConfig[] = [
  { id: "add_website", label: "Add your first website", href: "/websites", enabled: true },
  { id: "run_audit", label: "Run a site audit", href: "/websites", enabled: true },
  { id: "track_keyword", label: "Track a keyword", href: "/keywords", enabled: true },
  { id: "create_campaign", label: "Create a campaign", href: "/campaigns", enabled: true },
];

export async function getOnboardingSteps(): Promise<OnboardingStepConfig[]> {
  try {
    const raw = await getDbSetting("onboarding_steps");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as OnboardingStepConfig[];
    }
  } catch {
  }
  return DEFAULT_ONBOARDING_STEPS;
}

router.get("/admin/onboarding-steps", async (_req, res): Promise<void> => {
  const steps = await getOnboardingSteps();
  res.json(steps);
});

router.put("/admin/onboarding-steps", async (req, res): Promise<void> => {
  const steps = req.body;
  if (!Array.isArray(steps)) {
    res.status(400).json({ error: "Request body must be an array of steps" });
    return;
  }
  const VALID_IDS = DEFAULT_ONBOARDING_STEPS.map(s => s.id);
  for (const step of steps) {
    if (typeof step !== "object" || step === null) {
      res.status(400).json({ error: "Each step must be an object" });
      return;
    }
    if (!VALID_IDS.includes(step.id)) {
      res.status(400).json({ error: `Invalid step id: ${step.id}` });
      return;
    }
    if (typeof step.label !== "string" || !step.label.trim()) {
      res.status(400).json({ error: `Step "${step.id}" must have a non-empty label` });
      return;
    }
    if (typeof step.href !== "string" || !step.href.trim()) {
      res.status(400).json({ error: `Step "${step.id}" must have a non-empty href` });
      return;
    }
    if (!step.href.trim().startsWith("/")) {
      res.status(400).json({ error: `Step "${step.id}" href must be a relative path starting with "/"` });
      return;
    }
    if (typeof step.enabled !== "boolean") {
      res.status(400).json({ error: `Step "${step.id}" must have a boolean enabled field` });
      return;
    }
  }
  const seenIds = new Set<string>();
  const normalized: OnboardingStepConfig[] = [];
  for (const step of steps) {
    if (seenIds.has(step.id)) continue;
    seenIds.add(step.id);
    normalized.push({
      id: step.id,
      label: step.label.trim(),
      href: step.href.trim(),
      enabled: step.enabled,
    });
  }
  for (const id of VALID_IDS) {
    if (!seenIds.has(id)) {
      normalized.push(DEFAULT_ONBOARDING_STEPS.find(s => s.id === id)!);
    }
  }
  await setDbSetting("onboarding_steps", JSON.stringify(normalized));
  res.json(normalized);
});

export default router;
