# ForgeFlow Deployment & Operations Guide

## 1. Container Topology

ForgeFlow runs as three cooperative services:
1. `db`: PostgreSQL 16 container with persistent volume. Internal network access only; not exposed publicly.
2. `backend`: Python 3.12 / FastAPI server managed via Uvicorn. Exposes port 8000 internally.
3. `frontend`: Next.js 16 standalone production build. Exposes port 3000.

In production deployments (e.g. via Coolify / Docker Compose with Caddy or Traefik):
- A reverse proxy terminates TLS and routes traffic:
  - `/` -> `frontend:3000`
  - `/api/v1/*` -> `backend:8000`
  - `/health/*` -> `backend:8000`

---

## 2. Cloudflare Workers Frontend Hosting (OpenNext)

The ForgeFlow frontend is configured for deployment as a Cloudflare Worker using `@opennextjs/cloudflare`.

### 2.1 Architecture & Routing
- **Worker Name**: `crm`
- **Adapter**: `@opennextjs/cloudflare`
- **Routing**:
  - Static assets (`/_next/static/*`, `/public/*`) are served directly from Cloudflare edge asset storage (`ASSETS` binding) with 1-year immutable caching.
  - Next.js dynamic App Router pages and Server Components execute in `workerd` (Cloudflare Workers runtime).
  - Next.js rewrites in `next.config.ts` transparently forward:
    - `/api/v1/:path*` -> `INTERNAL_API_URL/api/v1/:path*`
    - `/health/:path*` -> `INTERNAL_API_URL/health/:path*`
  - Browser requests remain same-origin, preserving session cookies (`forgeflow_session`), CSRF tokens (`forgeflow_csrf`), and credentials without cross-origin cookie restrictions.

### 2.2 Cloudflare Project Settings
In the Cloudflare Dashboard:
- **Project / Worker Name**: `crm`
- **Connected Repository**: `Satjeet2005/CRM`
- **Production Branch**: `master`
- **Root Directory**: `frontend`
- **Build Command**: `pnpm exec opennextjs-cloudflare build`
- **Deploy Command**: `pnpm exec opennextjs-cloudflare deploy`
- **Environment Variables**:
  - `INTERNAL_API_URL`: `https://forgeflow-backend-preview.onrender.com` (Build and runtime variable)

### 2.3 Backend `FRONTEND_ORIGIN` Requirement
Once the Worker URL or custom domain is active (e.g., `https://crm.<your-subdomain>.workers.dev` or `https://crm.yourdomain.com`):
- Update `FRONTEND_ORIGIN` in the Render FastAPI backend service to match the exact public origin of the Cloudflare Worker.
- This ensures FastAPI's CORS middleware and cookie policies permit cross-service communication while keeping strict security boundaries.

### 2.4 Local Cloudflare Preview & Verification
To test the Cloudflare Workers build and runtime locally:
```bash
cd frontend
pnpm build
INTERNAL_API_URL=https://forgeflow-backend-preview.onrender.com pnpm preview
```
This builds with OpenNext and starts the local Workers emulator on `http://localhost:8787`.

### 2.5 Troubleshooting
- **Backend Cold Start**: Render's free tier backend service may hibernate after inactivity, taking 50–60s to boot on the first `/health/ready` probe. The frontend's login interface includes automatic readiness polling and status banners to guide the user.
- **Wrangler workerd Compatibility**: If local preview reports a compatibility date mismatch with `workerd`, ensure `wrangler.jsonc` specifies a compatibility date supported by the installed `workerd` engine (e.g. `2026-10-26`).

---

## 3. Configuration & Secrets

Environment variables are passed via `.env`:
- `APP_ENV=production`
- `DEMO_MODE=false` (strictly required in production)
- `APP_SECRET_KEY`: High-entropy 64-character random string.
- `DATABASE_URL`: Connection string to private PostgreSQL container.
- `FRONTEND_ORIGIN`: Exact public HTTPS origin (e.g., `https://forgeflow.example.com`).

Startup checks in `backend/app/config.py` fail immediately if:
- `DEMO_MODE=true` in `APP_ENV=production`
- `APP_SECRET_KEY` matches any known default or is fewer than 32 characters long.
- Cookies lack the `Secure` flag in production.

## 3. Database Migrations

Database migrations are executed via Alembic:
```bash
alembic upgrade head
```
In Docker Compose deployments, the backend container's entrypoint runs migrations before starting Uvicorn, guaranteeing schema synchronization prior to serving requests.

## 4. Reset & Rollback Rules

- `make reset-db` executes destructive dropping and recreating of database schemas. It verifies `APP_ENV` and terminates with an error if executed in `production`.
- PostgreSQL database volumes (`pgdata`) persist across `make down` and container rebuilds.
