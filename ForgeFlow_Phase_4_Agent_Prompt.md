# ForgeFlow Phase 4 Agent Prompt — Deterministic Quotation Engine, Quote Builder & Calculation Trace

> **Agent role:** Phase 4 implementation agent  
> **Product:** ForgeFlow — B2B Sales, RFQ & Quotation Operations CRM  
> **Binding source of truth:** repository-root `PRD.md`  
> **Predecessor:** Phase 3 — RFQ ingestion, deterministic matching, persisted catalog candidates and human review studio  
> **Next phase:** Phase 5 — change proposals, maker-checker review, approval queue and atomic commits  
> **Primary outcome:** Convert a quote-ready RFQ into a fully calculated, persistently saved, reviewable quotation draft whose amounts are produced by one authoritative Python `Decimal` domain engine.

---

## 0. Mission and scope boundary

Implement **Phase 4 only**: quotation domain calculations, immutable calculation snapshots, revision/line persistence, quote list/detail/builder screens, customer-facing browser preview, calculation inspector and policy evaluation for the initial draft.

Phase 1 through Phase 3 are reported as complete. Treat those reports as handoff context—not proof that the current checkout is healthy. Inspect the actual code, schema, migrations, API, lockfiles and tests before making changes. Preserve the existing polished shell, design tokens, authentication, CSRF protection, API client, CRM, catalog, RFQ workflow and matching safeguards.

The product journey should now work through:

`CRM account/opportunity → RFQ import → deterministic normalization → human-reviewed catalog matches → quote-ready RFQ → quotation draft with authoritative line/quote totals → inspectable calculation trace`.

**Do not implement the Phase 5 proposal/approval workflow in this phase.** It is acceptable—and required—to calculate and persist policy flags such as “manager approval required”; do not fabricate that a quote has been reviewed or approved. Do not implement the Phase 6 final PDF/CSV export system, external email delivery, actual sending, payment collection, ERP integration or any live customer integration. Do not introduce AI/LLM calls into pricing or quote readiness.

A coding task is not complete merely because endpoints exist: the main quote-builder screen must be real, polished, responsive and connected to persisted backend state, with accessible loading, empty, validation, conflict and error states.

## 1. Mandatory operating rules

1. Read the **entire `PRD.md`** before coding. At minimum re-read Sections 5.3, 6.7–6.10, 7.8–7.11, 8, 9, 10, 11.6–11.9, 12, 14, 15, 16 and Phase 4/5/6 in Section 17. The whole PRD remains binding; this prompt only assigns this phase's boundary.
2. Read `docs/agent-handoff.md`, `docs/architecture.md`, `docs/API.md`, `docs/data-dictionary.md`, `docs/security.md`, `docs/test-plan.md`, `docs/demo-script.md`, and `IMPLEMENTATION_REPORT.md` if present. Read the Phase 3 implementation report supplied by the user as supporting handoff context, but verify its claims against the checkout.
3. Record Git branch, HEAD SHA, `git status --short`, and preserve all uncommitted work. Never delete, reset or overwrite user changes to make a test pass.
4. Run the current phase-3 baseline commands (at least `make check` and `make test-e2e`) before changes. Capture actual results. After implementation, rerun all relevant suites and explain any baseline failure separately from regressions.
5. Do not modify an already-applied Alembic migration. Add a new migration after the actual Phase 3 head; do not assume the revision ID based on its filename.
6. `PRD.md` is authoritative and should remain unchanged. When genuine inconsistencies exist between the PRD, Phase 3 behavior, and this prompt, choose the smallest safe compatible behavior and document it in an ADR. Do not silently alter requirements or existing routes.
7. Reuse the current FastAPI/SQLAlchemy/Pydantic/Ruff/mypy backend, Next.js/React/TypeScript/Tailwind/Base UI/Motion frontend, TanStack Query/Table, generated OpenAPI TypeScript bindings, existing session and permission utilities. Do not introduce another UI system or a second backend framework.
8. Use synthetic demo data only. Do not use real customer data, real credentials or any external paid/live service. Do not present ForgeFlow as affiliated with or endorsed by Auribises.
9. No floating-point math for money. No browser, SQL, model or LLM computation may become authoritative quote calculation. The sole authoritative pricing implementation belongs in pure Python domain code using `decimal.Decimal`.
10. No success toast or optimistic terminal status before the server confirms the write. Do not report a check as passing unless you ran it and observed it pass.
11. Avoid routine questions. Make the explicit decisions below. If the actual repository presents a material contradiction, document it, use the least disruptive safe resolution, and continue.

## 2. Initial inspection and Phase 3 health check

Before implementing:

1. Inspect the current repository tree, migrations and actual schema for `quotes`, `rfqs`, `rfq_lines`, `catalog_products`, `accounts`, `opportunities`, `activities`, organization settings, user roles, permissions and `expected_version` handling.
2. Trace the current endpoint `POST /api/v1/rfqs/{rfq_id}/create-quote`. Verify its exact existing behavior, transaction boundary, duplicate-quote prevention, RFQ readiness rules, tenant scope, audit/activity logging, and response shape. Phase 4 must extend it without breaking current behavior or enabling bypasses.
3. Confirm the current `quotes` header columns and status enum. Confirm whether `current_revision_id` and `current_version` already exist; do not assume a migration detail based solely on the Phase 3 report.
4. Inspect the existing `OrgScopedMixin`/tenant-scoped repositories, permission helpers, session/CSRF middleware, API error contract, route registration, query provider, generated API types, reusable Dialog/Sheet/StatusBadge/DataTable/form components, navigation feature registry, and the existing dashboard contract.
5. Run `make check` and `make test-e2e` (or exact current equivalents). Save command output and distinguish previous failures from new ones.
6. Inspect Phase 3's demo RFQs and existing seeded product/catalog fields. Preserve the current demo fixture behavior and add or update quote fixtures idempotently without duplicate records.
7. Write/update `docs/architecture.md` and create `docs/architecture-decisions/ADR-000X-phase4-quote-revision-model.md` to describe the chosen relationship between the mutable initial quote draft and immutable committed revisions. Include the actual migration parent, key constraints, API behavior and Phase 5 handoff.

## 3. Stack and architectural rules

