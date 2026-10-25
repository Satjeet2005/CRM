# ForgeFlow Phase 7 Agent Prompt — Operational Hardening, Telemetry, Production Auditing & Release Readiness

**Role:** You are the Phase 7 / release-readiness agent for ForgeFlow. The previous delivery reports state that Phases 0–6 are complete. Your task is to verify that state against the actual repository, harden the integrated application for a controlled public demo, validate operational behavior, improve safe telemetry and audit verification, prepare/test backup and restore procedures, run the complete release smoke path, and produce an evidence-based deployment/handoff report.

**Required inputs:** `PRD.md`, `docs/agent-handoff.md`, `IMPLEMENTATION_REPORT.md`, `docs/architecture.md`, `docs/API.md`, `docs/data-dictionary.md`, `docs/security.md`, `docs/test-plan.md`, `docs/demo-script.md`, `docs/deployment.md` (if present), `docs/deployment-report.md` (if present), and the completion reports/ADRs for Phases 1–6 when available. The current repository—not a pasted completion claim—is the implementation truth. This prompt makes the Phase 7 work explicit; it does not supersede the PRD.

---

## 1. Product context and source-of-truth order

ForgeFlow is one B2B operations product integrating:

1. CRM and industrial catalog management.
2. RFQ ingestion, deterministic normalization, catalog matching and human line review.
3. Authoritative Decimal-based quotation calculations and calculation traceability.
4. Isolated quote-change proposals, maker-checker authorization, revision-safe atomic commits and an approval queue.
5. Customer-safe PDF/CSV exports, draft watermark governance, SHA-256 artifact fingerprints and durable export audit records.

The PRD defines the expected complete journey: CRM account/opportunity → RFQ import/review → quote generation → pricing change proposal → independent approval → atomic committed revision → final customer PDF/CSV → verifiable audit history.

Follow this precedence:

1. `PRD.md` is the canonical product contract.
2. The current code, current database migrations and current handoff documents establish what really exists.
3. This prompt translates the final hardening/release phase into concrete execution steps.
4. Completion reports are useful evidence claims, not proof by themselves. Re-run key checks and inspect the relevant code/configuration.

If the PRD, code and reports disagree, do not conceal the discrepancy. Follow the PRD unless it would break an established security/data invariant; in that case stop the affected change, write an ADR describing the conflict and safest resolution, and report what remains blocked. Do not silently rewrite `PRD.md`. Any requirement amendment must be explicit and recorded.

## 2. Strict scope

### In scope

- Read-only repository and environment preflight; establish a reproducible baseline before editing.
- Production configuration validation and a fail-closed production mode.
- Verification of health/readiness endpoints and safe reverse-proxy/same-origin behavior.
- Structured request telemetry: correlation/request IDs, duration, status, route/operation and safe actor context.
- Log redaction verification for credentials, session tokens, CSRF material, private business payloads, internal cost/margin data and uploaded RFQ content.
- Security and dependency/configuration review using tools that are present or are explicitly added as development-only tooling with justification.
- Audit integrity/consistency verification for sensitive business actions, proposal decisions, quote revisions, export attempts and customer-delivery fingerprints. Do not call a plain SHA-256 artifact digest a tamper-proof audit ledger.
- Release preflight and an automated full-workflow smoke test that follows the real persisted workflow from login through a final export.
- Backup/restore scripts and a restore rehearsal in an isolated, clearly identified non-production database or temporary environment.
- Measured performance and stability verification for the PRD's targets, with reproducible commands, environment notes and honest results.
- Hardened deployment scripts/configuration, deployment runbook, rollback/incident steps, known-limitations register and evidence-based release report.
- Deploy to the already-selected/configured target **only if valid credentials and explicit deployment configuration are already available**. Do not create paid infrastructure, alter DNS, buy domains, or make an irreversible production change without explicit authorization. A public deployment must be verified, not inferred.
- Documentation updates and the Phase 7 handoff.

### Out of scope

- No new product module or major UI redesign.
- No changes to authoritative RFQ normalization/matching thresholds, Decimal pricing formulas, calculator version, proposal operations, maker-checker invariants, export eligibility or watermark rules merely to make tests pass.
- No rewrite of authentication, opaque session-token storage, password hashing, CSRF, tenant isolation or role-based redaction unless a concrete verified security defect requires a narrow fix. Preserve established interfaces and add regression tests.
- No microservices, Kubernetes, Kafka, Redis, event queues, paid observability vendor, external LLM or new third-party business integration.
- No telemetry that records full request/response bodies, full RFQ uploads, full customer export bytes, cookies, access tokens or sensitive financial internals.
- No destructive database reset on a deployed or production-like database. Do not alter DNS or deploy to an unconfigured target.
- No broad dependency upgrades without compatibility analysis. Do not suppress security warnings or weaken tests to obtain a green build.
- Do not claim a production SLA, zero vulnerabilities, tamper-proof auditability, a successful public deployment or complete Phase 7 unless the required evidence exists.

---

## 3. Mandatory first actions: inspect and establish baseline

Before changing any file:

