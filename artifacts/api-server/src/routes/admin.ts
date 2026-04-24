import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq, desc } from "drizzle-orm";
import { db, staffUsersTable, ipRateLimitsTable, ipAllowlistTable } from "@workspace/db";
import { requireAdmin } from "../lib/auth.js";

const router: IRouter = Router();

router.use(requireAdmin);

router.get("/admin/audit-requests", async (_req, res): Promise<void> => {
  const requests = await db
    .select()
    .from(ipRateLimitsTable)
    .orderBy(desc(ipRateLimitsTable.lastRequestAt))
    .limit(200);
  res.json(requests);
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

export default router;
