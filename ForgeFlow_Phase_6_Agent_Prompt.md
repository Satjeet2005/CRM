# ForgeFlow Phase 6 Agent Prompt — Customer Exports, Watermark Governance, Audit Verification & End-to-End Finish

**Role:** You are the Phase 6 implementation agent for ForgeFlow. Implement server-generated customer quotation PDF/CSV exports, draft watermark governance, export authorization, checksums and durable audit/delivery records, then finish the end-to-end export verification and relevant UI states. Do not re-implement earlier phases or expand the project beyond the canonical PRD.

**Required input files:** `PRD.md`, `docs/agent-handoff.md`, `docs/architecture.md`, `docs/API.md`, `docs/data-dictionary.md`, `docs/security.md`, `docs/test-plan.md`, `docs/demo-script.md`, and the Phase 5 implementation report/ADR where available. This prompt narrows the Phase 6 task; it does not supersede the PRD.

---

## 1. Product context and governing sources

ForgeFlow is one B2B operations platform connecting CRM, industrial catalog, RFQ ingestion/matching, deterministic quotations, and revision-safe manager approvals. Phase 5 reports that proposals use review-before-write isolation, maker-checker authorization, immutable quote revisions, a transactional atomic commit, stale-base detection, role-aware cost masking, and idempotency support.

Phase 6 must make that existing workflow safe and demonstrable through customer-facing quotation documents. Customer exports must always be generated server-side from an authoritative persisted quote revision. Never trust browser-rendered HTML, client totals, local form values, or a revision supplied by the browser without revalidating it against the database and the caller's permissions.

### Source-of-truth priority

1. `PRD.md` is the canonical specification.
2. Current implemented behavior, schema, and the committed Phase 5 handoff explain actual integration points; inspect them before coding.
3. This prompt translates the Phase 6 requirements into an implementation plan. If a real conflict is discovered, do not silently choose a behavior. Follow the PRD, record the conflict and resolution in an ADR, and document any approved deviation.

The PRD export rules in Section 6.11 are binding. In particular:

- Final quote PDF/CSV exports use an approved/sent current committed revision.
- Draft/unapproved quotes must not escape via the final export action. If a separate internal preview-download route is retained, it must be explicitly enabled, conspicuously watermarked `DRAFT — NOT APPROVED`, authorization-checked, audit-recorded, and clearly separate from final export.
- Final exports never expose unit cost, total cost, gross profit, margin, internal notes, matching confidence internals, access tokens, or other internal-only metadata.
- Final PDF totals must exactly match the committed revision.
- CSV must be UTF-8, RFC 4180-compatible and safe against spreadsheet formula injection without corrupting typed numeric values (including legitimate negative numeric values).
- Cross-tenant IDs must fail using the documented non-disclosing error behavior.
- Every export attempt/result must be audit-recorded; do not place full document bodies in logs.

## 2. Strict scope

### Implement in this phase

1. A backend PDF rendering pipeline using **WeasyPrint**, with a source-controlled/versioned HTML/CSS quotation template.
2. Final quotation PDF generation from a persisted, approved/sent, exact current quote revision.
3. Customer-safe quote CSV generation using the same authoritative revision and explicit field allowlist.
4. An optional draft-preview export only if consistent with the existing PRD route/configuration and already-implemented UI behavior; final export must stay fail-closed regardless.
5. Draft watermark governance and status-aware export eligibility.
6. Database persistence for successful customer delivery/export fingerprints and complete export-attempt audit events.
7. SHA-256 hash of the exact artifact bytes returned for download.
8. Frontend export actions, disabled/ineligible states, clear error handling, download behavior, and display of export metadata/fingerprint where specified in the PRD/handoff.
9. End-to-end tests proving the end-to-end RFQ → quote → proposal → approval → final export path, along with regression and security tests.
10. Finish Phase 6 UI states/accessibility for the export workflow, and update documentation and `docs/agent-handoff.md`.

### Explicitly out of scope

