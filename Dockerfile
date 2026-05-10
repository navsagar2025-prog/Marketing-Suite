###############################################################################
# SEO Command — multi-stage production Dockerfile
#
# Stages:
#   1. builder  — installs all deps, builds API (esbuild) and frontend (Vite)
#   2. production — slim runtime with nginx + Node.js
#
# Build:
#   docker build -t seo-command .
#   # or via docker compose (recommended):
#   docker compose up --build
###############################################################################

###############################################################################
# Stage 1 — builder
###############################################################################
FROM node:22-slim AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm

WORKDIR /app

# ── Copy workspace manifests first (better layer caching) ─────────────────
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc \
     tsconfig.base.json tsconfig.json ./

# lib packages
COPY lib/db/package.json                            lib/db/
COPY lib/api-zod/package.json                       lib/api-zod/
COPY lib/api-spec/package.json                      lib/api-spec/
COPY lib/api-client-react/package.json              lib/api-client-react/
COPY lib/integrations-openai-ai-server/package.json lib/integrations-openai-ai-server/
COPY lib/integrations-openai-ai-react/package.json  lib/integrations-openai-ai-react/

# scripts + artifact manifests
COPY scripts/package.json                           scripts/
COPY artifacts/api-server/package.json              artifacts/api-server/
COPY artifacts/marketing-hub/package.json           artifacts/marketing-hub/
COPY artifacts/mockup-sandbox/package.json          artifacts/mockup-sandbox/

# Install all dependencies (including devDeps needed for build tools)
RUN pnpm install --frozen-lockfile

# ── Copy full source ───────────────────────────────────────────────────────
COPY lib/                        lib/
COPY scripts/                    scripts/
COPY artifacts/api-server/       artifacts/api-server/
COPY artifacts/marketing-hub/    artifacts/marketing-hub/
COPY artifacts/mockup-sandbox/   artifacts/mockup-sandbox/
# attached_assets is referenced by the @assets vite alias
COPY attached_assets/            attached_assets/

# ── Build API server (esbuild bundles everything to dist/) ─────────────────
RUN pnpm --filter @workspace/api-server run build

# ── Build frontend (Vite — produces dist/public/) ─────────────────────────
# BASE_PATH=/ means the app lives at the root URL; /api/* calls hit nginx proxy
ARG BASE_PATH=/
ENV BASE_PATH=${BASE_PATH}
ENV NODE_ENV=production
RUN pnpm --filter @workspace/marketing-hub run build

###############################################################################
# Stage 2 — production runtime
###############################################################################
FROM node:22-slim AS production

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm

# nginx (static files + reverse proxy) and postgresql-client (health check)
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      nginx \
      postgresql-client \
      ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Re-install dependencies for the production container ──────────────────
# We do a full install (not --prod) so that drizzle-kit is available for
# the schema push that runs on each container start.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc \
     tsconfig.base.json tsconfig.json ./

COPY lib/db/package.json                            lib/db/
COPY lib/api-zod/package.json                       lib/api-zod/
COPY lib/api-spec/package.json                      lib/api-spec/
COPY lib/api-client-react/package.json              lib/api-client-react/
COPY lib/integrations-openai-ai-server/package.json lib/integrations-openai-ai-server/
COPY lib/integrations-openai-ai-react/package.json  lib/integrations-openai-ai-react/

COPY scripts/package.json                           scripts/
COPY artifacts/api-server/package.json              artifacts/api-server/
COPY artifacts/marketing-hub/package.json           artifacts/marketing-hub/
COPY artifacts/mockup-sandbox/package.json          artifacts/mockup-sandbox/

RUN pnpm install --frozen-lockfile

# ── Copy lib source (drizzle schema lives in lib/db/src/schema/) ──────────
COPY lib/ lib/

# ── Copy built API server from builder ────────────────────────────────────
COPY --from=builder /app/artifacts/api-server/dist artifacts/api-server/dist/

# ── Copy built frontend to nginx webroot ──────────────────────────────────
COPY --from=builder /app/artifacts/marketing-hub/dist/public /var/www/html/

# ── Nginx configuration ───────────────────────────────────────────────────
COPY docker/nginx.conf /etc/nginx/sites-available/seocommand
RUN rm -f /etc/nginx/sites-enabled/default \
 && ln -s /etc/nginx/sites-available/seocommand /etc/nginx/sites-enabled/seocommand

# ── Startup script ────────────────────────────────────────────────────────
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

ENV NODE_ENV=production
# API server listens on this internal port; nginx proxies /api/* to it
ENV PORT=8080

ENTRYPOINT ["/entrypoint.sh"]
