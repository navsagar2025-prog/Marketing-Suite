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
- **AI**: Multi-provider via central `callAI()` service — supports Replit Default (free), OpenAI, Anthropic, Perplexity, Google Gemini; configured in Settings UI

## Artifacts

- `artifacts/api-server` — Express API server (port via `PORT` env, dev: 8080)
- `artifacts/marketing-hub` — React+Vite frontend (port via `PORT` env)

## API Routes

- `GET/POST /api/websites` — Website management
- `GET/PATCH/DELETE /api/websites/:id`
- `GET/POST /api/keywords` — Keyword tracking
- `PATCH/DELETE /api/keywords/:id` — Update/delete keyword
- `GET /api/keywords/:id/history?days=90` — Rank history (default 90 days)
- `POST /api/admin/keywords/snapshot` — Capture rank snapshot for all keywords now (admin only)
- `GET/POST/PATCH/DELETE /api/campaigns` — Campaign management
- `GET/POST/PATCH/DELETE /api/social-posts` — Social media posts
- `GET/POST/PATCH/DELETE /api/backlinks` — Backlink tracking
- `GET/POST/PATCH/DELETE /api/leads` — Lead management
- `GET/POST /api/conversations` — Conversation management (AI lead qualification)
- `GET /api/conversations/:id/messages` — Get messages for a conversation
- `POST /api/conversations/:id/messages` — Send user message + get AI reply
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
- `GET /api/admin/audit-requests` — List all public audit rate-limit records (admin only)
- `GET /api/admin/visitor-stats` — Aggregated visitor stats: unique IPs today, total audits today/all-time, IPs at daily limit, 14-day daily volume (admin only)
- `GET /api/admin/allowlist` — Manage IP allowlist (admin only)
- `GET /api/admin/staff` — Manage staff accounts (admin only)
- `GET /api/settings` — Get app settings (falApiKeyConfigured, aiProvider, aiModel, aiEnabled, aiApiKeyConfigured)
- `PATCH /api/settings` — Update settings (falApiKey, aiProvider, aiModel, aiEnabled, aiApiKey)
- `POST /api/settings/test-ai` — Test the configured AI provider connection
- `POST /api/websites/detect` — Auto-detect niche/SEO score from URL via crawl + AI
- `POST /api/websites/:id/audit` — Run full SEO audit (crawl URL + AI analysis, store snapshot)
- `GET /api/websites/:id/audits` — List audit history for a website
- `POST /api/ai/fix-issue` — AI-generated fix for a specific SEO audit issue

## Database Schema (lib/db)

Tables: `websites`, `keywords`, `keyword_rank_history`, `social_posts`, `campaigns`, `backlinks`, `leads`, `conversations`, `messages`, `media_assets`, `app_settings`, `seo_audits`, `link_suggestions`, `competitor_analyses`

### keyword_rank_history table
- `id`: serial PK
- `keywordId`: FK → keywords (cascade delete)
- `rank`: integer (nullable)
- `recordedDate`: date (YYYY-MM-DD)
- `createdAt`: timestamp
- Unique constraint: (keywordId, recordedDate) — one snapshot per keyword per day
- Daily cron at 00:00 UTC auto-populates from `keywords.currentRank`

### seo_audits table
- `id`: serial PK
- `websiteId`: FK → websites (cascade delete)
- `score`: integer (0-100)
- `issuesJson`: jsonb (array of SEO issues)
- `crawledData`: jsonb (raw crawl data snapshot)
- `crawledAt`: timestamp

### leads table
- `score`: integer (nullable) — computed lead score 0–100
- `scoreBreakdown`: jsonb (nullable) — breakdown object `{sourcePoints, statusPoints, valuePoints, recencyPoints, total}`
- Scoring engine: `artifacts/api-server/src/lib/lead-scoring.ts`
- Auto-scored on create/update via `leads.ts` routes
- Config stored in `app_settings` under key `lead_scoring_config` (JSON)
- Admin endpoints: `GET/PATCH /api/admin/lead-scoring-config`, `POST /api/admin/leads/recalculate-scores`
- Default weights: source {paid:30, referral:25, social:20, organic:15, direct:10}, status {qualified:30, contacted:20, new:10}, valueTier {over1000:20, over500:15, over100:10, over0:5}, recencyBonus:10
- High-intent threshold: score ≥ 70 (used in analytics summary `highIntentLeads` count and frontend filter)

### link_suggestions table
- `id`: serial PK
- `websiteId`: FK → websites (cascade delete)
- `sourcePage`, `targetPage`, `anchorText`, `reason`: text fields
- `createdAt`: timestamp
- Populated by `POST /api/websites/:id/link-suggestions` (AI-powered)

### competitor_analyses table
- `id`: serial PK
- `websiteId`: FK → websites (cascade delete)
- `competitorUrl`: text — the competitor site URL
- `analysisJson`: jsonb — `{ summary: string, gapKeywords: [{keyword, reason}] }` once analysed
- `createdAt`: timestamp
- Max 3 competitors per website enforced at API level
- Gap analysis via `POST /api/websites/:id/competitors/:competitorId/analyse` (crawl + AI)

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
