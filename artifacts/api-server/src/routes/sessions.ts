import { Router, type IRouter } from "express";
import { eq, and, desc, isNull, ne } from "drizzle-orm";
import { db, sessionsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";
import { emitSecurityEvent, clientIp, clientUa } from "../lib/security-events.js";

const router: IRouter = Router();

router.use(requireAuth);

router.get("/sessions", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: sessionsTable.id,
      jti: sessionsTable.jti,
      device: sessionsTable.device,
      ip: sessionsTable.ip,
      userAgent: sessionsTable.userAgent,
      createdAt: sessionsTable.createdAt,
      lastSeenAt: sessionsTable.lastSeenAt,
      expiresAt: sessionsTable.expiresAt,
    })
    .from(sessionsTable)
    .where(and(eq(sessionsTable.userId, req.user!.id), isNull(sessionsTable.revokedAt)))
    .orderBy(desc(sessionsTable.lastSeenAt));

  res.json(rows.map(r => ({ ...r, current: r.jti === req.user!.jti })));
});

router.delete("/sessions/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [updated] = await db
    .update(sessionsTable)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessionsTable.id, id), eq(sessionsTable.userId, req.user!.id), isNull(sessionsTable.revokedAt)))
    .returning({ id: sessionsTable.id, jti: sessionsTable.jti });
  if (!updated) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  await emitSecurityEvent({
    action: "session_revoke",
    userId: req.user!.id,
    actorId: req.user!.actorId,
    target: String(updated.id),
    ip: clientIp(req),
    userAgent: clientUa(req),
  });
  res.json({ ok: true });
});

router.post("/sessions/revoke-all", async (req, res): Promise<void> => {
  const updated = await db
    .update(sessionsTable)
    .set({ revokedAt: new Date() })
    .where(and(
      eq(sessionsTable.userId, req.user!.id),
      isNull(sessionsTable.revokedAt),
      ne(sessionsTable.jti, req.user!.jti),
    ))
    .returning({ id: sessionsTable.id });
  await emitSecurityEvent({
    action: "session_revoke_all",
    userId: req.user!.id,
    actorId: req.user!.actorId,
    ip: clientIp(req),
    userAgent: clientUa(req),
    details: { revokedCount: updated.length },
  });
  res.json({ revokedCount: updated.length });
});

export default router;
