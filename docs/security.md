# ForgeFlow Security Specification & Model

## 1. Authentication & Session Architecture

ForgeFlow implements a stateful, server-side opaque session architecture as required by OWASP ASVS and PRD Section 6.1:

- **Password Storage**: Argon2id hashing via `pwdlib[argon2]`. Plaintext passwords are never logged, echoed, or stored.
- **Session Tokens**: Cryptographically random 32-byte tokens generated via `secrets.token_urlsafe(32)`.
- **Database Persistence**: The raw session token is never stored in the database. Only its SHA-256 digest (`token_hash`) is persisted in the `sessions` table.
- **Cookie Security**:
  - `HttpOnly`: Session cookies cannot be read or exfiltrated via JavaScript (`document.cookie`).
  - `SameSite=Lax`: Defends against cross-site request forgery while preserving top-level navigation.
  - `Path=/`: Restricts cookie scope.
  - `Secure`: Enforced in production (`APP_ENV=production` or `HTTPS=true`).
- **Session Lifetime**:
  - Maximum Lifetime: 12 hours from creation (`SESSION_TTL_HOURS=12`).
  - Idle Timeout: 60 minutes since last activity (`SESSION_IDLE_TTL_MINUTES=60`).
  - Revocation: `POST /api/v1/auth/logout` sets `revoked_at=now()` and expires the cookie. Password changes or account deactivations revoke all active sessions for that user.

## 2. Cross-Site Request Forgery (CSRF) Defense

Cookie-based authentication requires defense-in-depth against CSRF:
1. **Strict Origin & Referer Validation**: For all state-mutating HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`), the backend verifies that the `Origin` (or fallback `Referer`) header matches `FRONTEND_ORIGIN`.
2. **Double-Submit / Synchronizer CSRF Token**:
   - The server issues a random CSRF token via a readable cookie (`forgeflow_csrf`).
   - Mutating client requests must submit this token in the `X-CSRF-Token` request header.
   - The backend validates that the header matches the expected token.
3. **Safe Methods**: `GET`, `HEAD`, and `OPTIONS` requests are prohibited from altering server state.

## 3. Role-Based Access Control (RBAC) & Tenant Isolation

### 3.1 Roles and Separation of Duties

| Role | Permissions |
|---|---|
| `sales_rep` | View/create/edit assigned CRM entities, import RFQs, review matches, draft quotes, submit proposals. Cannot approve proposals, alter catalog, or export unapproved quotes. |
| `sales_manager` | View organization-wide pipeline, approve/reject proposals (maker-checker enforced: cannot approve own proposals), review audit logs. |
| `catalog_manager` | Manage products, SKUs, aliases, unit conversions, and resolve catalog matching. Cannot approve commercial proposals. |
| `admin` | Manage organization users, roles, settings, approval policies, and catalog. Cannot self-approve proposals. |

### 3.2 Tenant Isolation
- Every database query and mutation is explicitly scoped by `organization_id` derived from the validated session.
- Client-provided organization IDs are rejected or ignored.
- Inaccessible or nonexistent resources return `404 Not Found` to prevent entity enumeration across tenants.

## 4. Rate Limiting & Denial of Service

- `POST /api/v1/auth/login` is rate-limited by client IP address and target email to mitigate brute-force credential stuffing.
- Login failures return a generic error message: `"Invalid email or password"`. No information is leaked regarding whether an email address exists in the system.

## 5. Demo Mode Safeguards

- Seed accounts and demo credentials (`ForgeFlowDemo!2026`) are enabled **only** when `DEMO_MODE=true`.
- Startup validation immediately halts server startup in production if `DEMO_MODE=true` or if `APP_SECRET_KEY` remains set to the default placeholder.
- Test databases must be explicitly separated via `TEST_DATABASE_URL` (`forgeflow_test`). Automated tests fail closed if pointed to the primary database.

## 6. RFQ Ingestion & Export Security Controls (Phase 3)

### 6.1 DoS & Resource Exhaustion Defense
- **Maximum File Upload Size**: Hard limit of 5 MiB (`MAX_RFQ_FILE_SIZE_BYTES=5242880`) enforced during initial byte reading before full memory consumption.
- **Data Row Ingestion Limit**: Hard limit of 500 rows (`MAX_RFQ_DATA_ROWS=500`) parsed per RFQ to prevent worker saturation.
- **Content Hash Deduplication**: Ingested files compute a SHA-256 content hash. Re-uploading an identical file into the tenant returns `409 Conflict` (`DUPLICATE_RFQ_FILE`) unless explicitly overridden with user confirmation.

### 6.2 Formula Injection Neutralization (CSV Export)
RFC 4180 CSV exports of normalized RFQ lines neutralize spreadsheet formula injection vulnerabilities. Any cell text beginning with dangerous leading characters (`=`, `+`, `-`, `@`, `\t`, `\r`) is prefixed with a single quote `'` in both raw and normalized description fields, preventing arbitrary code execution when opened in Microsoft Excel or Google Sheets.

