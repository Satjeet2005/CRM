# ForgeFlow Phase 3 Agent Prompt — RFQ Ingestion, Deterministic Matching & Review Studio

> **Agent role:** Phase 3 implementation agent  
> **Product:** ForgeFlow — B2B Sales, RFQ & Quotation Operations CRM  
> **Source of truth:** repository-root `PRD.md`  
> **Predecessor phase:** Phase 2 (CRM, industrial catalog, deterministic demo data and dashboard)  
> **Next phase:** Phase 4 (quotation calculation engine, quote builder and calculation trace)

## 0. Mission and scope boundary

Implement **Phase 3 only**: the complete RFQ CSV ingestion, deterministic normalization/catalog matching, persisted human-review workflow, RFQ review studio, safe decisions, atomic bulk acceptance, rematching, RFQ CSV export and quote-readiness/conversion gate. Integrate it with the already working Phase 1 foundation and Phase 2 CRM/catalog. Deliver a genuinely polished, accessible, responsive signature screen, not a wireframe or a static demo.

The Phase 2 completion report says that CRM, accounts, contacts, opportunities, tasks, catalog, activity, real dashboard metrics and seeded industrial data are already implemented. Treat that as a handoff, **not proof that the current checkout is healthy**. Inspect the repository and rerun baseline checks before changing it.

The complete product journey ultimately is:

`account → opportunity → RFQ CSV import → normalized line items → explainable catalog candidates → human decisions → RFQ ready to quote → quotation → revision proposal → approval → guarded final export`.

Phase 3 must make the workflow reliable through **RFQ ready-to-quote and the required quote-creation boundary**, while leaving authoritative quote calculations, editable quote revisions, proposals, approvals and final quote PDF export to later phases. Implement the minimum quote-draft handoff needed by the explicit PRD API contract, if it can be done without prematurely implementing Phase 4. A newly created quote draft must not pretend that pricing or quote revisions already exist. Record the boundary in the handoff and an ADR.

## 1. Mandatory rules

1. Read the **entire `PRD.md`** before coding, especially Sections 4.1–4.2, 5.3, 6.6–6.7, 7.5–7.10, 9.2–9.5, 10.1–10.2, 11.5, 12, 13, 14.2–14.6, 15.3–15.5, 16, Phase 3 in Section 17, and Sections 18–20.
2. Read `docs/agent-handoff.md`, `docs/architecture.md`, `docs/API.md`, `docs/data-dictionary.md`, `docs/security.md`, `docs/test-plan.md`, `docs/demo-script.md`, and current `IMPLEMENTATION_REPORT.md` if present. Inspect actual code, migrations, lockfiles and tests before relying on a report.
3. `PRD.md` is binding and must not be silently rewritten. If the PRD itself contains contradictory values or Phase 2 implementation differs from its logical model, document the conflict and the chosen compatible behavior in `docs/architecture-decisions/ADR-000X-rfq-phase3-boundaries.md`. Do not hide discrepancies by changing the PRD.
4. Preserve working Phase 1/2 behavior. Keep existing tests, migrations and public API contracts compatible. Add new migrations; **never edit an already-applied migration** to retrofit RFQ tables.
5. Use synthetic data only. Do not use real customer information or claim that ForgeFlow is affiliated with or endorsed by Auribises.
6. Use deterministic domain code. **No LLM, external AI API, embedding model, vector database, probabilistic service or network call** may make RFQ normalization or matching decisions in this phase.
7. Keep route handlers thin. Parsing/matching/eligibility logic must be pure or service-layer testable. Database writes and audit events must use explicit transactions.
8. Do not fake success. A UI toast may say “Imported” only after the server committed the import. Do not report a test, E2E run, build or visual audit as passing unless it actually ran and passed.
9. Do not weaken matching thresholds, compatibility invariants, RBAC or concurrency checks to make the demo appear more automated.
10. Avoid routine questions. Follow explicit PRD decisions. For real conflicts, choose the smallest safe compatible behavior, document it, and continue.

## 2. Initial repository inspection and baseline

Before implementation:

1. Record the current Git branch, `git status --short`, HEAD commit and any uncommitted changes. Never overwrite the user's work.
2. Run the exact existing Phase 2 commands from the repository root, at minimum `make check` and `make test-e2e`. Capture the actual outcome and distinguish regressions introduced by Phase 3 from pre-existing problems.
3. Inspect current schema/model/API conventions for `accounts`, `contacts`, `opportunities`, `tasks`, `activities`, `catalog_products`, `catalog_aliases`; inspect the existing catalog service, organization scoping, permission policy, version fields, API error contract, OpenAPI type generation, query client, navigation registry and shared design system.
4. Inspect the source repository `https://github.com/Satjeet2005/RFQ-line-item-normalizer` at the actual current commit. Review its domain package, tests, CSV rules, matching invariants, frozen synthetic evaluation fixtures, README, any `LICENSE` or third-party notices, and documented threshold/rule version. Inspect `https://github.com/Satjeet2005/model-change-review-lab` only for patterns if necessary; Phase 3 must not import its financial formulas.
5. Record source repo SHA(s) and the exact modules/tests reviewed in `docs/architecture.md` or a new ADR. Verify ownership/provenance and any third-party dependency licenses before copying/adapting source. If a file cannot be safely reused, keep the adapter clean and document why; do not import code at runtime from GitHub.
6. Run the source domain tests/evaluation where feasible before adapting. Keep their results separate from ForgeFlow's new test results. Existing frozen-set metrics apply only to that specific synthetic dataset; do not market them as real-world performance.

## 3. Phase 3 features to implement

### 3.1 RFQ workspace and navigation

Add the RFQ feature through the existing feature registry and shared shell; do not replace or redesign the completed shell.

Required routes (follow current Next.js route-group conventions; do not reorganize the app just to match this notation):

