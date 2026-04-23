# Workspace

## Overview

pnpm workspace monorepo using TypeScript. This project is an SEO & Marketing Command Center — a full-stack app for managing multiple websites' SEO, social media, campaigns, backlinks, and lead generation, with AI-powered content tools.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind + shadcn/ui
- **Charts**: Recharts
- **AI**: OpenAI (gpt-4.1) via Replit AI Integrations

## Artifacts

- `artifacts/api-server` — Express API server (port via `PORT` env, dev: 8080)
- `artifacts/marketing-hub` — React+Vite frontend (port via `PORT` env)

## API Routes

- `GET/POST /api/websites` — Website management
- `GET/PATCH/DELETE /api/websites/:id`
- `GET/POST /api/keywords` — Keyword tracking
- `GET/POST/PATCH/DELETE /api/campaigns` — Campaign management
- `GET/POST/PATCH/DELETE /api/social-posts` — Social media posts
- `GET/POST/PATCH/DELETE /api/backlinks` — Backlink tracking
- `GET/POST/PATCH/DELETE /api/leads` — Lead management
- `GET /api/analytics/summary` — Dashboard stats
- `GET /api/analytics/website/:id` — Per-site analytics
- `GET /api/analytics/campaigns` — Campaign performance
- `GET /api/analytics/leads-funnel` — Leads funnel breakdown
- `POST /api/ai/suggest-keywords` — AI keyword suggestions
- `POST /api/ai/generate-post` — AI social post generator
- `POST /api/ai/generate-meta` — AI meta tag generator
- `POST /api/ai/generate-campaign-copy` — AI ad copy generator
- `POST /api/ai/generate-seo-brief` — AI SEO content brief
- `POST /api/ai/generate-image` — AI image generation (Fal.ai flux/schnell)
- `POST /api/ai/generate-video` — AI video generation (Fal.ai kling-video v2.1)
- `GET /api/media-assets` — List saved media assets (filter by websiteId/campaignId/type)
- `POST /api/media-assets` — Save a media asset record
- `DELETE /api/media-assets/:id` — Delete a media asset
- `GET /api/settings` — Get app settings (falApiKeyConfigured boolean)
- `PATCH /api/settings` — Update settings (set/remove falApiKey)
- `POST /api/websites/detect` — Auto-detect niche/SEO score from URL via crawl + AI
- `POST /api/websites/:id/audit` — Run full SEO audit (crawl URL + AI analysis, store snapshot)
- `GET /api/websites/:id/audits` — List audit history for a website
- `POST /api/ai/fix-issue` — AI-generated fix for a specific SEO audit issue

## Database Schema (lib/db)

Tables: `websites`, `keywords`, `social_posts`, `campaigns`, `backlinks`, `leads`, `conversations`, `messages`, `media_assets`, `app_settings`, `seo_audits`

### seo_audits table
- `id`: serial PK
- `websiteId`: FK → websites (cascade delete)
- `score`: integer (0-100)
- `issuesJson`: jsonb (array of SEO issues)
- `crawledData`: jsonb (raw crawl data snapshot)
- `crawledAt`: timestamp

## Important Notes

- PostgreSQL `numeric` columns (`budget`, `spend`, `value`) return as strings from node-postgres; must call `parseFloat(String(val))` before Zod parsing
- Social platform icons use `lucide-react` (not `react-icons/si` which lacks some icons)
- Sidebar nav uses `Link` from `wouter` — do not nest `<a>` inside `<Link>`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
