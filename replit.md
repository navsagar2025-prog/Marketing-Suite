# Workspace

## Overview

This project is an SEO & Marketing Command Center, a full-stack monorepo application designed to manage and optimize multiple websites' SEO, social media, marketing campaigns, backlink profiles, and lead generation efforts. It incorporates AI-powered tools for content generation and analysis, aiming to provide a comprehensive platform for digital marketing professionals. The project is built with a focus on scalability and advanced features, targeting a market need for integrated digital marketing solutions.

## User Preferences

- I prefer simple language and explanations.
- I like functional programming paradigms where applicable.
- I want an iterative development process, with frequent updates and feedback loops.
- Please ask for my approval before making any major architectural changes or significant code refactoring.
- Do not make changes to the `artifacts/marketing-hub/src/components/ProductTour.tsx` file.
- Do not make changes to the `pnpm-workspace` skill.

## System Architecture

The project is structured as a pnpm monorepo utilizing Node.js 24 and TypeScript 5.9.

**UI/UX Decisions:**
The frontend, `marketing-hub`, is built with React, Vite, Tailwind CSS, and shadcn/ui, providing a modern and responsive user interface. Recharts is used for data visualization within dashboards and reports. A custom guided product tour is implemented using React portals and SVG masks for first-time user onboarding.

**Technical Implementations:**
- **API Server (`api-server`):** An Express 5 application serving RESTful APIs. It handles all backend logic, database interactions, and integrations.
- **Database:** PostgreSQL with Drizzle ORM for type-safe database access and schema management.
- **Validation:** Zod (`zod/v4`) is used for robust data validation, including `drizzle-zod` for ORM integration.
- **API Codegen:** Orval generates API hooks and Zod schemas from an OpenAPI specification, ensuring strong typing between frontend and backend.
- **Build System:** esbuild is used for efficient CJS bundling of backend artifacts.
- **AI Integration:** A central `callAI()` service supports multiple AI providers (Replit Default, OpenAI, Anthropic, Perplexity, Google Gemini), configurable via the UI.
- **Authentication & Authorization:** Staff user roles with granular, module-level permissions are implemented, safeguarding access to specific features.
- **Website Auditing:** A background BFS crawler (up to 100 pages, concurrency 3, 10s timeout) performs full-site audits, respecting `robots.txt` and identifying various SEO issues (e.g., missing titles, slow pages, broken links). It calculates a health score based on weighted issue deductions.
- **Lead Scoring:** An automated lead scoring engine assigns scores (0-100) to leads based on configurable criteria (source, status, value, recency), with weights stored in `app_settings`.
- **Google Search Console Integration:** Secure OAuth flow using AES-256-GCM encrypted tokens for connecting to Google Search Console, fetching GSC data (cached with 1-hour TTL), and managing properties.

**Core Features:**
- **Website Management:** CRUD operations for websites.
- **Keyword Tracking & Research:** Monitor keyword ranks, historical data, and AI-powered research for new keyword ideas, including competitor analysis.
- **Campaign Management:** Create, track, and manage marketing campaigns.
- **Social Media Management:** Schedule and manage social media posts.
- **Backlink Tracking:** Monitor and manage backlinks.
- **Lead Management:** Track leads, qualify them using AI conversations, and apply lead scoring.
- **Analytics & Reporting:** Comprehensive dashboards, per-site analytics, campaign performance, and lead funnel breakdowns. Client reports can be generated, saved, and shared publicly.
- **AI Tools:** Integrated AI for keyword suggestions, social post generation, meta tag generation, ad copy, SEO content briefs, and media generation (images via Fal.ai flux/schnell, videos via Fal.ai kling-video v2.1).
- **Media Asset Management:** Store and manage media assets linked to websites or campaigns.
- **Outreach Management:** Manage outreach contacts for guest posts, link requests, and partnerships, including tracking status and follow-ups.

## External Dependencies

- **Database:** PostgreSQL
- **AI Providers:** Replit Default, OpenAI, Anthropic, Perplexity, Google Gemini
- **Image Generation:** Fal.ai (flux/schnell models)
- **Video Generation:** Fal.ai (kling-video v2.1 model)
- **Payment Gateways (Admin Only):** Stripe, Razorpay
- **Google Services:** Google OAuth, Google Search Console API (for data retrieval)