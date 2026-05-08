import type { Request } from "express";
import { db, securityEventsTable } from "@workspace/db";
import { logger } from "./logger.js";

export type SecurityAction =
  | "login_success"
  | "login_failure"
  | "login_lockout"
  | "logout"
  | "password_reset_request"
  | "password_reset_complete"
  | "permission_denied"
  | "session_revoke"
  | "session_revoke_all"
  | "impersonation_start"
  | "impersonation_stop"
  | "staff_create"
  | "staff_delete"
  | "staff_update";

export interface EmitOpts {
  action: SecurityAction;
  userId?: number | null;
  actorId?: number | null;
  target?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown> | null;
}

export function clientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

export function clientUa(req: Request): string {
  return (req.headers["user-agent"] ?? "").toString().slice(0, 512);
}

export async function emitSecurityEvent(opts: EmitOpts): Promise<void> {
  try {
    await db.insert(securityEventsTable).values({
      action: opts.action,
      userId: opts.userId ?? null,
      actorId: opts.actorId ?? null,
      target: opts.target ?? null,
      ip: opts.ip ?? null,
      userAgent: opts.userAgent ?? null,
      details: opts.details ?? null,
    });
  } catch (err) {
    logger.error({ err, action: opts.action }, "Failed to write security event");
  }
}
