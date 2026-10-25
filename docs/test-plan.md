# ForgeFlow Test Plan & Quality Gates

## 1. Testing Strategy

ForgeFlow employs an automated multi-tier testing strategy ensuring data isolation, determinism, accessibility compliance, and business rule enforcement:
- **Unit Tests**: Pure domain logic, password verification, RBAC permissions, and session token hashing.
- **Integration Tests**: API endpoints, authentication flows, optimistic concurrency, stage transition rules, and database constraints tested against a dedicated PostgreSQL database (`forgeflow_test`).
- **Component Tests**: Frontend UI primitives, design tokens, focus management, formatters, and status badges checked with Vitest + React Testing Library in `jsdom`.
- **End-to-End Tests**: Playwright browser flows covering authentication, navigation, CRM operations, RBAC data isolation, responsive viewports (Desktop, Tablet, Mobile), and axe-core accessibility auditing.

---

## 2. Test Commands Contract

| Test Suite | Command | Environment Requirements |
|---|---|---|
| **All Quality Checks** | `make check` | Runs lint, typecheck, backend pytest, frontend vitest, and frontend build. |
| **Backend Integration & Unit Tests** | `cd backend && uv run pytest` | Requires PostgreSQL test database (`forgeflow_test`). |
| **Frontend Component Tests** | `cd frontend && pnpm test` | Vitest in jsdom environment. |
| **Full Typecheck** | `make typecheck` | `tsc --noEmit` and `mypy app`. |
| **Lint & Format Validation** | `make lint` | `ruff check app tests` and `pnpm lint`. |
| **End-to-End Browser & Axe Tests** | `make test-e2e` | Running Docker stack (`http://localhost:3000` + `http://localhost:8000`). |

---

## 3. Dedicated Test Database Safety Guarantee

Tests must never execute against the primary application database.
The test runner config (`backend/tests/conftest.py`) checks:
1. `TEST_DATABASE_URL` must contain the string `_test` or be explicitly separate from `DATABASE_URL`.
2. If `TEST_DATABASE_URL == DATABASE_URL`, the test suite immediately aborts with an error before running migrations or resetting tables.

---

## 4. Phase 2 Verified Coverage Areas

### Backend Test Coverage (`backend/tests/integration/test_crm_api.py`)
- **Account CRUD & Pagination**: Filtering by name, type, and pagination offset.
- **Contact Primary Uniqueness & Demotion**: Partial unique constraint on `(account_id) WHERE (is_primary = true)`. Creating or updating a contact with `is_primary = true` atomically updates existing primaries to `false` in the same transaction.
- **Opportunity Stage Rules**:
  - Validation requires `actual_close_date` when moving to `closed_won`.
  - Validation requires `closed_reason` and `actual_close_date` when moving to `closed_lost`.
  - Reopening a closed opportunity requires manager permission (`crm:manage` or `quotes:approve`).
- **Optimistic Concurrency Control**: Updating accounts, contacts, opportunities, and tasks with mismatched `expected_version` raises `HTTP 409 Conflict` with `STALE_VERSION`.
- **Task Lifecycle**: Completing open tasks sets `completed_at` timestamp; reopening resets status to `open`.
- **Catalog RBAC Data Isolation**: `unit_cost` field is strictly `None` when queried by `sales_rep` and `sales_manager`; populated with decimal cost when queried by `catalog_manager` and `admin`.
- **Operational Dashboard Aggregations**: `/api/v1/dashboard/summary` computes live pipeline totals and stage counts from the database; `/api/v1/dashboard/attention` flags overdue tasks and stagnant deals.

### Frontend Component Tests (`frontend/tests/`)
- `tests/formatters.test.ts`: Currency formatting in INR (`₹`), date formatting, and stage labels.
- `tests/components/crm-components.test.tsx`: Opportunity stage badges, priority indicators, and task toggle handlers.
- `tests/components/button.test.tsx`, `status-badge.test.tsx`, `data-table.test.tsx`.

