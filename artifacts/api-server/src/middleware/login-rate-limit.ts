import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, loginAttemptsTable } from "@workspace/db";

export async function loginRateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const now = new Date();

  const [attempt] = await db.select().from(loginAttemptsTable).where(eq(loginAttemptsTable.ip, ip));

  if (attempt?.lockedUntil) {
    if (attempt.lockedUntil > now) {
      const retryAfterSeconds = Math.ceil((attempt.lockedUntil.getTime() - now.getTime()) / 1000);
      res.status(429).json({
        error: `Too many login attempts. Try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).`,
        retryAfterSeconds,
        lockedUntil: attempt.lockedUntil.toISOString(),
      });
      return;
    }
    await db.delete(loginAttemptsTable).where(eq(loginAttemptsTable.ip, ip));
  }

  next();
}