Use the versions and lockfiles already fixed by the repository and PRD. Do not upgrade the toolchain as part of Phase 4 unless an actual incompatibility requires it and is recorded.

### Backend

- Python 3.12, `uv`, FastAPI, Pydantic v2, SQLAlchemy 2.0, Psycopg 3, Alembic, PostgreSQL 16.
- Pure domain code lives under `backend/app/domain/quotes/` and must not import FastAPI, SQLAlchemy, repositories, or frontend types.
- Recommended domain module boundaries: `money.py`, `calculator.py`, `trace.py`, `policies.py`, `schemas.py` or equivalent, plus unit tests under `backend/tests/unit/domain/quotes/`.
- API routers remain thin. Domain functions take validated immutable/safe values and return calculations, trace data and policy results. Services coordinate persistence, tenant checks and transactions.
- Use `Decimal` created from validated decimal strings or Decimal-valued database fields. Reject NaN, Infinity, non-finite values, invalid precision and invalid ranges. Do not convert incoming money/quantity to `float` at any boundary.

### Frontend

- Continue using current Next.js App Router, React/TypeScript strict, Tailwind CSS 4, shadcn/ui with Base UI, `motion/react`, `lucide-react`, TanStack Query/Table, React Hook Form + Zod and generated OpenAPI types.
- Use shared ForgeFlow tokens and UI components. Do not add a competing component library or new animation framework.
- Server responses are the source of truth. A client-side total preview is optional and may only be a responsive, clearly provisional preview; persisted totals and shown calculation trace must be replaced by the server calculation response. Prefer showing the last confirmed calculation while a save/recalculation is pending.
- Use the existing API fetch wrapper and its CSRF injection/error mapping. Never reimplement session/cookie behavior in a quote feature.

## 4. Phase 4 feature scope

### In scope

1. A pure, deterministic quote calculator using Decimal and explicit rounding.
2. A structured calculation trace for every line and total.
3. Persisted quote revision and quote-line snapshots with historical catalog/product data.
4. Phase 3 quote-conversion integration that creates the first draft revision and its lines from the already resolved RFQ.
5. Quote list, quote detail/builder, customer preview mode and calculation inspector.
6. Draft field and line editing with server validation and expected-version conflict protection.
7. Server-side quote-policy evaluation and persisted policy results/snapshots.
8. Server-side filtering of internal cost/margin fields using the existing permission model.
9. Real dashboard/API updates for quote metrics whose definitions can now be calculated from real Phase 4 persisted data; retain null for metrics that require Phase 5/6 functionality.
10. Tests, generated API types, documentation, synthetic fixtures and handoff for Phase 5.

### Explicitly out of scope

- Quote change proposal workflow, proposer/reviewer states, proposal diff lifecycle, idempotency keys for proposal commits, approval queue pages, manager approve/reject/atomic commit and maker-checker workflow. Those are Phase 5.
- Final PDF renderer (WeasyPrint), final customer PDF export event pipeline, quote CSV export, email sending and `mark-sent` lifecycle. Those are Phase 6.
- Editing an already approved/committed/sent quote in place. Later revisions must go through Phase 5 proposals.
- Multi-currency conversion, currency rates, compound tax, jurisdiction-specific GST filing/compliance, payment processing, ERP sync, stock reservation, procurement orders, LLM-generated prices, AI matching changes or arbitrary formulas.
- Organization settings editor/team management/audit console unless a small read-only or additive piece is required by this phase. Do not expand into unrelated UI modules.

## 5. Domain and persistence design

### 5.1 Migration strategy

Create a new Alembic migration after the real Phase 3 head. A likely filename is `0004_quote_revisions_calculations.py`, but use the repository's actual migration identifiers and naming conventions. Never edit migrations that may already have run.

The Phase 3 `quotes` header is already present. Extend the model/header additively only where necessary. Add or complete these logical records per PRD Section 10.1:

#### `quote_revisions`

Required logical fields:

- `id UUID PK`, `organization_id`, `quote_id`, `revision_number` positive integer.
- `parent_revision_id NULL` for the first revision, otherwise the parent revision within the same quote and organization.
- `currency` (`INR` for current MVP; stored on every revision).
- `snapshot_json` or normalized revision metadata for validity, payment terms, delivery terms, customer-facing notes and any revision-level commercial inputs.
- `calculation_snapshot_json` containing reproducible calculator output, inputs, trace, applied rules, policy evaluation and rounding method.
- `calculator_version`, `input_fingerprint`, `created_by`, `created_at`, `commit_reason`, `is_committed` and a `version`/equivalent concurrency token if required by the current API patterns.
- Unique `(quote_id, revision_number)`, tenant-scoped foreign keys/indexes, and a constraint or transactional check that `parent_revision_id` belongs to the same quote/organization.
- The quote's current revision pointer must always reference a revision belonging to that same quote and organization. Enforce it at the service/transaction level and with suitable database constraints where practical.

#### `quote_revision_lines`

Each row captures the actual line inputs and the immutable product/source snapshot for that revision:

- UUID ID, organization ID, revision ID, stable `line_order`.
- Optional source `rfq_line_id` and optional source `catalog_product_id`.
- Snapshot fields: SKU, product name, description/specification, unit, requested quantity, unit selling price, discount percentage, tax rate, and optional unit cost snapshot where the acting/organization data allows it.
- Persist decimal quantities/prices/rates as PostgreSQL `NUMERIC`, never FLOAT/REAL/DOUBLE for financial values. Choose precision to accept valid catalog values and reject impossible/overflowing values, documenting it in `docs/data-dictionary.md`.
- Per-line calculation snapshot (gross, discount, taxable, tax, total, optional cost/margin trace) tied to the exact inputs and calculator version.
- No cascading delete of historical revision lines when the catalog or source RFQ changes. Preserve the original source relationship as a reference but use snapshot fields to show historic content.
- Constraints: quantity > 0, price/cost >= 0 when present, discount range 0–100, tax in configured 0–100 range, valid line order, correct tenant ownership.

#### Optional narrow supporting record

Use a separate calculation-snapshot table only if the existing persistence conventions or query needs require it. The PRD permits `calculation_snapshot_json` on each `quote_revisions` row, which is the default choice. Avoid tables that do not solve a real query or integrity problem.