### Playwright End-to-End Suite (`frontend/tests/e2e/crm.spec.ts`)
- **Responsive Viewports**: Tested across Desktop Chrome (1440x900), Tablet Chrome (1024x768), and Mobile Chrome (390x844).
- **No Document Overflow**: Confirmed `scrollWidth <= clientWidth` on all viewport sizes.
- **Sales Rep Core Journey**:
  - Authenticates via demo switcher.
  - Verifies live dashboard KPI cards and attention queue.
  - Creates a unique new account; verifies instant appearance in data table.

---

## 5. Phase 3 Verified Coverage Areas (RFQ Ingestion & Review Studio)

### Backend Domain Engine (`backend/tests/unit/test_rfq*.py` - 116 tests)
- **Unit Normalization & Conversion**: Deterministic conversion and parsing across metric and imperial industrial units (`test_rfq_units.py`).
- **Text Normalization & Tokenization**: Stopword removal, alias expansion, dimension extraction, and symbol stripping (`test_rfq_normalizer.py`).
- **Deterministic Candidate Matching**: Exact alias/SKU matching, token similarity scoring, ranking constants (`K=5`, `T_MIN=0.30`, `T_PROPOSE=0.60`, `T_MARGIN=0.10`), and tie-breaking (`test_rfq_matcher.py`).

### Backend Integration & Security Tests (`backend/tests/integration/test_rfq_api.py` - 7 tests)
- **Preview & Structure Validation**: RFC 4180 parsing, UTF-8 BOM handling, and canonical mapping suggestions without database mutation.
- **Atomic Ingestion & Duplicate Protection**: Ingests line items and computes content hash; duplicate uploads without override are rejected with `409 Conflict`.
- **Review Decision Lifecycle**: Transitions lines through `accept_suggestion`, `choose_product`, `mark_unmatched`, and `revert`.
- **Bulk Exact Acceptance**: Single-transaction resolution of all exact matches, updating RFQ version.
- **Catalog Rematch**: Re-evaluation of non-accepted lines with version bump.
- **Safe CSV Export**: Formula injection neutralization on all exported cells starting with dangerous symbols (`=`, `+`, `-`, `@`, `\t`, `\r`).
- **Quote-Readiness Gate**: Blocks quote creation when lines remain in review or invalid; successfully initializes draft `Quote` and converts RFQ to `quoted` status when all lines are resolved.

### Frontend Component Tests (`frontend/tests/unit/rfq-components.test.tsx` - 5 tests)
- Normalization status badges (`valid`, `warning`, `invalid`).
- Match status indicators and percentage confidence score formatting.
- Line review action callbacks and button state management.

### Playwright End-to-End Suite (`frontend/tests/e2e/rfq.spec.ts` - 9 tests across 3 viewports)
- **Sales Rep End-to-End Requisition Ingestion**:
  - Selects customer account and CRM opportunity.
  - Uploads customer CSV with automatic preview summary and header mapping.
  - Enters Review Studio; executes bulk acceptance of exact matches.
  - Inspects line items in slide-over Inspector Sheet with extracted quantity/dimensions and candidate matches.
  - Runs full Axe-core accessibility audit with 0 violations.
- **Blocking RFQ Diagnostics**: Verifies "Create Quotation" button is disabled on incomplete RFQs and reveals actionable blocking diagnostic reasons.
- **Catalog Reviewer Role**: Confirms "Rematch" catalog capability is available to catalog managers.

---

## 6. Phase 4 Verified Coverage Areas (Deterministic Quotation Engine & Quote Builder)

### Pure Domain Pricing Engine (`backend/tests/unit/test_quote_domain.py` - 10 tests)
- **Decimal Money Precision & Rounding**:
  - `round_currency` explicitly enforces `ROUND_HALF_UP` to 2 decimal places.
  - `round_quantity` enforces 4 decimal places.
  - No binary floating-point representation artifacts.
- **Deterministic Authoritative Calculation**:
  - Exact line arithmetic: `gross_amount = round_currency(quantity * unit_price)`, `discount_amount = round_currency(gross_amount * discount_percent / 100)`, `taxable_amount = gross_amount - discount_amount`, `tax_amount = round_currency(taxable_amount * tax_rate_percent / 100)`, `line_total = taxable_amount + tax_amount`.
  - Totals equal the exact sum of line rounded figures.
  - Dual-track internal cost and gross profit calculation when unit costs exist.
  - Uncosted items yield clean `null` total margins without division by zero.
  - Canonical SHA-256 `input_fingerprint` deterministic generation.
