#!/usr/bin/env bash
# scripts/setup.sh — one-command local dev setup for SEO & Marketing Hub
# Usage: bash scripts/setup.sh

set -euo pipefail

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
RESET="\033[0m"

step()  { echo -e "\n${BOLD}▶ $*${RESET}"; }
ok()    { echo -e "  ${GREEN}✓${RESET} $*"; }
warn()  { echo -e "  ${YELLOW}⚠${RESET}  $*"; }
die()   { echo -e "\n${RED}✗ $*${RESET}\n" >&2; exit 1; }

echo -e "${BOLD}SEO & Marketing Hub — local dev setup${RESET}"
echo "────────────────────────────────────────"

# ── 1. Check required tools ──────────────────────────────────────────────────
step "Checking required tools"

if ! command -v node &>/dev/null; then
  die "Node.js is not installed. Install Node.js 20 LTS or later: https://nodejs.org"
fi
NODE_VER=$(node --version | sed 's/v//')
NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 20 ]; then
  die "Node.js $NODE_VER is too old. Node.js 20 LTS or later is required."
fi
ok "Node.js $NODE_VER"

if ! command -v pnpm &>/dev/null; then
  die "pnpm is not installed. Install it with: npm install -g pnpm"
fi
ok "pnpm $(pnpm --version)"

if ! command -v psql &>/dev/null; then
  warn "psql not found. Make sure PostgreSQL 15+ is installed and running."
else
  ok "psql $(psql --version | awk '{print $3}')"
fi

# ── 2. Copy .env.example → .env ──────────────────────────────────────────────
step "Environment file"

ENV_JUST_CREATED=false
if [ -f ".env" ]; then
  ok ".env already exists — skipping copy"
else
  if [ ! -f ".env.example" ]; then
    die ".env.example not found. Run this script from the project root."
  fi
  cp .env.example .env
  ok "Copied .env.example → .env"
  ENV_JUST_CREATED=true
fi

# Load env vars (silently; ignore errors for unset variables)
if [ -f ".env" ]; then
  set -a
  # shellcheck disable=SC1091
  source .env 2>/dev/null || true
  set +a
fi

# Detect placeholder DATABASE_URL
PLACEHOLDER_URL="postgresql://postgres:password@localhost:5432/marketing_hub"
DB_URL_IS_PLACEHOLDER=false
if [ "${DATABASE_URL:-}" = "$PLACEHOLDER_URL" ] || [ "${DATABASE_URL:-}" = "" ]; then
  DB_URL_IS_PLACEHOLDER=true
fi
if [ -z "${DATABASE_URL:-}" ] && [ -z "${SUPABASE_DATABASE_URL:-}" ]; then
  DB_URL_IS_PLACEHOLDER=true
fi

if [ "$ENV_JUST_CREATED" = true ]; then
  echo ""
  echo -e "  ${BOLD}Action required — edit .env before continuing:${RESET}"
  echo "    DATABASE_URL   → your PostgreSQL connection string"
  echo "    SESSION_SECRET → run:  openssl rand -hex 32"
  echo "    ADMIN_PASSWORD → choose a login password"
  echo "    APP_URL        → http://localhost:5000 for local dev"
fi

# ── 3. Install dependencies ───────────────────────────────────────────────────
step "Installing dependencies (pnpm install)"
pnpm install
ok "Dependencies installed"

# ── 4. Run database migration ─────────────────────────────────────────────────
step "Database migration"

if [ "$DB_URL_IS_PLACEHOLDER" = true ]; then
  warn "DATABASE_URL is not configured (still contains the placeholder value)."
  warn "Edit .env and set a real DATABASE_URL, then run:"
  warn "  pnpm --filter @workspace/db run push"
else
  echo "  Running pnpm --filter @workspace/db run push ..."
  MIGRATION_OK=true
  if pnpm --filter @workspace/db run push; then
    ok "Database schema pushed"
  else
    MIGRATION_OK=false
    echo ""
    warn "Migration failed. Common causes:"
    warn "  • PostgreSQL is not running"
    warn "  • DATABASE_URL credentials are wrong"
    warn "  • The database does not exist (create it with: createdb <dbname>)"
    warn "Once resolved, re-run: pnpm --filter @workspace/db run push"
  fi
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "────────────────────────────────────────"
if [ "${MIGRATION_OK:-true}" = false ] || [ "$DB_URL_IS_PLACEHOLDER" = true ]; then
  echo -e "${BOLD}${YELLOW}Setup finished with warnings (see above).${RESET}"
else
  echo -e "${BOLD}${GREEN}Setup complete!${RESET}"
fi
echo ""
echo "Next steps:"
if [ "$DB_URL_IS_PLACEHOLDER" = true ]; then
  echo "  1. Edit .env — fill in DATABASE_URL, SESSION_SECRET, ADMIN_PASSWORD"
  echo "  2. Push the schema:         pnpm --filter @workspace/db run push"
  echo "  3. Start the API server:    PORT=5000 pnpm --filter @workspace/api-server run dev"
  echo "  4. Start the frontend:      PORT=5173 BASE_PATH=/ pnpm --filter @workspace/marketing-hub run dev"
  echo "  5. Open http://localhost:5173 in your browser"
else
  echo "  1. Start the API server:    PORT=5000 pnpm --filter @workspace/api-server run dev"
  echo "  2. Start the frontend:      PORT=5173 BASE_PATH=/ pnpm --filter @workspace/marketing-hub run dev"
  echo "  3. Open http://localhost:5173 in your browser"
fi
echo ""
