# ADR-0010: Phase 4 Quotation Engine, Revision Modeling, and Pricing Boundaries

## Status
Accepted

## Context
Phase 4 implements the Authoritative Deterministic Quotation Engine, Quote Revision Snapshots, Calculation Traces, Quote Builder UX, and Policy Evaluation.
Several structural and architectural decisions govern this phase:

1. **Mutable Working Draft vs. Immutable Committed Revisions**:
   - *Problem*: The PRD describes quotation revisions as immutable snapshots, while users need to edit quantities, unit prices, discounts, and payment terms on a newly created draft.
   - *Decision*:
     - When an RFQ is converted via `POST /api/v1/rfqs/{rfq_id}/create-quote`, the server initializes a Quote header and its first draft revision (`revision_number = 1`, `is_committed = false`).
     - While `is_committed = false` and the quote status is `draft`, this working revision is mutable via `PATCH /api/v1/quotes/{quote_id}/draft`. Edits require `expected_version` matching the quote's current version and atomically update line snapshots and recalculate `calculation_snapshot_json`.
     - Once a revision is approved/committed (which occurs in Phase 5 via maker-checker proposals), `is_committed` becomes `true` and the revision becomes permanently immutable.
     - Subsequent changes to committed quotes in Phase 5 will create isolated proposals rather than modifying committed revisions in place.

2. **Authoritative Decimal Pricing Engine**:
   - *Problem*: Financial calculations must never suffer from binary floating-point drift, ambiguous rounding order, or client/browser divergence.
   - *Decision*:
     - A pure Python domain engine in `backend/app/domain/quotes/` (`calculator.py`, `money.py`, `trace.py`, `policies.py`) serves as the sole source of truth for pricing math.
     - All calculations operate on Python `decimal.Decimal` with explicit `ROUND_HALF_UP` to 2 decimal places for INR currency values.
     - Line formula sequence:
       - `gross_amount = round_currency(quantity * unit_price)`
       - `discount_amount = round_currency(gross_amount * discount_percent / 100)`
       - `taxable_amount = gross_amount - discount_amount`
       - `tax_amount = round_currency(taxable_amount * tax_rate_percent / 100)`
       - `line_total = taxable_amount + tax_amount`
     - Quote totals are the exact sums of computed rounded line values (never re-rounded at the quote level):
       - `subtotal = sum(gross_amount)`
       - `total_discount = sum(discount_amount)`
       - `taxable_subtotal = sum(taxable_amount)`
       - `tax_total = sum(tax_amount)`
       - `grand_total = sum(line_total)`
     - Freight is omitted unless explicitly specified by PRD quote models.

3. **Cost, Margin, and RBAC Data Isolation**:
   - When unit cost exists:
     - `line_cost = round_currency(quantity * unit_cost)`
     - `line_gross_profit = round_currency(taxable_amount - line_cost)`
     - `margin_percent = (line_gross_profit / taxable_amount) * 100` (rounded to 2 decimal places; `null` if taxable amount is 0).
   - In accordance with Phase 2 RBAC policies, `sales_rep` and `sales_manager` are strictly forbidden from viewing internal costs and margins. The API serialization layer scrubs `unit_cost`, `line_cost`, `line_gross_profit`, and `margin_percent` to `None`/`null` for these roles.

4. **Calculation Snapshot and Trace Reproducibility**:
   - Each saved revision stores a complete, self-contained `calculation_snapshot_json` containing:
     - `calculator_version`: Semantic domain constant (e.g. `forgeflow-quote-calculator/1.0.0`).
     - `input_fingerprint`: SHA-256 digest of canonical ordered JSON inputs.
     - `totals`: Subtotal, discount total, taxable subtotal, tax total, grand total.
     - `line_calculations`: Dictionary of per-line breakdown amounts.
     - `trace`: Ordered human-readable explanation nodes documenting every mathematical operation and rounding boundary.
     - `policy_evaluation`: Evaluated policy triggers, rule IDs, and thresholds.
   - Changing catalog prices after quote creation never alters historical quote line snapshots.

5. **Policy Evaluation Boundary (Phase 4 vs Phase 5)**:
   - Organization policy thresholds (seeded from PRD defaults):
     - `line_discount_approval_percent = 5.00` (>5% triggers manager review)
     - `quote_total_approval_inr = 500000.00` (>₹500,000 triggers manager review)
     - `minimum_gross_margin_percent = 15.00` (<15% triggers manager review when cost exists)
   - Phase 4 evaluates and stores policy triggers in the calculation snapshot, displaying warnings in the UI (e.g., *"Manager review required: Line discount exceeds 5%"*).
   - Phase 4 does NOT implement approval decisions, maker-checker authorization, or proposal diff commits (which belong to Phase 5).

6. **Database Schema & Migration**:
   - Migration `0004_quote_revisions.py` (Revision ID: `0004_quote_revisions`, 20 chars, complying with PostgreSQL's 32-char `version_num` limit) builds directly upon `0003_rfq_ingestion_review`.
   - Extends `quotes` table with `current_revision_id` foreign key.
   - Creates `quote_revisions` and `quote_revision_lines` with PostgreSQL `NUMERIC` types, tenant isolation indexes, and optimistic concurrency versioning.

## Consequences
- Guarantees 100% deterministic, audit-traceable, mathematically sound financial quoting.
- Enforces strict tenant and role isolation for confidential procurement costs.
- Establishes a seamless, clean architectural boundary for Phase 5 proposal governance.