- Do not change the deterministic pricing formula, money rounding rules or calculator version.
- Do not rewrite RFQ normalization/matching or CRM/catalog logic.
- Do not redesign authentication, session token handling, password hashing, CSRF controls, tenant scoping or maker-checker policy.
- Do not add email sending, live procurement integrations, payments, e-signature, cloud object storage, async worker queues, or external paid APIs. A successful export is a recorded manual download/demo delivery; do not show “email sent.”
- Do not store full customer PDFs or CSV files permanently in PostgreSQL or logs.
- Do not create a separate microservice.
- Do not add unrequested endpoints/UI for arbitrary historical revisions. Historical exports are allowed only if the PRD explicitly supports them, access is manager/admin-only, and the UI unmistakably labels them as historical. Otherwise implement current-revision final export only.

---

## 3. Mandatory first steps: verify the existing Phase 5 implementation

Before changing files:

1. Inspect `git status`, latest commit, repository layout, migration list and the existing `docs/agent-handoff.md`. Do not overwrite uncommitted user work.
2. Read the complete PRD sections 6.8–6.12, 7, 9–12, 14–20, and any referenced route/schema decisions relevant to quote revisions, export policy and delivery logging.
3. Inspect and trace the existing quote/RFQ/proposal models, migration `0005_proposals_approvals.py`, current quote revision structure, quote statuses, current-revision pointer, policy snapshot and actor/organization relations.
4. Find out whether a general `export_events` table/model already exists. The PRD describes `export_events` for every attempt/result, while the Phase 5 handoff proposes `quote_customer_deliveries` for successful customer exports. Inspect both the schema and actual call sites before deciding whether to reuse or extend an existing model.
5. Run the current tests and baseline `make check`, `make test-e2e`, and build command before editing when the environment supports them. Record actual results; distinguish any pre-existing failures from regressions introduced in this phase.
6. Verify the actual status names and transitions from code. Do not guess enum names from prose: at minimum, only the canonical approved/sent statuses allowed by the PRD are eligible for final export.
7. Record any meaningful schema/policy decision in `docs/architecture-decisions/ADR-0012-phase6-customer-exports.md` (choose the next available ADR number if 0012 already exists).

Do not spend the phase rewriting completed product features. Preserve the existing visual design tokens, application shell, quote builder, approval queue, and established API client.

---

## 4. Export eligibility and authorization contract

Implement one authoritative server-side eligibility service used by **both** PDF and CSV routes. The route handler must not duplicate a weaker version of this logic.

### Final export preconditions

At request time, load and validate, within the caller's authenticated organization scope:

- Quote exists and belongs to the caller's organization.
- Caller has permission to view/export the quote under the existing RBAC policy.
- Requested revision, when specified, is the quote's `current_revision_id`.
- Quote is in a state accepted for final export by PRD Section 6.11 (`approved` or `sent`).
- The selected revision is committed and is the exact revision approved for this quote; it is not a proposal draft, stale snapshot, rejected revision or uncommitted candidate.
- Approval/maker-checker constraints are satisfied by the persisted workflow records; never infer approval solely from a frontend badge or a client-supplied status.
- The quote has at least one valid line and a valid, persisted authoritative calculation snapshot.
- All required server-side validations pass and the revision's calculator version/fingerprint fields are present as required by the existing schema.

A quote in `draft`, `pending_approval`, `rejected`, `stale` or `cancelled` must never be emitted by a final export route. If the implementation uses additional states, map them to the PRD's state policy explicitly. `sent` means the current approved revision may be re-downloaded, not that ForgeFlow has sent email.

### Authorization failures

- Reject unapproved/draft final export with the documented conflict/state error; use the existing standard error shape (`code`, `message`, optional safe `details`, `request_id`).
- Do not reveal whether a foreign organization's quote ID exists. Use the documented non-disclosing `404`/`403` behavior consistently.
- Preserve CSRF and exact-origin protection for any mutations. PDF/CSV download routes are read operations, but still require a valid session and organization/role authorization.
- Never rely on obscurity of the URL or client-side button state.
- Do not weaken `sales_rep` / `sales_manager` restrictions on internal costs and margins. Customer-facing exports use a dedicated allowlisted DTO; do not serialize ORM objects or general internal quote response models directly.

### Draft preview rule

The PRD allows an internal draft-preview download only if explicitly enabled. Follow the existing shipped UI/configuration, if any. If included:

- It uses a separate route/action or an unambiguous explicit preview mode distinct from the final-download action.
- Every page displays a clear, high-contrast `DRAFT — NOT APPROVED` watermark; do not describe the file as final or approved.
- It is permission checked, content safe, and recorded in both export audit and successful-delivery/fingerprint history if successful.
- A failure, unknown status, missing state, or absent approval record must fail closed to preview/watermarked or deny access; never accidentally render an unwatermarked final artifact.
- Do not expose a draft preview by default in production if the PRD/settings do not enable it.

The handoff mentions the longer watermark `DRAFT — NOT APPROVED COMMERCIAL PROPOSAL`; use the exact wording specified in PRD/UI conventions if already standardized, and document the chosen single canonical phrase. Never render an unapproved quote without a conspicuous draft label.

---

## 5. PDF generation: WeasyPrint renderer and template

### Architecture

Create a dedicated pure/helper export module under the existing `backend/app/exports/` package; follow current naming conventions. Separate:

1. **Eligibility and authorization** — loads the quote/revision and establishes final/draft-preview policy.
2. **Customer-safe projection** — converts the persisted revision into a narrowly typed export DTO.
3. **Template rendering** — renders a version-controlled HTML/CSS template using only the DTO.
4. **Artifact post-processing** — obtains final PDF bytes and computes SHA-256 over those exact bytes.
5. **Audit persistence** — records the attempt/result and successful artifact manifest in a transaction-safe manner.

The HTML template must not receive a raw SQLAlchemy object, general response schema containing internal values, request session/token, matcher metadata, or arbitrary client HTML. The rendering module must not access the database directly. Route/service code prepares a fully validated DTO and provides it to the template renderer.

### Required PDF content

Include, where present and allowed by the persisted quote revision:

- “ForgeFlow Demo” / synthetic organization branding, without Auribises branding or any claim of affiliation.
- Quotation number/identifier.
- Issue date and valid-until date.
- Seller organization/business details from validated persisted configuration or seeded demo organization.
- Customer/account business name and permitted business details.
- Opportunity reference where appropriate and customer-safe.
- A line-item table: SKU, product description, specifications, quantity, unit, unit price, discount, tax rate/tax amount as specified, and line total.
- Subtotal, discount total, tax total and grand total.
- Payment terms, delivery terms and customer-facing notes from the committed revision.
- Approved/final status or a clear draft-preview watermark and draft status when preview is explicitly allowed.
- Page numbering and professional typography/layout.

Do not fabricate values. Do not create a validity date when absent. Use the exact persisted amounts from the committed calculation snapshot; do not recalculate with different formulas or rounding during rendering. Use the existing currency-code configuration and formatting helpers, with INR fixtures supported.

### Layout/print quality requirements

- Version the template source within the repository, with a template version constant/identifier recorded in metadata or code.
- Set PDF page size/margins and repeat table headings on multi-page tables.
- Avoid splitting a line row across pages; keep summary totals together where possible.
- Handle long product descriptions, large quantities, unicode punctuation and page overflow gracefully.
- Use a known installed font family with fallback configuration. Confirm the actual generated PDF contains readable glyphs in the Docker production image.
- Make links and URLs safe and optional; do not render arbitrary HTML supplied by a customer.
- Escape all untrusted strings through template auto-escaping. For any deliberately allowed rich text, use a documented sanitized representation; simplest default is plain text only.
- Set deterministic metadata where practical. Do not promise byte-identical hashes across renderers/builds unless proven; SHA-256 represents the exact bytes of this successful export.
- Do not fetch arbitrary network URLs in WeasyPrint. Restrict URL fetching to local/static assets under the approved template asset directory; deny remote protocols/hosts to prevent SSRF.
- A missing WeasyPrint system dependency/font must produce a clear service failure and log a safe error code, not silently return HTML or a broken file.

### Dependencies and deployment

- Add a pinned, compatible WeasyPrint dependency with the repo's existing package manager (`uv` / lockfile).
- Update the backend Dockerfile/production image to install its required native libraries and fonts. Keep the image as small and reproducible as practical, but do not omit native dependencies necessary for successful rendering.
- Add a renderer smoke test that produces a non-empty PDF in the same container environment used for deployment.
- Ensure `make build` and the documented fresh-install path include the renderer dependencies; do not rely only on the developer's host machine.

---

## 6. CSV export: typed fields, RFC 4180 and injection safety

### Quote CSV content