#### Quote header additions

Retain Phase 3 quote header and contract. Verify `quote_number`, `account_id`, `opportunity_id`, optional `rfq_id`, `current_revision_id`, `current_version`, `status`, owner/creator, validity date and timestamps. Add only missing fields. Human-readable quote numbers must be generated server-side and unique per organization, e.g. `FF-Q-2026-000123`; UUIDs remain canonical API identifiers. Number generation must be transaction-safe under concurrent creation.

### 5.2 Draft revision semantics — explicit decision

Phase 3 currently creates a minimal `quotes` header through the quote-readiness gate. Phase 4 must make that quote operational:

1. Convert the resolved RFQ lines to a **first draft revision** in the same database transaction that finalizes initial conversion, or use a safe backfill/transaction path when Phase 3 created a quote header earlier. The resulting quote must not remain a header with no revision after successful conversion.
2. The initial draft revision is editable while the quote remains in `draft` and `is_committed=false`. Saving the initial draft updates this working draft using `expected_version` and recomputes/persists its calculation snapshot transactionally. Do not allow drafts to be edited when stale/inactive/approved/sent/cancelled.
3. The initial draft must not be called “approved” or “committed.” Phase 5 will implement submission/manager approval and the transaction that commits an eligible initial revision. Once a revision is committed, its inputs and snapshots are immutable.
4. This phase does **not** implement proposal-based changes to already committed revisions. Such changes must remain unavailable until Phase 5. No route should mutate a committed revision in place.
5. For quotes that were created before this migration, reconcile them idempotently: if a qualifying RFQ and quote are found with no current revision, create exactly one valid initial draft revision from persisted resolved RFQ lines and set the current revision pointer. Do not duplicate quote headers or create multiple revision-1 rows on repeated seed/start calls. If conversion data is invalid/unresolvable, return a safe actionable error and document a repair path rather than fabricate line inputs.
6. Keep optimistic concurrency consistent with current Phase 3 contracts: accept `expected_version` or the existing documented `If-Match` pattern, increment the canonical quote version in the same transaction, and return `409 STALE_VERSION` (or the exact existing error code) without partial changes if stale.

Record this semantics in an ADR. If actual existing behavior conflicts, inspect before choosing and explain in the ADR without changing the PRD.

## 6. Authoritative Decimal pricing engine

### 6.1 Public domain contract

Implement a pure function comparable to:

`calculate_quote(input: QuoteCalculationInput) -> QuoteCalculationResult`

The exact names may follow existing conventions, but its semantics are binding. It must accept explicit, validated revision-level inputs and ordered line inputs. It must not query the database, read environment variables, call network APIs or mutate objects. Put policy evaluation in a separate pure function so calculations can be tested independently.

Return:

- Per-line output keyed by stable line ID/order.
- Every intermediate monetary value.
- Quote-level totals.
- Optional internal cost/profit/margin calculations, represented as absent/null when cost is absent or the viewer is unauthorized (permission filtering belongs at the response/service boundary, not in a client-only condition).
- A structured trace sufficient to explain each number in plain language.
- Applied calculation rules, currency precision, rounding mode, calculator version and stable input fingerprint.
- Validation failures as typed domain errors that map to existing `422`/conflict response contracts.

### 6.2 Decimal and rounding requirements

- Construct `Decimal` from validated decimal strings / validated Pydantic decimal values / database `NUMERIC`; never `Decimal(float_value)`.
- Reject NaN, Infinity, negative quantities, negative sell prices, rates outside bounds, discount outside 0–100, excessive decimal places beyond the defined contract and numbers that exceed database/domain precision.
- `INR` is the only MVP currency. Display with `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`; do not use JS math as authoritative storage or calculation. Server calculations use Decimal.
- Currency result precision is 2 decimal places; use explicit `ROUND_HALF_UP`. Use a named helper such as `round_currency` so each rounding boundary is centralized and tested. Do not depend on ambient Decimal context.
- `quantity` can support fractional units to the precision allowed by the PRD/schema (choose/document the actual allowed scale based on catalog base units). Do not silently round quantities merely because currency has two decimals.
- No binary floats in calculator inputs, outputs, JSON snapshot construction, database writes or calculations. JSON serialization must use an explicit stable Decimal representation (canonical decimal strings preferred).

### 6.3 Required line formulas

Implement the exact ordered rules below. Keep the intermediate rounding boundaries in this order—do not algebraically collapse them or re-round totals differently:

```text
gross_amount    = round_currency(quantity * unit_price)
discount_amount = round_currency(gross_amount * discount_percent / 100)
taxable_amount  = gross_amount - discount_amount
tax_amount      = round_currency(taxable_amount * tax_rate_percent / 100)
line_total      = taxable_amount + tax_amount
```

Quote totals:

```text
subtotal          = sum(line.gross_amount)
total_discount    = sum(line.discount_amount)
taxable_subtotal  = sum(line.taxable_amount)
tax_total         = sum(line.tax_amount)
grand_total       = sum(line.line_total)
```

Totals are sums of stored/computed line-level rounded values. Do not recompute a discount/tax at aggregate level. Freight is **out of scope** unless the PRD's current quote schema explicitly includes it; do not add it because a generic quotation system might have it. Do not add unapproved pricing operations.

Optional internal cost/margin calculation when a unit cost snapshot exists:

```text
line_cost          = round_cost(quantity * unit_cost)  # document selected cost scale/rounding
line_gross_profit  = round_cost(taxable_amount - line_cost)
margin_percent     = line_gross_profit / taxable_amount * 100  # defined calculation precision
```

If taxable amount is zero, `margin_percent` is `null`; never divide by zero or fabricate a percentage. Margin is an internal signal, not a customer-facing quote field. Follow the existing RBAC: `sales_rep` and `sales_manager` do not receive internal unit cost; only roles allowed by the current permission matrix may see cost/margin. Do not widen permissions to make the builder easier to implement. If schema/PRD role permission differences appear, keep current Phase 2 authorization and document the discrepancy.

### 6.4 Snapshot, fingerprint and reproducibility

Each saved quote revision must store:

- Exact inputs: line identifiers/order, source RFQ line IDs, catalog product IDs, product/SKU/name/specification/unit snapshot, quantity, unit price, discount, tax and optional authorized unit cost snapshot; revision currency/terms/validity and the policy settings version or values used for evaluation.
- Exact output: per-line gross/discount/taxable/tax/total, quote totals, optional private internal financial values, structured trace, rule identifiers, rounding method, calculator version and stable input fingerprint.
- `calculation_snapshot_json` must be safe to serialize and stable enough for historical inspection. Do not save Python class objects, ORM objects, secrets, raw file bytes or unbounded debug dumps.
- Use a deterministic canonical serialization (document key ordering and Decimal string format) and a cryptographic digest such as SHA-256 for the input fingerprint. Identical canonical inputs with the same calculator version must give identical fingerprint and outputs.
- Catalog edits after quote creation must not change the saved quote line text, selling price, tax, unit or calculation snapshot. Recalculation of the mutable draft may explicitly use its draft inputs, but must not silently pull updated catalog values over user edits.
- Store `calculator_version` as a semantic/domain version constant controlled by source code (e.g. `forgeflow-quote-calculator/1.0.0`); do not infer the version from an unpinned runtime package.

## 7. Quote policy evaluation

Implement a deterministic pure policy evaluator over a calculation result, organization defaults and current user/action context. Evaluation returns triggered rule identifiers, human-readable reasons, severity, required action and a safe, persisted snapshot. Policy is **evaluation only** in Phase 4; Phase 5 will implement approvals/decisions.

Seed the explicit PRD demo defaults in the existing organization `settings_json` or the current organization-settings mechanism, using a migration/default-setting path that does not overwrite unrelated existing keys:

- `line_discount_approval_percent`: `5.00` — discount **above** 5% triggers manager review; exactly 5% does not trigger this rule.
- `quote_total_approval_inr`: `500000.00` — grand total **above** ₹500,000 triggers manager review; exactly ₹500,000 does not trigger this rule.
- `minimum_gross_margin_percent`: `15.00` — when internal cost exists, margin **below** 15% triggers manager review; exactly 15% does not trigger this rule.

Requirements:

1. No cost data means margin is “not evaluated,” not zero and not a trigger. Other policy checks continue normally.
2. Multiple policy triggers must all be represented, not short-circuited after the first.
3. Record the effective thresholds and triggered-rule results in the calculation/policy snapshot associated with the draft, so changing organization policy later does not silently rewrite a previously saved calculation's historic evaluation.
4. Do not build a general settings editor in this phase. Expose the effective policy and rule explanations read-only to the admin/manager on the quote detail where helpful; policy configuration UI is a later feature. Do not permit browser payloads to override policy thresholds.
5. If no configured policy exists, apply safe PRD defaults and record the fallback source; seed idempotently so normal demo startup has the exact defaults.
6. An RFQ with any unresolved, unmatched, invalid or stale blocking line must not produce a quote revision. The existing Phase 3 server-side gate remains authoritative. Never rely on disabled UI alone.
7. A policy trigger means “approval required”; it does not mean approved, and it must never permit a final export/sending operation. There is no final export/sending implementation in this phase.

## 8. Quote conversion and lifecycle integration

### 8.1 Existing RFQ conversion endpoint

Preserve the public contract and all Phase 3 guards for `POST /api/v1/rfqs/{rfq_id}/create-quote`. Extend its service/transaction to create exactly one working initial revision when quote conversion succeeds:

1. Lock or compare-and-swap the RFQ/quote boundary using the existing version/concurrency strategy.
2. Revalidate authenticated organization and account/opportunity/RFQ relationships server-side.
3. Re-evaluate readiness in the backend: at least one line; every required line valid and actively resolved according to the existing Phase 3 policy; no blocking line; no quote already linked/created unless the route's documented idempotent semantics return the existing quote.
4. For each resolved RFQ line, copy it into `quote_revision_lines` with a stable `line_order`, source `rfq_line_id`, accepted catalog product ID where present, and snapshots of SKU/name/description/specifications/unit. Use the accepted catalog product selling price and tax rate **as defaults at the moment of conversion**, not later catalog reads. Quantity comes from the reviewed RFQ line. Initial discount is 0 unless the PRD explicitly seeds a different default. Do not invent a price when the accepted line lacks a valid catalog selling price; block conversion with an actionable error. Do not use product cost as selling price.
5. Use a transaction to persist the quote header linkage, revision 1, line snapshots, calculation snapshot, fingerprint and required activity event. If any write fails, roll back the entire conversion; there must not be a dangling quote header or an RFQ marked quoted without its revision.
6. Set the quote's current revision pointer and increment the appropriate quote/RFQ versions consistently. The RFQ should become `quoted` only as part of the successful transaction.
7. Ensure retrying a conversion request cannot create duplicate quotes, duplicate revision-1 records or duplicate activities. Follow the existing contract (return existing result if documented, otherwise a stable conflict) and add a uniqueness/transaction backstop.
8. Quote calculation/policy failure is not permission to bypass RFQ readiness. Return the existing structured API error format with code/message/request ID and safe diagnostics.

### 8.2 Quote list/detail API and status rules

Implement the PRD quote API contracts that belong to this phase, using existing naming conventions and Pydantic schemas:

- `GET /api/v1/quotes` — organization-scoped paginated/filterable quote list; search by quote number/customer/opportunity; filter by status/owner/date when supported by schema.
- `GET /api/v1/quotes/{quote_id}` — quote header, current revision metadata, current server-calculated totals and policy flags, with permissions applied.
- `GET /api/v1/quotes/{quote_id}/revisions` — ordered revision list (Phase 4 may contain the first draft revision; later Phase 5 adds committed revisions/proposals).
- `GET /api/v1/quotes/{quote_id}/revisions/{revision_id}` — immutable-safe snapshot/detail and calculation snapshot permission-filtered for the authenticated role.
- `PATCH /api/v1/quotes/{quote_id}/draft` — update the current uncommitted draft revision's allowed editable fields/lines, requires expected quote/revision version, validates all input and atomically stores recalculated results. It must reject non-draft/committed/stale records.
- `GET /api/v1/quotes/{quote_id}/calculation-trace?revision_id=...` — permission-filtered structured explanation. Default to current revision only if the existing API convention supports that unambiguously.