1. Run `pwd`, inspect the repository root, `git status --short --branch`, the current commit SHA, untracked files, migrations, lockfiles, Docker/Compose files, test commands, and the current deployment documentation. Do not overwrite user changes or discard uncommitted files.
2. Read all of `PRD.md`; specifically study Sections 12–18, the final release acceptance checklist, the operational targets, deployment shape, backup/reset rules, and required documentation artifacts. Review relevant requirements from Sections 6–11 for auth, tenancy, quotation, approvals and exports.
3. Read the Phase 6 `docs/agent-handoff.md`, Phase 6 ADR, `IMPLEMENTATION_REPORT.md`, and the actual code for:
   - settings and production environment validation;
   - authentication/session/CSRF/rate limiting;
   - SQLAlchemy engine/session lifecycle and Alembic migration flow;
   - request/correlation ID and logging middleware;
   - health/readiness routes;
   - organization-scoped authorization;
   - activity/audit tables and write paths;
   - quote revision/proposal lifecycle and maker-checker logic;
   - export events, delivery ledger, hashes and response headers;
   - Dockerfiles, `compose.yaml`/`docker-compose.yml`, reverse proxy and CI.
4. Run the current baseline commands before edits when the environment supports them: `make check`, `make test-e2e`, `make build`, and the documented clean-start/migration/seed flow. Inspect `Makefile` first so commands are not mistakenly assumed or unsafe. Record exact command, exit code and material output in a baseline note. If unavailable, state why.
5. Inspect actual migrations and verify the current `0006` export/audit schema exists before considering any schema change. Do not create a second export event/delivery table if the existing tables already serve those roles.
6. Establish the deployment target only from committed docs and configured environment. Inspect whether an existing public URL is already declared and whether deployment tooling/credentials exist. Do not print, copy or expose secret values while checking configuration.
7. Create `docs/phase-7-baseline.md` (or an equivalent section in `docs/IMPLEMENTATION_REPORT.md`) containing verified commit SHA, baseline results, migration head, service topology, deployment target state and known discrepancies.

If the baseline is red, classify each failure as pre-existing, environment-blocked or newly introduced. Fix failures within Phase 7 scope; do not falsely attribute existing failures to a new change.

---

## 4. Production configuration and deployment invariants

Inspect the live configuration implementation and enforce the PRD's production constraints.

### Required production guards

When `APP_ENV=production` or the repository's canonical production mode is active:

- `DEMO_MODE` must be `false`; startup must fail closed if demo mode is enabled.
- `APP_SECRET_KEY` must not equal any known example/default/placeholder value and must meet a strong minimum entropy/length rule supported by the current config. Never print the value in an exception.
- HTTPS-only cookie security must be enabled. Session cookies remain `HttpOnly`, `SameSite=Lax`, correct `Path` and secure in production; preserve the current session/CSRF design.
- Debug mode and development hot reload must be disabled.
- CORS must use exact, configured origins only. Prefer the PRD's same-origin `/api/v1` routing. Do not use wildcard CORS with credentialed session requests.
- `FRONTEND_ORIGIN`, trusted proxy settings, host allowlists and secure URL generation must match the configured deployment architecture. Do not trust arbitrary `X-Forwarded-*` headers from untrusted clients.
- PostgreSQL must not be publicly exposed. The application DB account must not be a superuser. Public exposure is limited to the explicitly intended TLS reverse-proxy/web ports (normally 80/443).
- Reset/seed commands must fail closed outside explicitly allowed development/demo modes.
- Runtime errors must not disclose environment variables, stack traces, SQL query values, connection strings, secrets, user existence, or foreign-tenant resource existence.
- Required configuration must validate at process startup with actionable but safe error messages.

Add unit/integration tests for each guard. Where an enforcement already exists, preserve it and improve test coverage rather than rewriting it.

### Deployment behavior

- Migrations run through a single controlled deployment migration step/job or the repository's existing single-writer gate. Do not allow every worker replica to race migrations.
- The application must not receive traffic before migration success and readiness.
- The database uses a persistent volume in demo hosting. `make down` must not delete it. Backups are performed before schema-affecting releases when a persistent target exists.
- The release must use pinned lockfiles and reproducible container builds.
- Do not publish a production login over HTTP. Enforce HTTPS and same-origin routing wherever the configured hosting target supports it.
- If an existing target such as Coolify is configured in the repo, validate and document that target rather than introducing a second deployment method. If the configured hosting target is not available to this agent, mark live deployment verification as `BLOCKED` and do not claim the exit criterion is met.

### Compose and container review

Inspect and correct only verified defects:

- DB healthcheck and service readiness dependencies are present.
- DB port binds to loopback locally or is not host-published when unnecessary.
- Runtime container uses a non-root user where compatible with native dependencies and mounted storage.
- Production frontend/backend images exclude `.env`, local databases, development caches, test artifacts and secret files.
- `.dockerignore` files are effective; inspect built image layers/configuration for obvious secret-copy risks.
- Signals, shutdown and connection cleanup behave correctly.
- Persistent volume and migration behavior are documented.
- WeasyPrint and system fonts/dependencies are installed in the final backend image; a PDF rendering smoke test must execute inside that built image, not only on the host.
- Healthchecks do not print credentials or depend on tools unavailable in the final image.

Do not optimize container layers at the cost of PDF rendering or reproducibility.

---

