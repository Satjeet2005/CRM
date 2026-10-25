# ForgeFlow Architecture Documentation

## 1. Overview and High-Level Topology

ForgeFlow is a modular monolith B2B operations platform uniting CRM, RFQ line-item normalization, and quotation change review with atomic proposals.

```
+--------------------------------------------------------------+
|                    Next.js App Router (16.x)                 |
|   React 19 / TypeScript / Tailwind CSS 4 / Base UI Primitives|
+------------------------------+-------------------------------+
                               | Same-origin or CORS /api/v1
                               v
+--------------------------------------------------------------+
|                        FastAPI API                           |
|       Typed Pydantic v2 Models / Argon2id Auth / CSRF        |
+------------------------------+-------------------------------+
                               |
            +------------------+------------------+
            v                                     v
+-----------------------+              +-----------------------+
|    Domain Services    |              | Pure Python Libraries |
| (CRM, RFQ, Quotes,    |              | - RFQ Normalizer/Units|
|  Proposals, Audit)    |              | - Quote Calculator    |
+-----------+-----------+              +-----------------------+
            |
            v
+--------------------------------------------------------------+
|                 SQLAlchemy 2.0 / Alembic                     |
+------------------------------+-------------------------------+
                               |
                               v
+--------------------------------------------------------------+
|                    PostgreSQL 16 Database                    |
|           UUID PKs / UTC Timestamps / Org-Scoped Isolation   |
+--------------------------------------------------------------+
```

## 2. Monorepo Organization

```text
forgeflow/
├── PRD.md                       # Verbatim product requirements
├── README.md                    # Setup, running, testing guide
├── Makefile                     # Root development contract
├── compose.yaml                 # Multi-container orchestration (db, backend, frontend)
├── .env.example                 # Documented configuration template
├── docs/                        # Architecture, ADRs, security, API specs, handoff notes
│   ├── architecture.md
│   ├── security.md
│   ├── API.md
│   ├── test-plan.md
│   ├── deployment.md
│   ├── data-dictionary.md
│   ├── demo-script.md
│   ├── agent-handoff.md
│   └── architecture-decisions/
├── frontend/                    # Next.js 16 + React 19 application
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── app/                     # App router pages and layouts
│   ├── components/              # UI, layout, data-display, forms
│   ├── features/                # Domain-specific feature modules
│   ├── lib/                     # API client, auth, formatters, utils
│   ├── hooks/                   # React custom hooks
│   └── tests/                   # Vitest and Playwright tests
└── backend/                     # FastAPI + Python 3.12 application
    ├── pyproject.toml
    ├── uv.lock
    ├── alembic.ini
    ├── alembic/                 # Database migrations
    ├── app/
    │   ├── main.py              # Application entrypoint & middleware
    │   ├── config.py            # Typed settings via pydantic-settings
    │   ├── api/v1/              # Versioned API routes
    │   ├── auth/                # Password, session, CSRF, RBAC logic
    │   ├── db/                  # Engine, sessionmaker, Base model
    │   ├── models/              # SQLAlchemy 2.0 ORM models
    │   ├── schemas/             # Pydantic v2 schemas
    │   ├── repositories/        # Database access layer
    │   ├── services/            # Application business services
    │   ├── domain/              # Pure domain logic (RFQ, quotes, proposals)
    │   └── seed/                # Synthetic demo seeding
    └── tests/                   # Pytest unit, integration, and security tests
```

## 3. Frontend Architecture

- **Rendering Paradigm**: React Server Components for layouts/shells and data pre-fetching where compatible; Client Components for interactive forms, rich tables, stateful drawers, motion, and charts.
- **Styling & Tokens**: Tailwind CSS 4 with custom CSS variables matching PRD Section 7.3 specifications for light and dark themes.
- **Component Architecture**: Base UI primitives wrapped in shadcn-compatible API conventions. Accessible keyboard navigation, ARIA attributes, and explicit visual focus rings.
- **State Management**:
  - Server state: TanStack Query (cached API data, optimistic updates, query invalidation).
  - Form state: React Hook Form with Zod schemas matching backend validation.
  - UI state: React context for theme, auth, and sidebar navigation.

## 4. Backend Architecture

