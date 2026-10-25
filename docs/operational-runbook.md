# ForgeFlow Operational Runbook

This operational runbook provides production-grade operational procedures, health triage guidelines, structured log inspection patterns, service lifecycle management, secret rotation runbooks, and incident rollback instructions for the ForgeFlow B2B platform.

---

## 1. Service Health & Readiness Architecture

ForgeFlow exposes unauthenticated, un-cached health probes under `/health`:

| Endpoint | Path | Intended Consumer | Purpose | Success Code |
| :--- | :--- | :--- | :--- | :--- |
| **Liveness** | `GET /health/live` | Container orchestrators (Docker, K8s, Nomad) | Verifies process availability and event loop responsiveness | `200 OK` (`{"status": "alive"}`) |
| **Readiness** | `GET /health/ready` | Ingress routers, Load Balancers, Deployment Gates | Verifies active DB connectivity (`SELECT 1`) and Alembic migration synchronization (`alembic_version == '0006_customer_exports'`) | `200 OK` (`{"status": "ready", "database": "connected", "migrations": "synchronized"}`) |

### Health & Readiness Triage Matrix

When `/health/ready` returns a non-200 status code, ingress controllers will stop routing traffic to the instance to prevent serving degraded or corrupted states.

| HTTP Code | Error Code | Root Cause | Immediate Triage Action |
| :--- | :--- | :--- | :--- |
| **503 Service Unavailable** | `DATABASE_UNAVAILABLE` | Backend cannot execute `SELECT 1` via connection pool. PostgreSQL may be down, network partition, or connection credentials invalid. | 1. Check database container status: `docker compose ps db`<br>2. Inspect database logs: `docker compose logs db --tail 50`<br>3. Verify DB credentials in `.env` match PostgreSQL cluster. |
| **503 Service Unavailable** | `MIGRATIONS_OUTDATED` | Database `alembic_version` does not match backend target head `0006_customer_exports`. Occurs when new application container is launched before database migrations execute. | 1. Run migrations: `docker compose exec backend uv run alembic upgrade head`<br>2. Inspect version: `docker compose exec db psql -U forgeflow -d forgeflow -c "SELECT version_num FROM alembic_version;"` |
| **500 Internal Server Error** | `HEALTH_CHECK_FAILED` | Unexpected internal exception during health probe. | Inspect application container logs for stack trace: `docker compose logs backend --tail 100` |

*Security Note: Health probes never leak database hostnames, usernames, passwords, or detailed connection strings into JSON responses.*

---

## 2. Telemetry, Structured Logging & Request Tracing

### Request Correlation (`X-Request-ID`)

ForgeFlow tags every incoming HTTP request with a unique correlation ID:
- If the incoming request specifies an `X-Request-ID` matching `^[A-Za-z0-9_\-\.]{1,64}$`, that identifier is preserved for end-to-end tracing across reverse proxies.
- If missing, invalid, or oversized, ForgeFlow generates a cryptographically secure UUIDv4 and returns it in the response header `X-Request-ID`.

### Production Structured Logs

In production environments (`APP_ENV=production`), ForgeFlow formats all log emissions as single-line JSON records written directly to `stdout`.

#### Record Schema
```json
{
  "timestamp": "2026-10-25T03:30:00.123456Z",
  "level": "INFO",
  "logger": "forgeflow.request",
  "message": "POST /api/v1/proposals/4c8a2b5e-1234-5678-90ab-cdef12345678/submit 200 OK (14.2ms)",
  "request_id": "7f8b9a10-c123-4567-89ab-cdef01234567",
  "method": "POST",
  "path": "/api/v1/proposals/4c8a2b5e-1234-5678-90ab-cdef12345678/submit",
  "status_code": 200,
  "duration_ms": 14.21,
  "client_ip": "10.0.0.1"
}
```

### Log Querying & Correlation Runbook

#### 1. Filter Logs by Request ID
```bash
docker compose logs backend --tail 1000 | grep "7f8b9a10-c123-4567-89ab-cdef01234567"
```

#### 2. Monitor Slow Requests (>250ms)
```bash
docker compose logs -f backend | jq 'select(.duration_ms > 250)'
```

#### 3. Monitor 5xx Server Errors
```bash
docker compose logs -f backend | jq 'select(.status_code >= 500)'
```

### Redaction Policy

