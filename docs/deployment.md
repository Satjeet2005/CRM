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

## 2. Configuration & Secrets

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