Do not create a generic unrestricted patch accepting arbitrary ORM property maps. The schema must reject unexpected/immutable fields such as `organization_id`, `quote_number`, `current_revision_id`, status/approval fields, creator, cost fields from unauthorized users, calculation snapshot, input fingerprint and audit fields. Use strict request models or explicitly forbidden extras according to existing standards.

Use existing API pagination `{ items, page, page_size, total }`, page-size bounds and error format. All endpoints require authentication and organization scope. A record that belongs to another organization must be indistinguishable from a nonexistent record per the existing non-disclosure convention. Every applicable endpoint must enforce action permissions server-side.

### 8.3 Draft edit contract

- Only one mutable initial draft revision is allowed for the current Phase 4 lifecycle. `expected_version` must match the quote and draft revision state. The implementation may atomically update the same uncommitted draft snapshot and line rows on Save; once a revision becomes committed in Phase 5, no edit route may mutate it.
- If current version mismatches, return `409` with the current safe revision number/summary and the established conflict code. The client must preserve the user's unsaved edits and offer “Reload latest”/compare; do not blindly retry the change.
- If a saved draft has invalid inputs, reject the entire update with field-level errors. Do not persist partial line changes or stale calculated totals.
- Delete/remove line behavior should be limited to the mutable draft revision, explicit in request schema, and protected by confirmation if destructive. Never delete source RFQ lines or catalog products from a quote editing action.
- When line values change, re-run the authoritative calculator and policy evaluator in the same service operation before the save is considered successful. The returned response must contain the saved input version and the matching new calculation snapshot.
- Do not implement or advertise arbitrary future revision diffs as committed history before Phase 5.

## 9. API/schema details and error handling

Use the repository's schema conventions. The exact class names may differ, but establish clean modules such as:

- `backend/app/domain/quotes/calculator.py`
- `backend/app/domain/quotes/trace.py`
- `backend/app/domain/quotes/policies.py`
- `backend/app/schemas/quotes.py`
- `backend/app/schemas/quote_calculations.py` (optional, only if helpful)
- `backend/app/api/v1/quotes.py`
- `backend/app/services/quote_service.py`
- `backend/app/repositories/quotes.py` (follow repository conventions)
- tests for domain, API, tenant/security, concurrency and conversion integration.

Error behavior:

- `401`: no valid session.
- `403`: authenticated user lacks permission.
- `404`: missing or cross-tenant object per existing non-disclosure pattern.
- `409`: stale expected version, invalid state transition, duplicate/conflicting conversion or mutable draft no longer available.
- `422`: invalid quantities, decimal precision/range, missing required snapshot input, bad terms/date or invalid quote line payload.
- Preserve the standard safe error fields `code`, `message`, optional field-safe `details`, `request_id`. No SQL, traceback, secret, cross-tenant hint or internal cost in unauthorized responses.

Use transaction scopes for all multi-row mutations. Maintain the append-only `activities` convention for quote creation and draft update where appropriate. Business state and required activity entries must commit together. Use `SELECT ... FOR UPDATE` or the repository's tested compare-and-swap pattern when quote header/current revision changes could race. Do not hold a DB transaction open during expensive rendering or network calls.

Generate frontend API bindings from the current FastAPI OpenAPI contract using the existing `make openapi-generate` (or documented repo command). CI must fail if generation creates an uncommitted contract diff.

## 10. Calculation inspector and trace contract

A quote's displayed amount must be inspectable without executing arbitrary code. Implement structured trace nodes/items with at least:

- `output_key` (e.g. `quote.grand_total`, `line:<uuid>.tax_amount`).
- `label` / safe explanation string.
- Ordered input references/values, using canonical decimal strings.
- Operation identifier (`multiply`, `percentage`, `subtract`, `sum`, `round_currency`, etc.).
- Formula text or human-readable operation—not executable Python/eval content.
- Rounding method and rounding boundary.
- Result value.
- Calculator version and source IDs/snapshot reference.
- Optional internal trace section for cost/profit/margin, filtered server-side according to permissions.

Required example explanation sequence for a line:

1. Quantity × unit price → gross amount.
2. Gross amount × discount rate → discount amount, rounded to INR currency precision.
3. Gross minus discount → taxable amount.
4. Taxable amount × tax rate → tax amount, rounded to INR currency precision.
5. Taxable amount + tax amount → line total.

Quote total trace must point to the exact line values summed. Explain that amounts are precomputed by the server; trace rendering must not recalculate financial amounts in React. A trace response must be reconstructed from the saved revision snapshot or validated against it; do not show the latest catalog price as the reason a historic quote had an older price.

## 11. Frontend routes and UX requirements

Add Quotes to the existing feature registry only when the list and detail pages are functional. Follow actual route-group conventions; the public route paths are:

- `/app/quotes` — quote list.
- `/app/quotes/[quoteId]` — quote builder/detail with quote header, editable draft, totals, policy flags and customer preview mode.
- `/app/quotes/[quoteId]/revisions/[revisionId]` — revision/snapshot view and calculation trace. A first draft revision must be labelled clearly as “Draft revision” and “Not approved”; do not render fake approval controls.

### 11.1 Quote list page

Use real API-backed data. Include:

- Page heading “Quotations” with one-line explanation and appropriate primary action only where a real workflow supports it. The main path to create a quote should be the “Create quotation” action on an RFQ that passes the Phase 3 readiness gate; avoid a broken manual quote creation button.
- Search by quote number/customer/opportunity; status filters; owner/date filters if supported.
- Columns: quote number, customer/account, opportunity, source RFQ, current revision, quote total, status, policy/approval indicator, owner and last-updated time.
- The current quote total should use the stored server calculation snapshot and currency formatting. Do not sum in the table client.
- Useful loading skeleton, first-run empty state linking to RFQs, filtered-empty state with clear filters, recoverable error/retry state, and pagination if the collection exceeds the page size.
- Approval indicators explain “Manager review required” when the policy snapshot flags it. Do not style it as “Pending approval” unless a real Phase 5 transition has occurred.

### 11.2 Quote builder — high-priority screen

Treat this as a major product screen, not a generic CRUD form. Reuse the existing visual system/tokens/components; no bespoke parallel palette.