Use a documented stable column order and a customer-safe allowlist. At minimum include line number, SKU, product description, permitted product specifications, quantity, unit, unit price, discount percentage/amount, tax rate/amount and line total, plus the appropriate quote-level header/terms through either defined metadata columns or a documented separate header convention. Use the exact committed revision snapshot.

Do not export internal unit cost, line cost, total cost, gross profit, margin, proposal operation payloads, internal notes, matcher candidate scores, auth/session values, or audit metadata. Use an explicit export schema/DTO and never dump arbitrary database columns.

### RFC 4180/encoding

- UTF-8 output; use a documented newline convention and standards-compliant quoting for commas, double quotes, and CR/LF inside fields.
- Use the Python CSV module or another verified RFC 4180-compliant encoder. Do not hand-build CSV by concatenating strings.
- Stable output order by the committed revision's line order.
- Safe filenames that do not embed raw untrusted customer names or path separators. Set correct `Content-Type` and `Content-Disposition` headers.

### Spreadsheet formula-injection protection

Neutralize **untrusted textual cells** whose first meaningful character is `=`, `+`, `-`, `@`, tab, carriage return or line feed by prefixing an apostrophe or the documented safe representation before CSV quoting. Do not mutate domain numeric columns simply because negative numeric values are valid. Preserve the distinction between numeric typed data and string fields. Add tests for leading whitespace/control characters, embedded quotes, newlines, Unicode and negative numeric values. Make the policy explicit in `docs/security.md` and `docs/API.md`.

---

## 7. Data persistence, migration and hashes

The Phase 5 handoff proposes migration `0006_customer_exports.py` and a `quote_customer_deliveries` record with fields along these lines:

- `id` UUID
- `organization_id`
- `quote_id`
- `revision_id`
- `exported_by_user_id`
- `export_type` (`pdf` / `csv`)
- `sha256_hash`
- `recipient_email` (optional; only set for an explicitly supplied, validated record of intended recipient; do not imply an email was sent)
- `watermarked` boolean
- `created_at` UTC timestamp

Inspect the real schema before implementation. The PRD separately requires `export_events` (or its equivalent) to record every attempt/result, including failures, actor, organization, resource, revision, format, result, timestamp, request ID and a safe failure code. Avoid duplicate, contradictory audit sources. Prefer the following separation if consistent with the current code:

- **`export_events`**: one row per export attempt/result, including denied/failed attempts, safe failure code, request ID and optional artifact hash.
- **`quote_customer_deliveries`**: successful artifact manifest/delivery record only, linked to the exact quote and revision with hash, export type, actor and watermark status.

If an equivalent table already implements one responsibility, reuse/extend it rather than creating a redundant table; document the mapping in an ADR and `docs/data-dictionary.md`. Do not break existing migrations. Use Alembic migration `0006_customer_exports.py` unless a previously committed migration uses that revision number; inspect first and follow current migration numbering.

### Database invariants

- Every record is tenant scoped and references the actual quote/revision/user with appropriate foreign keys.
- Validate that `revision_id` belongs to `quote_id` and the same organization; do not trust independently supplied IDs.
- Export history is append-only at the application/API layer; normal APIs must not update or delete it.
- Store SHA-256 as a 64-character lowercase hex digest or the existing repo's documented binary representation, consistently.
- Hash the exact final byte sequence returned to the client. Do not hash only the input JSON or a separately rendered approximation.
- Never store the binary PDF/CSV in logs. Prefer stream/in-memory generation for the expected small demo artifacts; if temporary files are necessary, use a private temp directory, non-predictable filenames and guaranteed cleanup after success/failure.
- Treat export attempts as auditable even when authorization or eligibility denies them, but ensure error/audit records do not disclose another tenant's resource details.
- Use one consistent request/correlation ID in structured logs and export event.
- Ensure export event persistence and download generation have documented failure semantics. Never return a success response/hash when the corresponding required audit persistence failed. Where audit persistence itself fails, fail closed and return an appropriate safe error; avoid a “successful but unrecorded” export.

### Migration/testing safety

- Add downgrade logic when practical and consistent with repository migration conventions.
- Validate fresh database upgrade and rerunning the normal startup/migration path.
- Preserve all existing quote/RFQ/CRM records through migration.
- Do not use destructive DB reset as a substitute for a migration test. Use the guarded dedicated test database.