## 5. Telemetry and safe operational observability

The PRD requires safe request IDs, structured logs and response durations. Implement or verify an explicit, low-dependency telemetry contract. The demo must remain useful without a paid external monitoring service.

### Request/correlation ID

- Every HTTP request gets one server-generated correlation ID unless a valid incoming ID is accepted by a narrow documented format and length allowlist.
- The same identifier is returned in a response header (use the established header name; prefer `X-Request-ID`) and included in structured logs and safe error responses.
- Never trust an arbitrary incoming value as a log line. Reject or replace control characters, excessively long values and invalid syntax.
- The request ID is not an authentication token and must not be used to authorize data access.

### Structured request log contract

At minimum, deployed request logs should emit structured fields for timestamp, log level, request ID, method, normalized route template (not raw sensitive query values), status code, elapsed milliseconds, and safe actor/organization identifiers where useful and allowed. Include a deployment release identifier if configured.

- Prefer standard Python logging and the existing logging stack. Do not add an external logging SaaS SDK.
- Normalize dynamic paths to route templates where possible; avoid high-cardinality values like quote IDs as metric labels.
- Avoid logging complete request bodies, response bodies, Authorization/Cookie headers, `X-CSRF-Token`, session digests, passwords, raw uploaded CSV rows, product matcher payloads, quote calculation internals, cost/margin data, PDF/CSV artifact bytes, or query strings containing secrets.
- Exceptions may include safe class/code and request ID, but never embed secret-bearing config or uploaded content in error text.
- Ensure logs are single-record structured output in deployment, without user-controlled newline injection.
- Verify failures and 4xx/5xx paths also carry the request ID and safe duration/status fields.

### Error handling and frontend telemetry

- Verify unexpected backend exceptions return the standard safe error envelope and request ID; keep tracebacks server-side only.
- Verify the frontend's unexpected error boundary gives users a recovery path and does not expose server stack traces.
- Ensure client errors display actionable generic messages for `401`, `403`, `404`, `409`, `422`, `429` and `5xx` while preserving the existing domain-specific codes where appropriate.
- Do not log user input or customer commercial content from client-side telemetry. Use existing frontend logging/error UI only; do not add an analytics tracker without explicit approval and privacy review.

### Metrics policy

- First use request duration/status structured logs and reproducible load-test reports, which are sufficient for this demo.
- Do not add Prometheus/Grafana, OpenTelemetry collector, external agents or a new metrics endpoint unless an existing deployment target specifically requires it or the PRD already defines it. If an internal metrics endpoint already exists, ensure it is authenticated/restricted or exposes only non-sensitive aggregate health counters, and document its exposure.
- Do not use user IDs, organization IDs, quote IDs, RFQ IDs, file names or exception messages as high-cardinality metrics labels.

### Telemetry acceptance tests

Add automated tests to prove:

- Request ID appears in response and logs for successful, validation, authorization and unexpected-error requests.
- Invalid incoming request IDs are safely replaced.
- `Cookie`, `Authorization`, CSRF header values, passwords and RFQ payload content do not appear in captured logs.
- Exception responses never include traceback or secret configuration.
- Request timing/status are recorded without holding up request processing unnecessarily.

---

## 6. Audit verification and business-history consistency

Phase 7 must verify the reliability of the audit trail already created in Phases 2, 3, 5 and 6. Avoid inventing a new audit architecture if the current model already captures the required evidence.

### Audit sources to inspect

- `activities` for CRM/business timeline events.
- `rfq_line_decisions` and RFQ/import audit data.
- Quote revision history and the quote's `current_revision_id` pointer.
- `quote_change_proposals` and immutable `quote_approval_decisions`.
- Export attempt events and successful customer-delivery records introduced by Phase 6.
- Request/correlation IDs tying operational logs to API actions, where stored.

### Verify invariants

Create a read-only audit verification service/command that reports violations without modifying data. At minimum inspect:

1. Every current quote revision pointer resolves to a revision owned by that quote and organization.
2. Revision numbering is unique/sequential according to the repository's actual invariant; do not invent a renumbering repair.
3. A proposal marked committed refers to a persisted committed revision; a proposal that is pending/rejected/stale is not falsely the current canonical revision.
4. A committed proposal's base revision and resulting revision follow the exact persisted lifecycle rules.
5. Maker-checker decisions have distinct proposer and reviewer identities, with approved/rejected decision and required rejection rationale as defined by the current product contract.
6. RFQ line decision records point to lines/products within the expected organization and retain immutable actor/time snapshots.
7. Every successful final export event has a matching delivery record where required by the current model contract, and the record references the quote and exact persisted revision from the same organization.
8. Export SHA-256 is a well-formed lowercase hex digest; when the exact exported bytes are not retained by design, verify available metadata and document that the byte artifact can no longer be independently recomputed. Do not pretend a hash of stored metadata proves the bytes remain intact.
9. Failed/denied exports are represented as events if that is the documented contract, without leaking whether a foreign tenant's resource exists.
10. No routine API endpoint mutates or deletes append-only decision/delivery audit records.
11. Activity/event records include safe actor, event kind and timestamp fields where required by the current schema.
12. No customer export data contains internal costs/margins, matcher scores, internal notes or sensitive auth material.