- **Calculation Trace Graph**:
  - Verifies DAG of `TraceNode` items capturing input keys, formula texts, operations, and outputs for all line and total calculations.
- **Pure Commercial Policy Evaluation**:
  - Triggers warning when line discount exceeds threshold (> 5.00%).
  - Triggers warning when grand total exceeds threshold (> ₹500,000.00).
  - Triggers warning when overall gross margin falls below minimum threshold (< 15.00%).
  - Correctly evaluates compliant quotes as self-approvable (`requires_manager_approval = False`).

### Backend Integration & RBAC Security Tests (`backend/tests/integration/test_quote_api.py` - 5 tests)
- **RFQ to Quote Revision 1 Conversion**:
  - Converts resolved RFQ lines into `QuoteRevisionLine` items with snapshot.
  - Generates Revision 1 with calculation snapshot and initial version 1.
- **Server-Side RBAC Cost Redaction**:
  - `sales_rep` and `sales_manager` roles query quotes and receive `null` for `unit_cost`, `line_cost`, `line_gross_profit`, and `margin_percent`.
  - `admin` and `catalog_manager` roles query quotes and receive real Decimal unit costs and profit margins.
  - Calculation trace nodes computing cost metrics are stripped for unauthorized roles.
- **Draft Updates & Concurrency Control**:
  - `PATCH /api/v1/quotes/{id}/draft` recalculates lines and totals, updating the current revision.
  - Submitting a stale `expected_version` aborts the transaction with `HTTP 409 Conflict`.
- **Authoritative Trace API**:
  - `GET /api/v1/quotes/{id}/calculation-trace` returns ordered nodes matching the engine snapshot.

### Frontend Component Tests (`frontend/tests/components/quote-components.test.tsx` - 4 tests)
- Quote status badge variants (`draft`, `in_review`, `approved`, `sent`).
- Currency formatting with INR (`₹`) and two decimal places.
- Policy trigger summary alerts and badges.

### Playwright End-to-End Suite (`frontend/tests/e2e/quote.spec.ts` - 9 tests across 3 viewports)
- **Sales Rep End-to-End Quote Builder Journey**:
  - Navigates from Overview Dashboard to `/app/quotes`.
  - Confirms cost isolation (cost column and margin intelligence box are hidden).
  - Inspects triggered policy alerts (`High-Value Quotation Threshold` and `Excessive Line Discount`).
  - Opens slide-over Calculation Inspector Sheet and audits arithmetic trace nodes.
  - Toggles Customer Preview Mode, verifying uneditable view, policy masking, and "DRAFT — NOT APPROVED COMMERCIAL PROPOSAL" watermark.
  - Edits draft lines, verifies live local recalculation, and commits saved draft with toast feedback.
  - Full Axe-core WCAG 2.1 AA accessibility audit: 0 violations.
- **Administrator Role Audit**:
  - Confirms visible "Cost (INR)" table column.
  - Confirms visible "Internal Margin Intelligence" box with base cost and projected gross profit margin.
  - Calculation Inspector sheet contains internal cost trace nodes.

---

## 7. Phase 5 Verified Coverage Areas (Review-Before-Write Proposals & Maker-Checker Approvals)

### Backend Domain Unit Tests (`backend/tests/unit/test_proposal_domain.py` - 8 tests)
- Allowlisted operations application (`set_line_quantity`, `set_line_unit_price`, `set_line_discount_percent`, `set_line_tax_rate_percent`, `add_line`, `remove_line`, `set_payment_terms`, `set_delivery_terms`, `set_valid_until`).
- Rejection of non-allowlisted / forbidden operations.
- Proposal before/after diff computation (`compute_proposal_diff`).
- State machine transition checks (`assert_can_transition`).
- Maker-checker security invariant checks (`assert_maker_checker`).

