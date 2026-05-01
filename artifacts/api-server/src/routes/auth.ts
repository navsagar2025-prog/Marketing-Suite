import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, staffUsersTable } from "@workspace/db";
import { signToken, requireAuth } from "../lib/auth.js";

const VALID_PLANS = ["starter", "growth", "agency"] as const;
type Plan = (typeof VALID_PLANS)[number];

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const { username, password, plan } = req.body as { username?: string; password?: string; plan?: string };
  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  const [user] = await db.select().from(staffUsersTable).where(eq(staffUsersTable.username, username.trim().toLowerCase()));
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const permissions = user.role === "admin" ? null : (user.permissions ?? null);
  const token = signToken({ id: user.id, username: user.username, role: user.role, permissions });

  const requestedPlan =
    plan && VALID_PLANS.includes(plan as Plan) ? (plan as Plan) : null;

  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role, permissions, plan: user.plan },
    planSelected: requestedPlan,
    canSetPlan: requestedPlan !== null && user.plan === "starter",
  });
});

router.post("/auth/logout", (_req, res): void => {
  res.json({ ok: true });
});

router.post("/auth/plan", requireAuth, async (req, res): Promise<void> => {
  const { plan } = req.body as { plan?: string };
  if (!plan || !VALID_PLANS.includes(plan as Plan)) {
    res.status(400).json({ error: "Invalid plan" });
    return;
  }

  const [user] = await db.select().from(staffUsersTable).where(eq(staffUsersTable.id, req.user!.id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (user.plan !== "starter") {
    res.status(409).json({ error: "Plan already set. Use the upgrade flow to change tiers." });
    return;
  }

  await db
    .update(staffUsersTable)
    .set({ plan: plan as Plan })
    .where(eq(staffUsersTable.id, user.id));

  res.json({ plan: plan as Plan });
});

router.get("/auth/me", requireAuth, (req, res): void => {
  const { id, username, role, permissions } = req.user!;
  res.json({ user: { id, username, role, permissions: permissions ?? null } });
});

export default router;