- **Layered Monolith**:
  - `api/v1/`: Thin route controllers that parse requests, verify permissions, call domain services, and return validated Pydantic models.
  - `auth/`: Security boundary managing Argon2id passwords, SHA-256 hashed sessions, CSRF headers, and RBAC matrix.
  - `services/`: Transaction boundaries orchestrating database persistence and business operations.
  - `domain/`: Pure Python functions with no FastAPI or database dependencies (deterministic matching, quotation math, diff generation).
  - `models/`: Explicit SQLAlchemy declarative models with constraints and organization foreign keys.
- **Error Handling**: Standardized error response format `{ "code": str, "message": str, "details": any, "request_id": str }` with no leaked stack traces or database queries.

## 5. Security & Isolation

- **Tenant Isolation**: Every customer entity contains an `organization_id` foreign key. Repositories and services automatically scope queries by the authenticated user's organization (`ctx.organization.id`).
- **Maker-Checker Invariant**: Proposers cannot approve their own quotation proposals, regardless of whether their role has manager or admin privileges.
- **Opaque Sessions**: Raw tokens are never stored; only cryptographic SHA-256 digests exist in the `sessions` table.
- **Role-Based Column Masking**: Sensitive fields (e.g. `catalog_products.unit_cost`) are masked at the service/schema level depending on user role permissions before serialized to JSON.

---

## 6. Phase 2 Architecture: Core CRM, Catalog & Operational Dashboard

### CRM Domain
1. **Accounts**: Customer organizations with hierarchical relationships to contacts, opportunities, and tasks.
2. **Contacts**: Linked to accounts with a partial unique index `uq_contacts_account_primary` enforcing at most one primary contact per account. Updates and insertions atomically demote previous primaries in the same transaction.
3. **Opportunities & Pipeline**: 7 strict stages (`lead`, `qualified`, `solutioning`, `proposal`, `negotiation`, `closed_won`, `closed_lost`). Enforces stage progression rules (mandatory close dates, required loss reasons, manager approval to reopen closed deals).
4. **Tasks**: Operational tasks with deadline and priority tracking, supporting idempotent completion and undo/reopen flows.
5. **Activity Log**: Immutable chronological timeline recording state transitions, creations, and updates.

### Concurrency & Optimistic Locking
All mutation endpoints require `expected_version: int`. If `entity.version != payload.expected_version`, the API rejects the update with `HTTP 409 Conflict` and code `STALE_VERSION`, returning the current version to the client. This guarantees concurrency safety without locking tables.

### Catalog & RBAC Data Masking
Catalog products store standard industrial dimensions, base units, selling prices, and internal unit costs.
- When `sales_rep` or `sales_manager` queries catalog products, `unit_cost` is explicitly scrubbed to `None` / `null`.
- When `catalog_manager` or `admin` queries, `unit_cost` is populated.
- Only users with `catalog:manage` or `catalog:write` can create or modify products.

### Real Operational Dashboard & Attention Queue
- **Summary Metrics (`/api/v1/dashboard/summary`)**: Aggregates real pipeline sums, stage distributions, active accounts, and overdue tasks directly via SQL aggregation queries. For future phase values (`quote_conversion_rate`, `average_quote_value`), it returns stable `null` with `available_phase_4: false`.
- **Attention Queue (`/api/v1/dashboard/attention`)**: Computes high-priority actionable operational bottlenecks:
  - Overdue tasks.
  - Stagnant high-value opportunities (`> ₹500,000` with no activity in 14 days).
  - Returns flags `has_pending_rfqs: false` and `has_pending_approvals: false` until Phases 3 and 5 are activated.

---

## 7. Phase 3 Architecture: RFQ Ingestion, Normalization & Review Studio