The verification utility must:

- Run read-only by default; never auto-repair or delete history.
- Support a documented scope such as a database/organization and return nonzero exit status on invariant violations suitable for CI/release preflight.
- Print aggregate counts and safe identifiers only; do not dump customer payloads or internal financial details to stdout.
- Be deterministic and repeatable against a read-only snapshot or stable transaction where practical.
- Distinguish `PASS`, `FAIL` and `NOT CHECKABLE` when required evidence is absent by design.
- Provide clear remediation guidance without automatically mutating canonical records.

### Hash and tamper-evidence wording

A SHA-256 digest verifies the integrity of exact artifact bytes only when those bytes are available for re-hashing. It does not, by itself, make database audit rows append-only against a privileged database operator. Document this distinction honestly. Do not introduce hash-chain/WORM storage as a new infrastructure project unless the PRD or an existing ADR requires it. Enforce append-only behavior at the application/API layer and verify it through tests.

### Security and tenant-isolation audit

Extend existing tests or create a focused security regression matrix covering:

- Cross-organization access for account, contact, opportunity, task, catalog product/alias, RFQ/import job/line/decision, quote/revision/proposal/approval decision, export event and customer-delivery IDs.
- RBAC masking for internal unit cost, line cost, gross profit and margin in API responses, UI DTOs, traces, logs, exports and PDF templates.
- Attempted self-approval for every applicable role, including admin.
- Invalid/stale base revision and duplicate/idempotent approval retries.
- Export of unapproved/stale/foreign quote is rejected without data leakage.
- Malicious CSV cells and HTML/PDF fields remain neutralized/escaped.
- Production configuration rejects demo mode/default secrets/insecure cookies.

Do not blindly test only the frontend hiding buttons; call the backend APIs directly.

---

## 7. Readiness, migration and deployment smoke tooling

The PRD requires a simple deployment smoke script covering login, authenticated dashboard summary, migration status and quotation PDF generation. Reuse an existing script if one exists; improve it rather than adding a duplicate.

### Required smoke-test behavior

Provide a documented script/command such as `make smoke` or the repository's established equivalent. It must be explicitly configured via environment variables and must:

1. Verify `/health/live` returns safe liveness data.
2. Verify `/health/ready` checks DB connectivity and migration readiness without exposing DB credentials.
3. Confirm the deployed migration head matches the expected Alembic head, using a safe admin/deployment check—not by exposing internal migration details through an unauthenticated public endpoint unless the PRD already allows it.
4. Authenticate with an explicit demo/test identity only in an allowed demo/test environment, or use a configured secure test identity. Never hard-code a production password into scripts or CI.
5. Request `/api/v1/auth/me` and an authenticated real dashboard summary.
6. Query the catalog and verify safe schema/role filtering.
7. Exercise a seeded RFQ's known review-safe operation or validate the existing RFQ flow without unexpectedly mutating a deployed demo record.
8. Verify a quote in a known safe approved fixture can produce a non-empty PDF and CSV and that response SHA-256 matches the exact response bytes.
9. Verify a known draft/pending-approval quote cannot use the final export route and can only use the explicitly intended watermarked preview route if enabled.
10. Verify delivery/export audit metadata exists for the successful export.
11. Verify the process exits nonzero on an unexpected status, empty artifact, checksum mismatch, unsafe response, or readiness failure.

Use separate ephemeral records/organization when a test necessarily mutates data. If using seeded fixtures, verify they are expected and use idempotency keys. Do not destructively reset the deployed demo database during routine smoke testing.

### Health and readiness

- `/health/live` indicates process liveness only and does not attempt slow dependencies.
- `/health/ready` returns not-ready when the database is unavailable or required schema/migrations are incompatible.
- Public responses contain no connection string, database name/username/password, stack trace, environment dump or secret configuration.
- A database outage must not produce false healthy readiness.
- Configure bounded timeouts for readiness probes and DB checks.

### Release preflight

Provide a release preflight script/command that checks as much as safely possible without mutating the target:

- Working tree/commit information is captured.
- Production config validates with secrets redacted.
- Lockfiles are current and build commands can reproduce the images.
- Migration head and known pending migrations are identified.
- Security/audit verification utility passes against the target database where credentials permit.
- Database backup is created/verified before migration or release when a configured persistent target is being updated.
- Production image PDF renderer smoke test passes.
- Known expected demo mode is disabled in production.

Every destructive step requires an explicit flag and environment guard. A preflight must never reset a database, run a seed command in production, or automatically deploy.

---

## 8. Backup, restore and data-recovery verification

The PRD requires documented backup/restore commands. Do not stop at writing a command; test restoration into an isolated destination.

### Required outcomes

