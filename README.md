# SEO & Marketing Hub

An AI-powered marketing command center that gives agencies and solo marketers a single platform for SEO monitoring, content creation, lead management, social scheduling, and deep analytics — all backed by Google Search Console, Google Analytics 4, and large-language-model AI.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Prerequisites & Environment Variables](#prerequisites--environment-variables)
4. [Local Development](#local-development)
5. [How to Use the App](#how-to-use-the-app)
6. [Google Integration Setup](#google-integration-setup)
7. [Deployment](#deployment)
8. [Contributing & License](#contributing--license)

---

## Features

| Module | Description |
|---|---|
| **Keyword Tracking** | Monitor keyword rankings across websites, track position history over time, and spot ranking opportunities or drops. |
| **AI Content Suite** | Generate blog posts, social copy, SEO briefs, and email sequences using GPT/Claude — with a built-in blog editor and knowledge-base builder. |
| **Lead Generation & CRM** | Embed customisable lead-capture forms on any site, score incoming leads automatically, and manage them through a lightweight CRM pipeline. |
| **Marketing Automation** | Schedule and publish social posts to Twitter/X, LinkedIn, and Facebook; run email drip campaigns; and build automated outreach sequences. |
| **Analytics & Reporting (GA4)** | Pull live traffic, engagement, and conversion data directly from Google Analytics 4 and Search Console. Generate white-label client reports on demand or on a schedule. |
| **UTM Builder** | Create and shorten UTM-tagged links, track click-through rates, and organise campaigns in one place. |
| **Client Reports** | Produce branded PDF/shareable-link reports combining GSC, GA4, keyword, and backlink data for clients. |
| **SEO Chat** | An AI chatbot trained on your site's knowledge base to answer customer and prospect questions 24/7. |
| **Site Audit** | Crawl any connected website for technical SEO issues: broken links, missing meta tags, slow pages, and more. |
| **A/B Tests** | Track split-test experiments and log variant performance alongside other analytics data. |

---

## Tech Stack

### Frontend
- **React 18** + **Vite** — fast dev server and optimised production builds
- **Tailwind CSS** + **shadcn/ui** (Radix UI primitives) — utility-first styling with accessible component library
- **TanStack Query** — server-state management and caching
- **Wouter** — lightweight client-side routing
- **Recharts** — data visualisation

### Backend
- **Node.js** + **Express 5** + **TypeScript** — REST API server
- **Drizzle ORM** — type-safe database access layer
- **PostgreSQL** — primary relational database

### AI & Integrations
- **OpenAI / Anthropic** — AI content generation and chat
- **Google Analytics 4** — traffic and engagement analytics
- **Google Search Console** — keyword and impression data
- **Google PageSpeed Insights** — site performance auditing
- **Stripe** — subscription billing and webhooks
- **Razorpay** — alternative payment gateway
- **Nodemailer / Resend / SendGrid / Mailgun** — transactional email
- **Twitter, LinkedIn, Facebook APIs** — social media publishing

### Infrastructure
- **Docker** + **Docker Compose** — containerised local and production deployments
- **Kubernetes** manifests in `k8s/` — production-grade cluster deployment
- **Nginx** — reverse proxy and static asset serving

---

## Prerequisites & Environment Variables

### Required Tools

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20 LTS or later | Required for all packages |
| pnpm | 9+ | Workspace package manager (`npm i -g pnpm`) |
| PostgreSQL | 15+ | Local DB or a hosted service (Supabase, Neon, etc.) |

### Environment Variables

Create a `.env` file in the project root (or set these as secrets in your hosting environment). **Never commit real secrets.**

```env
# ── Core ──────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://user:password@localhost:5432/marketing_hub
SESSION_SECRET=replace-with-a-long-random-string
APP_URL=http://localhost:5000
NODE_ENV=development

# ── Service ports (required — both services throw on startup if missing) ──
# API server port
PORT=5000
# Frontend: port the Vite dev server listens on
# PORT=5173  ← set this when starting the frontend (use a separate shell or process manager)
# Base URL path the frontend is served from (use "/" for local development)
BASE_PATH=/

# ── Google OAuth & APIs ───────────────────────────────────────────────
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
# Must match the Authorized Redirect URI registered in Google Cloud Console:
GOOGLE_REDIRECT_URI=http://localhost:5000/api/integrations/google/callback
GOOGLE_PAGESPEED_API_KEY=your-pagespeed-api-key

# ── AI ────────────────────────────────────────────────────────────────
AI_API_KEY=sk-...                     # OpenAI or compatible key
# (Replit-managed AI integrations proxy — used automatically when available)
AI_INTEGRATIONS_OPENAI_API_KEY=your-key
AI_INTEGRATIONS_OPENAI_BASE_URL=https://openai-proxy.example.com

# ── Email ────────────────────────────────────────────────────────────
EMAIL_ENCRYPTION_KEY=replace-with-32-char-hex-string
RESEND_WEBHOOK_SECRET=your-resend-webhook-secret
SENDGRID_WEBHOOK_KEY=your-sendgrid-webhook-key
MAILGUN_WEBHOOK_SIGNING_KEY=your-mailgun-signing-key

# ── Social Media ──────────────────────────────────────────────────────
TWITTER_CLIENT_ID=your-twitter-client-id
TWITTER_CLIENT_SECRET=your-twitter-client-secret
LINKEDIN_CLIENT_ID=your-linkedin-client-id
LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret

# ── Billing ───────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=your-razorpay-key-secret
```

---

## Local Development

### 1. Clone and install dependencies

```bash
git clone https://github.com/your-org/seo-marketing-hub.git
cd seo-marketing-hub
pnpm install
```

### 2. Configure environment

Copy the example above into a `.env` file at the project root and fill in your values. At a minimum you need `DATABASE_URL`, `SESSION_SECRET`, `APP_URL`, and `PORT` to start the API server. The frontend additionally requires `BASE_PATH`.

### 3. Set up the database

```bash
# Push the Drizzle schema to your local PostgreSQL database
pnpm --filter @workspace/db run push
```

### 4. Start the API server

In one terminal, set `PORT` and start the server:

```bash
PORT=5000 pnpm --filter @workspace/api-server run dev
```

The API server is now available at **`http://localhost:5000/api`**.

### 5. Start the frontend

In a second terminal, set `PORT` and `BASE_PATH` then start Vite:

```bash
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/marketing-hub run dev
```

The frontend dev server is now available at **`http://localhost:5173`**. It calls the API directly (no dev proxy is configured — both services must be running).

### Expected URLs

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API | http://localhost:5000/api |
| API health check | http://localhost:5000/api/healthz |

---

## How to Use the App

### Keyword Tracking
- Add a website under **Websites** and enter the domain you want to track.
- Navigate to **Keywords** → **Add Keywords** and enter terms to monitor.
- Rankings refresh automatically; view position history in the keyword detail chart.

### AI Content Suite
- Go to **AI** → choose a content type (blog post, social copy, SEO brief, etc.).
- Fill in the prompt fields and click **Generate**.
- Edit the result in the built-in rich-text editor and publish or save to drafts.
- Use **Blog** to manage and publish articles directly to your connected site.

### Lead Generation & CRM
- Open **Lead Forms** → **Create Form**, customise fields and styling, then copy the embed snippet.
- Paste the snippet into any HTML page to start capturing leads.
- Leads appear in **Leads** where you can score, tag, assign, and move them through the pipeline.

### Marketing Automation
- Go to **Social** → **Schedule Post**, select your connected accounts, write copy, pick a date/time, and publish.
- Use **Campaigns** to group posts and track campaign-level performance.
- Build email drip sequences under **Outreach** → **Sequences**.

### Analytics & Reporting (GA4)
- Connect Google (see [Google Integration Setup](#google-integration-setup)).
- Navigate to **Analytics** → **GA4** to see traffic, sessions, top pages, and engagement metrics.
- Switch to the **Search Console** tab for impressions, clicks, and average keyword position.
- Generate a client report under **Reports** → **New Report**, choose a date range and metrics, then share a link or export PDF.

### UTM Builder
- Go to **UTM Builder**, fill in campaign source, medium, name, and destination URL.
- Click **Generate** to get a full UTM URL and a shortened tracking link.
- All links are stored in the UTM dashboard with click counts updated in real time.

### Client Reports
- Open **Reports** → **New Report** and select a connected website.
- Choose which data sections to include (GSC, GA4, keywords, backlinks).
- Set up a recurring schedule or generate on demand; share via a public link or PDF download.

### SEO Chat
- Go to **AI** → **Chatbot** to configure the bot's knowledge base and persona.
- Embed the chat widget on your site using the provided script snippet.
- View conversation history and hand-off transcripts in the **Conversations** section.

---

## Google Integration Setup

Connecting Google unlocks Search Console and GA4 data throughout the app. Follow these steps:

### Step 1 — Create a Google Cloud project

1. Go to [Google Cloud Console](https://console.cloud.google.com) and create a new project (or reuse an existing one).
2. Enable the following APIs for your project:
   - **Google Search Console API**
   - **Google Analytics Data API**
   - **PageSpeed Insights API** (optional, for site audits)

### Step 2 — Create OAuth 2.0 credentials

1. In the Cloud Console, open **APIs & Services → Credentials**.
2. Click **Create Credentials → OAuth client ID**.
3. Choose **Web application** as the application type.
4. Under **Authorised redirect URIs**, add:
   ```
   http://localhost:5000/api/integrations/google/callback   ← local development
   https://your-production-domain.com/api/integrations/google/callback   ← production
   ```
5. Copy the **Client ID** and **Client Secret** into your `.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
6. Set `GOOGLE_REDIRECT_URI` to the redirect URI that matches your current environment.

> **Important:** The redirect URI in your `.env` must exactly match one of the URIs registered in Google Cloud Console — including the protocol (`http` vs `https`) and port number. Mismatches are the most common cause of Google auth failures.

### Step 3 — Connect inside the app

1. Log in to the SEO & Marketing Hub.
2. Go to **Settings → Integrations → Google**.
3. Click **Connect Google Account** and complete the OAuth consent screen.
4. Once connected, select your GA4 property and Search Console site from the dropdowns that appear.

---

## Deployment

### Docker Compose (simplest self-hosted option)

```bash
# Standard build
docker compose up --build

# Or use the prebuilt image
docker compose -f docker-compose.prebuilt.yml up
```

The `docker/` directory contains an `nginx.conf` for reverse-proxying the frontend and API under a single domain.

### Kubernetes

Production-ready manifests are in the `k8s/` directory:

| File | Purpose |
|---|---|
| `namespace.yaml` | Dedicated namespace for isolation |
| `deployment.yaml` | App deployment with replica count and resource limits |
| `postgres-statefulset.yaml` | PostgreSQL StatefulSet with persistent volume |
| `pvc.yaml` | PersistentVolumeClaim for the database |
| `configmap.yaml` | Non-secret environment configuration |
| `secret.yaml` | Sensitive environment variables (base64-encoded) |
| `service.yaml` | ClusterIP services for the app and database |
| `ingress.yaml` | Ingress rule to expose the app via a domain |
| `hpa.yaml` | Horizontal Pod Autoscaler for traffic spikes |

Apply in order:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/
```

### Replit

The project runs natively on Replit. Open the project, let the workflows install dependencies automatically, then use the **Deploy** button in the Replit UI to publish to a production `.replit.app` domain. Set all required environment variables in the **Secrets** panel before deploying.

---

## Contributing & License

Contributions are welcome. Please open an issue to discuss significant changes before submitting a pull request. Run `pnpm run typecheck` before pushing to ensure there are no type errors.

This project is licensed under the **MIT License** — see the `license` field in `package.json`.