ForgeFlow automatically redacts sensitive tokens, passwords, cookies, authorization bearer headers, and commercial unit costs from all telemetry logs. Log analyzers will see `"[REDACTED]"` for sensitive fields.

---

## 3. Service Lifecycle & Container Management

ForgeFlow operates as a containerized stack managed via Docker Compose.

### Starting Stack
```bash
# Start all services in detached mode
docker compose up -d

# Verify container health
docker compose ps
```

### Restarting Services
```bash
# Graceful restart of backend
docker compose restart backend

# Graceful restart of frontend
docker compose restart frontend

# Full restart with clean dependency order
docker compose down && docker compose up -d
```

### Hot Configuration Reload
Environment variables are injected into containers at container start. After modifying `.env`:
```bash
docker compose up -d --force-recreate
```

---

## 4. Secret & Credential Rotation Procedures

### Rotating `APP_SECRET_KEY`

`APP_SECRET_KEY` signs session cookies and CSRF tokens. Rotating this secret immediately invalidates all active browser sessions and CSRF tokens, forcing re-authentication.

1. **Notify Users**: Schedule a brief maintenance window (all active sales reps and managers will be logged out).
2. **Generate Secret**:
   ```bash
   python3 -c "import secrets; print(secrets.token_urlsafe(48))"
   ```
3. **Update Configuration**:
   Update `APP_SECRET_KEY` in `.env` (or production secret store / Vault).
4. **Recreate Backend**:
   ```bash
   docker compose up -d --force-recreate backend
   ```
5. **Verify**:
   Execute smoke test:
   ```bash
   make smoke
   ```

### Rotating Database Credentials (`POSTGRES_PASSWORD`)

1. **Alter Password in Database**:
   ```bash
   docker compose exec db psql -U forgeflow -d postgres -c "ALTER USER forgeflow WITH PASSWORD 'NEW_STRONG_PASSWORD';"
   ```
2. **Update Environment**:
   Update `POSTGRES_PASSWORD` and `DATABASE_URL` in `.env`.
3. **Recreate Services**:
   ```bash
   docker compose up -d --force-recreate db backend
   ```
4. **Validate Readiness**:
   ```bash
   curl -i http://localhost:8000/health/ready
   ```

---

## 5. Common Operational Incidents & Triage Runbooks

### Incident 1: User Receives HTTP 403 `CSRF_FAILED`
- **Cause**: Browser cookie `forgeflow_csrf` does not match request header `X-CSRF-Token` or origin header differs from allowed CORS origins.
- **Triage**:
  1. Verify browser origin matches `CORS_ORIGINS` in `.env`.
  2. Inspect whether a proxy stripped cookies or headers (`SameSite=Lax` issues over insecure HTTP).
  3. User action: Refresh browser page or log out and log back in to renew CSRF token.

### Incident 2: User Receives HTTP 409 `REVISION_LOCKED` or `PROPOSAL_NOT_SUBMITTED`
- **Cause**: Maker-checker governance prevents editing locked quote revisions or approving proposals that are not in `submitted` status.
- **Triage**:
  1. Inspect quote status in UI or database.
  2. If revision was already approved or committed, modifications must be done via a new `QuoteChangeProposal`.
  3. Run audit verification:
     ```bash
     make verify-audit
     ```

### Incident 3: Rapid Export Requests Return HTTP 429 `RATE_LIMITED`
- **Cause**: Endpoint rate limiter protects compute-heavy PDF generation (`10 requests / 60 seconds` per client).
- **Triage**:
  1. Wait 60 seconds for sliding window bucket to reset.
  2. If automated service requires bulk exports, batch downloads sequentially with throttling.

---

## 6. Rollback Procedures

If a deployment introduces a critical regression:

### 1. Revert Container Image or Git Commit
```bash
git checkout <PREVIOUS_STABLE_COMMIT_HASH>
docker compose build
docker compose up -d
```

### 2. Database Migration Rollback (if required)
If database schema must be rolled back:
```bash
# Downgrade by 1 migration step
docker compose exec backend uv run alembic downgrade -1

# Verify migration head
docker compose exec db psql -U forgeflow -d forgeflow -c "SELECT version_num FROM alembic_version;"
```

### 3. Full Point-in-Time Database Restore
If data corruption occurred, execute the isolated database restore procedure documented in `docs/backup-restore.md`.
