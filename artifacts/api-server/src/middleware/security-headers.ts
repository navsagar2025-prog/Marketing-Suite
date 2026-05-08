import type { Request, Response, NextFunction } from "express";
import { randomBytes } from "node:crypto";

declare global {
  namespace Express {
    interface Request {
      cspNonce?: string;
    }
  }
}

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  const nonce = randomBytes(16).toString("base64");
  req.cspNonce = nonce;

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");

  res.setHeader("Content-Security-Policy", csp);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  res.setHeader("X-CSP-Nonce", nonce);
  next();
}
