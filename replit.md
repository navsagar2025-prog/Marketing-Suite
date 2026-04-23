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
- `POST /api/ai/keywords` — AI keyword recommendations
- `POST /api/ai/content-brief` — AI content brief generator
- `POST /api/ai/meta-tags` — AI meta tag generator
- `POST /api/ai/social-post` — AI social post generator
- `POST /api/ai/ad-copy` — AI ad copy generator

## Database Schema (lib/db)

Tables: `websites`, `keywords`, `social_posts`, `campaigns`, `backlinks`, `leads`, `conversations`, `messages`

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