**Header:** quote number, account, opportunity, RFQ source, current draft revision, save state, last updated, validity date, state badge “Draft / Not approved”, and role-allowed actions. Include a breadcrumb and an unambiguous unsaved-change state.

**Main work area:**

- Editable line-item table with product/SKU snapshot, description/specification, quantity, unit, unit selling price, discount %, tax %, server-calculated gross/discount/taxable/tax/line total, and row actions.
- Inputs have explicit labels, supported decimal precision and field-level validation. Numeric inputs must not convert through JS floating point to authoritative values; submit normalized decimal strings. When focus enters a cell editor, preserve local input text; do not make invalid intermediate text impossible to type.
- Product/catalog selection must be constrained to active products permitted for the role and should use the current catalog APIs. For lines derived from an RFQ, preserve source linkage and make clear that the product, unit and original RFQ values were copied into the draft. Catalog changes must not silently overwrite quote snapshots.
- Only draft-editable fields have active controls. Do not show controls for approve/reject/commit/final export in Phase 4.
- Saving line edits submits one validated change request with expected version. The API returns the authoritative new quote calculation and snapshot. On conflict, preserve unsaved inputs and show a dedicated stale-version banner with reload action.

**Right-side totals/policy panel:**

- Subtotal, discount total, taxable subtotal, tax total, and grand total.
- Each total can open the calculation inspector.
- Display policy triggers with specific copy, e.g. “Manager review required: a line discount exceeds 5%.” If no cost exists, say “Margin rule not evaluated — cost data unavailable” only when relevant and permitted; do not reveal whether hidden cost exists to an unauthorized role unless the PRD explicitly allows that fact.
- Show policy threshold source/default for admin/manager as permitted. No browser-controlled threshold edits.
- Show clear saved/pending/error state; on successful save, replace all totals with server values and only then show success notification.

**Customer-facing preview mode:**

- Separate from edit mode; it is an in-browser preview only, not the final PDF export implementation.
- Print-oriented clean layout with synthetic seller organization identity, customer details, quote number, date, valid-until (only if stored), item SKU/description/specification/quantity/unit/unit price/discount/tax/line total, subtotal, discount, tax and grand total, payment/delivery terms and customer-facing notes.
- Display a prominent “DRAFT — NOT APPROVED” label/watermark in draft preview. Never show internal notes, unit cost, gross profit, margin, matcher score, audit internals, tokens or hidden operational metadata.
- Do not fabricate an expiry date, organization address, legal identity or payment term if no stored value exists. Show a safe empty/omitted value according to PRD preview rules.
- No PDF generation or export download button in this phase. A preview/print stylesheet is allowed, but do not claim the result is a final approved quotation.

**Calculation inspector:**

- Open via a right-side Sheet/SlideOver, not a cramped modal that hides the line table context.
- Clicking an amount shows its label, exact server-returned inputs, ordered steps, rounding rules, result, calculator version and relevant source line/product snapshot references.
- Use explanatory prose, formatted decimal values, subtle step numbering and copyable values where useful; do not expose executable code or internal-only cost/margin fields to unauthorized roles.
- Provide keyboard and screen-reader labels; focus returns to the selected amount when the sheet closes.

### 11.3 Visual and interaction quality bar

- Keep the app visually consistent with the existing PRD design tokens in `globals.css`; do not edit the token values to make the quote page easier to style.
- Prefer clean, high-information hierarchy, calm surfaces, restrained borders/shadows, precision typography, and enough spacing between grouped financial values. Use tabular numerals for money and aligned decimal columns.
- Use `motion/react` only for purposeful small transitions (sheet enter/exit, save state, subtle disclosure, row state); respect `prefers-reduced-motion`. Never animate totals in a way that implies an amount different from the server value.
- Use lucide icons with text labels for state; no emoji. Never rely on color alone for approval/blocking/error status.
- Do not add heavy background gradients, glassmorphism, arbitrary chart decoration, fake activity, invented metrics, fake skeleton interactions or dead buttons.
- At ≥1280 px use a table/main workspace with a persistent totals panel. At tablet width, allow the totals panel to move below or into a deliberate side panel. At mobile, line rows become readable stacked cards or an explicitly designed horizontally navigable table; the user must still be able to edit every field and inspect totals without accidental page-wide overflow. Keep actions reachable and don't turn the whole quote view into a tiny desktop table.
- Required visual verification viewports: 1440×900, 1024×768 and 390×844. Add Playwright screenshot evidence and axe-core scans for quote list, builder, preview and calculation inspector.
- Test every relevant state: initial load, loading, empty quote collection, draft, invalid input, server error, policy trigger, no-cost margin status, successful save, stale conflict, permission restricted, preview, and current revision detail.

## 12. Authorization and tenant isolation

Follow the existing RBAC helpers and current Phase 2 contract, not a new role scheme. Current known roles are `sales_rep`, `sales_manager`, `catalog_manager`, and `admin`; inspect the current permission matrix before implementing.

- Every quote, revision and line query must be scoped by `organization_id` from the authenticated session. Do not accept organization scope from the browser as authority.
- A quote's account, opportunity, source RFQ, RFQ lines and catalog products must belong to the same organization. Reject cross-tenant references.
- The `sales_rep` and `sales_manager` roles currently receive `unit_cost: null`; maintain that behavior. Internal costs/margin must be absent or null from unauthorized API payloads, calculation traces, list/detail responses, React Query cache data exposed to those roles, and in-browser/customer previews. Hiding a column in React is insufficient.
- Only the existing authorized roles can create/update catalog products/price information. A sales role may update its allowed quote selling-price/discount inputs only if current PRD permissions explicitly grant the action; do not equate permission to edit a quote with permission to see or edit internal unit cost.
- Do not allow client payloads to supply or change organization ID, creator, quote number, status, `is_committed`, current revision pointer, calculation snapshots, fingerprint, policy threshold values, reviewer/approver fields or audit timestamps.
- Enforce auth, role, state and tenant checks at every API action, including detail, revision and trace endpoints.
- Add negative tests that request an existing quote/revision from another tenant and verify it is not disclosed.

## 13. Dashboard and navigation integration

Extend Phase 2 dashboard metrics additively. Inspect the actual existing response schema. If Phase 2 included fields such as `quote_conversion_rate`, `average_quote_value` and `available_phase_4`, define exact meanings and update them only where data is now real:

