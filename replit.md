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
- `GET /api/admin/staff` — List staff accounts with permissions (admin only)
- `POST /api/admin/staff` — Create staff account; accepts `permissions: string[] | null` (admin only)
- `PATCH /api/admin/users/:id/permissions` — Update per-module permissions for a staff user (admin only); `null` = full access
- `DELETE /api/admin/staff/:id` — Delete staff account (admin only)
- `GET /api/settings` — Get app settings (falApiKeyConfigured, aiProvider, aiModel, aiEnabled, aiApiKeyConfigured)
- `PATCH /api/settings` — Update settings (falApiKey, aiProvider, aiModel, aiEnabled, aiApiKey)
- `POST /api/settings/test-ai` — Test the configured AI provider connection
- `GET /api/settings/payment` — Get payment gateway settings (admin only; returns provider, currency, key statuses)
- `POST /api/settings/payment` — Update payment gateway settings (admin only; accepts stripePublishableKey, stripeSecretKey, stripeWebhookSecret, razorpayKeyId, razorpayKeySecret, provider, currency; secret keys encrypted at rest; Stripe currencies: usd/gbp/eur, Razorpay: inr)
- `POST /api/settings/payment/test` — Test active payment provider connection (stripe: balance.retrieve; razorpay: payments.all)
- `POST /api/websites/detect` — Auto-detect niche/SEO score from URL via crawl + AI
- `POST /api/websites/:id/audit` — Run full SEO audit (crawl URL + AI analysis, store snapshot)
- `GET /api/websites/:id/audits` — List audit history for a website
- `POST /api/ai/fix-issue` — AI-generated fix for a specific SEO audit issue
- `GET /api/reports` — List all client reports (analytics permission)
- `GET /api/reports/:id` — Get single report with full snapshot
- `POST /api/reports` — Generate and save a new report (body: websiteId, title, dateRangeStart, dateRangeEnd, sections[])
- `DELETE /api/reports/:id` — Delete a report
- `GET /public/report/:token` — Public report access by share token (no auth required)
- `GET /api/billing/me` — Get current user's plan, limits, and monthly usage counts (websites, keywords, campaigns, AI generations); plan is display-only (set via DB/admin)

## Database Schema (lib/db)

Tables: `websites`, `keywords`, `keyword_rank_history`, `social_posts`, `campaigns`, `backlinks`, `leads`, `conversations`, `messages`, `media_assets`, `app_settings`, `seo_audits`, `link_suggestions`, `competitor_analyses`, `staff_users`, `client_reports`

### staff_users.plan
- `plan`: pgEnum `staff_plan` — values: `starter`, `growth`, `agency` — defaults to `starter`
- Plan limits (used in billing endpoint): Starter: 1 website, 25 keywords, 1 campaign, 50 AI gens; Growth: 5, 200, unlimited, 300; Agency: unlimited, unlimited, unlimited, 1000

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

### outreach_contacts table
- `id`: serial PK
- `name`, `domain`: text (required)
- `email`: text (nullable)
- `type`: text — `guest_post`, `link_request`, `partnership`, `pr`
- `status`: text — `not_sent`, `sent`, `opened`, `replied`, `rejected`, `won`
- `dateSent`: date (nullable)
- `followUpDate`: date (nullable) — "Follow-ups Due" filter matches rows where date ≤ today AND status = "sent"
- `notes`: text (nullable)
- `createdAt`, `updatedAt`: timestamps
- API: `GET/POST /api/outreach`, `PATCH/DELETE /api/outreach/:id`, `GET /api/outreach/stats`
- Permission guard: `backlinks`
- Frontend: `/outreach` page with stat cards (total, reply rate, won, follow-ups due), filter tabs per status, sortable table, slide-in sheet form

### competitor_analyses table
- `id`: serial PK
- `websiteId`: FK → websites (cascade delete)
- `competitorUrl`: text — the competitor site URL
- `analysisJson`: jsonb — `{ summary: string, gapKeywords: [{keyword, reason}] }` once analysed
- `createdAt`: timestamp
- Max 3 competitors per website enforced at API level
- Gap analysis via `POST /api/websites/:id/competitors/:competitorId/analyse` (crawl + AI)

### staff_users table
- `permissions`: jsonb (nullable, default null) — `null` = full access for legacy/admin users; `string[]` = explicit module-level access for staff
- Module keys: `websites`, `keywords`, `leads`, `campaigns`, `backlinks`, `social`, `analytics`, `ai_tools`, `media`, `calendar`, `conversations`
- `requirePermission(module)` middleware in `artifacts/api-server/src/lib/auth.ts` — admins always pass; staff with null = full access; staff with explicit array must include the module
- Frontend: `usePermissions()` hook in `AuthContext.tsx`; sidebar filters nav items; `PermissionGuard` wraps page routes; `AccessDenied` component shown on blocked pages
- Admin UI: StaffTab in `/admin` page lets admins set per-module permissions when creating or editing staff accounts

## Product Tour

A custom guided tour component lives in `artifacts/marketing-hub/src/components/ProductTour.tsx`.

- 7-step spotlight tour highlighting: welcome banner → sidebar nav → keywords → campaigns → backlinks → stats grid → getting started checklist
- Auto-starts on first login (checks `localStorage.getItem('product_tour_completed')`)
- "Take the tour" button on the dashboard welcome banner for manual re-launch
- Persists completion state via `localStorage` key `product_tour_completed`
- Uses React portals + SVG mask for the spotlight overlay, no external tour library
- `data-tour` attributes on target elements: `welcome-banner`, `sidebar-nav`, `nav-keywords`, `nav-campaigns`, `nav-backlinks`, `stats-grid`, `getting-started`

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