---

## 8. API contract

Use the API prefix `/api/v1`, existing session/authentication and common error envelope. Inspect current implementation and maintain the PRD's endpoint shape. Expected endpoints are:

- `GET /api/v1/quotes/{quote_id}/export/pdf?revision_id=...`
- `GET /api/v1/quotes/{quote_id}/export/csv?revision_id=...`
- Optional explicit internal draft preview endpoint only if the PRD/config/current UX supports it; do not overload the final action.
- `GET /api/v1/exports/{export_event_id}` for safe event metadata if needed by the existing UI/PRD.

For each endpoint, document:

- Accepted parameters, valid revision behavior, authentication and required permission.
- Status and approval preconditions.
- `Content-Type`, `Content-Disposition`, safe filename convention and whether the response is streamed or buffered.
- Success behavior, including how the checksum is exposed (e.g., response header and/or persisted export metadata) without introducing an invalid second representation of the artifact.
- Failures: unauthorized, unknown/cross-tenant quote, not exportable state, mismatched/stale revision, missing/invalid snapshot, renderer failure, CSV generation failure and audit persistence failure.
- Audit side effects, whether a successful delivery record is created, and idempotency/retry behavior.

Use headers such as `X-Content-SHA256` only if tested and documented. Avoid adding unrequested custom headers unless useful. The download remains the raw PDF/CSV body, so the frontend can trigger a native download and display hash/event metadata separately if the API contract exposes it. If metadata must accompany the artifact, do not wrap file bytes in JSON; choose a consistent header or existing export-event endpoint.

Generate TypeScript types via `make openapi-generate` for any API models added. Binary response handling needs explicit client support; do not force a PDF/CSV response through the JSON parser in `frontend/lib/api/client.ts`.

---

## 9. Frontend: export actions, confirmation and states

Integrate into the existing quote detail workspace using the established design tokens, component system, route structure, and accessible interaction patterns. Do not redesign the entire quote builder.

### Buttons and visibility

- `Export Customer PDF` and `Export Procurement CSV` must be real actions wired to the API.
- A quote is eligible only when the server-confirmed current revision is `approved` or `sent`. UI visibility/disabled state is a convenience, never the security boundary.
- If ineligible, disable final exports and explain why using a visible message/tooltip that is also available to keyboard and touch users. Avoid hover-only diagnostics.
- If policy requires review, link the user to the correct proposal/approval state; do not show a fake success message.
- Draft preview, if supported, must use a separate label such as `Download Watermarked Draft Preview` and indicate the exact watermark. Never label it “Export Customer PDF.”
- For exporting a prior revision, show a clearly labeled historical export flow only for allowed manager/admin roles; otherwise don't implement it.

### Download behavior

- Show pending/loading state and prevent accidental duplicate clicks while a request is in flight.
- Download the returned binary using a safe filename from the server's validated `Content-Disposition` header or documented fallback. Sanitize filenames; never trust raw server/user text as an arbitrary path.
- Handle session expiry, 403, 404, 409/state conflicts, 422, 429 if configured, and 5xx errors using the existing typed error mapper.
- Revoke temporary browser object URLs when used; don't leave unreleased object URLs or save artifact content in localStorage/sessionStorage.
- Show success only after the server confirms the artifact and audit record were created. Include fingerprint/export metadata when supported by the API, with an accessible copy control if useful.
- If user repeats an export, treat it as a new documented export attempt unless the existing PRD/API has a different explicit idempotency contract. Do not accidentally create duplicate rows from component rerenders.

### Visual/interaction quality

- Use consistent icons from `lucide-react`, not emoji.
- Preserve spacing, typography, surfaces, light/dark colors, responsive behavior, keyboard focus and reduced-motion rules.
- Add accessible status text for the exported revision, format, date and watermark state.
- Provide clear loading, success, failure, unauthorized/ineligible and empty-history states.
- On mobile, export actions must remain usable and must not overflow the quote toolbar.

---

## 10. Testing plan — required, not optional

Create dedicated tests following established naming/structure. Run all checks from repository root and capture actual outcomes.

### Pure unit tests