### 6.3 Server-Evaluated Quote-Readiness Gate
Clients cannot bypass human line-item review to convert an RFQ to a quotation. The quote creation endpoint (`POST /api/v1/rfqs/{rfq_id}/create-quote`) evaluates the entire RFQ on the server:
- All line items must be resolved to either an accepted catalog product or explicitly marked unmatched.
- Zero lines may possess an invalid normalization status.
- The RFQ must have at least one line item.
- If already converted (`status == 'quoted'`), duplicate conversion is rejected.

---

## 7. Quotation Engine & Pricing Security Controls (Phase 4)

### 7.1 Server-Side RBAC Cost & Margin Masking
To prevent commercial intelligence leakage (such as vendor purchase pricing or internal margins), the backend enforces strict server-side masking on all quotation endpoints (`GET /api/v1/quotes`, `GET /api/v1/quotes/{id}`, `GET /api/v1/quotes/{id}/revisions`, and `GET /api/v1/quotes/{id}/calculation-trace`):
- Only users with explicit permission `catalog:cost` or `admin` / `catalog_manager` roles receive real unit costs and profit margins.
- For `sales_rep` and `sales_manager` roles, the following fields are masked to `null` before JSON serialization:
  - `unit_cost`
  - `line_cost`
  - `line_gross_profit`
  - `margin_percent`
  - `total_cost`
  - `total_gross_profit`
  - `overall_margin_percent`
- Masking is strictly authoritative on the API layer; client applications never receive masked numerical values in responses or state.

### 7.2 Calculation Trace Filtering
Calculation traces generated by the authoritative pure-Python engine (`GET /api/v1/quotes/{id}/calculation-trace`) trace every arithmetic operation. To defend cost isolation:
- Nodes containing internal cost inputs or computing line gross margin/profit are purged from the graph for unauthorized roles before returning the response.
- Authorized users (Admin / Catalog Manager) view the full dual-track trace including cost formulas.

### 7.3 Optimistic Concurrency Control (Version Locking)
To prevent lost updates when sales reps concurrently edit quotations:
- Draft updates (`PATCH /api/v1/quotes/{id}/draft`) require the client to supply `expected_version`.
- If the current quote version in the database does not match `expected_version`, the server aborts the transaction with `HTTP 409 Conflict` (`QUOTE_VERSION_CONFLICT`).
- Successful updates atomically increment `version`.

### 7.4 Customer Presentation Mode (Preview Protection)
The quote builder includes a client-side "Customer Preview Mode" designed for live screen-sharing and client reviews:
- Masks internal policy alerts and approval notices.
- Displays prominent "DRAFT — NOT APPROVED COMMERCIAL PROPOSAL" watermark banners.
- Hides draft edit controls to prevent accidental modifications during buyer presentations.

---

## 8. Proposal Isolation & Maker-Checker Governance Controls (Phase 5)

### 8.1 Review-Before-Write Proposal Isolation
- Creating or editing a `QuoteChangeProposal` operates strictly in an isolated staging layer.
- Active quotes, current revision pointers, and committed `QuoteRevision` records remain completely untouched and immutable until managerial approval and atomic commit.

### 8.2 Allowlisted Operations Constraint
Proposals cannot execute arbitrary JSON transformations or schema overrides. Only allowlisted operations are parsed and validated by pure-Python domain functions:
- `set_line_quantity`, `set_line_unit_price`, `set_line_discount_percent`, `set_line_tax_rate_percent`
- `add_line`, `remove_line`
- `set_valid_until`, `set_payment_terms`, `set_delivery_terms`

### 8.3 Maker-Checker Security Invariant
To enforce strict separation of duties and prevent financial fraud or unauthorized self-discounting:
- A user who authored a change proposal or created an initial quotation (`created_by_user_id`) is strictly prohibited from approving or rejecting their own proposal or quote.
- This invariant is checked server-side across all roles: an `admin` or `sales_manager` who proposes a discount change cannot approve it; another authorized sales manager or administrator must sign off.
- Violations fail immediately with `HTTP 403 Forbidden` (`MAKER_CHECKER_VIOLATION`).

### 8.4 Rejection Reason Mandate
- Commercial rejections require a non-empty, actionable explanation (`HTTP 422 REJECTION_REASON_REQUIRED`).
- Rejections are recorded immutably in `quote_approval_decisions` and appended to the entity activity timeline.

### 8.5 Atomic Commit & Stale Base Revision Concurrency Control
- Atomic commit operations (`POST /api/v1/proposals/{id}/commit`) acquire an explicit database row lock on the parent quote: `SELECT ... FOR UPDATE`.
- The server validates that `quote.current_revision_id == proposal.base_revision_id`.
- If another user committed a different proposal or updated the revision in the interim, the commit immediately aborts with `HTTP 409 Conflict` (`STALE_BASE_REVISION`), transitioning the outdated proposal to `stale` to guarantee zero dirty writes or lost revisions.
- On valid commit, Revision $N+1$ is allocated, lines are created, `quote.current_revision_id` is updated, the proposal is marked `committed`, and an audit activity log entry is written within the single atomic transaction.