### Backend Integration & Security Tests (`backend/tests/integration/test_proposal_api.py` - 4 tests)
- Full proposal lifecycle: `draft -> pending_review -> approved -> committed`.
- Server-side maker-checker enforcement: Sales rep cannot approve own proposal (`403 MAKER_CHECKER_VIOLATION`).
- Administrator maker-checker enforcement: Admin cannot approve proposal they authored (`403 MAKER_CHECKER_VIOLATION`).
- Rejection reason mandate: Rejecting without reason fails with `422 REJECTION_REASON_REQUIRED`.
- Initial quote approval path with maker-checker enforcement (`POST /api/v1/quotes/{id}/submit-for-approval` and `POST /api/v1/quotes/{id}/approve-initial`).

### Frontend Component Tests (`frontend/tests/components/proposal-components.test.tsx` - 9 tests)
- Status badge variants for proposals (`draft`, `pending_review`, `approved`, `committed`, `rejected`, `stale`).
- Maker-checker violation warning banner display.
- Before/after financial diff summary metrics and currency formatting.
- Line-level diff items rendering with old vs new deltas.

### Playwright End-to-End Suite (`frontend/tests/e2e/proposal.spec.ts` - 9 tests across 3 viewports)
- **Sales Rep Proposal Authoring & Maker-Checker Warning**:
  - Opens quote, stages allowlisted operation in builder, creates change proposal.
  - Inspects review sheet with financial deltas and policy checks.
  - Submits proposal for managerial review.
  - Verifies maker-checker security invariant notice is displayed and Approve button is disabled for author.
- **Sales Manager Review & Atomic Commit**:
  - Accesses role-gated Reviews & Approvals queue (`/app/approvals`).
  - Opens diff review sheet, evaluates managerial cost and margin impact.
  - Approves proposal via confirmation dialog.
  - Commits proposal atomically, verifying increment to new committed revision and activity audit entry.
- **Commercial Rejection Inspection**:
  - Verifies rejection reason is recorded and rendered in proposal details.
  - Executed across Desktop (1440x900), Tablet (1024x768), and Mobile (390x844).
  - Axe-core accessibility auditing on review sheet and approvals queue: 0 violations.

---

## 8. Phase 6 Verified Coverage Areas (Customer Document Exports & Watermark Governance)

### Backend Domain Unit Tests (`backend/tests/unit/test_export_domain.py` - 8 tests)
- **Customer-Safe Projection Exclusion**: Verifies `QuoteExportDTO` and `QuoteExportLineDTO` never expose `unit_cost`, `line_cost`, `line_gross_profit`, `margin_percent`, internal notes, or candidate matches.
- **RFC 4180 CSV Generation & Formula Injection Sanitization**: Confirms dangerous string characters (`=`, `+`, `-`, `@`, `\t`, `\r`, `\n`) are prefixed with single quote `'`; numeric values remain unquoted numbers.
- **WeasyPrint PDF Rendering**: Verifies valid `%PDF-` document structure rendered from Jinja2 template (`forgeflow-quotation-template/1.0.0`).
- **Watermark Enforcement**: Validates draft watermark text `"DRAFT — NOT APPROVED COMMERCIAL PROPOSAL"` is present when requested and absent on unwatermarked exports.
- **SSRF Sandboxing**: Verifies `safe_url_fetcher` raises `ValueError` on remote `http://`/`https://` and local `file://` schemes.

### Backend Integration & Security Tests (`backend/tests/integration/test_export_api.py` - 5 tests)
- **Unapproved Quote Export Rejection**: Attempting final PDF/CSV export on `draft` or `pending_approval` quote fails closed with `HTTP 409 Conflict` (`QUOTE_NOT_APPROVED_FOR_EXPORT`).
- **Watermarked Draft Preview PDF**: Allows downloading draft preview for pre-approval inspection; verifies `Content-Type: application/pdf`, `X-Content-SHA256` header, and `export_events` record with `is_watermarked=True`.
- **Approved Quote Export**: Generates unwatermarked PDF and RFC 4180 CSV for approved quote revision; verifies `X-Content-SHA256` and matching `quote_customer_deliveries` record.
- **Audit Logging & Delivery History**: `GET /api/v1/quotes/{id}/deliveries` returns delivery records with byte size, filename, and SHA-256 fingerprint.