- `/app/rfqs` — RFQ list and status/ownership/search filters.
- `/app/rfqs/new` — import wizard: context → file selection → header mapping/preview → validation report → explicit import.
- `/app/rfqs/[rfqId]` — signature RFQ review studio.
- Optional nested line URL only if it fits current route patterns; selecting a row must still be deep-linkable or restorable where practical.

Requirements:

- Enable the RFQ navigation entry only when list/import/review routes are implemented and non-dead-ending. Do not enable Quotes or Approvals in Phase 3 unless their actual Phase 4+ functionality exists.
- Respect existing role-aware navigation and permission contracts. Navigation visibility is presentation only; backend authorization is authoritative.
- RFQ list shows human-readable RFQ number, title, account, opportunity, imported date, owner, line count, status and unresolved count. Provide search, status filter, account/opportunity filters where practical, pagination, loading skeleton, empty state and recoverable error state.
- The import action is visible to permitted users. Existing seeded records must remain usable and the list must show real persisted data.
- Update dashboard RFQ metrics/attention items additively using actual database values. Preserve the current Phase 2 response contract; do not fabricate quote/approval metrics or mark Phase 4 fields available. Keep `available_phase_4: false` until Phase 4 functionality actually exists.

### 3.2 CSV import wizard

Accepted input is **CSV only**. Do not add XLS/XLSX support.

Canonical import contract from PRD Section 6.6:

- Must include a header row.
- UTF-8 and UTF-8 with BOM are accepted.
- Required canonical columns: `description`, `quantity`.
- Recognized optional columns: `sku`, `manufacturer`, `manufacturer_part_number`, `unit`, `specifications`, `notes`.
- Unknown columns are ignored but reported.
- Maximum input size: **5 MiB**.
- Maximum: **500 data rows per RFQ** (header is not a data row).
- Parse using Python's standard `csv` reader with RFC 4180-compatible handling. Never split by commas manually.

The PRD's Section 16.2 example environment values conflict with the stricter values in the Phase 3 import contract. Use the Section 6.6 import-specific contract for RFQ upload: set/document an effective default of 5 MiB and 500 data rows. Record the discrepancy in an ADR; do not silently edit `PRD.md`. If the repository needs environment variables, document which values control RFQ imports and validate invalid/nonpositive configuration at startup.

Implement a two-stage preview/commit flow:

1. The user chooses an existing account and an opportunity belonging to that account and current organization. Required fields include RFQ title. Optional customer reference/owner follow existing PRD rules. A sales rep may only act on permitted/assigned records as defined by the permission module.
2. Provide both drag-and-drop **and a normal keyboard-operable file picker**. Do not make drag-and-drop the only option.
3. The browser may perform friendly early validation, but server-side validation is authoritative.
4. Preview uses a dedicated endpoint or existing API pattern, preferably `POST /api/v1/rfqs/import/preview`. Preview must not create an RFQ or line items. It returns detected headers, mapping recommendations, first 10 data rows, valid/warning/rejected/blank/duplicate counts, unknown columns and actionable diagnostics.
5. Allow explicit source-header-to-canonical-column mapping. Auto-detection may recommend a mapping, but required fields must never be silently mis-mapped. The final header mapping is persisted with import metadata.
6. The user explicitly confirms import. The server validates the actual bytes, extension/MIME hints and content; MIME and filename are not trusted by themselves. Read no more than the byte limit plus one byte before rejecting an oversized upload, so a large file is not read unbounded into memory.
7. Validate encoding, header presence, mapped required columns, duplicate headers/mapping collision, row count and row parsing. Reject a fatal file-level error without creating any RFQ or partial set of RFQ lines. Preserve valid row boundaries and create reviewable `invalid` lines for row-level field/normalization errors where parsing still succeeds.
8. Report imported rows, warnings, rejected rows, ignored columns, blank lines, duplicate rows and normalization/matching outcome counts.
9. Do not retain the raw uploaded file blob after parsing. Store source filename, byte size, SHA-256 hash, source row numbers, raw line fields and mapping/diagnostics needed for audit/review.
10. Same content hash in the same organization must trigger a clear duplicate warning and must not silently create a second RFQ. Support an explicit, confirmed override only if documented and auditable; otherwise return a safe `409 DUPLICATE_RFQ_IMPORT` referencing the existing RFQ without leaking cross-tenant details.
11. The import is atomic: persist the RFQ, import job, lines, initial candidates, diagnostics and associated activity consistently. No orphan RFQ/import job/line collection may be exposed as successfully imported. Database uniqueness constraints remain the final defense.
12. The frontend must show a preview before the irreversible commit, then navigate to the created RFQ review page on success. Failed import must retain safe user input where appropriate and make retry possible.

Define clean typed request/response schemas and actionable errors for all fatal and row-level cases. Add request IDs to errors using the existing API error convention. Never return stack traces, SQL, file bytes or secrets.

### 3.3 Domain normalization and catalog matching

The current RFQ Normalizer repository is the intended starting point. Review and adapt its pure-Python domain logic and tests instead of reimplementing the behavior from scratch. Integrate it under the main application's domain boundary, e.g. `backend/app/domain/rfq/`, with a focused adapter/service around the existing Phase 2 `catalog_products` and `catalog_aliases` services.

Preserve and test applicable upstream capabilities/invariants, including:

- Unicode NFKC normalization.
- Whitespace, punctuation/case normalization without destroying meaningful identifiers.
- Supported Devanagari digit conversion where present in the source domain.
- Unicode fraction/quantity parsing, trailing-quantity extraction and explicit ambiguous/malformed outcomes.
- Structured specification extraction and unit/dimension conversion/compatibility.
- SKU, manufacturer part number and alias matching.
- Deterministic candidate scoring/ranking and rule-reason output.
- Hard incompatibility checks and safe abstention/human escalation.
- The upstream frozen synthetic evaluation fixtures and determinism checks where those are reusable.

Implementation constraints:

