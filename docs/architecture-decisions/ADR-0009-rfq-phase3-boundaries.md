# ADR-0009: RFQ Ingestion, Matching Thresholds, and Phase 3/4 Boundaries

## Status
Accepted

## Context
Phase 3 implements RFQ CSV Ingestion, Deterministic Normalization, Persisted Catalog Matching, and the Line-Item Review Studio.
Several specifications and boundaries require clear architectural decisions:

1. **Upload Limits vs PRD Section 16.2 Environment Table**:
   - PRD Section 16.2 mentions general file limits (e.g., 25MB max upload), while Section 6.6 explicitly dictates an RFQ-specific import contract: maximum 5 MiB and maximum 500 data rows.
   - *Decision*: Enforce the Section 6.6 contract as authoritative for RFQ CSV ingestion (5 MiB, max 500 data rows). Read up to 5 MiB + 1 byte before rejecting with `413 PAYLOAD_TOO_LARGE` to prevent unbounded memory consumption.
   - Environment variables `MAX_RFQ_FILE_SIZE_BYTES=5242880` (5 MiB) and `MAX_RFQ_DATA_ROWS=500` will be validated at startup.

2. **Catalog Schema Adapter**:
   - The upstream `RFQ-line-item-normalizer` repo used a standalone `Product` dataclass with `uom` and flat `attributes: Dict[str, str]`.
   - ForgeFlow Phase 2 uses `CatalogProduct` with `base_unit` (`nos`, `mtr`, `kg`, etc.), `manufacturer_part_number`, and `attributes_json: dict`.
   - *Decision*: Adapt ForgeFlow's `CatalogProduct` and `CatalogAlias` models into the matcher's domain input without changing Phase 2 database columns or creating duplicate tables. A narrow adapter maps:
     - `base_unit` -> matcher canonical unit (`uom`).
     - `attributes_json` -> matcher attributes dictionary (material, dn_mm, pn_rating, etc.).
     - `catalog_aliases` -> product alias tokens.

3. **Deterministic Matching Engine & Thresholds**:
   - Upstream commit `a91341e2bf2bb479b8accadbf03a70b4a627adbb` established `version="1.0.0-final"` with:
     - `K = 5` (top candidate count)
     - `T_MIN_CANDIDATE = 0.30` (minimum similarity to be considered a candidate)
     - `T_PROPOSE = 0.60` (minimum similarity to be proposed without low-similarity flag)
     - `T_MARGIN = 0.10` (near-tie margin triggering missing discriminator review)
   - *Decision*: Preserve these verified matching constants exactly. No arbitrary threshold adjustments. Match scores are reported as similarity scores (0.0 to 1.0), not calibrated probabilities.

4. **Quote Readiness and Conversion Boundary**:
   - PRD Section 11.5 specifies `POST /api/v1/rfqs/{rfq_id}/create-quote`.
   - Phase 4 is solely responsible for quote pricing calculation, line totals, discounts, and editable revisions.
   - *Decision*: In Phase 3, `POST /api/v1/rfqs/{rfq_id}/create-quote` acts as the authoritative **Readiness Gate & Quote Shell Hand-off**. It:
     1. Evaluates server-side readiness (`ready_to_quote` state, 0 blocking/invalid/unmatched lines).
     2. Transitions RFQ status to `quoted` atomically.
     3. Creates a minimal `quotes` header record (`rfq_id`, `opportunity_id`, `account_id`, `status='draft'`, `version=1`) with snapshot lines linked to accepted products.
     4. Does NOT calculate financial totals, taxes, or proposals (which belong to Phase 4). Subsequent calls on the same RFQ return `409 ALREADY_QUOTED`.

5. **Decision Immutability & Audit Trail**:
   - Decision records (`rfq_line_decisions`) are strictly append-only.
   - Reverting a decision adds a compensating decision record with action `revert`, resetting the line to `suggested` or `needs_review`.
   - Bulk exact match acceptance is strictly atomic: all target lines must belong to the RFQ, must be designated eligible exact matches by the backend, and must match their `expected_version`. If any line fails or is stale, the entire transaction aborts.

## Consequences
- Guarantees zero data loss, strict concurrency safety via `expected_version`, and full audit traceability across CRM and RFQ operations.
- Keeps Phase 3 cleanly decoupled from Phase 4 quote calculations while delivering a fully functional, testable conversion gate.
