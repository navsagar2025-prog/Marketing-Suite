# SEO Command — Production Setup Guide

SEO Command is a full-stack SaaS: React/Vite frontend served by nginx and an
Express 5 / Node.js API backend connected to PostgreSQL.

---

## Table of Contents

1. [Which package to use?](#which-package-to-use)
2. [Quick Start — Pre-Built (fastest)](#quick-start--pre-built-fastest)
3. [Quick Start — Source Build](#quick-start--source-build)
4. [Database Options](#database-options)
5. [VPS / Bare Metal (no Docker)](#vps--bare-metal-no-docker)
6. [Kubernetes](#kubernetes)
7. [Managed Cloud Services](#managed-cloud-services)
8. [Reverse Proxy & TLS](#reverse-proxy--tls)
9. [Environment Variable Reference](#environment-variable-reference)
10. [Post-Setup Checklist](#post-setup-checklist)
11. [Upgrading](#upgrading)
12. [Troubleshooting](#troubleshooting)

---

## Which package to use?

| | **production-package-prebuilt.zip** | **production-package.zip** |
|---|---|---|
| **Docker build time** | ~60 seconds | 5–10 minutes |
| **Requires internet during build?** | Only 3 npm packages | Full pnpm install |
| **Source code included?** | No (dist only) | Yes |
| **Customisable?** | No | Yes |
| **Dockerfile** | `Dockerfile.prebuilt` | `Dockerfile` |
| **Compose file** | `docker-compose.prebuilt.yml` | `docker-compose.yml` |

Use **pre-built** for fastest deployment on a server. Use **source** if you want
to modify and rebuild the application.

---

## Quick Start — Pre-Built (fastest)

> Uses `Dockerfile.prebuilt` — no TypeScript or Vite compilation in Docker.
> Build time is ~60 seconds (only installs 3 migration packages).

```bash
# 1. Unzip the pre-built package
unzip production-package-prebuilt.zip
cd production-package-prebuilt   # or wherever you unzipped

# 2. Create your .env file
cp .env.example .env
```

Edit `.env` — these three are the minimum required:
```dotenv
DB_PASSWORD=some_strong_password
SESSION_SECRET=paste_output_of__openssl_rand_hex_32
ADMIN_PASSWORD=your_admin_login_password
```

```bash
# 3. Build and start (fast — no compilation)
docker compose -f docker-compose.prebuilt.yml up -d --build

# 4. Verify
curl http://localhost/api/healthz
# → {"status":"ok"}

# 5. Open http://localhost
#    Login: admin / your ADMIN_PASSWORD
```

---

## Quick Start — Source Build

> Uses `Dockerfile` — compiles TypeScript and Vite inside Docker.
> Build time is 5–10 minutes on first run.

```bash
# 1. Unzip the source package
unzip production-package.zip

# 2. Create your .env file
cp .env.example .env
# Edit .env — set DB_PASSWORD, SESSION_SECRET, ADMIN_PASSWORD

# 3. Build and start
docker compose up -d --build

# 4. Verify
curl http://localhost/api/healthz
```

---

## Docker Image Sizes

Both Dockerfiles produce a **minimal Alpine-based image**:

| Layer | Size (approx.) |
|-------|---------------|
| node:22-alpine base | ~130 MB |
| nginx + postgresql-client | ~10 MB |
| Schema-runner (drizzle-kit + drizzle-orm + pg) | ~80 MB |
| API server bundle | ~8 MB |
| Frontend static files | ~3 MB |
| **Total image** | **~230 MB** |

This is significantly smaller than a Debian/slim-based image (~480 MB).

---

## Database Options

### Option A — Bundled PostgreSQL (default)

Included in docker-compose. Set `DB_PASSWORD` in `.env`.

```dotenv
DB_PASSWORD=strong_password_here
```

**Backup:**
```bash
docker compose exec db pg_dump -U seocommand seocommand > backup_$(date +%Y%m%d).sql
```

**Restore:**
```bash
cat backup.sql | docker compose exec -T db psql -U seocommand seocommand
```

### Option B — External / Supabase PostgreSQL

Set `SUPABASE_DATABASE_URL` in `.env` and leave `DB_PASSWORD` blank.
The app connects with SSL and skips the local postgres container.

**Supabase:**
1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Project Settings → Database → Connection string → Transaction pooler**
3. Copy the connection string (use port **6543**, not 5432)

```dotenv
DB_PASSWORD=
SUPABASE_DATABASE_URL=postgresql://postgres.YOURREF:YOURPASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres
```

Start only the app (skip bundled postgres):
```bash
docker compose up -d --build app
# or for pre-built:
docker compose -f docker-compose.prebuilt.yml up -d --build app
```

**Any external PostgreSQL:**
```dotenv
SUPABASE_DATABASE_URL=postgresql://user:password@db.host.com:5432/seocommand
```

---

## VPS / Bare Metal (no Docker)

For Ubuntu 22.04 / Debian 12.

### 1. Install Node.js 22, pnpm, nginx, PostgreSQL

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs nginx postgresql postgresql-client
npm install -g pnpm
```

### 2. Create database

```bash
sudo -u postgres psql << 'SQL'
CREATE USER seocommand WITH PASSWORD 'strong_db_password';
CREATE DATABASE seocommand OWNER seocommand;
SQL
```

### 3. Deploy source

```bash
# From source package:
unzip production-package.zip -d /opt/seocommand
cd /opt/seocommand
pnpm install --frozen-lockfile
pnpm --filter @workspace/api-server run build
BASE_PATH=/ NODE_ENV=production pnpm --filter @workspace/marketing-hub run build
```

Or from pre-built package (no build needed):
```bash
unzip production-package-prebuilt.zip -d /opt/seocommand
```

### 4. Push database schema

```bash
export DATABASE_URL=postgresql://seocommand:strong_db_password@localhost:5432/seocommand
export SESSION_SECRET=$(openssl rand -hex 32)

# Source package:
cd /opt/seocommand && pnpm --filter @workspace/db run push-force

# Pre-built package (uses schema-runner — install it first):
cd /tmp && npm install drizzle-kit@0.31.9 drizzle-orm@0.45.2 pg@8.20.0
node /tmp/node_modules/.bin/drizzle-kit push --force \
  --config /opt/seocommand/lib/db/drizzle.config.ts
```

### 5. systemd service

Create `/etc/seocommand.env`:
```dotenv
NODE_ENV=production
PORT=8080
DATABASE_URL=postgresql://seocommand:strong_db_password@localhost:5432/seocommand
SESSION_SECRET=your_32_byte_hex_secret
ADMIN_PASSWORD=your_admin_password
APP_URL=https://seo.yourdomain.com
```

Create `/etc/systemd/system/seocommand.service`:
```ini
[Unit]
Description=SEO Command API
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/seocommand
EnvironmentFile=/etc/seocommand.env
ExecStart=/usr/bin/node --enable-source-maps /opt/seocommand/dist/index.mjs
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

> For source install: `ExecStart` path is `artifacts/api-server/dist/index.mjs`
> For pre-built: `ExecStart` path is `dist/index.mjs` (root of unzipped folder)

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now seocommand
sudo journalctl -u seocommand -f
```

### 6. nginx config

```bash
sudo tee /etc/nginx/sites-available/seocommand << 'NGINX'
server {
    listen 80;
    server_name seo.yourdomain.com;

    # Source install: /opt/seocommand/artifacts/marketing-hub/dist/public
    # Pre-built:      /opt/seocommand/artifacts/marketing-hub/dist/public
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
NGINX

sudo ln -s /etc/nginx/sites-available/seocommand /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## Kubernetes

All manifests are in `k8s/`. Apply in order:

### 1. Prepare secrets

Edit `k8s/secret.yaml` — replace all `CHANGE_ME_*`:
```bash
openssl rand -hex 32   # for SESSION_SECRET
```

Update `k8s/ingress.yaml` and `k8s/configmap.yaml` with your domain.

### 2. Build and push your image

```bash
# Build the minimal image
docker build -t ghcr.io/your-org/seocommand:v1.0.0 .
# or use pre-built (faster):
docker build -f Dockerfile.prebuilt -t ghcr.io/your-org/seocommand:v1.0.0 .

docker push ghcr.io/your-org/seocommand:v1.0.0
```

Update `k8s/deployment.yaml` line `image: seocommand:latest` to your registry path.

### 3. Apply

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/pvc.yaml
kubectl apply -f k8s/postgres-statefulset.yaml   # skip if using external DB
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/hpa.yaml   # optional, requires metrics-server

kubectl -n seocommand rollout status deployment/seocommand-app
```

### External DB with Kubernetes

Skip `postgres-statefulset.yaml`. In `k8s/secret.yaml` set `SUPABASE_DATABASE_URL`
and leave `DATABASE_URL` / `DB_PASSWORD` blank.

---

## Managed Cloud Services

### Railway

1. Connect GitHub repo → Railway auto-detects the Dockerfile.
2. Add PostgreSQL plugin — Railway sets `DATABASE_URL` automatically.
3. Set `SESSION_SECRET`, `ADMIN_PASSWORD`, `APP_URL` in Variables.

### Render

1. New → Web Service → Docker → connect repo.
2. Add a PostgreSQL database.
3. Set env vars in the dashboard.

### Fly.io

```bash
fly launch --dockerfile Dockerfile --no-deploy
fly postgres create --name seocommand-db
fly postgres attach seocommand-db
fly secrets set \
  SESSION_SECRET=$(openssl rand -hex 32) \
  ADMIN_PASSWORD=yourpassword
fly deploy
```

### AWS ECS / Fargate

```bash
aws ecr create-repository --repository-name seocommand
docker build -t 123456789.dkr.ecr.us-east-1.amazonaws.com/seocommand:latest .
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/seocommand:latest
```
Create an RDS PostgreSQL instance. Create an ECS Task Definition using the ECR
image, pass env vars from Secrets Manager, and create a Service with an ALB.

### DigitalOcean App Platform

Connect repo → Dockerfile build → add a managed PostgreSQL database → set env vars.

---

## Reverse Proxy & TLS

### Let's Encrypt (bare metal)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d seo.yourdomain.com
```

### Cloudflare

Point DNS to your server, enable the orange-cloud proxy, set SSL/TLS mode to
**Full** (or **Full strict** if your origin also has a certificate).

---

## Environment Variable Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `SESSION_SECRET` | **Yes** | 32-byte hex string for JWT signing. `openssl rand -hex 32` |
| `ADMIN_PASSWORD` | **Yes** | Password for the auto-created `admin` account (first boot only) |
| `DATABASE_URL` | Yes* | PostgreSQL connection string (bundled postgres) |
| `SUPABASE_DATABASE_URL` | Yes* | External/Supabase URL. Overrides `DATABASE_URL`. SSL enabled automatically |
| `APP_URL` | Recommended | Full public URL e.g. `https://seo.yourdomain.com` (OAuth callbacks, emails) |
| `OPENAI_API_KEY` | Optional | Enables AI features |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth (Search Console + GA4) |
| `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth secret |
| `GOOGLE_REDIRECT_URI` | Optional | `https://seo.yourdomain.com/api/integrations/google/callback` |
| `GOOGLE_PAGESPEED_API_KEY` | Optional | PageSpeed Insights API key |
| `TWITTER_CLIENT_ID` | Optional | Twitter/X OAuth 2.0 |
| `TWITTER_CLIENT_SECRET` | Optional | Twitter/X OAuth 2.0 |
| `LINKEDIN_CLIENT_ID` | Optional | LinkedIn OAuth |
| `LINKEDIN_CLIENT_SECRET` | Optional | LinkedIn OAuth |
| `FACEBOOK_APP_ID` | Optional | Facebook/Instagram OAuth |
| `FACEBOOK_APP_SECRET` | Optional | Facebook/Instagram OAuth |
| `EMAIL_ENCRYPTION_KEY` | Optional | 32-byte hex for SMTP credential encryption |
| `FAL_AI_API_KEY` | Optional | fal.ai image/video generation |
| `DB_PASSWORD` | Option A | Bundled postgres container password |
| `HOST_PORT` | Optional | Local port Docker binds to. Default `80` |

> *One of `DATABASE_URL` or `SUPABASE_DATABASE_URL` must be set.

### Social OAuth callback URLs

| Platform | Callback URL |
|----------|-------------|
| Twitter/X | `https://seo.yourdomain.com/api/integrations/social/twitter/callback` |
| LinkedIn | `https://seo.yourdomain.com/api/integrations/social/linkedin/callback` |
| Facebook | `https://seo.yourdomain.com/api/integrations/social/facebook/callback` |
| Instagram | `https://seo.yourdomain.com/api/integrations/social/instagram/callback` |
| Google | `https://seo.yourdomain.com/api/integrations/google/callback` |

---

## Post-Setup Checklist

- [ ] App loads at your domain, login works
- [ ] `curl https://seo.yourdomain.com/api/healthz` returns `{"status":"ok"}`
- [ ] Settings → AI Provider — add your OpenAI key
- [ ] Settings → Integrations — configure social OAuth apps
- [ ] Settings → Email — set up SMTP
- [ ] Change admin password from Settings → Security
- [ ] Set up database backups

---

## Upgrading

### Docker Compose

```bash
# Source package:
git pull && docker compose down && docker compose up -d --build

# Pre-built: re-download new prebuilt ZIP and re-run:
docker compose -f docker-compose.prebuilt.yml down
docker compose -f docker-compose.prebuilt.yml up -d --build
```

Schema migration runs automatically on each startup (idempotent).

### Kubernetes

```bash
docker build -f Dockerfile.prebuilt -t ghcr.io/your-org/seocommand:v1.1.0 .
docker push ghcr.io/your-org/seocommand:v1.1.0
kubectl -n seocommand set image deployment/seocommand-app \
  app=ghcr.io/your-org/seocommand:v1.1.0
kubectl -n seocommand rollout status deployment/seocommand-app
```

---

## Troubleshooting

### "DATABASE_URL must be set"
Either `DATABASE_URL` or `SUPABASE_DATABASE_URL` must be present in the environment.

### "SESSION_SECRET environment variable is required"
Generate one: `openssl rand -hex 32`

### SSL error connecting to Supabase
Use the **transaction pooler** URL (port **6543**), not the direct connection
(port 5432 is blocked by most firewalls/Replit).

### Blank page / 404 on page refresh
nginx must serve `index.html` as the SPA fallback. The bundled nginx config
already does this. On bare metal, verify `try_files $uri $uri/ /index.html;` is
in your nginx config.

### All API requests return 401 after restart
`SESSION_SECRET` changed between restarts — all JWTs are invalidated. Set a
stable value in `.env`.

### Schema out of date after upgrade

```bash
# Docker Compose
docker compose exec app node /schema-runner/node_modules/.bin/drizzle-kit \
  push --force --config ./lib/db/drizzle.config.ts

# Bare metal (source install)
pnpm --filter @workspace/db run push-force
```

### Check logs

```bash
docker compose logs -f app          # Docker Compose
docker compose logs -f db
sudo journalctl -u seocommand -f    # bare metal systemd
kubectl -n seocommand logs -f deployment/seocommand-app   # Kubernetes
```