- Do not duplicate catalog truth. Fetch active catalog products and aliases via current organization-scoped services/repositories, then pass an explicit catalog snapshot/value collection to pure matcher functions.
- Adapt the domain to Phase 2's **actual current schema and enums** rather than creating duplicate `catalog_products` tables or renaming Phase 2 columns. In particular, inspect how Phase 2 represents `base_unit`, manufacturer part number and product `attributes_json`/specifications. Add a narrow conversion adapter and document the mapping to PRD terms.
- Only active catalog products can be selected as new matches. An inactive/archived product may appear in historical data, but must not be proposed as an available new choice.
- Exact normalized SKU/MPN matches must rank above alias/text similarity where applicable. An exact identifier never overrides a hard specification incompatibility.
- Hard conflicts (nominal size/dimension, material/grade, pressure/class or unit incompatibility as applicable) must exclude or safely demote candidates according to the source rules. Text similarity cannot override known incompatibility.
- Preserve upstream confidence/thresholds and candidate handling. No arbitrary threshold adjustment. Any necessary threshold/rule change requires a new matcher rule version, the old and new evaluation results, regression analysis, a rationale and an explicit ADR.
- The same input + the same catalog snapshot + same rule version must produce exactly the same normalized output, candidates, rank order, reason codes and compatibility flags.
- Scores are ranking/similarity signals, never calibrated probabilities. UI labels say “Match score” or “Similarity score”, not “confidence probability”.
- The matcher produces a **recommendation**, not a decision. `exact_match` status may be safe for a bulk accept action only when the backend explicitly determines the match is eligible; it is not automatically committed as a reviewer decision during import.
- No LLM or outside service for parsing, normalization or matching.
- Keep pure domain tests free of database/network/web framework dependencies.

For each line persist raw source fields unchanged plus canonical normalized description, parsed quantity, canonical unit, structured attributes/specifications, normalization status/diagnostics, match status and current version. Preserve source row number and any source identifiers. Never erase the original raw text after normalization.

### 3.4 Candidate snapshots and match status semantics

Implement persistent candidate snapshots, not ephemeral rankings computed only in the browser.

Each candidate should persist as supported by the source/PRD model:

- organization, RFQ line and product references;
- rank and candidate-set/matcher version;
- match method (`exact_sku`, `exact_mpn`, `alias`, `attribute_compatible`, or a typed equivalent consistent with upstream code);
- numeric score when available;
- explainability/reason codes;
- compatibility flags and explicit hard-conflict reasons;
- timestamp and source catalog snapshot/version as needed to make the decision reviewable.

Use PRD match statuses: `exact_match`, `suggested`, `needs_review`, `matched`, `unmatched`. Use normalization statuses: `valid`, `warning`, `invalid`. Implement one documented state-transition policy so the statuses cannot drift between API and UI. Distinguish “a safe candidate was suggested” from “a human accepted the candidate”. Invalid or review-blocking lines remain blocking even if a text score is high.

Expose reasons that operators understand, such as `Exact SKU`, `Manufacturer part number`, `Alias match`, `Compatible unit`, `Material matches`, `Size conflict`, `Insufficient specification`, and `No safe catalog match`. Store machine-readable codes and render human-readable text in the UI.

### 3.5 Persistence and migration

Create a new Alembic migration after the already existing Phase 2 migration; likely `0003_rfq_ingestion_review.py` (inspect actual naming conventions and revision identifiers first). Do **not** edit or renumber `0001` or `0002`.

Required tables/entities per PRD Section 10.1:

1. `rfqs`: UUID id, `organization_id`, human-readable `rfq_number` unique per organization, account and required opportunity, title, optional customer reference, source filename/hash/size/row count, header mapping/import diagnostics metadata, status (`needs_review|ready_to_quote|quoted|cancelled`), owner/importing user, imported/timestamps, integer version.
2. `rfq_import_jobs`: organization, nullable resulting RFQ reference for failed/preview jobs if needed, status, file hash/row count/error count, safe validation report JSON, start/complete timestamps, creator and request ID. Do not persist source bytes or unnecessary raw file contents.
3. `rfq_lines`: organization, RFQ, source row (unique within RFQ), raw SKU/description/quantity/unit/specifications/manufacturer/MPN/notes plus a safe raw field snapshot, canonical normalized values and diagnostics, `normalization_status`, `match_status`, selected product (nullable), resolution reason, decision actor/time, version and timestamps.
4. `rfq_match_candidates`: organization, RFQ line, catalog product, rank, match method, score, explanation/compatibility JSON, matcher version, candidate-set version and creation time. Enforce useful foreign keys and indexes.
5. `rfq_line_decisions` or an equivalent append-only normalized record for every human decision/undo/rematch outcome. Store actor, timestamp, old/new status, prior and selected products, reason code/detail, line version before/after, candidate set/rule version and request ID. Do not rely solely on mutable fields in `rfq_lines` to represent history.

Follow current project naming conventions. Every organization-owned row/query must be scoped to the authenticated organization. Add foreign keys and constraints so an RFQ's account and opportunity belong to the same organization and the opportunity belongs to the supplied account. Ensure line/product/alias references cannot cross organizations. Use restrictive/non-cascading deletes for RFQ history and decisions; preserve records through archive/cancel semantics rather than destroying audit history.

Add indexes for organization-scoped lists, RFQ number, status/import date, account/opportunity, line status, source row, candidate ranking and decision history. Use explicit UTC-aware timestamps. Use database uniqueness as the final guard for RFQ numbers, source rows, duplicate aliases/identifiers and idempotency where supported.

If a minimal quote draft model is required to satisfy the PRD's `POST /rfqs/{rfq_id}/create-quote` contract now, implement only the smallest persisted quote shell necessary and record that Phase 4 will add immutable revisions, quote lines and calculations. Do not duplicate or invent Phase 4 tables/calculation logic early. The endpoint must still reject/block conversion when RFQ eligibility fails.

