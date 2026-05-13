#!/bin/sh
# SEO Command — container startup script
# Compatible with Alpine (sh, not bash).
# Runs on every container start:
#   1. Waits for PostgreSQL (skipped for external/Supabase DB)
#   2. Pushes the Drizzle schema (idempotent)
#   3. Starts nginx (serves the static frontend)
#   4. Starts the Node.js API server (foreground)
set -eu

# ── 1. Wait for PostgreSQL (bundled DB only) ──────────────────────────────────
if [ -z "${SUPABASE_DATABASE_URL:-}" ]; then
  _PG_HOST="${PGHOST:-localhost}"
  _PG_PORT="${PGPORT:-5432}"
  _PG_USER="${PGUSER:-postgres}"
  echo "[entrypoint] Waiting for PostgreSQL at ${_PG_HOST}:${_PG_PORT}..."
  until pg_isready -h "$_PG_HOST" -p "$_PG_PORT" -U "$_PG_USER" >/dev/null 2>&1; do
    printf '.'
    sleep 1
  done
  echo ""
  echo "[entrypoint] PostgreSQL is ready."
else
  echo "[entrypoint] External DB detected (SUPABASE_DATABASE_URL set) — skipping pg_isready."
fi

# ── 2. Push Drizzle schema ────────────────────────────────────────────────────
# drizzle-kit is in /schema-runner/node_modules (minimal ~80 MB install).
# Idempotent: safe to run on every startup.
echo "[entrypoint] Applying database schema..."
cd /app
node /schema-runner/node_modules/.bin/drizzle-kit push --force \
  --config ./lib/db/drizzle.config.ts
echo "[entrypoint] Schema applied."

# ── 3. Start nginx (background) ───────────────────────────────────────────────
echo "[entrypoint] Starting nginx..."
nginx

# ── 4. Start API server (foreground — Docker captures logs) ──────────────────
echo "[entrypoint] Starting API server on port ${PORT:-8080}..."
exec node --enable-source-maps /app/dist/index.mjs
