import { defineConfig } from "drizzle-kit";
import path from "path";

const rawUrl = process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL;

if (!rawUrl) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

function sanitizeUrl(url: string): string {
  try {
    return new URL(url).toString();
  } catch {
    const m = url.match(/^(postgresql|postgres):\/\/([^:]+):([^@]+)@(.+)$/);
    if (m) {
      const [, scheme, user, pass, rest] = m;
      return `${scheme}://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${rest}`;
    }
    return url;
  }
}

const url = sanitizeUrl(rawUrl);

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url,
    ssl: process.env.SUPABASE_DATABASE_URL ? "require" : undefined,
  },
});