### 3.6 Domain state machine and readiness policy

Implement explicit, tested RFQ/line state transitions. At minimum:

- Imported RFQ starts in `needs_review` unless all lines are already valid and unambiguously safe under documented status policy; even exact candidates are not treated as manually accepted decisions.
- Invalid normalization status blocks readiness.
- `needs_review`, `suggested` requiring confirmation, and `unmatched` block readiness until resolved according to policy.
- A line is resolved only when an authorized user accepts a safe candidate/product or explicitly marks it unmatched with a valid reason if the PRD allows that line to be excluded; in the MVP, **unmatched lines block quote conversion**. Do not permit a caller to bypass this by editing an RFQ status field.
- Hard-incompatible candidates require explicit review and a recorded reason for manual override if override is allowed under upstream rules; where the source domain does not permit override, keep the line blocked.
- RFQ can become `ready_to_quote` only if every line that participates in the RFQ is valid and has an accepted product match. No silent line dropping. Any exclusion/removal must be a separate explicit audited operation only if the PRD permits it; otherwise not implemented.
- Cancelling an RFQ must be permission-checked and audited. Do not allow cancellation to delete lines/decisions.
- Once quote conversion occurs, decisions that would change the quote source must be blocked or handled by a later explicit workflow. The source RFQ and conversion snapshot must not silently mutate.

Build one authoritative `evaluate_rfq_readiness`/equivalent service; call it in API endpoints, dashboard aggregations and tests. Do not derive readiness solely from UI state.

### 3.7 Human decision and review APIs

Implement the PRD Section 11.5 API surface (adapt route conventions only with an ADR):

- `GET /api/v1/rfqs` — organization-scoped pagination, search and allowlisted filters for status/account/opportunity/owner/import date.
- `POST /api/v1/rfqs/import/preview` — stateless preview, mapping recommendations, sample rows and row/column diagnostics; no RFQ created.
- `POST /api/v1/rfqs/import` — explicit transactional import.
- `GET /api/v1/rfqs/{rfq_id}` — metadata plus counts/readiness summary.
- `GET /api/v1/rfqs/{rfq_id}/lines` — paginated/filterable line list with safe top candidate summary.
- `GET /api/v1/rfqs/{rfq_id}/lines/{line_id}` — raw/normalized fields, candidates, reasons, product details, line decision history and version.
- `POST /api/v1/rfqs/{rfq_id}/lines/{line_id}/decision` — accept candidate, select a product, mark unmatched, or revert a prior decision before quote conversion. Include mandatory `expected_version`; include machine reason code and a detail string where required. Never permit a client to submit a trusted score or make itself a `catalog_manager`.
- `POST /api/v1/rfqs/{rfq_id}/lines/bulk-decision` — bulk accept of only backend-designated eligible exact matches. Requires each line ID and expected version. MVP must be atomic/all-or-nothing: if any line is stale, unauthorized, ineligible or invalid, commit no line changes and no success audit rows; return a safe conflict/validation response identifying actionable row-level errors without leaking other organizations' data.
- `POST /api/v1/rfqs/{rfq_id}/rematch` — `catalog_manager`/`admin` only. Persist a new candidate-set version. Preserve manually accepted decisions by default. Clearing a manual decision requires an explicit `clear_manual_decisions=true`, appropriate permission, confirmation and audit record; never clear implicitly.
- `GET /api/v1/rfqs/{rfq_id}/export.csv` — authorized CSV export of RFQ source/normalized/decision data allowed by policy, with RFC-compatible output and spreadsheet formula injection neutralization. It is not a final quotation export.
- `POST /api/v1/rfqs/{rfq_id}/create-quote` — quote-readiness/conversion boundary. Must verify RFQ status and all blocking line conditions inside a transaction and accept an expected RFQ version. Do not implement quote math in this phase. If creating the minimal quote shell now, ensure duplicate retries cannot create multiple drafts from the same RFQ and that source product/spec values are snapshotted. Otherwise return the PRD-approved readiness state/action and leave the Phase 4 draft creation seam explicitly documented; do not pretend a quote was created.
- Integrate RFQ-related activity via the existing append-only `activities` infrastructure (e.g. imported, decision made/reverted, rematch run, exported and quote-readiness/conversion event).

Also implement exact documented status/error behavior for unauthorized operations, inaccessible IDs, stale versions, duplicate import and invalid transitions. Use existing error response structure (`code`, `message`, optional safe `details`, `request_id`). Expected status codes: `401` for invalid session, `403` for a known disallowed operation where policy permits, `404` for inaccessible/cross-tenant resources according to project non-disclosure policy, `409` for stale/duplicate/state conflicts, `413` for oversized file, `415` for unsupported content type when applicable, `422` for actionable schema/domain validation, and `429` for existing rate-limit contract.

### 3.8 Permissions and data isolation

Use the existing permission-policy module and actual `sales_rep`, `sales_manager`, `catalog_manager`, `admin` role definitions. Do not add mixed roles or create an authorization bypass.

- Every list/get/update/decision/export query must scope the RFQ and every related account, opportunity, line, candidate and catalog product to the authenticated organization.
- IDs do not grant access. Cross-organization account, opportunity, RFQ, line or product IDs must not reveal record existence.
- Sales reps can import/review/resolve RFQs only within their assigned records and granted capabilities, matching PRD Section 4.1 and current phase conventions.
- Sales managers can view organization-wide business records and history, but cannot bypass revision checks or use catalog-only actions unless current policy explicitly grants them.
- Catalog/RFQ reviewers and admins may manage catalog/re-match and resolve ambiguous lines within their organization. They cannot approve future commercial proposals or export final quotes merely because they can review RFQs.
- Server must re-check permission, current state, expected version and entity ownership **inside the write transaction**.
- Do not expose `unit_cost` to `sales_rep`/`sales_manager` in any RFQ candidate response, product detail, diagnostics, errors, exports or nested object. Reuse the Phase 2 catalog serializer/policy. `catalog_manager`/`admin` visibility must match existing rules.
- Raw customer-provided CSV text is untrusted input. Render it as text; do not inject raw text as HTML. Limit diagnostics and avoid logging full file/line contents by default.