1. Customer-safe projection includes only allowed fields.
2. Internal cost/margin, proposal internals, matcher confidence, internal notes and secrets are absent even if present in source ORM objects/snapshots.
3. PDF template has a stable template version and handles missing optional fields without inventing values.
4. PDF rendering succeeds, yields `%PDF`-prefixed non-empty bytes, and supports long descriptions/multiple pages/Unicode in the deployment environment.
5. CSV uses stable column order, UTF-8 and proper escaping for commas/quotes/newlines.
6. Formula injection neutralizes dangerous untrusted text prefixes and does not corrupt legitimate negative numeric values.
7. SHA-256 equals the digest of the exact bytes produced.
8. Filename/content-disposition generation safely handles Unicode and malicious/path-like customer names.
9. Eligibility pure/service logic maps valid and invalid quote/revision/status combinations correctly.
10. Draft preview always watermarks when enabled; no unapproved final output exists.

### PostgreSQL/API integration tests

1. Approved current revision can export PDF and CSV; `Content-Type` and `Content-Disposition` are correct.
2. PDF line items and totals match authoritative persisted snapshot; extract PDF text in tests and assert a known total/quotation number is present.
3. PDF/CSV have no forbidden cost or margin fields; explicitly test a seeded cost value that would reveal leakage if the sanitizer fails.
4. Draft, pending approval, rejected, stale and cancelled quote states cannot use final export routes.
5. An approved quote's proposal draft or stale/old revision cannot be exported as the current final revision.
6. Cross-tenant quote/revision and export-event IDs return the documented non-disclosing response and create only safe audit metadata.
7. Role restrictions hold regardless of frontend role and response DTO path.
8. Every attempted export records an export event or documented safe failure result, with actor, organization, resource, revision, format, result, request ID and timestamp where applicable.
9. Successful exports create a delivery/artifact record with exact SHA-256 hash, actor, revision and watermarked flag.
10. Renderer failures and audit persistence failures never claim success and do not leak stack traces.
11. Concurrent revision change between eligibility read and artifact generation is handled according to a documented consistency strategy; never emit an artifact for a revision that fails the final validation. Establish a stable snapshot/transaction strategy and test it.
12. All historical export behavior, if implemented, is manager/admin-only and unmistakably labeled.

### Frontend component tests

- PDF/CSV controls call the correct binary API path and do not pass files to the JSON parser.
- Pending, success, failure, expired-session and ineligible states render correctly.
- Disabled control reason is accessible without hover and on mobile.
- Download filename and fingerprint presentation work with API response headers/metadata.
- Draft preview (if included) is clearly separated and labeled.

### Playwright E2E tests

At minimum:

1. Log in as the appropriate synthetic user, complete the actual existing RFQ → quote → proposal → manager approval journey, then export final PDF and CSV.
2. Verify the PDF download, filename and text contents for a known quote/revision; confirm it is not watermarked after approval and does not contain internal costs/margins.
3. Try final PDF and CSV export on a draft/pending quote and confirm denial/disabled UI plus server guard.
4. Verify role-based access and cross-tenant handling where test fixtures support more than one organization.
5. Verify CSV injection neutralization with a synthetic malicious text value and preservation of a negative numeric value.
6. Verify the export history/fingerprint metadata and no duplicate event from a single click/render.
7. Check desktop 1440×900, tablet 1024×768 and mobile 390×844 layouts; no unexpected horizontal overflow.
8. Run axe-core WCAG 2.1 AA checks on quote detail/export surfaces and export history views.
9. Preserve all existing CRM, RFQ, quote, proposal, maker-checker and cost isolation E2E tests.

### Final quality gates

Run the actual repository commands (at minimum `make check`, `make test-e2e`, `make build`, migration upgrade checks, and export-specific PDF container smoke test). Use locked dependency installs when environment setup is needed. Do not hide or relax existing failing tests. If something is blocked by unavailable infrastructure, mark `BLOCKED` and explain why instead of claiming success.

---

## 11. Security checklist

