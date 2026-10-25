.PHONY: all up down seed reset-db lint typecheck test test-e2e build check openapi-generate smoke verify-audit backup restore-test release-preflight

SHELL := /bin/bash
APP_ENV ?= $(shell grep -E '^APP_ENV=' .env 2>/dev/null | cut -d '=' -f2 || echo "development")
DEMO_MODE ?= $(shell grep -E '^DEMO_MODE=' .env 2>/dev/null | cut -d '=' -f2 || echo "true")

all: check

up:
	@if [ ! -f .env ]; then \
		echo "Creating .env from .env.example..."; \
		cp .env.example .env; \
	fi
	docker compose up -d db
	@echo "Waiting for PostgreSQL database to be healthy..."
	@docker compose exec -T db sh -c 'until pg_isready -U $${POSTGRES_USER:-forgeflow} -d $${POSTGRES_DB:-forgeflow}; do sleep 1; done'
	@echo "Applying Alembic database migrations..."
	@cd backend && uv run alembic upgrade head
	@echo "ForgeFlow database is up and migrated."

down:
	docker compose down

seed:
	@if [ "$(DEMO_MODE)" != "true" ]; then \
		echo "ERROR: DEMO_MODE is not true. Refusing to seed synthetic demo data in non-demo mode." >&2; \
		exit 1; \
	fi
	cd backend && uv run python3 -m app.seed.demo_seed

reset-db:
	@if [ "$(APP_ENV)" != "development" ] && [ "$(APP_ENV)" != "test" ]; then \
		echo "SAFETY VIOLATION: Refusing to reset database. APP_ENV is '$(APP_ENV)' (must be 'development' or 'test')." >&2; \
		exit 1; \
	fi
	@echo "Resetting development/test database..."
	docker compose down -v
	docker compose up -d db
	@docker compose exec -T db sh -c 'until pg_isready -U $${POSTGRES_USER:-forgeflow} -d $${POSTGRES_DB:-forgeflow}; do sleep 1; done'
	cd backend && uv run alembic upgrade head
	$(MAKE) seed

lint:
	@echo "=== Linting Backend (Ruff) ==="
	cd backend && uv run ruff check app tests
	cd backend && uv run ruff format --check app tests
	@echo "=== Linting Frontend (ESLint) ==="
	cd frontend && pnpm lint

typecheck:
	@echo "=== Typechecking Backend (Mypy) ==="
	cd backend && uv run mypy app
	@echo "=== Typechecking Frontend (TypeScript) ==="
	cd frontend && pnpm typecheck

test:
	@echo "=== Running Backend Tests (Pytest) ==="
	cd backend && uv run pytest
	@echo "=== Running Frontend Component Tests (Vitest) ==="
	cd frontend && pnpm test

test-e2e:
	@echo "=== Running Playwright Browser End-to-End Tests ==="
	cd frontend && pnpm test:e2e

openapi-generate:
	@echo "=== Generating OpenAPI TypeScript Definitions ==="
	cd backend && uv run python3 -c "import json; from app.main import app; json.dump(app.openapi(), open('../openapi.json', 'w'), indent=2)"
	cd frontend && pnpm generate:api

build:
	@echo "=== Building Frontend Production Standalone Build ==="
	cd frontend && pnpm build
	@echo "=== Building Docker Compose Images ==="
	docker compose build

check:
	@echo ">>> RUNNING FORGEFLOW QUALITY GATES IN DETERMINISTIC ORDER <<<"
	$(MAKE) lint
	$(MAKE) typecheck
	$(MAKE) test
	$(MAKE) build
	@echo ">>> ALL QUALITY GATES PASSED SUCCESSFULLY <<<"

verify-audit:
	@echo "=== Verifying Database Business-History & Audit Invariants ==="
	cd backend && uv run python3 -m app.cli.verify_audit

smoke:
	@echo "=== Running ForgeFlow Deployment & Release Smoke Suite ==="
	cd backend && uv run python3 ../scripts/smoke.py

backup:
	@echo "=== Creating Timestamped Database Backup ==="
	./scripts/backup.sh

restore-test:
	@echo "=== Rehearsing Database Restore in Isolated Target ==="
	./scripts/restore_test.sh

release-preflight:
	@echo "=== Running Release Readiness Preflight Verification ==="
	cd backend && uv run python3 ../scripts/release_preflight.py
