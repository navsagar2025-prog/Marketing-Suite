#!/bin/bash
# SEO Command — container startup script
# Runs on every container start:
#   1. Waits for PostgreSQL to accept connections (skipped for external/Supabase DB)
#   2. Pushes the Drizzle schema (creates/updates tables idempotently)
#   3. Starts nginx (serves the static frontend)
#   4. Starts the Node.js API server (foreground — Docker reads its logs)
set -euo pipefail

# ── 1. Wait for PostgreSQL (only for bundled/local postgres) ──────────────────
if [ -z "${SUPABASE_DATABASE_URL:-}" ]; then
  PGHOST="${PGHOST:-localhost}"
  PGPORT="${PGPORT:-5432}"
  PGUSER="${PGUSER:-postgres}"

  echo "[entrypoint] Waiting for PostgreSQL at ${PGHOST}:${PGPORT}..."
  until pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" >/dev/null 2>&1; do
    printf '.'
    sleep 1
  done
  echo ""
  echo "[entrypoint] PostgreSQL is ready."
else
  echo "[entrypoint] Using external database (SUPABASE_DATABASE_URL is set) — skipping pg_isready."
fi

# ── 2. Push Drizzle schema ─────────────────────────────────────────────────────
# Uses push-force (drizzle-kit push --force) — idempotent, safe to run on every boot.
echo "[entrypoint] Applying database schema..."
cd /app
pnpm --filter @workspace/db run push-force
echo "[entrypoint] Schema applied."

# ── 3. Start nginx (background) ───────────────────────────────────────────────
echo "[entrypoint] Starting nginx..."
nginx

# ── 4. Start the Node.js API server (foreground) ──────────────────────────────
echo "[entrypoint] Starting API server on port ${PORT:-8080}..."
exec node --enable-source-maps /app/artifacts/api-server/dist/index.mjs