- [ ] Server is authoritative for org, quote, revision, state and permissions.
- [ ] No final export for draft/unapproved or non-current revision.
- [ ] No internal costs/margins in PDF, CSV, HTML templates, headers, URLs, client DTOs or logs.
- [ ] No data from any other organization.
- [ ] No untrusted content used as HTML, local file path, network fetch, or response header without validation.
- [ ] WeasyPrint external URL/file access is restricted; prevent SSRF and local file exfiltration.
- [ ] CSV injection handling is safe but doesn't modify typed numeric amounts.
- [ ] Download headers are safe, with correct MIME type, `Content-Disposition: attachment`, and a suitable `X-Content-Type-Options: nosniff` where appropriate.
- [ ] Temporary files (if any) are private and cleaned on success and failure.
- [ ] Logs contain request IDs and safe error codes, not document contents, tokens, credentials or unnecessary personal information.
- [ ] Export attempts and success/failure are audit-recorded without exposing another tenant's existence.
- [ ] Existing auth/session/CSRF/RBAC protections are untouched and regression-tested.

---

## 12. Documentation and handoff updates

Update these real repository files to reflect implementation, not aspiration:

- `docs/API.md`: PDF/CSV routes, binary responses, permissions, eligibility states, parameters, response headers, error codes and audit effects.
- `docs/data-dictionary.md`: export event and customer-delivery/artifact tables, keys, constraints, retention and hash semantics.
- `docs/architecture.md`: DTO → template → artifact → hash/audit flow; renderer isolation; consistency strategy.
- `docs/security.md`: final/draft policy, data allowlist, CSV injection handling, WeasyPrint URL/file restrictions, tenant isolation and safe download headers.
- `docs/test-plan.md`: PDF/CSV unit/integration/E2E tests and exact commands/results.
- `docs/demo-script.md`: end-to-end final export in the 3–4 minute product demo; use exact seeded data/users.
- `docs/agent-handoff.md`: Phase 6 completed/not completed status, migration name, endpoints, template version, environment/runtime dependencies, test evidence, known limitations and next-phase instructions.
- `IMPLEMENTATION_REPORT.md`: concise phase report with observed command outcomes and any blocked acceptance criteria.
- `docs/architecture-decisions/ADR-0012-phase6-customer-exports.md` (or the next unused ADR ID): audit/delivery model division, WeasyPrint sandboxing, export consistency and draft-preview choice.

Do not alter `PRD.md` to hide a failure or redefine requirements. Any necessary approved spec change must be documented explicitly.

---

## 13. Definition of done and handoff

Phase 6 is done only when:

1. A persisted quote that has passed the actual Phase 5 approval process can be exported as a server-generated PDF and customer-safe CSV.
2. The final output is generated exclusively from the approved current revision and its authoritative pricing snapshot.
3. Final export requests on draft/unapproved/stale/non-current states fail closed at the API even when invoked directly.
4. PDF has the required content, paginates well, renders inside the production container with installed fonts/dependencies, and its totals exactly match the committed revision.
5. Draft-preview output, if included, is separately routed and conspicuously watermarked on every page.
6. Neither artifact contains internal cost/margin information or non-customer-safe fields.
7. CSV formula injection is neutralized without corrupting legitimate numeric amounts.
8. Exact artifact SHA-256 and successful export/delivery metadata are stored; audit events include failed/denied attempts according to the PRD.
9. Existing phases remain green and all new tests pass, including migration, API, browser and accessibility checks.
10. Docs and demo instructions match the actual implementation.
11. Final report distinguishes `PASS`, `FAIL`, `BLOCKED`, and `NOT IMPLEMENTED`; no unexecuted check is described as passing.

### Final response format

At completion, provide:

1. **Delivered** — exact Phase 6 features and files.
2. **Architecture/data decisions** — PDF renderer/template version, customer-safe projection, audit/delivery record strategy, hash semantics and draft-preview policy.
3. **API contract** — implemented export endpoints and response/error behavior.
4. **Security evidence** — final-export gate, role isolation, tenant isolation, injection prevention and URL-fetch restrictions.
5. **Test evidence table** — every actual command and `PASS`/`FAIL`/`BLOCKED` result, including the production-container PDF smoke test and E2E export test.
6. **Known limitations** — specific and truthful only.
7. **Updated handoff** — exact next steps for Phase 7 (deployment, clean environment smoke test, docs and final release handoff); do not claim Phase 7 or public deployment is complete unless it was actually completed and verified.

**Priority rule:** never compromise final-export authorization, committed-revision integrity, customer data confidentiality, correct totals, auditability or the working approval workflow to save time. Reduce optional polish before weakening any of these invariants.