### 3.9 Concurrency, auditability and transactions

Use the project's existing `expected_version` optimistic concurrency convention. Do not introduce a new client-visible version format in only the RFQ module.

For any line decision:

1. Load and lock/check line and parent RFQ state within organization scope.
2. Verify actor permissions, line version, candidate-set version and catalog-product compatibility/active state.
3. Verify requested command is allowed for current match/normalization status.
4. Persist selected product/status/reason, increment version and add append-only decision + activity records in the same transaction.
5. If any validation/version check fails, roll back all state/audit changes and return actionable `409` or `422`.

For bulk exact-match acceptance:

- Validate the entire request before committing.
- Check every line belongs to that RFQ and organization, every exact candidate remains eligible/current, every version matches, and no line is invalid/already manually resolved in a way that makes bulk acceptance inapplicable.
- Lock or conditionally update all target rows in a stable order to avoid deadlocks.
- Commit all lines/decision history/activity entries together, or commit none.
- Add integration tests that deliberately make one row stale and prove zero other lines changed.

For rematching:

- Use one explicit catalog snapshot and rule version for the run.
- Generate candidates deterministically and persist the candidate set as a new version.
- Preserve previously accepted manual decisions by default; re-match must not silently replace selection.
- Use a transaction/safe staged operation so a failed rematch leaves the previous candidate set usable.

Maintain append-only decision/audit history. Never delete a decision to implement undo; create a compensating/revert decision event.

### 3.10 Signature RFQ review studio — required UI quality

This is the product's signature screen. Give it more design, interaction and accessibility attention than a typical CRUD table. Use the **existing** exact CSS-variable tokens from PRD Section 7.3, current Tailwind/shadcn Base UI component system, Lucide icons and `motion/react` conventions. Do not alter `globals.css` or introduce a second UI system.

Desktop at 1280px and above:

- Compact header with RFQ number/title, account, linked opportunity, import filename/time, state, updated time and line count.
- Clear progress strip: `Imported → Normalized → Review → Ready to quote`.
- Search, status filter, “Needs review” toggle, manufacturer filter, reset and safe bulk actions.
- Sticky table header with row selection, source row, raw customer description, normalized description/quantity/unit/specs, suggested product (SKU/name/key specs), explanation/match score/status and next action.
- Selecting a row opens a right-side inspector/sheet without losing the table scroll position or selection. Inspector shows original raw data next to normalization, candidate list/rationale, compatibility flags, hard conflicts, product attributes, selected decision and history.
- Persistent/sticky summary of resolved/total, invalid, unresolved, and blocking lines. Explain why “Continue to quotation” is disabled; accessible description must announce blocker count.

Interactions:

- “Accept suggestion” includes a review/confirmation step and posts candidate ID + expected version.
- “Choose different product” uses a searchable catalog picker and displays SKU, name, unit, manufacturer and relevant specs/compatibility before confirming.
- “Mark unmatched” offers `not_in_catalog`, `insufficient_specification`, `incompatible_unit`, `other`; `other` requires explanatory detail. This does not unblock quote conversion in MVP.
- “Revert decision” is available only before quote conversion and adds a compensating decision event.
- “Bulk accept exact matches” opens a confirmation summary showing number and preview of affected rows. Only backend-designated safe exact matches are selectable. Stale conflict must commit none and offer “Reload latest version”.
- “Re-run matching” appears only for `catalog_manager`/`admin`; explains that prior manual decisions will be preserved unless clearing is explicitly requested and confirmed.
- Progress counts and table filters use server-returned/current data; no fake counters.
- After successful decisions, refresh/invalidate affected queries and show success only once the server confirms commit.

Statuses use both icon and text; color is never the sole signal. Raw input remains visible after normalization. A numeric score is never the sole explanation. Use restrained motion only for panel transitions, decision feedback and progress changes; respect reduced motion and do not delay core operations.

Responsive requirements:

- ≥1280px: table + right-side inspector and sticky summary/action bar.
- 768–1279px: reduce lower-priority columns, keep raw description, normalized result, product match and decision state visible; use sheet inspector; any horizontal scroll must be inside the table container, not the whole document.
- <768px: use line cards instead of squeezing a desktop table. Keep raw description, normalized values, proposed product, status/reason and primary decision together. Candidate details are in a full-width sheet/drawer with usable close/back behavior.
- Verify layouts at 1440×900, 1024×768, and 390×844 with no page-level horizontal overflow. Keep a usable flow at 200% zoom.

Accessibility requirements:

- Keyboard-operable import/file picker, header mapping, filters, table/line selection, candidate list, decision controls and sheets/dialogs.
- Visible focus, correct labels/instructions, screen-reader announcements for import status, count updates and conflicts; correct focus restoration when the inspector closes.
- Use shared dialogs, badges, data table, skeleton, empty/error/inline feedback components.
- Status labels and match reasons are text-accessible; never rely on color or a percentage alone.
- Loading, empty, partial-warning, fatal-error, stale-conflict, success and no-match states are designed, not improvised.
- Run axe checks and review actual browser screenshots. A passing component test alone is not a visual audit.

### 3.11 Synthetic RFQ fixtures and demo seed

Expand the existing idempotent `backend/app/seed/demo_seed.py` and/or add a deterministic RFQ-specific seed module. Do not break or duplicate Phase 2 organizations/users/accounts/opportunities/catalog each time `make seed` runs.

Create at least 3 coherent RFQs linked to existing seeded accounts/opportunities/catalog products:

1. **Mostly exact-match RFQ:** includes existing SKU/MPN/alias matches that can demonstrate safe exact acceptance and bulk acceptance.
2. **Needs-review RFQ:** includes similar descriptions where meaningful attributes need a human to select the correct product.
3. **Blocking RFQ:** includes an unmatched item, a hard-incompatible candidate and an invalid normalization row; quote readiness must remain blocked.

Each fixture must use the actual Phase 2 catalog entries/aliases and valid account-opportunity relationships. Add a clearly synthetic file such as `fixtures/demo-rfq-ambiguous.csv` with a short README/fixture explanation. It should cover:

- normal exact SKU/MPN and alias match;
- supported normalization/whitespace/punctuation variance;
- a supported unit conversion;
- missing or ambiguous spec that requires review;
- high text similarity with a hard attribute incompatibility;
- catalog miss;
- a row-level invalid value;
- correctly quoted CSV fields containing commas/quotes and safe notes.

Seed decisions/candidates consistently and idempotently. Use stable identifiers or reliable natural-key lookups. `make seed` must not create duplicate RFQs, candidates, lines or activities when run repeatedly. Preserve the ability to reset fixtures only in development/demo/test as existing safeguards require. Do not claim synthetic results prove real-world accuracy.

## 4. API, type generation and frontend data patterns

- Backend OpenAPI remains the contract source. After endpoint/schema changes, run the current `make openapi-generate` command and commit generated TypeScript type changes.
- Use current base API client at `frontend/lib/api/client.ts` and existing TanStack Query provider/key conventions. Do not create a second fetch wrapper.
- Use typed feature service/hooks, not direct `fetch` scattered across components. Keep server error mapping and CSRF behavior in the existing API client.
- Use `snake_case` on the wire and the existing established camel-case conversion convention if one is present. Do not hand-maintain incompatible duplicate endpoint schemas.
- List APIs use `{ items, page, page_size, total }` per PRD. Defaults: 25, max 100. Allowlist sort/filter keys. Validate page-size and query bounds server-side.
- Frontend form schemas can use Zod for useful early messages, but Pydantic/backend validation remains authoritative.
- Use `react-dropzone` only if already installed/required by the PRD; preserve an accessible normal file input even with dropzone.
- Use TanStack Table or the existing reusable data table pattern. Add TanStack Virtual only if measured list size justifies it; max 500 lines is not permission to make keyboard navigation fragile.

## 5. Tests that must be added

### 5.1 Pure domain tests

At minimum test:

- Unicode NFKC/punctuation/whitespace normalization, case and identifiers.
- Quantity parsing with integer, decimal, fraction/Unicode fraction, trailing quantity and ambiguous/malformed values.
- Unit normalization and supported conversions; unknown/incompatible unit is not guessed.
- Specification extraction and comparison for supported attributes.
- Exact SKU, exact MPN, alias, compatible attribute, low-similarity and unmatched outcomes.
- Hard incompatibility excludes/demotes candidate according to the existing domain contract even when text similarity is high.
- Safe abstention for ambiguous inputs.
- Stable candidate ordering, reasons and scores for same input/catalog/rule version.
- No `unit_cost` or irrelevant hidden fields leak through DTOs.
- Regression test all relevant upstream frozen synthetic cases without weakening original expected assertions.

Target at least 85% line coverage for new pure RFQ domain modules, with branch coverage concentrated on safety decisions. Do not chase the coverage number with meaningless tests.

### 5.2 CSV parser/import tests

Test:

- normal UTF-8, UTF-8 BOM, quoted commas, escaped quotes and newlines in quoted fields;
- empty file, header-only file, absent headers, missing required columns, duplicate headers, ambiguous/colliding mappings and unknown optional columns;
- invalid UTF-8, binary-looking content, wrong extension/content hint and malformed CSV structure;
- exactly at and just above 5 MiB; exactly 500 and 501 data rows;
- blank rows, duplicates, empty description, zero/negative/malformed quantity and invalid units;
- maximum field length/column count defenses where appropriate;
- row errors persisted as reviewable invalid lines only where row boundaries are sound;
- fatal file errors create no RFQ or partial lines;
- duplicate content hash warns/blocks and an explicit override follows the recorded policy;
- formulas and raw dangerous CSV cells are displayed as text, never executed/rendered as HTML.

### 5.3 PostgreSQL integration/API/security tests

Use the project's dedicated PostgreSQL test database. Do not assume SQLite semantics for the transaction/locking guarantees.

Cover:

- Migration from an empty DB and compatibility with Phase 2 migration; foreign keys/indexes/unique constraints.
- Authenticated import success and full rollback on database failure.
- Cross-tenant account/opportunity/RFQ/line/catalog-product IDs are denied/non-disclosing.
- Wrong account/opportunity linkage cannot import.
- Per-role read/import/decision/rematch/export boundaries, including catalog unit cost masking.
- All state transitions and quote-readiness gate.
- Line decision increments version and persists append-only decision and activity records.
- Stale expected version returns `409 STALE_VERSION` and changes nothing.
- Bulk exact decision is atomic: if one row is stale/invalid/unauthorized then no target line or success history changes.
- Rematch produces a new candidate version and preserves manual decisions by default.
- Invalid or unmatched lines block quote conversion; client cannot override by submitting status.
- RFQ CSV export is organization-scoped, safe and formula-neutralized.
- Duplicate request/idempotency behavior as implemented; repeated imports/conversions do not create unexpected duplicates.
- Failed state mutations do not emit success activities.

### 5.4 Frontend component and E2E tests

Add meaningful Vitest/Testing Library coverage for:

- import validation/mapping/review interaction;
- required columns, unknown columns, row diagnostics and fatal errors;
- accepting/rejecting a match, unmatched reasons and stale conflict UI;
- bulk accept eligibility/confirmation;
- hidden nav/actions by role while also testing backend restrictions;
- filter/search state, loading/empty/error/retry states;
- visible focus and accessible names/labels.

Extend Playwright to cover full RFQ path:

