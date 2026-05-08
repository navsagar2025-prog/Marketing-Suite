import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { db, securityEventsTable, staffUsersTable, sessionsTable } from "@workspace/db";
import { requireAdmin, signToken, verifyToken } from "../lib/auth.js";
import { emitSecurityEvent, clientIp, clientUa } from "../lib/security-events.js";

const router: IRouter = Router();

router.get("/admin/security-events", requireAdmin, async (req, res): Promise<void> => {
  const { action, userId, since, until, format, limit } = req.query as Record<string, string | undefined>;
  const conds = [];
  if (action) conds.push(eq(securityEventsTable.action, action));
  if (userId) {
    const uid = parseInt(userId, 10);
    if (!isNaN(uid)) conds.push(eq(securityEventsTable.userId, uid));
  }
  if (since) {
    const d = new Date(since);
    if (!isNaN(d.getTime())) conds.push(gte(securityEventsTable.createdAt, d));
  }
  if (until) {
    const d = new Date(until);
    if (!isNaN(d.getTime())) conds.push(lte(securityEventsTable.createdAt, d));
  }
  const max = Math.min(parseInt(limit ?? "500", 10) || 500, 5000);
  const rows = await db
    .select()
    .from(securityEventsTable)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(securityEventsTable.createdAt))
    .limit(max);

  if (format === "csv") {
    const header = "id,created_at,action,user_id,actor_id,target,ip,user_agent,details\n";
    const esc = (v: unknown) => {
      if (v === null || v === undefined) return "";
      const s = typeof v === "string" ? v : JSON.stringify(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const body = rows.map(r => [
      r.id, r.createdAt.toISOString(), r.action, r.userId, r.actorId, r.target, r.ip, r.userAgent, r.details,
    ].map(esc).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="security-events.csv"`);
    res.send(header + body);
    return;
  }
  res.json(rows);
});

router.get("/admin/security-events/actions", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select({ action: securityEventsTable.action, count: sql<number>`count(*)::int` })
    .from(securityEventsTable)
    .groupBy(securityEventsTable.action)
    .orderBy(desc(sql`count(*)`));
  res.json(rows);
});

router.post("/admin/staff/:id/impersonate", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  if (req.user!.actorId) {
    res.status(400).json({ error: "Already impersonating. Stop impersonation first." });
    return;
  }
  if (id === req.user!.id) {
    res.status(400).json({ error: "Cannot impersonate yourself" });
    return;
  }
  const [target] = await db.select().from(staffUsersTable).where(eq(staffUsersTable.id, id));
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (target.role === "admin") {
    await emitSecurityEvent({
      action: "permission_denied",
      userId: req.user!.id,
      actorId: req.user!.id,
      target: `impersonate:staff:${target.id}`,
      ip: clientIp(req),
      userAgent: clientUa(req),
      details: { reason: "admin_target_blocked" },
    });
    res.status(403).json({ error: "Cannot impersonate another admin account" });
    return;
  }

  const ttlSeconds = 60 * 60;
  const jti = randomUUID();
  const permissions = target.role === "admin" ? null : (target.permissions ?? null);
  const token = signToken({
    id: target.id,
    username: target.username,
    role: target.role,
    permissions,
    jti,
    actorId: req.user!.id,
    actorUsername: req.user!.username,
  }, ttlSeconds);

  await db.insert(sessionsTable).values({
    userId: target.id,
    jti,
    device: `Impersonated by ${req.user!.username}`,
    ip: clientIp(req),
    userAgent: clientUa(req),
    expiresAt: new Date(Date.now() + ttlSeconds * 1000),
  });

  await emitSecurityEvent({
    action: "impersonation_start",
    userId: target.id,
    actorId: req.user!.id,
    target: `staff:${target.id}`,
    ip: clientIp(req),
    userAgent: clientUa(req),
    details: { actorUsername: req.user!.username, targetUsername: target.username },
  });

  res.json({
    token,
    user: { id: target.id, username: target.username, role: target.role, permissions, plan: target.plan },
    actor: { id: req.user!.id, username: req.user!.username },
  });
});

router.post("/auth/stop-impersonate", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  const tokenStr = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const payload = tokenStr ? verifyToken(tokenStr) : null;
  if (!payload || !payload.actorId) {
    res.status(400).json({ error: "Not impersonating" });
    return;
  }
  // Revoke the impersonation session
  if (payload.jti) {
    await db.update(sessionsTable).set({ revokedAt: new Date() }).where(eq(sessionsTable.jti, payload.jti));
  }

  // Re-load actor (admin) and mint a fresh session for them
  const [actor] = await db.select().from(staffUsersTable).where(eq(staffUsersTable.id, payload.actorId));
  if (!actor) {
    res.status(404).json({ error: "Actor account not found" });
    return;
  }

  const ttlSeconds = 60 * 60 * 24;
  const jti = randomUUID();
  const permissions = actor.role === "admin" ? null : (actor.permissions ?? null);
  const newToken = signToken({
    id: actor.id, username: actor.username, role: actor.role, permissions, jti,
  }, ttlSeconds);

  await db.insert(sessionsTable).values({
    userId: actor.id,
    jti,
    device: "Restored from impersonation",
    ip: clientIp(req),
    userAgent: clientUa(req),
    expiresAt: new Date(Date.now() + ttlSeconds * 1000),
  });

  await emitSecurityEvent({
    action: "impersonation_stop",
    userId: payload.id,
    actorId: actor.id,
    target: `staff:${payload.id}`,
    ip: clientIp(req),
    userAgent: clientUa(req),
  });

  res.json({
    token: newToken,
    user: { id: actor.id, username: actor.username, role: actor.role, permissions, plan: actor.plan },
  });
});

export default router;
