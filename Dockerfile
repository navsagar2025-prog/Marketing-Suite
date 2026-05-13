###############################################################################
# SEO Command — MINIMAL multi-stage Dockerfile
#
# Uses Alpine Linux throughout to keep the final image as small as possible.
# The API server is fully bundled by esbuild (zero runtime node_modules needed).
# Only drizzle-kit + drizzle-orm + pg are installed in the production image
# (for the startup schema migration).
#
# Build:
#   docker build -t seocommand .
# Run:
#   docker compose up --build
###############################################################################

###############################################################################
# Stage 1 — builder  (Alpine + full deps + esbuild + Vite)
###############################################################################
FROM node:22-alpine AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm

WORKDIR /app

# ── Copy workspace manifests (layer-cache friendly) ───────────────────────────
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

# ── Copy full source ───────────────────────────────────────────────────────────
COPY lib/                        lib/
COPY scripts/                    scripts/
COPY artifacts/api-server/       artifacts/api-server/
COPY artifacts/marketing-hub/    artifacts/marketing-hub/
COPY attached_assets/            attached_assets/

# ── Build API (esbuild bundles everything — zero runtime node_modules needed) ──
RUN pnpm --filter @workspace/api-server run build

# ── Build frontend (Vite) ──────────────────────────────────────────────────────
ARG BASE_PATH=/
ENV BASE_PATH=${BASE_PATH}
ENV NODE_ENV=production
RUN pnpm --filter @workspace/marketing-hub run build

# ── Create minimal schema-runner (drizzle-kit + drizzle-orm + pg only) ────────
# Replaces the 641 MB full node_modules with ~80 MB of migration-only packages.
# Versions are read from the already-installed pnpm store for exact consistency.
WORKDIR /schema-runner
# Versions pinned to match pnpm-lock.yaml (drizzle-kit@0.31.9, drizzle-orm@0.45.2, pg@8.20.0)
RUN npm init -y && \
    npm install --save \
      drizzle-kit@0.31.9 \
      drizzle-orm@0.45.2 \
      pg@8.20.0 \
    2>&1 | tail -3

###############################################################################
# Stage 2 — production (Alpine + nginx, NO pnpm, NO source)
###############################################################################
FROM node:22-alpine AS production

# nginx for static serving + reverse proxy
# postgresql-client for the pg_isready healthcheck in entrypoint (bundled DB mode)
RUN apk add --no-cache nginx postgresql-client

WORKDIR /app

# ── Schema-runner (drizzle-kit + drizzle-orm + pg — ~80 MB) ──────────────────
COPY --from=builder /schema-runner /schema-runner
# lib/db schema files (TypeScript — drizzle-kit compiles them internally)
COPY --from=builder /app/lib/db/drizzle.config.ts  lib/db/drizzle.config.ts
COPY --from=builder /app/lib/db/src/               lib/db/src/

# ── API server (single bundled file — no node_modules needed) ─────────────────
COPY --from=builder /app/artifacts/api-server/dist/index.mjs   dist/index.mjs
COPY --from=builder /app/artifacts/api-server/dist/pino-worker.mjs     dist/pino-worker.mjs
COPY --from=builder /app/artifacts/api-server/dist/pino-file.mjs       dist/pino-file.mjs
COPY --from=builder /app/artifacts/api-server/dist/pino-pretty.mjs     dist/pino-pretty.mjs
COPY --from=builder /app/artifacts/api-server/dist/thread-stream-worker.mjs dist/thread-stream-worker.mjs

# ── Frontend → nginx webroot ───────────────────────────────────────────────────
COPY --from=builder /app/artifacts/marketing-hub/dist/public /var/www/html/

# ── nginx config ──────────────────────────────────────────────────────────────
COPY docker/nginx.conf /etc/nginx/http.d/seocommand.conf
# Remove default site
RUN rm -f /etc/nginx/http.d/default.conf

# ── Startup entrypoint ─────────────────────────────────────────────────────────
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

ENV NODE_ENV=production
ENV PORT=8080

ENTRYPOINT ["/entrypoint.sh"]