1. Sign in with synthetic sales/demo account.
2. Open a valid account/opportunity and upload/import the seeded sample CSV through preview and explicit confirmation.
3. Inspect raw vs normalized values.
4. Bulk-accept only safe exact matches.
5. Resolve one ambiguous line manually with a reason if required.
6. Attempt quote conversion while one blocking line remains and confirm it is blocked with a specific explanation.
7. Resolve remaining blocking line(s) according to policy and confirm readiness/minimal draft gate behavior.
8. Open another session/tab or use a prepared stale-version test to make an old decision and verify the second action gets `409` and no data is overwritten.
9. Verify a non-review role cannot re-match or access restricted fields by invoking the API directly, not merely by testing hidden buttons.
10. Export RFQ CSV and test safe neutralization of malicious formula cells in a fixture.

Run E2E/accessibility at 1440×900, 1024×768 and 390×844. Check no document horizontal overflow and run Axe scans on RFQ list, import wizard and review studio. Update screenshots used in the report if capture tooling is available. If a screenshot or browser audit cannot run, mark it `BLOCKED` with reason; do not claim visual verification.

## 6. Dashboard and activity integration

- Extend Phase 2 dashboard summary with real organization-scoped RFQ counts, such as total open RFQs, count needing review and lines blocking quote readiness, using actual persisted rows.
- Extend the attention queue with actionable links for RFQs with unresolved/invalid lines and relevant import issues. Sort by severity/due/created rules documented in code. Do not add decorative invented counts.
- Existing Phase 2 opportunity/task/catalog KPIs must still match their prior definitions and tests.
- Quote/approval metrics remain unavailable until those modules exist. Keep `available_phase_4: false` in Phase 3 unless the established contract defines a separate flag for Phase 3; do not return a fake quote conversion rate/average.
- Add activities for committed import, manual decision, decision revert, rematch, RFQ CSV export and quote-readiness/conversion outcomes. No “success” activity is committed if the corresponding operation rolls back.

## 7. Files and systems to protect

Preserve the working foundation and Phase 2 behavior. Do not casually edit or replace:

- `PRD.md` (immutable source of truth; use an ADR for conflicts).
- `frontend/globals.css` (design tokens pinned to PRD Section 7.3).
- `frontend/lib/api/client.ts` (existing CSRF-aware API client/error handling).
- `backend/app/auth/session.py`, `backend/app/auth/passwords.py`, `backend/app/auth/csrf.py` and the rate-limit/session foundation.
- initial and Phase 2 Alembic migrations (`0001`, `0002` or their actual revision IDs).
- Phase 2 role policy, organization-scope helpers, catalog field masking and dashboard response contract, except additive changes required here and covered by tests.
- existing Makefile quality commands/CI assumptions unless a missing Phase 3 command must be added compatibly.

Inspect exact paths first; the bullet names describe protected responsibilities. If one must change for necessary integration, make the smallest change, add focused regression tests and explicitly explain it in the final report. Do not refactor unrelated modules.

## 8. Out of scope — do not implement in Phase 3

- Full quotation calculator, discount/tax formulas, quote line editor, revision history, formula trace or financial scenario calculations (Phase 4).
- Reviewable commercial change proposals, maker-checker approval queue and atomic quote revision commits (Phase 5).
- Final customer quote PDF exports and production export policy beyond the RFQ CSV export specified here (Phase 6).
- XLS/XLSX ingestion; email inbox integration; ERP/PIM integrations; Slack/WhatsApp; scheduled/background matching infrastructure; paid services.
- LLM/AI semantic matching, embeddings, probabilistic confidence or auto-accepting uncertain candidates.
- Redesigning Phase 1/2 shell, changing the global tokens, replacing the UI kit, modifying existing auth/session/CSRF design, or migrating all routing conventions.

No controls may be shown as functional unless the corresponding action works. If future-phase navigation is present in current shell, keep it hidden or explicitly disabled with a clear phase explanation consistent with the feature registry.

## 9. Required documentation updates

Before handoff, update:

- `docs/architecture.md`: RFQ module boundaries, domain adapter, catalog snapshot/matching flow, transactions and readiness policy.
- `docs/API.md`: all implemented RFQ endpoints, request/response shapes, auth/RBAC, filters, limits, expected-version semantics, reason enums, error codes and examples. Mark Phase 4/5 endpoints as planned, not implemented.
- `docs/data-dictionary.md`: all new tables, fields, enums, indexes, constraints, retention and relationships.
- `docs/security.md`: upload safety, tenant scope, row text rendering, permission matrix and CSV export neutralization.
- `docs/test-plan.md`: parser/domain/API concurrency/E2E/axe test inventory and commands.
- `docs/demo-script.md`: add the RFQ import/review portion, exact seeded records, roles and reset approach.
- `docs/agent-handoff.md`: actual changes, relevant files, verified commands, decisions, risks, limitations and specific Phase 4 instructions.
- `IMPLEMENTATION_REPORT.md`: a Phase 3 delivery report (append or add a phase-specific report following repository conventions), with pass/fail/block status and command evidence.
- `docs/architecture-decisions/ADR-000X-rfq-phase3-boundaries.md`: PRD configuration discrepancy, schema mapping, threshold/version strategy and minimal quote-conversion boundary as appropriate.

Do not report unsupported business impact. Upstream benchmark values can be referenced only with an explicit synthetic-data qualification and the relevant fixed test-set description.

## 10. Execution sequence

