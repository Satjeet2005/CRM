# ADR-0001: Modular Monolith Repository Shape and Technology Stack

## Status
Accepted

## Context
ForgeFlow is an integrated B2B operations platform connecting CRM, deterministic RFQ line-item normalization/matching, and model-change review workflows (review-before-write proposals, atomic commits, revision safety). The project needs a robust foundation that can be maintained and extended across multiple development phases without unnecessary operational complexity.

## Decision
We adopt a **modular monolith** architecture comprising:
1. **Frontend**: Next.js 16 App Router (React 19, TypeScript strict mode) styled with Tailwind CSS 4, utilizing `@base-ui/react` primitives (shadcn-compatible), `motion/react`, `lucide-react`, TanStack Query, TanStack Table, React Hook Form + Zod, and `sonner`. Managed with `pnpm` (exact version pinned in `package.json`, committed `pnpm-lock.yaml`).
2. **Backend**: Python 3.12 managed via `uv` (committed `uv.lock`), FastAPI, Pydantic v2, SQLAlchemy 2.0 (async/sync mapped domain entities with Psycopg 3), Alembic for schema migrations, and `pwdlib[argon2]` for password hashing.
3. **Database**: PostgreSQL 16 with UTC timestamps, UUID primary keys, and organization-scoped isolation.
4. **Local Runtime**: Docker Compose with services `db`, `backend`, and `frontend`. Host port for postgres defaults to `5434` (mapped to container `5432`) to prevent conflicts with local database processes.

No microservices, Redis, Kafka, or Kubernetes are introduced.

## Consequences
- Single version-controlled repository with clean boundaries between `frontend/` and `backend/`.
- Frontend and backend share an authoritative API contract generated via `openapi-typescript` directly from FastAPI OpenAPI.
- High developer velocity and straightforward local onboarding via `make` targets.