- Document the supported PostgreSQL version and actual backup method (`pg_dump` custom format or another repository-compatible method).
- Provide scripts/Make targets with clear commands for backup, backup verification, restore rehearsal and cleanup of only the temporary test destination.
- Backups must be timestamped, written to a configured path, permission-restricted, and not committed to Git or uploaded to an unapproved external service.
- Never embed database passwords in process arguments or logs. Prefer standard PostgreSQL environment/credential mechanisms and document their risks.
- A restore command must refuse to overwrite a non-empty/production database unless an explicit separate procedure and authorization are provided. The normal rehearsal path must target a clearly named isolated restore database/container.
- Verify backup integrity (for example, `pg_restore --list` for custom-format backups) and restore the snapshot into a separate disposable DB.
- After restore, run migration/state verification and a small read-only smoke check against the restored DB.
- Verify expected counts or stable invariants for organizations, accounts, catalog products, RFQs, quotes/revisions, proposals and export records without printing sensitive details.
- Explain the consistency point and whether the backup captures all required persisted records. Include expected downtime/limitations; do not invent RPO/RTO values.
- `make down` must not delete persistent volumes. `make reset-db` must retain its explicit development/test guard.
- If no configured backup destination or a DB utility is available, demonstrate the procedure against the local Compose database when possible and record any production-specific blocker.

Add a restore rehearsal result with timestamp, source environment classification (local synthetic only; never reveal secret source details), target isolation proof, and pass/fail result in `docs/backup-restore.md` or `docs/deployment-report.md`.

---

## 9. Performance and reliability measurement

The PRD performance objectives are targets for the seeded demo environment, not guaranteed SLAs. Measure actual behavior on a documented machine and report the result honestly.

### Required measurements

- Authenticated dashboard initial API call and/or overview flow p95.
- Normal list/detail API p95 for a 25-row page on seeded data.
- RFQ normalization/matching time for the current enforced maximum import size, confirming it is bounded and does not hold an unnecessarily long database transaction.
- Quote pricing/proposal preview and export request timing, distinguishing PDF CPU time from ordinary API latency.
- A short representative concurrent-request test of health, dashboard and read-only list endpoints (only against local/test/staging synthetic data). Avoid aggressive load against a public deployment.
- App cold start and readiness time only if useful; separate those from warm request latency.

### Measurement rules

- Record hardware/OS/container configuration, runtime versions, DB data volume/seed size, command, warmup policy, request count/concurrency, and output summary.
- Report p50/p95/p99 where the tool provides them, error rate and throughput; do not confuse frontend total load time with backend API latency.
- Compare against PRD targets (overview p95 <500ms; normal 25-row list/detail p95 <300ms) and state pass/fail/limited measurement accordingly.
- Use reproducible scripts and synthetic data only. Do not use fabricated latency numbers.
- If a target fails, identify the measured bottleneck and make only justified changes. Re-measure after changes. Do not add Redis, a queue, a new DB, caching or a third-party APM just to reach a target.
- Keep audit and security controls intact under concurrency. Include a small regression run ensuring concurrent stale commits remain rejected and do not create duplicate revisions.

---

## 10. Dependency, secret and security release review

Perform a focused release security review; do not claim a formal penetration test.