### 8.6 Idempotency Key De-duplication
- Proposal creation, approval decisions, and atomic commits accept optional client idempotency keys (`idempotency_key`) to prevent duplicate submissions or duplicate revisions caused by network retries.

---

## 9. Customer Document Export & Delivery Security Controls (Phase 6)

### 9.1 Commercial Cost Confidentiality & Projection DTO Isolation
- Customer exports (both PDF and CSV) strictly utilize a dedicated domain projection DTO (`QuoteExportDTO` and `QuoteExportLineDTO`).
- Internal purchase unit costs, internal line costs, gross margin percentages, gross profits, candidate RFQ match internals, and seller notes are completely excluded from the projection schema.
- Even if a sales representative or external client downloads or inspects the export payload, confidential margin intelligence is not present in the document data structure or memory footprint.

### 9.2 Watermark Governance & Approval Gating
- Official, unwatermarked customer PDF and CSV exports are strictly fail-closed: quotations in `draft` or `pending_approval` status immediately reject unwatermarked export requests with `HTTP 409 Conflict` (`QUOTE_NOT_APPROVED_FOR_EXPORT`).
- For internal inspection of pre-approval quotes, the system provides a dedicated draft preview endpoint (`/api/v1/quotes/{id}/export/preview-pdf`).
- Draft previews enforce a bold, semi-transparent diagonal watermark across every page: `"DRAFT — NOT APPROVED COMMERCIAL PROPOSAL"`.
- Watermarked previews cannot be mistakenly represented to buyers as legally binding commercial commitments.

### 9.3 WeasyPrint SSRF Prevention & Sandboxing
- PDF generation uses WeasyPrint with a custom `safe_url_fetcher` callable.
- The URL fetcher strictly denies:
  - All remote network schemes (`http://`, `https://`, `ftp://`).
  - All local filesystem path access (`file://`).
- Embedded resources (such as SVG badges and branding marks) are either inlined as data URIs or rendered from trusted local application packages, preventing Server-Side Request Forgery (SSRF), internal network scanning, and arbitrary local file read vulnerabilities.

### 9.4 RFC 4180 CSV Formula Injection Sanitization
- Customer procurement CSV files adhere to strict RFC 4180 standards.
- To prevent CSV Formula Injection (CWE-1236) when opened in desktop spreadsheet software (Excel, LibreOffice Calc, Apple Numbers), every string field is sanitized:
  - Leading formula execution prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`, `\n`) are neutralized by prepending a single quote (`'`).
  - Leading spaces are preserved while checking dangerous prefixes.
  - Pure numeric amounts, integers, decimals, and dates are preserved as numeric values for accounting interoperability without formula risk.

### 9.5 Cryptographic SHA-256 Deliverable Fingerprinting & Tamper-Evident Ledger
- Every generated export document is fingerprinted at the byte level with a cryptographic SHA-256 hash.
- The hash is returned in the `X-Content-SHA256` HTTP response header and recorded in the database:
  - `export_events`: Captures all generation attempts (including draft previews and failed attempts) for security and rate auditing.
  - `quote_customer_deliveries`: Immutable delivery log recording delivered documents, filenames, SHA-256 fingerprints, file sizes, and authenticated actor identity.
- Clients can verify document integrity and dispute resolution by matching the file hash against the system's recorded fingerprint.

---

## 10. Operational Hardening, Telemetry & Audit Integrity (Phase 7)

### 10.1 Structured Logging & Recursive Data Redaction
- In production (`APP_ENV=production`), application logs are formatted as single-line JSON records.
- Request correlation is enforced via `X-Request-ID` sanitized to `^[A-Za-z0-9_\-\.]{1,64}$`.
- All emitted telemetry recursively redacts sensitive fields:
  - Authentication tokens, session cookies, plaintext passwords, CSRF tokens, and Authorization headers.
  - Commercial cost intelligence (`unit_cost`, `markup_percent`, `margin_amount`) from sales rep queries.
  - Replaced universally with `"[REDACTED]"`.

### 10.2 Relational & Business Invariant Verification (`make verify-audit`)
- An automated diagnostic CLI continuously evaluates the database against 9 core relational and business integrity invariants.
- Detects revision pointer anomalies, sequence numbering gaps, uncommitted proposal drift, maker-checker duty separation violations, and delivery checksum mismatches.
- Fails closed with exit code 1 to alert operations teams before data inconsistencies can propagate.

### 10.3 Fail-Closed Production Launch Controls
- The application fails closed at startup if `APP_ENV=production` is paired with `DEMO_MODE=true` or an insecure `APP_SECRET_KEY`.
- `/health/ready` probe verifies Alembic migration synchronization (`0006_customer_exports`), failing with 503 if migrations have not been applied.