### Ingestion & Stream Processing
1. **RFC 4180 Ingestion**: Uploads support UTF-8 with BOM stripping, deterministic duplicate file hash detection (`content_hash`), file size validation (`5 MiB` max), and data row safety limits (`500` rows max).
2. **Column Mapping Engine**: Automatic header detection matches raw supplier CSV columns to ForgeFlow canonical fields (`description`, `quantity`, `unit`, `sku`, `specifications`, `manufacturer`, `manufacturer_part_number`, `notes`).
3. **Pure-Python Normalization & Matching Engine**: Adapted from `Satjeet2005/RFQ-line-item-normalizer` into `backend/app/domain/rfq/` with strict zero-dependency determinism:
   - Tokenization, standard unit normalization (`mtr`, `nos`, `pcs`, `set`, `kg`, etc.), and dimension extraction.
   - Catalog candidate ranking using exact alias/SKU lookup, token overlap, and Levenshtein similarity with strict PRD constants:
     - `K = 5` max candidates
     - `T_MIN_CANDIDATE = 0.30`
     - `T_PROPOSE = 0.60`
     - `T_MARGIN = 0.10`
   - Match statuses: `exact_match`, `high_confidence`, `ambiguous`, `unmatched`.

### Review Studio & Decision Lifecycle
1. **RFQ Line Review Lifecycle**:
   - `pending` -> `accepted` (via suggestion or manual product choice)
   - `pending` -> `unmatched` (explicit fallback for special orders)
   - `accepted` / `unmatched` -> `pending` (revert capability)
2. **Atomic Bulk Actions**:
   - `POST /api/v1/rfqs/{rfq_id}/bulk-accept-exact`: Atomically resolves all exact matches and high-confidence propositions in a single transaction, bumping RFQ version.
   - `POST /api/v1/rfqs/{rfq_id}/rematch`: Bumps RFQ version, re-evaluates all non-accepted lines against latest catalog products, preserving accepted human decisions.
3. **Safe RFC 4180 CSV Export**:
   - Neutralizes formula injection by prepending single quotes `'` to cells starting with `=`, `+`, `-`, `@`, `\t`, `\r`.
4. **Server-Evaluated Quote-Readiness Gate**:
   - `is_ready_to_quote` is strictly evaluated server-side: all lines must have resolution (`accepted` or `unmatched`), zero invalid lines, at least one line item, and no quoted quote already generated.
   - `POST /api/v1/rfqs/{rfq_id}/create-quote`: Transition gate initializing a draft `Quote` in `quotes` table, marking RFQ as `quoted` and recording audit activity.

---

## 8. Phase 4 Architecture: Deterministic Quotation Engine, Quote Builder & Calculation Trace

### 8.1 Pure-Python Authoritative Pricing Engine
Located in `backend/app/domain/quotes/`:
- **`money.py`**: Enforces strict Decimal arithmetic semantics. No floating-point rounding errors. Rounds using `ROUND_HALF_UP`:
  - Currency amounts: `0.01` (2 decimal places)
  - Quantities: `0.0001` (4 decimal places)
  - Percentages: `0.01` (2 decimal places)
- **`calculator.py`**: Pure function `calculate_quote(lines, currency)` implementing PRD Section 6.8 line-by-line formulas:
  - `gross_amount = round_currency(quantity * unit_price)`
  - `discount_amount = round_currency(gross_amount * discount_percent / 100)`
  - `taxable_amount = gross_amount - discount_amount`
  - `tax_amount = round_currency(taxable_amount * tax_rate_percent / 100)`
  - `line_total = taxable_amount + tax_amount`
  - Totals are the exact sum of line rounded figures.
  - Generates immutable snapshot dictionary and SHA-256 canonical `input_fingerprint`.
- **`trace.py`**: Generates ordered dependency graph of `TraceNode` items capturing every arithmetic operation, formula text, rounding rule, and input/output values.
- **`policies.py`**: Pure policy evaluator `evaluate_quote_policies(calc_result, config)` assessing:
  - Line discount > 5.00%
  - Grand total > ₹500,000.00
  - Gross profit margin < 15.00% (when internal costs are present)

### 8.2 Database Architecture & Revision Model
Migration `0004_quote_revisions.py` established:
- **`quotes`**: Extended with `current_revision_id`, `valid_until`, `payment_terms`, and `delivery_terms`.
- **`quote_revisions`**: Immutable revision records storing `calculation_snapshot_json`, `snapshot_json`, `calculator_version`, `input_fingerprint`, `revision_number`, `parent_revision_id`, and `commit_reason`.
- **`quote_revision_lines`**: Itemized lines preserving both customer commercial numbers and internal unit cost, gross profit, and margin percentages.

