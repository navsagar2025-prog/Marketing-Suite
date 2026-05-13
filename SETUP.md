# SEO Command — Production Setup Guide

SEO Command is a full-stack SaaS application: a React/Vite frontend served by
nginx, and an Express 5 + Node.js API backend connected to PostgreSQL.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start — Docker Compose (recommended)](#quick-start--docker-compose-recommended)
3. [Option A — Bundled PostgreSQL (default)](#option-a--bundled-postgresql-default)
4. [Option B — External / Supabase PostgreSQL](#option-b--external--supabase-postgresql)
5. [VPS / Bare Metal (without Docker)](#vps--bare-metal-without-docker)
6. [Kubernetes](#kubernetes)
7. [Managed Cloud Services](#managed-cloud-services)
8. [Reverse Proxy & TLS](#reverse-proxy--tls)
9. [Environment Variable Reference](#environment-variable-reference)
10. [Post-Setup Checklist](#post-setup-checklist)
11. [Upgrading](#upgrading)
12. [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Requirement | Minimum version | Notes |
|-------------|----------------|-------|
| Docker      | 24+            | With Compose v2 (plugin) |
| Node.js     | 22             | Only needed for bare-metal install |
| pnpm        | 9+             | `npm i -g pnpm` |
| PostgreSQL  | 15+            | Bundled via Docker or external |

---

## Quick Start — Docker Compose (recommended)

```bash
# 1. Clone / unzip the package
git clone https://github.com/your-org/seocommand.git
cd seocommand

# 2. Create your .env file
cp .env.example .env
# Edit .env — at minimum set:
#   DB_PASSWORD, SESSION_SECRET, ADMIN_PASSWORD

# 3. Build and start
docker compose up -d --build

# 4. Open http://localhost (or http://your-server-ip)
#    Log in with username "admin" and the ADMIN_PASSWORD you set.
```

The first startup automatically runs the database schema migration (Drizzle
`push`). This is idempotent — safe to run on every restart.

---

## Option A — Bundled PostgreSQL (default)

This is the default configuration. Docker Compose starts a postgres:16 container
alongside the app. All data is stored in a named Docker volume (`postgres_data`).

```bash
cp .env.example .env
```

Edit `.env` — these three variables are required:

```dotenv
DB_PASSWORD=some_strong_password_here
SESSION_SECRET=run_openssl_rand_hex_32_and_paste_here
ADMIN_PASSWORD=your_admin_login_password
```

```bash
docker compose up -d --build
```

**Backup the database:**

```bash
docker compose exec db pg_dump -U seocommand seocommand > backup_$(date +%Y%m%d).sql
```

**Restore:**

```bash
cat backup_20240101.sql | docker compose exec -T db psql -U seocommand seocommand
```

---

## Option B — External / Supabase PostgreSQL

Use this when you already have a managed PostgreSQL (Supabase, AWS RDS, Google
Cloud SQL, Azure Database, Railway, Neon, etc.).

### Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Go to **Project Settings → Database → Connection string → Transaction pooler**.
3. Copy the connection string (port **6543**, not 5432).
4. Edit `.env`:

```dotenv
# Leave DB_PASSWORD blank — no bundled postgres container needed
DB_PASSWORD=
SUPABASE_DATABASE_URL=postgresql://postgres.YOURPROJECTREF:YOURPASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres
SESSION_SECRET=run_openssl_rand_hex_32_and_paste_here
ADMIN_PASSWORD=your_admin_login_password
```

5. Start only the app (no bundled postgres):

```bash
docker compose up -d --build app
```

> The entrypoint automatically detects `SUPABASE_DATABASE_URL` and skips the
> local pg_isready wait, connecting directly to Supabase with SSL.

### Other external PostgreSQL

```dotenv
SUPABASE_DATABASE_URL=postgresql://user:password@db.host.com:5432/seocommand
```

SSL is automatically enabled whenever `SUPABASE_DATABASE_URL` is set. For non-
SSL external servers, use `DATABASE_URL` instead:

```dotenv
DATABASE_URL=postgresql://user:password@db.host.com:5432/seocommand
```

---

## VPS / Bare Metal (without Docker)

Install on any Ubuntu 22.04 / Debian 12 server.

### 1. Install Node.js 22 and pnpm

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -g pnpm
```

### 2. Install nginx and PostgreSQL

```bash
sudo apt-get install -y nginx postgresql postgresql-client
sudo systemctl enable --now postgresql
```

### 3. Create the database

```bash
sudo -u postgres psql -c "CREATE USER seocommand WITH PASSWORD 'strong_password';"
sudo -u postgres psql -c "CREATE DATABASE seocommand OWNER seocommand;"
```

### 4. Clone and build

```bash
git clone https://github.com/your-org/seocommand.git /opt/seocommand
cd /opt/seocommand
pnpm install --frozen-lockfile
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/marketing-hub run build
```

### 5. Set environment variables

Create `/etc/seocommand.env`:

```dotenv
NODE_ENV=production
PORT=8080
DATABASE_URL=postgresql://seocommand:strong_password@localhost:5432/seocommand
SESSION_SECRET=your_generated_secret
ADMIN_PASSWORD=your_admin_password
APP_URL=https://seo.yourdomain.com
```

### 6. Push the database schema

```bash
cd /opt/seocommand
export $(cat /etc/seocommand.env | xargs)
pnpm --filter @workspace/db run push-force
```

### 7. Create a systemd service

```ini
# /etc/systemd/system/seocommand.service
[Unit]
Description=SEO Command API Server
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/seocommand
EnvironmentFile=/etc/seocommand.env
ExecStart=/usr/bin/node --enable-source-maps /opt/seocommand/artifacts/api-server/dist/index.mjs
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now seocommand
sudo journalctl -u seocommand -f
```

### 8. Configure nginx

```nginx
# /etc/nginx/sites-available/seocommand
server {
    listen 80;
    server_name seo.yourdomain.com;

    root /opt/seocommand/artifacts/marketing-hub/dist/public;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;

    location /api/ {
        proxy_pass         http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_buffering    off;
        proxy_read_timeout 300s;
        client_max_body_size 50m;
    }

    location /r/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location ~* \.(js|css|woff2|ico|png|jpg|svg|webp)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/seocommand /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## Kubernetes

All manifests are in the `k8s/` directory. Apply in this order:

### 1. Fill in secrets

Edit `k8s/secret.yaml` — replace all `CHANGE_ME_*` values:

```bash
# Generate SESSION_SECRET
openssl rand -hex 32
```

### 2. Update your domain

Edit `k8s/ingress.yaml` and `k8s/configmap.yaml` — replace `seo.yourdomain.com`
with your actual domain.

### 3. Set your image

Edit `k8s/deployment.yaml` line `image: seocommand:latest` — replace with your
registry path, e.g. `ghcr.io/your-org/seocommand:v1.0.0`.

Build and push:

```bash
docker build -t ghcr.io/your-org/seocommand:v1.0.0 .
docker push ghcr.io/your-org/seocommand:v1.0.0
```

### 4. Apply manifests

```bash
# Namespace first
kubectl apply -f k8s/namespace.yaml

# Secrets and config
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/configmap.yaml

# Storage
kubectl apply -f k8s/pvc.yaml

# Database (skip if using external/Supabase)
kubectl apply -f k8s/postgres-statefulset.yaml

# Application
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml

# Ingress (requires nginx-ingress + cert-manager)
kubectl apply -f k8s/ingress.yaml

# Optional: autoscaling (requires metrics-server)
kubectl apply -f k8s/hpa.yaml
```

### 5. Monitor startup

```bash
kubectl -n seocommand get pods -w
kubectl -n seocommand logs -f deployment/seocommand-app
```

### Using external DB (Supabase) with Kubernetes

Skip `postgres-statefulset.yaml`. In `k8s/secret.yaml`:

- Set `SUPABASE_DATABASE_URL` to your connection string.
- Leave `DATABASE_URL` and `DB_PASSWORD` blank.

In `k8s/deployment.yaml`, remove the `initContainers` block — it is skipped
automatically when `SUPABASE_DATABASE_URL` is non-empty, but removing it is
cleaner.

---

## Managed Cloud Services

### Railway

1. Connect your GitHub repo at [railway.app](https://railway.app).
2. Add a PostgreSQL plugin — Railway sets `DATABASE_URL` automatically.
3. Set environment variables in the Railway dashboard (see reference below).
4. Railway auto-detects Docker and builds the `Dockerfile`.
5. Set the `PORT` variable to `80` (Railway proxies to `$PORT`).

### Render

1. New → Web Service → connect your repo.
2. Set **Dockerfile path**: `./Dockerfile`.
3. Add a PostgreSQL database — Render sets `DATABASE_URL` automatically.
4. Add environment variables in the Render dashboard.
5. Render exposes port 80 by default (matches nginx).

### Fly.io

```bash
fly launch --dockerfile Dockerfile --no-deploy
fly postgres create --name seocommand-db
fly postgres attach --app seocommand seocommand-db
fly secrets set SESSION_SECRET=$(openssl rand -hex 32) ADMIN_PASSWORD=yourpassword
fly deploy
```

### AWS ECS / Fargate

1. Build and push to ECR:
   ```bash
   aws ecr create-repository --repository-name seocommand
   docker build -t 123456789.dkr.ecr.us-east-1.amazonaws.com/seocommand:latest .
   docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/seocommand:latest
   ```
2. Create an RDS PostgreSQL instance.
3. Create an ECS Task Definition pointing to your ECR image with the env vars
   from the reference below stored in AWS Secrets Manager.
4. Create an ECS Service with an ALB on port 80.

### DigitalOcean App Platform

1. Push code to GitHub.
2. New App → select repo → choose **Dockerfile** as build method.
3. Add a managed PostgreSQL database — DO sets `DATABASE_URL` automatically.
4. Add environment variables from the reference below.

---

## Reverse Proxy & TLS

### TLS with Let's Encrypt (bare metal)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d seo.yourdomain.com
sudo systemctl reload nginx
```

Certbot auto-renews via a systemd timer. Verify with:

```bash
sudo certbot renew --dry-run
```

### Cloudflare (recommended for Docker/VPS)

1. Point your domain's DNS to your server IP via Cloudflare.
2. Enable **Proxy** (orange cloud) for automatic HTTPS.
3. In Cloudflare SSL/TLS settings, set mode to **Full (strict)** if your origin
   also has a certificate, or **Flexible** if nginx serves plain HTTP.

---

## Environment Variable Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `SESSION_SECRET` | **Yes** | 32-byte hex string for JWT signing. `openssl rand -hex 32` |
| `ADMIN_PASSWORD` | **Yes** | Password for the auto-created `admin` account (first boot only) |
| `DATABASE_URL` | Yes* | PostgreSQL connection string (used with bundled postgres) |
| `SUPABASE_DATABASE_URL` | Yes* | External/Supabase connection string. Overrides `DATABASE_URL`. Enables SSL automatically |
| `APP_URL` | Recommended | Full public URL, e.g. `https://seo.yourdomain.com` — used in OAuth callbacks and emails |
| `OPENAI_API_KEY` | Optional | Enables AI features. Can also be set from Settings → AI Provider |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth app client ID (Search Console + GA4) |
| `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth app client secret |
| `GOOGLE_REDIRECT_URI` | Optional | `https://seo.yourdomain.com/api/integrations/google/callback` |
| `GOOGLE_PAGESPEED_API_KEY` | Optional | Google PageSpeed Insights API key |
| `TWITTER_CLIENT_ID` | Optional | Twitter/X OAuth 2.0 client ID |
| `TWITTER_CLIENT_SECRET` | Optional | Twitter/X OAuth 2.0 client secret |
| `LINKEDIN_CLIENT_ID` | Optional | LinkedIn OAuth app client ID |
| `LINKEDIN_CLIENT_SECRET` | Optional | LinkedIn OAuth app client secret |
| `FACEBOOK_APP_ID` | Optional | Facebook/Instagram app ID |
| `FACEBOOK_APP_SECRET` | Optional | Facebook/Instagram app secret |
| `EMAIL_ENCRYPTION_KEY` | Optional | 32-byte hex key for encrypting SMTP credentials. Falls back to `SESSION_SECRET` |
| `FAL_AI_API_KEY` | Optional | fal.ai key for AI image/video generation |
| `SENDGRID_WEBHOOK_KEY` | Optional | SendGrid inbound webhook signing key |
| `MAILGUN_WEBHOOK_SIGNING_KEY` | Optional | Mailgun webhook signing key |
| `DB_PASSWORD` | Option A | Password for the bundled postgres container |
| `HOST_PORT` | Optional | Local port Docker binds nginx to. Default `80` |

> *One of `DATABASE_URL` or `SUPABASE_DATABASE_URL` must be set.

### Social OAuth callback URLs

Register these redirect URIs in each developer portal:

| Platform | Callback URL |
|----------|-------------|
| Twitter/X | `https://seo.yourdomain.com/api/integrations/social/twitter/callback` |
| LinkedIn | `https://seo.yourdomain.com/api/integrations/social/linkedin/callback` |
| Facebook | `https://seo.yourdomain.com/api/integrations/social/facebook/callback` |
| Instagram | `https://seo.yourdomain.com/api/integrations/social/instagram/callback` |
| Google | `https://seo.yourdomain.com/api/integrations/google/callback` |

---

## Post-Setup Checklist

- [ ] App loads at your domain without errors
- [ ] Can log in with `admin` + your `ADMIN_PASSWORD`
- [ ] `/api/healthz` returns `{"status":"ok"}`
- [ ] Settings → AI Provider — add your OpenAI key (or other provider)
- [ ] Settings → Integrations — register social OAuth apps and add credentials
- [ ] Settings → Integrations → Google — connect Search Console and GA4
- [ ] Settings → Email — configure SMTP for lead notification emails
- [ ] Change the admin password from Settings → Security
- [ ] Set up backups for the `postgres_data` Docker volume or your external DB

---

## Upgrading

### Docker Compose

```bash
git pull                         # or unzip the new package
docker compose down
docker compose up -d --build     # rebuilds the image, migrates schema on startup
```

The schema migration runs automatically on every startup and is idempotent.

### Kubernetes

```bash
docker build -t ghcr.io/your-org/seocommand:v1.1.0 .
docker push ghcr.io/your-org/seocommand:v1.1.0
kubectl -n seocommand set image deployment/seocommand-app app=ghcr.io/your-org/seocommand:v1.1.0
kubectl -n seocommand rollout status deployment/seocommand-app
```

---

## Troubleshooting

### Container won't start — "DATABASE_URL must be set"

Either `DATABASE_URL` or `SUPABASE_DATABASE_URL` must be set. Verify your `.env`
file is present and the variable is uncommented.

### "SESSION_SECRET environment variable is required"

`SESSION_SECRET` is missing. Generate one and add it to your `.env`:

```bash
openssl rand -hex 32
```

### Can't connect to Supabase — SSL errors

The app automatically enables SSL when `SUPABASE_DATABASE_URL` is used. If you
see `SELF_SIGNED_CERT_IN_CHAIN`, ensure you are using the **transaction pooler**
URL (port 6543) from Supabase, not the direct connection (port 5432), which is
blocked by most cloud firewalls.

### Blank white page / 404 on page refresh

nginx is not serving `index.html` as the SPA fallback. Verify the nginx config
`try_files $uri $uri/ /index.html;` is in place. With Docker Compose this is
handled automatically.

### API returns 401 for all requests after first login

`SESSION_SECRET` changed between restarts. All existing JWTs are invalidated.
Set a stable value in `.env` and avoid rotating it unless you want to force
all users to re-login.

### Database schema out of date after upgrade

The schema migration runs automatically on startup. If it fails, run it
manually:

```bash
# Docker Compose
docker compose exec app pnpm --filter @workspace/db run push-force

# Bare metal
cd /opt/seocommand && pnpm --filter @workspace/db run push-force
```

### Port 80 already in use (Docker)

Set `HOST_PORT=8080` (or any free port) in `.env` and restart:

```bash
docker compose up -d
# App is now at http://localhost:8080
```

### Viewing logs

```bash
# Docker Compose
docker compose logs -f app
docker compose logs -f db

# Bare metal
sudo journalctl -u seocommand -f

# Kubernetes
kubectl -n seocommand logs -f deployment/seocommand-app
```
