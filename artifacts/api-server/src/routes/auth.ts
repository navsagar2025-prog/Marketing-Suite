import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq, and, gt } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";
import { db, staffUsersTable, passwordResetTokensTable } from "@workspace/db";
import { signToken, requireAuth } from "../lib/auth.js";
import { getEmailProviderConfig, sendEmails } from "../lib/email-sender.js";

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

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { email } = req.body as { email?: string };
  if (!email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();

  const [user] = await db
    .select()
    .from(staffUsersTable)
    .where(eq(staffUsersTable.email, normalizedEmail));

  if (user) {
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db.insert(passwordResetTokensTable).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    try {
      const config = await getEmailProviderConfig();
      if (config) {
        const appUrl = process.env.APP_URL ?? `https://${process.env.REPL_SLUG ?? "localhost"}`;
        const resetLink = `${appUrl}/reset-password?token=${rawToken}`;
        const body = [
          `Hello ${user.username},`,
          "",
          "You requested a password reset for your SEO Command account.",
          "",
          `Reset your password here: ${resetLink}`,
          "",
          "This link expires in 1 hour.",
          "",
          "If you did not request this, you can safely ignore this email — your password will not change.",
        ].join("\n");

        await sendEmails(config, {
          to: [normalizedEmail],
          subject: "SEO Command — Password reset request",
          body,
        });
      }
    } catch {
      // Swallow send/config errors to avoid leaking whether an account exists
    }
  }

  res.json({ ok: true });
});

router.get("/auth/reset-password", async (req, res): Promise<void> => {
  const { token } = req.query as { token?: string };
  if (!token) {
    res.status(400).json({ valid: false, error: "Token is required" });
    return;
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const now = new Date();

  const [record] = await db
    .select()
    .from(passwordResetTokensTable)
    .where(
      and(
        eq(passwordResetTokensTable.tokenHash, tokenHash),
        eq(passwordResetTokensTable.used, false),
        gt(passwordResetTokensTable.expiresAt, now),
      )
    );

  if (!record) {
    res.status(400).json({ valid: false });
    return;
  }

  res.json({ valid: true });
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { token, password } = req.body as { token?: string; password?: string };
  if (!token || !password) {
    res.status(400).json({ error: "Token and password are required" });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const now = new Date();
  const passwordHash = await bcrypt.hash(password, 10);

  let resetDone = false;
  await db.transaction(async (tx) => {
    const consumed = await tx
      .update(passwordResetTokensTable)
      .set({ used: true })
      .where(
        and(
          eq(passwordResetTokensTable.tokenHash, tokenHash),
          eq(passwordResetTokensTable.used, false),
          gt(passwordResetTokensTable.expiresAt, now),
        )
      )
      .returning({ userId: passwordResetTokensTable.userId });

    if (consumed.length === 0) return;

    await tx
      .update(staffUsersTable)
      .set({ passwordHash })
      .where(eq(staffUsersTable.id, consumed[0].userId));

    resetDone = true;
  });

  if (!resetDone) {
    res.status(400).json({ error: "This reset link is invalid, expired, or has already been used." });
    return;
  }

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