### 8.3 Concurrency & Server-Side RBAC Masking
- **Optimistic Concurrency**: Draft mutations via `PATCH /api/v1/quotes/{id}/draft` require `expected_version: int`. Stale updates fail closed with `HTTP 409 Conflict`.
- **Server-Side Cost Redaction**: `sales_rep` and `sales_manager` roles receive `null` for `unit_cost`, `line_cost`, `line_gross_profit`, and `margin_percent`. Redaction is enforced server-side before serialization. Calculation trace nodes containing internal costs are purged for unauthorized roles.

### 8.4 User Experience & Interactive Quote Builder
Located in `frontend/app/app/(workspace)/quotes/`:
- **Quote List (`page.tsx`)**: Search, commercial status filtering, policy badges (`Approval Required`), active totals, and pagination.
- **Quote Builder (`[quoteId]/page.tsx`)**:
  - Live local recalculation of totals as sales reps adjust line quantities, prices, discounts, and tax rates.
  - Calculation Inspector sheet rendering the authoritative calculation trace.
  - Policy governance panel displaying triggered approval criteria.
  - Customer Preview Mode providing an uneditable presentation layout with watermark banner and internal alert masking.

---

## 9. Phase 5 Review-Before-Write Proposals & Maker-Checker Approvals

### 9.1 Pure Python Domain Engine (`app/domain/proposals/`)
Adapted from the isolated branching and proposal patterns in `Satjeet2005/model-change-review-lab`:
- **`operations.py`**: Pure functions validating and applying allowlisted mutations (`set_line_quantity`, `set_line_unit_price`, `set_line_discount_percent`, `set_line_tax_rate_percent`, `add_line`, `remove_line`, `set_valid_until`, `set_payment_terms`, `set_delivery_terms`).
- **`diff.py`**: Pure function `compute_proposal_diff(base_lines, proposed_lines, base_terms, proposed_terms)` computing modified lines, added lines, removed lines, unchanged lines, and net financial deltas.
- **`lifecycle.py`**: Formal state machine (`draft -> pending_review -> approved -> committed`) and maker-checker validation `assert_maker_checker(proposer_user_id, reviewer_user_id)`.

### 9.2 Database Migration & Models
Migration `0005_proposals_approvals` established:
- **`quote_change_proposals`**: Stores `proposed_changes_json`, `diff_summary_json`, `base_snapshot_json`, `proposed_calc_snapshot_json`, `policy_snapshot_json`, and author/reviewer references.
- **`quote_approval_decisions`**: Immutable audit records storing manager decisions, comments, and timestamps.

### 9.3 Concurrency Control & Atomic Commit
- **Row Locking**: Atomic commit acquires `SELECT ... FOR UPDATE` on the parent quote.
- **Stale Base Detection**: Compares `quote.current_revision_id == proposal.base_revision_id`. If mismatched, aborts with `HTTP 409 Conflict` (`STALE_BASE_REVISION`) and transitions proposal to `stale`.
- **Revision Allocation**: Atomically writes Revision $N+1$, repoints `quote.current_revision_id`, sets proposal status to `committed`, and records an immutable audit activity log entry.

### 9.4 Managerial Review Workspace & Approval Queue
- `/app/approvals`: Role-gated queue for Sales Managers and Admins with status tabs, search, pagination, and review action sheet.
- `/app/quotes/[quoteId]`: Embedded `QuoteProposalsSection` displaying active and historical change proposals with diff inspectors.

---

## 10. Phase 6 Customer Document Exports & Tamper-Evident Delivery Architecture

### 10.1 Customer-Safe Projection DTO (`app/domain/exports/dto.py`)
To preserve commercial confidentiality, document generation never receives raw database models or internal calculation snapshots. Instead, a projection pipeline converts committed `QuoteRevision` data into `QuoteExportDTO` and `QuoteExportLineDTO`:
- Strictly excludes `unit_cost`, `line_cost`, `line_gross_profit`, `margin_percent`, and candidate matches.
- Formats monetary amounts with exact Decimal precision and ISO standard currency labels.
- Includes customer-facing terms, seller organization metadata, notes, and line totals.