1. Inspect repository/status/PRD/handoff and run baseline `make check` + `make test-e2e`.
2. Inspect the source RFQ repository, its commit, domain code, tests, threshold/rule versions, fixtures and provenance/license.
3. Write/update a short ADR before changing data model or import limit conventions.
4. Implement RFQ domain adapter, pure parsing/normalization/matching functions and unit tests first.
5. Add migration `0003` (or next correct revision), SQLAlchemy entities, constraints/indexes and transaction/repository/service boundaries.
6. Implement preview and import APIs, duplicate-file protection, persisted candidates and diagnostics.
7. Implement detail/list/decision/bulk/rematch/export/readiness API contracts and their API/security/concurrency tests.
8. Implement idempotent synthetic RFQ seed fixtures using Phase 2 records; verify repeat `make seed`.
9. Implement RFQ list and import wizard, then the signature review studio with responsive inspector and row-card treatment. Use the existing design system only.
10. Regenerate OpenAPI TypeScript contracts (`make openapi-generate`) and wire TanStack Query hooks using the established API client.
11. Add dashboard and activity integration without regressing Phase 2 metrics.
12. Add Vitest/Playwright/Axe and required responsive screenshots/inspection.
13. Run all checks, including migrations from a fresh test DB, lint, formatting, backend/frontend typecheck, unit/integration tests, production builds, `make check` and `make test-e2e`. Fix regressions introduced in scope and rerun affected/full checks.
14. Update docs/handoff and provide the final report. Do not stop after code generation or a successful compile.

## 11. Definition of done / acceptance checklist

Do not mark Phase 3 complete unless every applicable item has evidence.

### Import and persistence

- [ ] Preview supports UTF-8 and BOM CSV, quoted values, explicit mapping and first-10-row preview.
- [ ] Both keyboard-operable file picker and drag/drop exist.
- [ ] Server enforces 5 MiB and 500 data row limits before expensive parsing.
- [ ] Required columns are mapped explicitly; missing/ambiguous headers never silently pass.
- [ ] Unknown columns are reported; row errors are understandable; fatal file errors create no partial RFQ.
- [ ] Import reports counts and safe diagnostics, persists mapping/hash/source filename/size, and does not retain raw file blobs.
- [ ] Same content hash triggers an explicit duplicate warning/block; no silent duplicates.
- [ ] Import persists RFQ/import job/lines/candidates/activities transactionally and reloads correctly.
- [ ] A fresh PostgreSQL database applies new migrations without modifying existing migration history.

### Domain and matching safety

- [ ] The existing normalization/matching domain is reviewed and adapted with provenance documented.
- [ ] Matching is deterministic, versioned, explainable and organization/catalog snapshot aware.
- [ ] Exact SKU/MPN and aliases behave according to upstream rules; hard incompatibility cannot be overridden by high text score.
- [ ] Unknown unit/ambiguous specs safely abstain or escalate.
- [ ] No uncertain match is silently accepted.
- [ ] Candidates and decision history survive refresh; raw input is retained.
- [ ] Upstream relevant synthetic regression cases still pass; no thresholds are casually changed.

### API/security/concurrency

- [ ] All RFQ endpoints are typed, documented and organization-scoped.
- [ ] Role restrictions and catalog cost masking are enforced server-side for nested responses and exports.
- [ ] Line decisions require expected version and generate append-only history/activity in the same transaction.
- [ ] Stale updates return `409` with no partial state change.
- [ ] Bulk exact acceptance is all-or-nothing; stale one row commits none.
- [ ] Rematching preserves manual decisions by default and creates a new candidate version.
- [ ] Quote readiness is calculated server-side; invalid, unmatched and blocking lines stop conversion.
- [ ] RFQ CSV export scopes data and neutralizes spreadsheet formula injection.
- [ ] Tests verify cross-tenant and cross-account/opportunity denial without leaking record existence.

### UI quality

- [ ] RFQ list/import/review screens use existing tokens/components and contain no fake buttons.
- [ ] The review studio shows raw vs normalized values, product identity/specs, reasoning, compatibility, status and decision history.
- [ ] Selection, inspector, filters, bulk action and conflict recovery work with real API data.
- [ ] Layouts are checked at 1440×900, 1024×768 and 390×844; no unwanted document horizontal overflow.
- [ ] Keyboard-only critical interaction works; focus remains visible and returns correctly after sheet/dialog close.
- [ ] Loading/empty/validation/fatal-error/duplicate/conflict/no-match/success states are complete.
- [ ] Axe checks for RFQ list, import and review routes have no unresolved serious/critical violations; results are reported honestly.

### Quality and handoff

- [ ] Phase 2 baseline tests still pass; prior dashboard/CRM/catalog workflows still work.
- [ ] `make openapi-generate`, `make check` and `make test-e2e` complete successfully (or exact blockers are documented; do not call the phase fully green if a release gate fails).
- [ ] Seed command is idempotent and destructive reset safeguards remain intact.
- [ ] Docs accurately distinguish implemented RFQ features from Phase 4/5 planned quote functionality.
- [ ] `docs/agent-handoff.md` tells the next agent to implement **Phase 4 only**: deterministic quote calculation engine, quote builder and calculation trace; it lists the authoritative quote calculation boundary and notes that Phase 3 only provides RFQ readiness/minimal draft handoff.

## 12. Required final response from you

Return a concise but evidence-based implementation report with:

1. **Status:** `PASS`, `PARTIAL` or `BLOCKED` for Phase 3, plus why.
2. **Implemented features:** exact APIs, models, routes, UI and workflow behaviors completed.
3. **Reuse/provenance:** upstream repository SHA, modules/tests reviewed, code adapted and any limitations.
4. **Database:** migration ID, tables/indexes and transaction invariants.
5. **Security:** tenant/RBAC, file validation, version checks and export hardening implemented/tested.
6. **UI/UX:** views and responsive/accessibility audits actually checked.
7. **Verification evidence:** table of exact commands executed and `PASS`/`FAIL`/`BLOCKED` results, including test counts where observed.
8. **Files of interest:** key code and docs paths.
9. **Known limitations:** especially any quote-creation boundary not yet implemented; no vague “minor issues.”
10. **Next agent handoff:** specific Phase 4 task and files to read first.

**Do not say “Phase 3 is complete and fully verified” unless the full acceptance checklist is satisfied and the checks were actually run.**