- `available_phase_4` becomes `true` only when the authoritative quote calculation/revision path is operational.
- Quote count/draft quote count and aggregate values must come from organization-scoped SQL over the correct current revision—not duplicate/synthetic hardcoded metrics.
- Only set `average_quote_value` when the denominator and population are explicitly defined and nonempty; otherwise return documented `null`.
- Define conversion-rate numerator/denominator precisely from persisted RFQ/quote lifecycle data; if the current schema lacks trustworthy sent/approved outcomes, keep the metric `null` rather than creating a misleading ratio.
- `quotes_awaiting_approval` and approval attention items must remain false/zero/null as specified by the existing contract until Phase 5 actually implements submission and approval states. Never fabricate awaiting approvals from a policy flag alone.
- Keep all existing Phase 2 dashboard fields and response compatibility intact. Add/extend schema tests and regenerate TypeScript bindings.
- Enable the Quotes navigation only after list/detail/quote conversion paths work end-to-end. Do not enable Approvals in Phase 4.

## 14. Testing strategy — mandatory

Add tests at each layer. Existing Phase 1–3 tests remain in place and green.

### 14.1 Pure domain tests

At minimum test:

- Standard single-line and multi-line calculations against hand-calculated fixtures.
- Exact formula/rounding order: line gross, discount, taxable, tax and line total; quote totals as sums of rounded line values.
- Half-up rounding boundaries including `.005`, values just below/above rounding boundary, repeating percentage calculations and multiple-line aggregate differences.
- Zero discount, 100% discount, zero tax, non-zero tax, zero taxable amount and empty line list (empty quote should be rejected by validation unless PRD states otherwise).
- Decimal quantities and unit prices at allowed maximum scale; values beyond allowed scale/precision rejected rather than silently rounded before calculation.
- Negative quantity, negative sell price/cost, invalid tax/discount, NaN/Infinity, missing units/product snapshot, unsupported currency and overflow behavior.
- Margin calculated when costs exist; margin is null on zero taxable amount; no inferred cost/margin when cost absent.
- Exact stable serialized calculation snapshot and fingerprint for identical inputs; deterministic output/order across repeated runs.
- Trace values exactly match calculator outputs and contain ordered calculation steps.
- Policy thresholds: discount 5.00% vs >5.00%; grand total ₹500,000 vs >₹500,000; margin 15.00% vs <15.00%; multiple triggers; missing cost; missing policy values/defaults.

### 14.2 Persistence and API integration tests

Use isolated PostgreSQL test DB, not a mocked SQLite substitute for transaction/concurrency constraints. Verify:

- New migration upgrades successfully from the Phase 3 database; existing records and RFQ functionality remain intact.
- Eligible RFQ converts to exactly one quote header + initial draft revision + copied line snapshots + calculation snapshot + audit/activity entry in one transaction.
- Blocked RFQ cannot create a quote/revision even with a direct API call.
- Retry of quote conversion follows a documented idempotent/conflict contract and never duplicates revision 1.
- Catalog price/name/tax/spec changes after conversion do not alter the quote snapshot/total.
- Draft Save validates, updates input and calculation snapshots atomically, bumps expected version, and rejects stale submissions with HTTP 409 and no partial data changes.
- A failed save rolls back all line updates and does not persist totals for an older/newer input mix.
- Missing/cross-organization quote, revision, RFQ, opportunity, account or product is non-disclosing and cannot create a cross-tenant relationship.
- Unit cost/margin fields are absent/null for `sales_rep` and `sales_manager`; authorized roles only see what the permission matrix allows.
- Unauthorized quote edits, attempt to modify immutable fields, edit of a non-draft/committed quote and invalid lifecycle state are rejected.
- Pagination/filter/search contract and dashboard metrics use persisted values.

### 14.3 Frontend tests

Use current Vitest/React Testing Library. Test:

- Quote list loading, empty, error/retry, filtering and server values.
- Draft builder shows the confirmed server totals, not a client-calculated replacement.
- Numeric editing preserves intermediate text and submits decimal strings in the API schema.
- Field validation and invalid server response preserve recoverable input.
- Save does not show success before API confirmation; server response updates line amounts and totals.
- A conflict shows a stale warning and reload option without silently discarding the user's edits.
- Policy notices display each applicable rule and never mislabel a draft as approved/pending approval without lifecycle support.
- Cost/margin and internal trace content are not rendered for unauthorized role payloads.
- Preview omits internal notes, internal costs, margins, matcher internals and tokens; draft watermark is visible.
- Inspector opens/closes accessibly and focus is restored.

### 14.4 Playwright and accessibility

Extend the existing suite, do not replace or weaken it. At least verify:

1. Demo sales login → existing RFQ review → finish required human decisions → create quote → quote builder loads draft revision and persisted line snapshots.
2. Quote lines show expected stored prices and consistent authoritative totals for a frozen demo fixture.
3. Edit quantity/discount/tax, save, reload page and confirm values/totals/trace persist.
4. A policy trigger appears correctly and does not falsely imply that manager approval has occurred.
5. Navigate to line/quote calculation inspector and verify the exact output values and rounding steps.
6. Attempt a stale version or simulate concurrent stale data; verify 409/conflict UI and no silent overwrite.
7. Sales user never sees unit cost/margin in UI/API; authorized role may view when the permission matrix allows.
8. Draft preview is visibly watermarked and contains no internal fields.
9. Existing Phase 1–3 flows still pass, including CSV upload/import, review decisions, catalog, CRM and task completion.
10. Run axe-core scans on quote list, builder, preview and inspector; no new WCAG AA violations. Capture desktop/tablet/mobile screenshots and verify no unwanted document-level horizontal overflow.

### 14.5 Commands

Use the actual repo command names, expected to include:

```bash
make lint
make typecheck
make test
make build
make check
make test-e2e
make openapi-generate
```

Run clean install/build commands when feasible. If any required command is missing, implement/update the existing command pattern and document it rather than silently omitting a quality gate. Do not use coverage percentages as a substitute for the required scenarios.

## 15. Demo data and end-to-end acceptance scenario

Extend the existing synthetic seed idempotently. Do not delete or rename Phase 2/3 fixtures. Ensure at least:

