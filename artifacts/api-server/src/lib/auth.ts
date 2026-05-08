import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { db, sessionsTable } from "@workspace/db";
import { logger } from "./logger.js";
import { emitSecurityEvent, clientIp, clientUa } from "./security-events.js";

const JWT_SECRET = process.env.SESSION_SECRET;

if (!JWT_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required for JWT signing but was not set.");
}

export interface JwtPayload {
  id: number;
  username: string;
  role: "admin" | "staff";
  permissions?: string[] | null;
  jti: string;
  actorId?: number;
  actorUsername?: string;
}

export function signToken(payload: JwtPayload, ttlSeconds: number): string {
  return jwt.sign(payload, JWT_SECRET!, { expiresIn: ttlSeconds });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET!) as JwtPayload;
  } catch {
    return null;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

const lastSeenCache = new Map<string, number>();
const LAST_SEEN_THROTTLE_MS = 60_000;

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const payload = verifyToken(token);
  if (!payload || !payload.jti) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  try {
    const [session] = await db
      .select()
      .from(sessionsTable)
      .where(and(eq(sessionsTable.jti, payload.jti), isNull(sessionsTable.revokedAt)));
    if (!session) {
      res.status(401).json({ error: "Session revoked or expired" });
      return;
    }
    if (session.expiresAt.getTime() < Date.now()) {
      res.status(401).json({ error: "Session expired" });
      return;
    }
    const now = Date.now();
    const last = lastSeenCache.get(payload.jti) ?? 0;
    if (now - last > LAST_SEEN_THROTTLE_MS) {
      lastSeenCache.set(payload.jti, now);
      db.update(sessionsTable)
        .set({ lastSeenAt: new Date(now), ip: clientIp(req), userAgent: clientUa(req) })
        .where(eq(sessionsTable.id, session.id))
        .catch((err) => logger.warn({ err }, "Failed to update session last_seen"));
    }
  } catch (err) {
    logger.error({ err }, "Session validation error");
    res.status(500).json({ error: "Auth backend error" });
    return;
  }

  req.user = payload;
  next();
}

export async function isAuthedRequest(req: Request): Promise<boolean> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return false;
  const payload = verifyToken(token);
  if (!payload || !payload.jti) return false;
  try {
    const [session] = await db
      .select()
      .from(sessionsTable)
      .where(and(eq(sessionsTable.jti, payload.jti), isNull(sessionsTable.revokedAt)));
    if (!session) return false;
    if (session.expiresAt.getTime() < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  void requireAuth(req, res, () => {
    if (req.user?.role !== "admin") {
      void emitSecurityEvent({
        action: "permission_denied",
        userId: req.user?.id,
        actorId: req.user?.actorId,
        target: "admin",
        ip: clientIp(req),
        userAgent: clientUa(req),
      });
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  });
}

export function requirePermission(module: string) {
  return requireAnyPermission(module);
}

export function requireAnyPermission(...modules: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (req.user.role === "admin") {
      next();
      return;
    }
    if (req.user.permissions == null) {
      next();
      return;
    }
    if (modules.some(m => req.user!.permissions!.includes(m))) {
      next();
      return;
    }
    void emitSecurityEvent({
      action: "permission_denied",
      userId: req.user.id,
      actorId: req.user.actorId,
      target: modules.join(","),
      ip: clientIp(req),
      userAgent: clientUa(req),
    });
    res.status(403).json({ error: `Permission denied: requires one of ${modules.join(", ")}` });
  };
}