### 10.2 WeasyPrint PDF Pipeline & SSRF Sandboxing (`app/domain/exports/pdf_renderer.py`)
- Renders HTML from a versioned Jinja2 template (`app/templates/quotation.html`, template version `forgeflow-quotation-template/1.0.0`).
- Generates print-ready vector PDF using WeasyPrint with custom font stacks (DejaVu Sans, Helvetica, sans-serif).
- Enforces SSRF sandboxing via `safe_url_fetcher`: denies external HTTP/HTTPS requests and local file system paths.
- Provides dynamic draft watermarking: conditional CSS styling displays an oversized, bold, 45-degree diagonal `"DRAFT — NOT APPROVED COMMERCIAL PROPOSAL"` watermark across all rendered pages.

### 10.3 RFC 4180 CSV Generator with Formula Injection Defense (`app/domain/exports/csv_generator.py`)
- Emits RFC 4180 compliant CSV documents formatted specifically for customer ERP and procurement import.
- Defends against spreadsheet formula injection (CWE-1236) by checking string fields against `DANGEROUS_PREFIXES = ("=", "+", "-", "@", "\t", "\r", "\n")` and prefixing hazardous values with a single quote (`'`). Pure numeric values remain unquoted numbers.

### 10.4 Tamper-Evident Ledger & Dual Audit Separation (`app/models/export.py`)
- **`export_events`**: Tracks every export attempt (success, failure, draft preview, full export) with metadata, user ID, and timing.
- **`quote_customer_deliveries`**: Records official released deliverables, linking to the exact `revision_id`, recording the byte-level SHA-256 fingerprint, file size, and delivering user.
- Export endpoints include `X-Content-SHA256` in the HTTP response headers and expose it to frontend downloads.

### 10.5 Frontend Export Workspace & 1-Click Verification
- `/app/quotes/[quoteId]` mounts `QuoteExportSection`:
  - Disables unwatermarked PDF and CSV export buttons when quotes are in `draft` or `pending_approval` status, displaying an explicit lock explanation.
  - Offers a dedicated "Download Watermarked Draft Preview" button for internal inspection.
  - Enables instant unwatermarked PDF and CSV exports for `approved` or `sent` quotes.
  - Displays the "Export History & Integrity Verification" table with 1-click SHA-256 copy action and status badges.

---

## 11. Phase 7 Architecture: Operational Hardening, Telemetry & Audit Integrity

Phase 7 completes the production operational foundation of ForgeFlow:

### 11.1 Health & Readiness Architecture (`app/api/v1/health.py`)
- Unauthenticated, un-cached probes `/health/live` and `/health/ready`.
- Readiness probe verifies PostgreSQL connection pool (`SELECT 1`) and Alembic migration synchronization (`SELECT version_num FROM alembic_version == '0006_customer_exports'`).
- Returns HTTP 503 `MIGRATIONS_OUTDATED` or `DATABASE_UNAVAILABLE` on degradation, with zero credential leakage.

### 11.2 Structured Telemetry & Recursive Redaction (`app/telemetry.py`)
- Sanitizes incoming `X-Request-ID` or generates UUIDv4.
- Formats logs as single-record JSON under `APP_ENV=production`.
- Automatically scrubs passwords, session cookies, auth headers, tokens, and commercial cost/margin data from emitted log payloads.

### 11.3 Relational & Audit Verification Engine (`app/services/audit_verification.py`, `app/cli/verify_audit.py`)
- Implements 9 relational and commercial invariant checks across quotes, revisions, proposals, maker-checker duty separation, RFQ decisions, export delivery checksums, and CRM activity logs.
- Runnable on demand via `make verify-audit` or CLI (`--json`, `--verbose`).

### 11.4 Backup & Disaster Recovery Architecture (`scripts/backup.sh`, `scripts/restore_test.sh`)
- Automated PostgreSQL custom format (`-Fc`) archives with TOC verification, `chmod 600` permissions, and SHA-256 digests.
- Isolated restore rehearsal verifies recoverability in an ephemeral rehearsal database without touching active production or test instances.

### 11.5 Automated Smoke & Release Preflight (`scripts/smoke.py`, `scripts/release_preflight.py`)
- End-to-end smoke verification of health, auth, RBAC, cost masking, approved quote exports, draft export 409 gates, and delivery logs.
- Preflight verification of lockfiles, configuration guards, migrations, and PDF compilers.
