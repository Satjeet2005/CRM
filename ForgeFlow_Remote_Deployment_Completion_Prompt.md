# ForgeFlow Remote Deployment Completion Prompt

**Purpose:** Close the single remaining release blocker after Phase 7: deploy the already-verified ForgeFlow application to an explicitly authorized remote HTTPS environment and verify it there. This is **not Phase 8** and must not expand the product scope. The planned product roadmap ends at Phase 7; this is a focused continuation of the Phase 7 release gate.

**Read first:** `PRD.md`, `docs/agent-handoff.md`, `IMPLEMENTATION_REPORT.md`, `docs/deployment-report.md`, `docs/deployment.md`, `docs/security.md`, `docs/operational-runbook.md`, `docs/backup-restore.md`, and `docs/phase-7-baseline.md` (use the repository's actual filenames if capitalization differs). Read the Phase 7 prompt and the latest release report if they are available in the repository. The repository and observed runtime—not a pasted report—are the implementation truth.

---

## 1. Mission and exact scope

You are the **Remote Deployment Completion Agent** for ForgeFlow. Phases 0–6 have been reported as implemented. Phase 7 operational hardening, audit verification, backup/restore rehearsal, telemetry, smoke tests, local production builds and performance checks have also been reported green. The remaining known blocker is the absence of an explicitly configured/authorized remote hosting target and/or cloud deployment credentials.

Your only goal is to close the required live deployment criterion from `PRD.md` by deploying the existing, verified code to a real remote HTTPS target **if and only if** the target and authorization are available. Then run the post-deployment checks and document evidence. Do not build new business features, redesign the UI, change the technology stack, or repeat completed work without a specific reason.

### Non-negotiable rules

1. `PRD.md` remains the source of truth. Do not silently amend it.
2. Do not assume a hosting provider, region, domain, database URL, project name or account entitlement. Discover the target only from explicit repository configuration, current environment configuration or clearly authorized instructions.
3. Do not create billable cloud resources, buy/register a domain, change DNS, alter a production security boundary, or perform any irreversible action without explicit authorization.
4. Never print, echo, copy into logs, commit, or include in reports any secret value, credential, cookie, session token, private database URL or private key. It is acceptable to report that a required variable is set/missing, never its value.
5. Do not invent deployment URLs, deployment logs, release SHAs, TLS status or successful smoke-test results. Public deployment is `PASS` only after direct verification against the real deployed URL.
6. Do not run destructive database resets or destructive restore commands against any persistent target. Do not run `alembic downgrade` in production as a generic rollback. Use a documented forward migration/rollback plan and take/verify a backup before schema-changing deployment.
7. Preserve the existing application architecture: Next.js 16 standalone frontend, FastAPI backend, PostgreSQL 16, Alembic migrations, Python 3.12, Node.js 22 and WeasyPrint PDF dependencies. Preserve same-origin routing where possible, cookie session security, CSRF, tenant isolation, RBAC and export governance.
8. No new metrics stack, microservices, Kubernetes, external observability vendor or unrelated infrastructure unless the current PRD/repository explicitly requires it.
9. Do not claim the application is production-proven or has an SLA. It is a synthetic-data demonstration unless the repository explicitly establishes otherwise.
10. Continue autonomously through all steps that are safe and possible. If a required external decision, authorization or credential is absent, finish the local preflight and report the exact blocker rather than guessing.

## 2. Known release baseline to verify

The Phase 7 report states the following. Re-verify these against the current checkout and runtime; treat any discrepancy as a finding:

- Phase 7 status was `PARTIALLY BLOCKED` solely by missing remote cloud target/credentials.
- Local production container stack consists of Next.js standalone frontend, FastAPI backend and PostgreSQL 16.
- Current Alembic head is `0006_customer_exports`.
- `GET /health/live` and `GET /health/ready` are expected to exist.
- Operational tools include `make check`, `make test-e2e`, `make verify-audit`, `make smoke`, `make backup`, `make restore-test`, `make release-preflight`, and `make build` (verify actual names before use).
- Audit verifier checks nine relational/commercial invariants.
- Local synthetic-data backup/restore rehearsal and full-flow smoke tests were reported passing.
- Production guards reject demo mode/default secrets in `APP_ENV=production`.
- A Zod advisory was documented in `docs/security-review.md`; re-check its current status and resolve it if a safe compatible update is available without breaking the app. Do not silently suppress the finding.

The Phase 7 report's benchmark values are local-container observations, not remote-service guarantees. Do not label them as remote measurements.

## 3. Stage A — inspect checkout and release artifacts

Before making changes:

1. Run `pwd`, `git status --short --branch`, inspect untracked files and changes, record `git rev-parse HEAD`, and confirm the checked-out branch/commit.
2. Read the required PRD/deployment/security/runbook documents listed above.
3. Inspect `compose.yaml`/`docker-compose.yml`, Dockerfiles, migration setup, frontend route handlers/proxy configuration, API base URLs, origin configuration, CORS, cookie/session settings, health checks, backup scripts and release scripts.
4. Identify the **actual configured target** from deployment files and non-secret environment metadata. Use safe inspection that reveals only names/presence of required environment variables, not their values.
5. Search for a previously chosen platform in repository documentation and CI/CD configuration. Reuse it if it is clearly authorized and configured. Do not introduce a second deployment path merely because it is familiar.
6. Establish a baseline by running the existing release checks as time and environment allow. At minimum run `make release-preflight`, `make check`, `make test-e2e`, `make verify-audit`, `make smoke`, and inspect `docker compose ps`/health. Use the actual target names in the repo if they differ. Do not hide failures or call a check passing based on past report text.
7. Record results in `docs/remote-deployment-completion.md` or the repository's existing deployment report without overwriting the Phase 7 evidence. Distinguish newly run evidence from inherited report claims.

If the working tree has uncommitted user changes, preserve them. Do not reset, clean, force-checkout or discard work.

## 4. Stage B — determine whether deployment is authorized and possible

Classify the current state into exactly one:

- **READY_TO_DEPLOY:** a target is explicitly configured, valid credentials exist, the target is authorized, and required domain/database/secret configuration is available.
- **LOCAL_ONLY:** no valid remote target or credential is available.
- **NEEDS_EXPLICIT_AUTHORIZATION:** a target or possible resource change exists, but deploying, creating a resource, altering DNS, or incurring costs has not been authorized.
- **CONFIGURATION_BLOCKED:** a target exists but required safe configuration is missing or invalid.

Do not infer that an installed CLI means a provider account is configured. Do not try to bypass missing authentication, use personal credentials from unrelated projects, or make a paid resource to unblock yourself.

### If the state is not READY_TO_DEPLOY

Complete all safe local readiness work, then stop remote mutation attempts. Produce a precise blocker report listing only what is missing, such as:

- selected hosting target/project/region;
- authorization to create or use resources and expected cost boundary, if resource creation is needed;
- access to the provider account/CLI/service connection;
- public domain or an explicitly authorized provider-issued hostname;
- persistent PostgreSQL 16 target with TLS/SSL and private network access;
- production environment secrets supplied through the provider's secret manager/configuration (never in Git);
- authorization for DNS changes, if a custom domain is required.

Do not request that the user paste secrets into chat or a markdown file. State that secrets should be supplied through the environment's secure secret mechanism. Do not claim deployment complete. The final status must remain `BLOCKED` or `PARTIALLY BLOCKED` as appropriate.

### If the state is READY_TO_DEPLOY

Proceed with the actual configured and authorized target; do not substitute a different provider. Continue to Stage C.

## 5. Stage C — validate production deployment architecture

Validate that the configured production shape is compatible with the PRD. Same-origin browser/API routing is preferred. Use the current platform's supported reverse proxy or ingress configuration rather than introducing a new infrastructure stack.

### Frontend and API routing

- The frontend should call a same-origin `/api/v1` path when that matches the established deployment architecture. Confirm actual routing is wired to the backend service rather than accidentally pointing at localhost or a development URL.
- Do not ship `localhost`, loopback hostnames, development ports or a developer machine hostname in browser-visible production configuration.
- If a split-origin topology is already explicitly selected, validate the exact trusted `FRONTEND_ORIGIN`, credentials CORS policy, cookie attributes, CSRF Origin/Referer checks and preflight behavior end to end. Never use wildcard CORS with credentials.
- Trust proxy headers only from the configured proxy/network boundary. Untrusted clients must not be able to spoof host, scheme or client IP through arbitrary `X-Forwarded-*` headers.
- Configure a suitable host allowlist and security headers according to the existing stack/PRD. Do not weaken CSRF or origin checks to work around a routing error.

### Database

- Use PostgreSQL 16 as required by the PRD unless an already documented compatibility ADR justifies another major version.
- The database must not be reachable from the public internet. Bind to an internal/private network or platform-private address; expose only HTTP/HTTPS entrypoints.
- Enforce SSL/TLS for remote database connections where supported and use a least-privilege, non-superuser application role.
- Confirm persistent storage/backup policy. Do not use ephemeral container filesystem storage as the only database persistence strategy.
- Do not run migrations concurrently from multiple application replicas. Use one controlled deployment migration job/step or the repository's existing single-writer migration gate.
- Confirm application and test databases are distinct. A deployment script or health check must not expose credentials or destructive DB controls publicly.

### Secrets and production mode

- Production must have `APP_ENV=production`, `DEMO_MODE=false`, a strong non-default `APP_SECRET_KEY`, secure session cookies, debug/reload disabled and valid trusted origin/host configuration.
- Provision secrets using the target platform's secret manager or protected environment configuration. Never store them in `compose.yaml`, Docker image layers, shell history, issue comments, `PRD.md`, `.env.example`, logs, or implementation reports.
- Do not enable the shared demo login/password or seed synthetic demo users into a production environment unless the PRD explicitly defines a separate, safe public-demo mode and its access restrictions. The report says production mode must reject demo mode.
- If a non-demo administrator setup procedure is required but missing, implement/document the smallest secure bootstrap path. It must not provide a public unauthenticated admin-creation endpoint or a reusable default password.
- Do not dump the whole process environment while diagnosing a problem.

### HTTPS and documents

- Do not publish a production-like login over plain HTTP.
- Verify TLS certificate validity, HTTPS redirects, secure cookie flag and correct origin values.
- Verify WeasyPrint and Pango/Cairo/font dependencies exist inside the actual built backend image. A host-only package does not satisfy container runtime needs.
- Preserve the PDF renderer's restricted URL fetcher/SSRF sandbox. Do not allow customer-provided text to initiate network or arbitrary local file reads.
- Ensure generated files are delivered as safe attachment responses; do not expose local temporary paths.

## 6. Stage D — establish pre-deployment evidence

Before deploying a new image or running migrations on a persistent remote database:

1. Confirm working tree and release commit. If release changes are required, commit them only under the repository's existing policy; never commit secrets.
2. Run `make release-preflight` or its documented equivalent.
3. Build the exact production images from the selected commit. Use immutable release tags/commit SHA labels where supported; do not rely only on `latest` for identifying the release.
4. Validate configuration without exposing secret contents. Confirm production fail-closed guards and demo mode disabled.
5. Verify migrations are forward-compatible with the deployed schema. Current expected head from the Phase 7 report is `0006_customer_exports`; verify actual current head before planning. Never assume that value is still current without inspection.
6. Take a backup of any pre-existing remote database using the approved safe procedure; verify the archive and checksum before proceeding. If the target is an empty new database, record that no prior customer data existed, as verified by the approved setup path.
7. Inspect release logs and scan output for leaked credentials or sensitive commercial data. Do not include full environment values in the evidence report.
8. If preflight has a blocking failure, do not deploy. Fix only in-scope problems, re-run the relevant checks and record what changed.

## 7. Stage E — controlled deployment

Only when the state is `READY_TO_DEPLOY` and preflight is clean:

1. Deploy the application image from the verified release commit to the already configured target.
2. Apply schema migrations once using the controlled migration step. Confirm the migration exits successfully before shifting application traffic to the new code.
3. Keep the database private. Verify backend/frontend services become healthy; do not expose PostgreSQL port 5432 or the local host port 5434 publicly.
4. Verify the frontend is served over HTTPS and browser API calls resolve through the intended production route.
5. Confirm the deployed release commit/image identifier and current migration head with approved mechanisms.
6. Preserve logs useful for triage, but redact secrets, cookies, session tokens, full uploaded RFQs, internal costs and margins.
7. If deployment fails, follow the existing rollback runbook. Prefer rolling back the application image when schema compatibility permits. Do not automatically downgrade migrations, delete a database/volume, or restore a backup over a live database without explicit incident-level authorization and a verified recovery plan.
8. Do not move DNS or switch final traffic unless that action is part of the explicit deployment authorization.

## 8. Stage F — post-deployment verification against the actual URL

Run checks against the deployed host—not only localhost. Record timestamp, hostname, release commit/image ID and results. Do not include credentials or customer payloads.

### Health and readiness

- `GET /health/live` returns the documented healthy response without requiring authentication.
- `GET /health/ready` verifies database connectivity and correct migration state; it must not leak database URLs, SQL exceptions or internal details.
- Confirm readiness returns non-success when the database/migration state is actually unhealthy in a safe test environment, if that behavior has not already been proven.

### Authentication, cookies and CSRF

- Login works through HTTPS using a valid non-demo user.
- Invalid login errors are generic and do not expose whether a particular user exists.
- Inspect browser cookie attributes without exposing the cookie value: `HttpOnly`, `Secure` in HTTPS production, expected `SameSite`, and correct path/lifetime.
- `GET /api/v1/auth/me` returns only safe current-user/organization/permission information.
- Logout invalidates the session.
- Mutating requests without valid CSRF/origin verification are rejected. Do not run destructive probes against valuable production data; use a safe test record or staging organization.
- Production refuses shared demo credentials and `DEMO_MODE=true` as required.

### Tenant isolation and role-based access

Using distinct authorized demo/test identities or an isolated staging organization:

- Confirm the API rejects cross-organization resource access, not merely hides links in the UI.
- Confirm sales_rep/sales_manager cannot retrieve internal unit cost or profit/margin fields. Catalog manager/admin visibility should match the PRD.
- Confirm proposal maker-checker invariant: proposer cannot approve their own proposal, even if manager/admin.
- Confirm rejected or stale proposals cannot be committed and stale base revisions fail closed.

### Full commercial flow

Use seeded synthetic fixture data only and isolate any mutation to dedicated test records/organization. Reuse the documented smoke script if possible; do not create another competing suite.

Verify the actual deployed app can perform:

1. Log in.
2. Load CRM dashboard and accounts.
3. Upload a synthetic RFQ CSV within declared limits.
4. Normalize lines deterministically and show catalog candidates/reasons.
5. Make a human line decision and verify persisted audit history.
6. Confirm unresolved/invalid RFQ lines block conversion as designed.
7. Convert a fully resolved RFQ to a draft quote.
8. Verify Decimal pricing and inspect a calculation trace.
9. Propose a quote change without mutating the active revision.
10. Confirm the proposer is blocked from approving their own proposal.
11. Approve via a distinct authorized manager and verify a new revision is atomically committed.
12. Confirm draft/pending quotes cannot be exported as final unwatermarked documents.
13. Generate an explicitly watermarked draft preview, if enabled.
14. Generate PDF/CSV for an eligible approved quote. Ensure customer exports exclude all cost/margin/internal matching fields and CSV content is formula-neutralized.
15. Recompute the PDF/CSV SHA-256 digest over the exact delivered bytes and compare it with `X-Content-SHA256` and the persisted delivery ledger as applicable.
16. Verify export history and audit records record the correct actor, organization, revision, result, fingerprint and time.

If full commercial mutation cannot safely be performed on the deployed target, use an isolated staging target or dedicated synthetic organization. Do not modify real customer records to prove an acceptance test.

### Browser and accessibility

- Run Playwright against the real deployed URL for login and representative end-to-end workflows.
- Confirm desktop, tablet and mobile layouts still work at PRD viewport sizes. Verify no unexpected horizontal overflow.
- Run Axe WCAG 2.1 AA checks on the main dashboard, RFQ review, quote builder, approval queue and export history screens.
- Confirm errors are actionable and do not display stack traces or secrets.

### Audit, backup and performance

- Run the read-only audit verifier against the deployed synthetic database. Every invariant must be `PASS` or have a documented, explicitly accepted reason; an uncheckable invariant is not a pass.
- Take a remote backup through the approved process and validate archive integrity/checksum.
- If authorized and safe, run a restore rehearsal into an isolated database/instance. Never restore over the live target for a routine check.
- Run a small representative performance sample against safe endpoints. Do not stress-test an unapproved public service. Report measurements as observed samples with machine/region, request count and date, not guarantees.

## 9. Stage G — final release documentation

Update the existing documents in place rather than creating duplicate competing runbooks. At minimum update:

- `docs/deployment-report.md` — actual provider/target label, verified public URL, release commit, image tag/digest if available, migration head, deployment timestamp, HTTPS/health results, smoke result, audit status, backup result, known limitations. Never include secret values.
- `docs/agent-handoff.md` — final checked-out state, files changed, actual commands and results, blockers and safe next actions.
- `README.md` — only the actual deployed URL after it is verified; exact demo access rules; links to setup, security, backup/restore and operational runbooks.
- `docs/operational-runbook.md` — target-specific start/restart, rollback, log inspection, secret rotation, health, alert/incident and recovery steps if the existing file can be safely generalized.
- `docs/backup-restore.md` — provider-specific backup/restore instructions, retention expectations and verified restore evidence.
- `docs/security-review.md` — current dependency-audit status and any remaining advisories with affected package/version, exploitability context, mitigation and owner/action. Do not call an advisory nonexistent merely because it is client-only.
- `IMPLEMENTATION_REPORT.md` — phase checklist distinguishing completed, blocked and not applicable items with evidence.

If no deployment is possible, document the exact missing prerequisite and keep Phase 7 status `PARTIALLY BLOCKED` (or `BLOCKED` if a more fundamental blocker exists). Do not relabel remote deployment as not applicable because the local stack works.

## 10. Required acceptance criteria

The task is `PASS` only if all required items below have observable evidence:

- [ ] Existing repository state and current release commit were recorded without losing user changes.
- [ ] The configured target is explicit and authorized; no unapproved billable resources or DNS changes were made.
- [ ] Production config has demo mode disabled, strong secrets, debug disabled and valid trusted-origin/proxy values.
- [ ] Database is private, persistent, least-privilege and migrated through a single controlled step.
- [ ] Frontend and API are publicly accessible only through the intended HTTPS routing; no development URL/port leaks into production.
- [ ] Readiness, auth, logout, CSRF, tenant isolation and RBAC were tested against the deployed target.
- [ ] Complete RFQ-to-approved-quote-to-export workflow was verified using synthetic data on the deployed environment or authorized isolated staging target.
- [ ] PDF/CSV exports passed watermark/status eligibility, cost redaction, formula injection and byte-level fingerprint checks.
- [ ] Audit verifier reports all applicable invariants cleanly; backup archive integrity is verified; restore rehearsal is documented where possible.
- [ ] Production build, representative browser E2E and accessibility checks passed against the actual deployed application.
- [ ] Documentation identifies the actual deployed release/URL or explicitly states the precise blocker.
- [ ] No credentials, session material, customer payloads or internal cost/margin information were disclosed in output or committed files.

If external credentials or the target are absent, the correct outcome is a complete safe preflight and an honest `BLOCKED` deployment status—not a guessed host or fictitious URL.

## 11. Final report format

Return a concise, evidence-based report with these sections:

1. **Overall status:** `PASS`, `PARTIALLY BLOCKED`, or `FAIL`.
2. **Target:** provider/platform and verified URL, or exact missing prerequisite. Never expose secrets.
3. **Release identity:** commit SHA, image version/digest if available, deployment timestamp and migration head.
4. **Deployment operations:** what actually changed, what resource operations were/weren't authorized, migration result and health result.
5. **Verification table:** command/check, environment (local/staging/remote), exact result and short evidence.
6. **Security:** production config guard, HTTPS/cookies/CSRF, RBAC/tenant isolation, customer export safety, audit and backup evidence.
7. **Performance:** actual measured results only; separate local measurements from remote measurements.
8. **Documentation changes:** paths modified.
9. **Known limitations/blockers:** exact items remaining and why.
10. **Final release decision:** clearly state whether the PRD's remote deployment exit criterion is genuinely satisfied. Do not say “fully deployed” if the only verified runtime is local Docker Compose.

**Finish condition:** stop when the real remote deployment has been verified or the exact external blocker is proven and documented. Do not create unrelated Phase 8 features, and do not claim success based on code existing or a local container build alone.