1. Run all existing lint, typecheck, unit, integration, E2E, build and accessibility gates.
2. Review dependency lockfiles and run the package managers' supported audit commands, if available. Separate direct vulnerable dependencies from transitive advisories, production dependencies from development-only dependencies, and actionable findings from false positives. Do not broadly update dependencies without compatibility and regression testing.
3. Run repository secret scanning if available (`gitleaks` or the project's approved equivalent). If not available, inspect `git status`, ignored files and tracked configuration for secrets and use the approved lightweight scan. Do not print matched secret values in the report; redact them and report file/path only.
4. Verify `.env`, local DB volumes, generated PDFs/CSVs, backup files, screenshots with sensitive content and cache/build directories are not accidentally tracked or included in release images.
5. Confirm no hard-coded demo credentials in production code paths or client bundle. Demo account details, where documented, are synthetic and available only when `DEMO_MODE=true`.
6. Review cookie flags, CSRF enforcement, exact origin/CORS configuration, trusted proxy headers, rate limiting, timeout/size limits, tenant filters and safe error responses.
7. Confirm PDF WeasyPrint URL fetch sandbox denies remote HTTP/HTTPS and filesystem traversal, and test injection fixtures remain in place.
8. Confirm formula injection tests include text values beginning with `=`, `+`, `-`, `@`, tab, carriage return, newline and leading whitespace/control variants while legitimate typed negative numeric values remain numerically represented.
9. Confirm no customer-facing export contains internal cost, gross profit, margin, matcher candidate internals, internal notes or auth metadata.
10. Confirm public health responses and structured logs do not leak secrets.
11. Document every meaningful unmitigated security advisory as `BLOCKER`, `ACCEPTED RISK` with rationale/owner, or `NOT APPLICABLE`; do not say “zero vulnerabilities” without reliable evidence.

If a security defect is found, fix it within narrow scope and add a regression test. If fixing it would require breaking migration or architectural changes, document and block release rather than silently accepting it.

---

## 11. End-to-end release verification

The core release test must exercise the actual integrated product against PostgreSQL. Prefer the existing Playwright/pytest infrastructure and synthetic fixtures; avoid building a second test framework.

### Required full journey

Use separate synthetic accounts/roles as required by the maker-checker invariant:

1. Start from a clean seeded synthetic database through the repository's guarded setup path.
2. Log in as sales representative and open the CRM dashboard; verify persisted metrics match API/database state.
3. Open an account/opportunity and import a synthetic RFQ fixture; verify raw text, normalization, candidate explanations, ambiguous/hard-incompatible behavior and saved human decisions.
4. Resolve the quote-readiness gate and create exactly one draft quote from the RFQ. Verify retry/idempotency cannot create duplicate quotes.
5. Edit draft quote lines and verify authoritative server-side Decimal totals, revision and calculation fingerprint/trace consistency.
6. Create a change proposal and prove the active committed revision does not change before approval.
7. Log in as a different eligible manager. Verify self-approval is rejected, valid manager review works, mandatory rejection rationale applies, and an approved proposal atomically creates the next revision.
8. Attempt stale/conflicting approval/commit and verify the documented `409`/stale behavior without duplicate revisions or partial writes.
9. Verify sales-role responses conceal sensitive cost/margin information, while an authorized role sees the allowed internal fields. Verify no internal fields appear in browser-visible customer preview or exports.
10. Verify the final export route rejects the unapproved lifecycle state and only the intentional watermarked draft preview is available if the PRD/config permits it.
11. After approval/commit, download final PDF and CSV for the approved current revision. Verify PDF is non-empty/parseable, expected text and totals are present, CSV headers/escaping/formula neutralization are correct, and artifact SHA-256 matches the exact response bytes.
12. Verify export event and delivery ledger records exist for the exact quote/revision, with actor, format, timestamp, hash and watermark status.
13. Run the read-only audit verification command against the same database and require no unexplained invariant violations.
14. Verify the dashboard/activity timeline reflects the persisted activity as specified.
15. Run the critical flow in browser E2E at desktop/tablet/mobile breakpoints, and keep Axe accessibility tests green.

The release test may use stable seeded records instead of creating every entity from scratch only if it proves that the fixture is resettable/idempotent and that all state transitions above were actually exercised. Tests must not silently skip key steps.

### Failure-path tests

Include or preserve tests for:

- DB temporarily unavailable → readiness fails safely.
- Invalid configuration in production → process fails closed.
- Session expiry/invalid CSRF → rejected mutation without side effect.
- Cross-tenant access → non-disclosing failure.
- Invalid/stale revision → conflict without partial write.
- Proposal self-approval → forbidden.
- Draft final export → denied and audit logged.
- PDF renderer unavailable → safe failure, no false successful delivery record.
- Artifact hash mismatch → smoke/preflight fails.
- Backup/restore invalid destination → script refuses to continue.

---

## 12. Deployment and release execution

First inspect `docs/deployment.md`, the existing host, deployment mechanism and configured secrets. Use only the currently configured target. If no target/credentials are available, complete local/staging operational readiness, document the missing prerequisites and report live deployment as blocked.

### Before deployment

1. Confirm current branch/commit and clean working tree or document preserved unrelated changes.
2. Run the full suite, production build, container build and renderer smoke test.
3. Validate production configuration without disclosing values.
4. Create and verify a database backup for an existing persistent environment before migration/release.
5. Inspect Alembic head and migration plan. Test forward migration from a copy of the existing schema/data. Do not treat downgrade as safe unless proven; do not run a destructive downgrade on live data.
6. Confirm production `DEMO_MODE=false`, secure cookies, exact allowed origin, trusted proxy configuration, DB private networking and non-default secret.
7. Run the audit consistency check and note pre-existing findings before release.
8. Record the exact release commit SHA and image tags.

### Controlled deployment

- Deploy only to the configured host/project already authorized by repository/environment settings.
- Do not open firewall ports or add paid resources, services, DNS records or domains without explicit configuration/authorization.
- Ensure DB migrations run once and succeed before the new app receives traffic.
- Confirm the new frontend/backend use the intended same-origin routing and HTTPS.
- Never dump secret environment values into deployment logs or reports.
- If deployment fails, preserve useful logs with secrets redacted and follow the documented rollback strategy; do not delete data or volumes in a panic.

### Post-deployment smoke

Run the documented smoke command against the actual deployed URL and verify:

- TLS certificate and HTTPS redirects work.
- `/health/live` and `/health/ready` return correct safe states.
- Login and `auth/me` work with the configured authorized demo/test account.
- Dashboard and catalog API return data and role masking behaves correctly.
- Full RFQ → quote → proposal → separate manager approval → final export flow passes against synthetic demo data if safe to run on that target.
- PDF renderer has correct fonts/native dependencies in the actual production image.
- Export hashes/delivery events are recorded and audit verification passes.
- No browser console errors, API stack traces, exposed secrets, unexpected horizontal overflow or obvious broken navigation appear in the critical demo screens.
- PostgreSQL cannot be reached from the public internet/host interface that is intended to be private.

If the configured environment cannot safely support stateful E2E mutations, use a dedicated synthetic staging organization/database and state the limitation. Do not run a destructive reset against a shared public demo.

### Rollback

Document rollback steps for a bad application release, including when DB migration rollback is unsafe. Prefer reverting application image/config if schema is backward-compatible; if not, stop and document the forward-fix plan. Never imply that restoring a database backup is safe without testing it and understanding data loss since that backup.

---

## 13. Observed discrepancy review

The supplied phase reports are helpful but have included different details across phases. Before marking done, verify and document actual behavior for discrepancies such as:

- RFQ upload size/row limits in the PRD versus the Phase 3 report.
- quote/proposal status spellings and allowed transitions in DB enums versus docs.
- route/file path differences in prior reports.
- migration IDs, migration head and whether both export audit responsibilities are actually covered.
- the distinction between “committed” and “approved/sent” for final export eligibility.

The PRD is canonical, but do not make a last-minute data-changing adjustment without inspecting impact. Create a concise ADR or discrepancy table with `PRD requirement`, `current implementation`, `risk`, `chosen resolution`, `tests`, and `remaining limitation`. If a mismatch materially affects safety, correctness or the release acceptance checklist, treat it as a release blocker until resolved or explicitly approved as a deviation.

---

## 14. Required documentation and artifacts

Update only what is supported by implemented behavior. At minimum create or refresh:

1. **`docs/phase-7-baseline.md`** — initial commit, current migration head, exact baseline commands/results, service topology, target state and pre-existing findings.
2. **`docs/operational-runbook.md`** — health/readiness, safe log lookup by request ID, restarting services, failure triage, known error codes, release and rollback steps.
3. **`docs/backup-restore.md`** — exact backup/restore commands, isolated restore rehearsal evidence, permissions, storage guidance and limits.
4. **`docs/audit-verification.md`** — data sources checked, invariant definitions, command usage, result semantics, limitations and remediation guidance.
5. **`docs/security-review.md`** — scope of the release security review, tools and exact results, accepted risks, blockers and limitations. Do not call it a penetration test unless one was actually performed.
6. **`docs/performance-report.md`** — environment, fixture sizes, benchmark commands, p50/p95/p99/errors where available, measured target comparison and bottleneck analysis.
7. **`docs/deployment-report.md`** — deployed URL if verified, commit SHA, image/version identifiers, migration head, HTTPS/health/smoke results, backup evidence, audit result, date/time and known limitations. If deployment is blocked, state `BLOCKED` and name the missing prerequisite without disclosing secret details.
8. **`docs/test-plan.md`** — current commands and results, with Phase 7 smoke/telemetry/audit/restore checks added.
9. **`docs/security.md`** — reflect actual production config, log redaction, audit guarantees and known limits.
10. **`docs/architecture.md`** — update only where telemetry/audit operations materially affect architecture.
11. **`README.md`** — exact setup, production-mode guard, smoke command, backup/restore pointer, demo-mode warning, and actual deployment status.
12. **`IMPLEMENTATION_REPORT.md`** — phases 0–7 checklist with completed/blocked/not-applicable status and evidence.
13. **`docs/agent-handoff.md`** — final state, commands actually run, files changed, remaining defects, deployment/hosting state, and recommended next actions.
14. **ADRs** — add a new ADR only for a meaningful architectural choice, using the next available number; never overwrite existing ADRs.

Do not hardcode report claims like “100% complete” unless all corresponding acceptance items have evidence. Keep `PRD.md` unchanged unless formally approved.

---

## 15. Required command contract

Preserve the existing command names and behavior. Add or extend targets only where needed; inspect the actual `Makefile` first. By handoff, provide documented equivalents for:

- `make check` — existing lint, typecheck, tests and build gates.
- `make test-e2e` — current browser suite with accessibility checks.
- `make build` — production frontend/backend images.
- `make smoke` — safe configurable release/deployment smoke test.
- `make verify-audit` (or the existing chosen name) — read-only audit consistency check.
- `make backup` — create a local/target-configured backup only after explicit path/configuration is provided.
- `make restore-test` — restore only into a dedicated isolated destination and verify the result.
- `make release-preflight` — read-only checks plus backup reminder/evidence; must never deploy automatically or reset the DB.

If a command is dangerous, fail closed when required environment/flags are missing. Print a clear reason without printing secrets. Ensure exit status is reliable and no target masks a failed subcommand.

---

## 16. Final acceptance criteria

Do not mark Phase 7 complete unless every applicable item has observable evidence.

### Application and configuration

- [ ] Clean documented startup/build path succeeds from a clean-like checkout using lockfiles.
- [ ] Production mode refuses demo accounts, default secrets, insecure cookies and invalid required config.
- [ ] Database is private; only intended HTTPS web/reverse-proxy traffic is public.
- [ ] Migrations run once through a controlled step and application readiness requires compatible schema.
- [ ] `/health/live` and `/health/ready` behave distinctly and safely.
- [ ] PDF renderer works in the built production image with expected fonts and no remote URL fetching.

### Telemetry and security

- [ ] Request IDs correlate response, logs, errors and audit events where defined.
- [ ] Logs include safe duration/status fields and do not log secrets or sensitive payloads.
- [ ] Secret/config scans are reported with values redacted.
- [ ] Dependency review is documented accurately; unresolved material issues are release blockers or explicitly accepted risks.
- [ ] Cross-tenant access, role masking, CSRF/session, maker-checker and export gating tests stay green.
- [ ] Security error responses do not reveal foreign resource existence, stack traces or sensitive data.

### Audit and recovery

- [ ] Read-only audit verification checks quote revision/proposal/decision/export invariants and returns correct exit status.
- [ ] Append-only audit records cannot be updated/deleted through normal user APIs.
- [ ] Export hashes are checked against exact bytes at download/smoke time, and docs accurately explain later independent-verification limitations.
- [ ] A backup is created and integrity-checked in an allowed environment.
- [ ] A restore rehearsal passes against an isolated destination without overwriting the source/live database.
- [ ] Persistent volumes survive `make down`; reset remains environment guarded.

### Workflow and quality

- [ ] One full synthetic RFQ-to-approved-quote-to-export workflow passes using separate maker/checker identities.
- [ ] Final PDF/CSV corresponds to the exact approved committed revision, and no internal costs/margins leak.
- [ ] Draft final export remains blocked; watermark preview behavior is correct if enabled.
- [ ] Audit verification passes after the workflow.
- [ ] `make check`, `make test-e2e`, `make build`, smoke, audit verification and restore tests pass or are transparently marked blocked with evidence.
- [ ] Performance targets are actually measured and outcomes stated honestly.
- [ ] Desktop/tablet/mobile critical paths have been inspected; Axe and existing accessibility checks remain green.

### Deployment and documentation

- [ ] Live deployment has verified HTTPS, correct commit/version, migration revision, safe health and post-deployment smoke if deployment credentials/target are available.
- [ ] If deployment is not possible, Phase 7 report explicitly remains partially blocked; no fake public URL or claim of completion is provided.
- [ ] Backup/restore, operational, audit and security runbooks are usable and tested.
- [ ] README and docs match the actual code and command behavior.
- [ ] Handoff report includes exact commands/results, known limits and unresolved blockers.

**Release blockers:** any cross-tenant disclosure, secret/session leakage, unauthorized/self-approved proposal commit, stale revision corruption, incorrect authoritative quote totals, final export of an unapproved quote, internal cost/margin leakage, missing required audit record for a successful export, destructive restore/reset risk, publicly exposed PostgreSQL, or nonfunctional core release workflow blocks release.

---

## 17. Execution order

Follow this order and keep the repo green as you work:

1. Read the complete PRD and current handoff; inspect Git state and the actual project tree.
2. Run and record baseline checks; distinguish existing failures from new failures.
3. Inspect production config, Docker/Compose, reverse proxy, migrations, health endpoints, logging, audit writes and export behavior.
4. Write the Phase 7 baseline note and discrepancies table before changing code.
5. Implement narrow configuration/health/logging fixes with regression tests.
6. Implement or strengthen read-only audit verification and tests against PostgreSQL.
7. Implement/test smoke and release-preflight commands.
8. Implement backup/restore scripts and perform the restore rehearsal in a distinct isolated target.
9. Run dependency/secret/security review and document findings.
10. Measure performance using synthetic fixtures, make justified changes only, and re-measure.
11. Run the complete end-to-end journey; fix regressions without changing domain invariants.
12. Build production images, run renderer smoke and release preflight.
13. Deploy to the existing explicitly configured target if available and authorized; otherwise report the exact blocker.
14. Run post-deployment smoke/audit checks where applicable.
15. Update all required docs and `docs/agent-handoff.md`.
16. Produce a final implementation report with evidence and honest status for every acceptance criterion.

Do not stop after writing documentation or adding scripts. Execute them. Do not introduce broad changes late in the phase without running the full suite again.

---

## 18. Final handoff report format (required)

Return a structured report with these sections:

1. **Overall status:** `PASS`, `PARTIALLY BLOCKED`, or `FAIL`; do not use “100% complete” if a required exit criterion is blocked.
2. **Verified starting state:** initial commit SHA, migration head, baseline failures and pre-existing discrepancies.
3. **Changes implemented:** exact files/modules and behavior, separating fixes from documentation.
4. **Telemetry:** request-ID behavior, log fields, redaction checks, observed examples with identifiers/values redacted.
5. **Audit verification:** invariants checked, rows/counts summarized, result, limitations and any failures.
6. **Backup/restore:** exact command, isolation proof, integrity check, restored DB checks and outcome.
7. **Security review:** tools executed, dependency findings, secret scan result, open risk list; distinguish audit from penetration testing.
8. **Performance results:** machine/container, dataset sizes, commands, measured percentiles/errors, PRD target comparison.
9. **Full workflow verification:** each step of RFQ → quote → proposal → separate approval → export, including role identities by role name only and artifact hash verification.
10. **Quality gate table:** exact command, `PASS`/`FAIL`/`BLOCKED`, outcome summary and duration where available.
11. **Deployment status:** public URL only if actually verified; exact release commit, image tags, migration revision, TLS/health/smoke status, or blocker.
12. **Documentation created/updated:** exact paths.
13. **Known limitations and release blockers:** priority, risk, and resolution or owner/next action.
14. **Final handoff:** how to start, seed, smoke-test, verify audit, backup, restore-test, and safely release/rollback.

Do not expose secret values, private credentials, full customer payloads or sensitive cost/margin information in the final report. It is acceptable and required to say that public deployment was blocked by missing credentials or infrastructure; never claim deployment was completed unless verified by direct smoke tests.

**Success means:** the whole integrated ForgeFlow workflow has been operationally validated, its production assumptions are enforced rather than merely documented, its audit trail has a repeatable verification path, a backup can be restored safely in isolation, and release status is supported by concrete evidence. It does not mean adding more technology or claiming production readiness because the build succeeded.
