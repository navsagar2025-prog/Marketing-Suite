import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, staffUsersTable } from "@workspace/db";
import { signToken, requireAuth } from "../lib/auth.js";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const { username, password } = req.body as { username?: string; password?: string };
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
  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role, permissions },
  });
});

router.post("/auth/logout", (_req, res): void => {
  res.json({ ok: true });
});

router.get("/auth/me", requireAuth, (req, res): void => {
  const { id, username, role, permissions } = req.user!;
  res.json({ user: { id, username, role, permissions: permissions ?? null } });
});

export default router;