1. The existing Phase 3 “Turnaround Piping & Valves Batch A” RFQ can be resolved and converted into a quote with multiple industrial line items.
2. A resulting draft has consistent line snapshots and the exact deterministic calculator output.
3. At least one quote is above the ₹500,000 threshold, demonstrating that policy evaluation flags a manager review requirement without pretending approval exists.
4. At least one line discount exceeds 5% to exercise the line-discount rule, unless product requirements intentionally prevent a user from entering that value; use a test fixture if necessary.
5. At least one quote has populated internal unit-cost snapshots for authorized internal review and at least one quote/line has no unit cost, demonstrating margin `null`/not-evaluated behavior.
6. Include a historical snapshot fixture showing that changing a catalog product after quote creation does not rewrite the quote line snapshot.
7. Keep all account/contact/email/quote data synthetic; use reserved `.example` domains. Seed script must be idempotent and never reset/drop the database.

A manual demo should be possible from the seeded app with no special hidden setup: open the existing RFQ, review its lines, create a quote, inspect line totals and quote totals, change an allowed draft field, save, reload, inspect a calculation trace and view the draft customer preview.

## 16. Documentation and handoff

Update the following docs to reflect actual behavior:

- `docs/API.md`: implemented quote endpoints, request/response shapes, state permissions, version contract, errors and current Phase 5/6 endpoints explicitly marked not implemented/planned.
- `docs/data-dictionary.md`: quote revision/line columns, precision/scale, constraints, indexes, snapshot fields and immutable/working-draft lifecycle.
- `docs/architecture.md`: conversion transaction, authoritative calculator boundary, trace generation, policy evaluation and snapshot/fingerprint design.
- `docs/security.md`: role-safe cost/margin filtering and tenant scoping for quotes/revisions/traces.
- `docs/test-plan.md`: actual command outputs and domain/API/E2E coverage.
- `docs/demo-script.md`: quote conversion, calculation inspection, policy trigger and draft preview sequence.
- `docs/agent-handoff.md`: exact Phase 4 implementation, migration ID, files/commands, endpoint contract, current role permissions, known limits and strict Phase 5 next steps.
- `IMPLEMENTATION_REPORT.md` or the current report convention: factual completion summary and verified checks.
- ADR describing draft and immutable committed revision semantics and how Phase 5 will transition the initial draft.

Do not claim final PDF export, approvals, proposal commit, email sending or manager queue are complete. Mark them as Phase 5/6 work.

## 17. Files and boundaries to preserve

Do not casually edit or refactor these completed foundations:

- `PRD.md` — source of truth.
- Core authentication/session/password/CSRF/rate-limit files (`session.py`, `passwords.py`, `csrf.py`, `rate_limit.py` or actual equivalents).
- Existing frontend `client.ts`/API wrapper and CSRF injection.
- Existing design tokens in `globals.css`.
- Phase 2 CRM/catalog/RBAC services and schema contracts.
- Phase 3 RFQ normalization/matching logic, persisted candidate/decision history, line-version checks and quote-readiness gate.
- Existing applied Alembic migrations.
- Existing test DB fail-closed guards, CI security checks and current E2E tests.

New code may call these modules and new migrations may add schema. If a small correction to an existing file is genuinely required for integration, keep it minimal, test the existing behavior and document the change. Never weaken previous invariants to pass Phase 4 tests.

## 18. Execution order

Follow this order to reduce integration risk:

1. Read PRD/handoff and inspect actual repository/schema; record Git state.
2. Run Phase 3 baseline `make check` and `make test-e2e`.
3. Define Decimal domain input/output types and pure calculator/trace/policy logic first; add exact unit tests before persistence/UI.
4. Add migration/model relationships/constraints/indexes and ensure upgrade from the current Phase 3 database.
5. Extend quote conversion transaction to create the initial draft revision and quote-line snapshots.
6. Implement quote services/repositories and REST schemas/endpoints with tenant/RBAC/version tests.
7. Generate OpenAPI TypeScript contracts and implement quote list/builder/preview/calculation inspector using shared design-system components.
8. Add realistic idempotent quote fixture(s) and update dashboard metrics/navigation additively.
9. Run all automated tests, inspect actual browser screenshots at required viewport sizes, fix all in-scope failures.
10. Update docs/ADR/handoff and provide a final verified report.

## 19. Definition of done / final handoff report

Phase 4 is complete only if the acceptance criteria in PRD Section 6.8 and Phase 4 roadmap pass, the quote conversion path creates a valid persisted draft revision, draft saves recalculate authoritatively, historical snapshots are stable, policy flags are truthful, UI is responsive/accessibility-tested, and Phase 1–3 flows remain green.

Return a concise but evidence-backed report with:

1. **Implemented:** domain calculator, trace, policy engine, migration, services/endpoints, screens and demo fixture updates.
2. **Migration:** exact Alembic revision ID/parent and tables/constraints added.
3. **Formula contract:** rounding/precision decisions, calculator version and fingerprint serialization.
4. **Lifecycle boundary:** how the draft revision works and exactly what Phase 5 must implement to submit/approve/commit it.
5. **Security:** tenant scope, cost/margin permissions, version/concurrency checks and preview exclusions.
6. **Verification:** each command run, actual `PASS`/`FAIL`/`BLOCKED` result and meaningful counts/timings if emitted by the command. Distinguish pre-existing failure from new regression.
7. **Visual QA:** viewports/screenshots/scans actually reviewed and results; don't claim a visual audit if no browser capture was performed.
8. **Files of interest:** key paths for subsequent agents.
9. **Known limitations:** specifically identify Phase 5 proposal/approval work and Phase 6 final exports; no hand-waving.
10. **Next step:** instruct the next agent to read `PRD.md` and `docs/agent-handoff.md` and implement **Phase 5 only** — reviewable quote change proposals, maker-checker approval, manager review workspace and revision-safe atomic commits — without redoing Phase 4 pricing or modifying committed revisions in place.

**Success criterion:** after Phase 4, the app can take a real, quote-ready synthetic RFQ through conversion into a draft quotation, compute every amount using deterministic Decimal math, explain each result from a persisted trace, show policy flags accurately and preserve snapshots across reloads—without yet pretending the manager approval or final export lifecycle exists.
