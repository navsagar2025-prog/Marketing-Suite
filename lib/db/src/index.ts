import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const rawUrl = process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL;

if (!rawUrl) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

function sanitizeConnectionUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.toString();
  } catch {
    const m = url.match(/^(postgresql|postgres):\/\/([^:]+):([^@]+)@(.+)$/);
    if (m) {
      const [, scheme, user, pass, rest] = m;
      return `${scheme}://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${rest}`;
    }
    return url;
  }
}

const connectionString = sanitizeConnectionUrl(rawUrl);
const isSupabase = !!process.env.SUPABASE_DATABASE_URL;

export const pool = new Pool({
  connectionString,
  ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