### Frontend Component Tests (`frontend/tests/components/export-components.test.tsx` - 3 tests)
- **Action Buttons & Draft Lock UI**: Verifies unwatermarked PDF and CSV buttons are disabled for draft quotes and watermark notice is displayed.
- **Approved Quote Export Activation**: Verifies export buttons are enabled for approved quotes.
- **Delivery History & SHA-256 Copy Action**: Verifies delivery table lists deliveries and clipboard copy function is bound.

### Playwright End-to-End Suite (`frontend/tests/e2e/export.spec.ts` - 3 tests across 3 viewports)
- **Full End-to-End Export Verification**:
  - Logs in as Sales Rep, navigates to approved quotation `QT-2026-0004`.
  - Verifies "Export Customer PDF" and "Export Procurement CSV" buttons are active.
  - Downloads customer PDF and customer CSV; verifies non-empty binary payloads and correct content dispositions.
  - Verifies "Export History & Integrity Verification" table records delivery events with format badges and SHA-256 hash.
  - Tests 1-click clipboard copy of SHA-256 fingerprint.
  - Navigates to draft quote `QT-2026-0001`; verifies final exports are locked with explanation and watermarked draft preview is available.
- **Multi-Viewport & Accessibility**:
  - Executed across Desktop (1440x900), Tablet (1024x768), and Mobile (390x844).
  - Axe-core accessibility auditing on export section: 0 violations.

---

## 9. Phase 7 Verified Coverage Areas (Operational Hardening, Telemetry & Release Readiness)

### Backend Telemetry & Health Probes (`backend/tests/unit/test_telemetry.py` & `backend/tests/integration/test_health_api.py` - 10 tests)
- **Telemetry Sanitization & Log Redaction**: Verifies `sanitize_or_generate_request_id` enforces regex boundaries, UUID generation on malformed inputs, and recursive sensitive data masking (`[REDACTED]` on passwords, tokens, cookies, auth headers, and unit costs).
- **Liveness & Readiness API**:
  - `GET /health/live`: Unauthenticated, un-cached probe returns `200 OK` (`{"status": "alive"}`).
  - `GET /health/ready`: Verifies database connection (`SELECT 1`) and migration head synchronization (`alembic_version == '0006_customer_exports'`).
  - Migration divergence returns `503 Service Unavailable` with `MIGRATIONS_OUTDATED` and zero credential leakage.
  - Database connectivity failure returns `503 Service Unavailable` with `DATABASE_UNAVAILABLE`.

### Relational & Audit Verification Suite (`backend/tests/unit/test_audit_verification.py` - 3 tests)
- **Invariant Validation**: Evaluates all 9 core structural and commercial invariants.
- **Fail-Closed Detection**: Confirms detector flags corrupted revision pointers, missing proposals, duty separation violations, and checksum discrepancies.
- **CLI Diagnostic Interface**: `app.cli.verify_audit` returns exit code 0 when clean and 1 when invariants fail.

### Release Preflight, Smoke & Backup Automation
- **Automated Smoke Test (`scripts/smoke.py`, `make smoke`)**: Validates health, login, catalog RBAC masking, approved quote PDF/CSV binary export, draft quote export 409 rejection, and delivery ledger integrity.
- **Backup & Rehearsal (`scripts/backup.sh`, `scripts/restore_test.sh`, `make backup`, `make restore-test`)**: Generates compressed archives with TOC checks and SHA-256 digests; rehearses isolated restore in temporary database verifying row counts and migration heads.
- **Release Preflight (`scripts/release_preflight.py`, `make release-preflight`)**: Validates locked dependencies, production config guards, migration status, audit state, and WeasyPrint compilation.

---

## 10. Cumulative Verified Test Counts (Phase 7 Final Release)

- **Backend Pytest Suite**: **203 passed**, 0 failed (up from 192 in Phase 6).
- **Frontend Vitest Suite**: **38 passed**, 0 failed across 9 test files.
- **Playwright End-to-End Browser Suite**: **48 passed**, 0 failed across 3 responsive viewports.
- **Axe-core Accessibility Audits**: **0 violations** across all application views and dialogs.
- **Audit Verification Invariants**: **9/9 satisfied** (`make verify-audit` exit code 0).
- **Smoke Suite Invariants**: **100% passed** (`make smoke` exit code 0).
- **Database Backup Rehearsal**: **100% verified** (`make restore-test` exit code 0).
