# ForgeFlow — B2B Operations Platform

ForgeFlow is an integrated, production-minded B2B operations platform connecting:
- **CRM**: Accounts, contacts, opportunities, and activities.
- **RFQ Line-Item Normalizer**: Deterministic CSV ingestion, specification parsing, catalog matching, and human review.
- **Model Change Review Lab Patterns**: Review-before-write proposals, formula/diff calculation traces, optimistic concurrency, and atomic commits applied to commercial quotations.

> [!WARNING]
> **Synthetic Demo Mode & Security Notice**
> All seeded accounts and customer data are completely synthetic. Seeded demo credentials (`ForgeFlowDemo!2026`) are enabled only when `DEMO_MODE=true` in development/demo environments. Never deploy with demo credentials or default secrets in production. ForgeFlow does not imply affiliation or endorsement by Auribises.

---

## 1. Technology Stack

- **Architecture**: Modular monolith with one frontend, one FastAPI API, and one PostgreSQL database.
- **Frontend**: Next.js 16 App Router (React 19, TypeScript strict mode), Tailwind CSS 4, Base UI primitives (`@base-ui/react`), Motion (`motion/react`), `lucide-react`, TanStack Query & Table, React Hook Form + Zod, `sonner`, date-fns. Pinned `pnpm@11.0.0` with locked dependencies.
- **Backend**: Python 3.12 managed by `uv` (`uv.lock`), FastAPI, Pydantic v2, SQLAlchemy 2.0, Psycopg 3, Alembic migrations, `pwdlib[argon2]` (Argon2id password hashing).
- **Database**: PostgreSQL 16 on private network / loopback bind (`127.0.0.1:5434:5432`).
- **Testing**: Pytest & Httpx (backend), Vitest & Testing Library (frontend unit/components), Playwright & axe-core (headless Chromium across Desktop, Tablet, and Mobile viewports).

---

## 2. Quickstart & Local Setup

### Prerequisites
- Node.js 22 LTS or compatible, `pnpm` (`corepack enable`)
- Python 3.12, `uv`
- Docker & Docker Compose v2

### Setup Steps

1. **Clone and configure environment**:
   ```bash
   cp .env.example .env
   ```

2. **Start Database and run migrations**:
   ```bash
   make up
   ```
   This boots PostgreSQL in Docker (port 5434 on host to avoid local port 5432 conflicts), waits for DB health, and executes Alembic migrations.

3. **Seed synthetic demo data**:
   ```bash
   make seed
   ```

4. **Run Local Development Services**:
   - Backend:
     ```bash
     cd backend && uv run uvicorn app.main:app --reload --port 8000
     ```
   - Frontend:
     ```bash
     cd frontend && pnpm dev
     ```
   - Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 3. Demo Credentials (`DEMO_MODE=true`)

| Role | Email | Password | Allowed Capabilities |
|---|---|---|---|
| Sales Representative | `sales@forgeflow.demo` | `ForgeFlowDemo!2026` | CRM entities, RFQ review, quote drafting, discount proposals |
| Sales Manager | `manager@forgeflow.demo` | `ForgeFlowDemo!2026` | Pipeline view, proposal approval/rejection (maker-checker), audit feed |
| Catalog Reviewer | `catalog@forgeflow.demo` | `ForgeFlowDemo!2026` | Catalog products, SKU aliases, matching resolution |
| Administrator | `admin@forgeflow.demo` | `ForgeFlowDemo!2026` | User management, organization settings, catalog management |

The login screen at `/login` provides a visible **"Quick Role Select"** panel to populate demo credentials with a single click.

---

## 4. Developer Command Contract (`Makefile`)

| Command | Action |
|---|---|
| `make up` | Boots PostgreSQL Docker container, waits for readiness, runs Alembic migrations. |
| `make down` | Halts Docker containers while preserving database volume. |
| `make seed` | Idempotently seeds demo manufacturing organization and 4 demo accounts. |
| `make reset-db` | Destructive database wipe and re-seed (guarded to fail closed outside dev/test). |
| `make lint` | Runs Ruff (lint + format check) on backend and ESLint on frontend. |
| `make typecheck` | Runs Mypy on backend and `tsc --noEmit` on frontend. |
| `make test` | Runs Pytest (backend unit/integration/security) and Vitest (frontend components). |
| `make test-e2e` | Runs Playwright browser end-to-end tests across 1440x900, 1024x768, and 390x844 viewports. |
| `make build` | Builds Next.js production standalone package and Docker Compose images. |
| `make openapi-generate` | Regenerates `openapi.json` from FastAPI and `schema.d.ts` via `openapi-typescript`. |
| `make check` | Runs full quality gate in deterministic order (`lint` -> `typecheck` -> `test` -> `build`). |
| `make verify-audit` | Evaluates 9 relational, revision, and maker-checker invariants on the active database. |
| `make smoke` | Runs comprehensive production deployment smoke test against live running services. |
| `make backup` | Generates a compressed PostgreSQL `.dump` archive with TOC integrity check and SHA-256 digest. |
| `make restore-test` | Rehearses backup restoration into an isolated database, validating row counts and migrations. |
| `make release-preflight` | Preflight release gate checking lockfiles, config guards, migration heads, and PDF compiler. |

---

## 5. Architecture Documentation

Detailed documentation is stored in `docs/`:
- `docs/architecture.md`: Topology, modular monolith boundaries, and upstream code reuse.
- `docs/security.md`: Argon2id passwords, SHA-256 hashed sessions, CSRF headers, and RBAC matrix.
- `docs/API.md`: Implemented foundation endpoints and planned PRD endpoints.
- `docs/test-plan.md`: Test pyramid, dedicated test database safety guarantees, and commands.
- `docs/deployment.md`: Container topology, secrets configuration, and private DB rules.
- `docs/operational-runbook.md`: Production health triage, structured logs, container lifecycle, and secret rotation.
- `docs/backup-restore.md`: PostgreSQL backup procedures, TOC verification, and isolated disaster recovery rehearsals.
- `docs/audit-verification.md`: The 9 relational and commercial invariants, CLI usage, and incident remediation.
- `docs/security-review.md`: Secret governance, dependency CVE assessment, session security, and RBAC cost masking.
- `docs/performance-report.md`: Latency percentiles, WeasyPrint PDF throughput, and RFQ line-item normalization benchmarks.
- `docs/deployment-report.md`: Release preflight status, container build verification, and deployment instructions.
- `docs/data-dictionary.md`: Database tables, column constraints, and relationships.
- `docs/demo-script.md`: Guided end-to-end walkthrough for demo evaluators.
- `docs/agent-handoff.md`: Handoff instructions and phase seams for subsequent coding agents.
- `docs/architecture-decisions/`:
  - `ADR-0001`: Stack and Repository Shape
  - `ADR-0002`: Upstream Code Reuse and Licensing
  - `ADR-0003`: Session Management and CSRF Protection
  - `ADR-0004`: Canonical Route Resolution (`/app/dashboard`)
