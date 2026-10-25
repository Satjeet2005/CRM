# ForgeFlow — Product Requirements Document (PRD)

**Status:** Source of truth for implementation | **Version:** 1.0 | **Date:** 23 October 2026  
**Product:** Full-stack, multi-role B2B sales, RFQ, and quotation operations CRM  
**Working name:** ForgeFlow | **Data classification:** Synthetic demo data only

## How to use this document

This PRD is the binding product and implementation specification. It is intentionally prescriptive: the coding agent should implement what is specified instead of repeatedly asking the product owner to make routine decisions.

**MUST/MUST NOT** are release-blocking requirements; **SHOULD/SHOULD NOT** are expected unless a concrete technical blocker is documented; **MAY** is optional and only follows completion of required work.

### Source-of-truth rules

1. This PRD defines product behavior, scope, workflows, design requirements, architecture and acceptance criteria.
2. Backend domain services and database constraints enforce business invariants. Client validation is only for usability.
3. The existing RFQ Line-Item Normalizer domain logic and tests are preferred sources for normalization/matching behavior. Do not casually change thresholds or matching invariants.
4. Model Change Review Lab contributes review-before-write, proposal isolation, revision safety, atomic commit and traceability patterns. Its financial-model formulas are **not** the quotation pricing engine.
5. ForgeFlow has exactly one authoritative quotation pricing implementation: the backend Python domain module. Never trust client-supplied final totals.
6. If code conflicts with this PRD, change code to match. If the PRD contains a genuine contradiction, document it and prioritize data integrity, access control and coherent user behavior. Do not silently invent scope.
7. Use maintained stable library releases compatible with the specified major versions; pin actual versions in lockfiles. No major upgrades without compatibility checks and full tests.
8. Every demo customer, contact, product, quote and employee is synthetic and identified as demo data.

---

# 1. Executive summary

ForgeFlow is a business operations product for a fictional industrial/B2B supplier. It combines three capabilities into one connected workflow:

1. **CRM:** accounts, contacts, opportunities, sales activities and follow-ups.
2. **RFQ Line-Item Normalizer:** CSV import, normalization, catalog matching, explainable suggestions and human review of uncertain items.
3. **Model Change Review concepts:** isolated pricing proposals, before/after comparisons, immutable quote revisions, revision-bound approval, atomic commits and calculation traceability.

The defining journey is:

**Customer account → opportunity → imported RFQ → normalized line items → human-reviewed product matches → quotation → reviewable pricing proposal → manager approval → guarded export → updated CRM opportunity.**

ForgeFlow is not a generic CRM decorated with charts. The RFQ review studio and safe quotation revision/approval workflow are its differentiators; the CRM supplies the real business context.

### Product statement

> ForgeFlow helps B2B sales teams turn messy customer RFQs into reviewed, correctly calculated, approved quotations while preserving the history and reasoning behind important decisions.

### Demo story

A sales representative opens a manufacturing-supplier opportunity, imports a CSV RFQ, inspects normalized descriptions beside catalog matches, manually resolves an ambiguous line, creates a quote, proposes a discount and submits it for review. A manager signs in separately, inspects the exact before/after revision and calculation breakdown, approves it and exports the quotation. A second tab/user demonstrates that stale edits cannot overwrite a newer revision and that an unauthorized user cannot approve the quote.

---

# 2. Research and product rationale

The direction comes from the user's conversation with an employee contact and research on Auribises Technologies and the two existing prototypes. The contact advised demonstrating both strong frontend/UI work and complex backend logic, suggested a multi-role CRM/management system, and reacted positively to both existing projects.

Auribises' public website describes capabilities across AI & Data, Cloud, Products, Automation and Support, explicitly mentions CRM/ticketing among its custom product capabilities, and lists Manufacturing among its industry areas. This makes a B2B workflow/product-engineering project directionally relevant; it does **not** prove Auribises requested ForgeFlow or has a customer with this exact problem.

### Existing project foundations

- **RFQ Line-Item Normalizer:** Next.js App Router UI, FastAPI API, PostgreSQL, pure-Python deterministic normalization/matching domain, human review, optimistic concurrency via `expected_version`, append-only decisions, gated exports and synthetic evaluation cases. Documented logic includes Unicode NFKC normalization, quantity/specification extraction, unit/dimension handling, deterministic candidate scoring, safe abstention and CSV/JSON export protection.
- **Model Change Review Lab:** React + TypeScript, FastAPI, PostgreSQL, isolated proposals, before/after review, atomic commits, stale-revision handling, audit transactions and formula/dependency traceability. Its financial-model calculations intentionally remain TypeScript-authoritative in that independent app. ForgeFlow adapts the *workflow patterns*, not those formulas.

ForgeFlow is a new integrated product. Inspect the actual repositories, dependencies and tests before copying/adapting code. Preserve existing tests and provenance; don't assume the original apps have already been merged. Do not copy local-machine file paths into new documentation.

---

# 3. Goals, non-goals and success criteria

## 3.1 Goals

1. Deliver a visually distinctive, polished B2B application—not a generic template dashboard.
2. Implement a persistent end-to-end flow from opportunity through RFQ import, matching, quote, approval and export.
3. Demonstrate real backend engineering: deterministic logic, state machines, server-side authorization, transactions, optimistic concurrency and conflicts.
4. Reuse the RFQ domain engine where practical, retaining safe abstention and explainability.
5. Adapt Model Change Review Lab's proposal/revision approach to quote pricing, with an exact diff and calculation trace.
6. Make every visible UI action work and give clear loading, success, validation, empty, error or conflict feedback.
7. Ship seed data, tests, local setup, deployment instructions and a public demo.
8. Keep architecture small enough to finish with quality; do not add infrastructure without a clear requirement.

## 3.2 Non-goals for MVP

Do not build these unless all required work passes:

- Live ERP/accounting integration, payment processing, payment-card storage, ledger/tax filing.
- Inbox synchronization, real email sending, SMTP campaigns, WhatsApp/SMS/push or calendar sync.
- Autonomous AI/LLM matching, AI pricing or auto-approval; the core workflow is deterministic and human-reviewed.
- Real customer datasets/PII or scraping; native mobile apps.
- Public self-service signup, billing/subscriptions or multi-tenant onboarding.
- User-defined workflow builder, arbitrary formula language or plugin marketplace.
- Microservices, Kafka, Redis, Kubernetes, event streaming or distributed jobs.
- Drag-and-drop kanban (explicit accessible stage-change controls are sufficient).
- Final email delivery; export is recorded, not sent externally.
- XLS/XLSX uploads; CSV only.
- Arbitrary document or executable uploads.

## 3.3 Release success criteria

- Four demo roles work and have different permissions/navigation.
- Sales can create an account/contact/opportunity and import a CSV RFQ.
- Exact, suggested, review-required and unmatched RFQ lines are clearly differentiated and persisted.
- No uncertain match silently becomes an approved product.
- A resolved RFQ can produce a quote with server-calculated totals.
- A pricing proposal can be reviewed without mutating the committed revision.
- Approval binds to the exact revision; stale changes return `409` and do not overwrite state.
- Unauthorized users and proposal creators cannot approve their own proposals.
- Approved quotes export to accurate PDF/CSV; unapproved quotes cannot be exported as final customer documents.
- Audit history explains material decisions.
- Automated CI checks pass.
- Full demo can be completed in under five minutes without database resets or manual data patching.
- At 1440×900, dashboard, RFQ studio and quote review look intentional, polished and responsive.

---

# 4. Users, roles and access control

MVP seeds one demo organization. Still put `organization_id` on organization-owned data and enforce organization scoping from the start. Self-service organization creation is out of scope.

## 4.1 Roles

### Sales Representative (`sales_rep`)
Can view/update assigned records; create accounts, contacts, opportunities, RFQs and quote drafts; import RFQs; review suggestions; resolve lines for assigned RFQs; create proposals; submit quotes; view their own relevant history.

Cannot approve their own quote/proposal, edit the catalog or approval policy, export an unapproved final quote, or access other organizations' data.

### Sales Manager (`sales_manager`)
Can view organization-wide business records, assign opportunities/tasks, view team pipeline, review and approve/reject another user's quote/proposal, provide a rejection/override reason and inspect business audit history.

Cannot approve their own proposals, bypass revision checks or edit immutable historical revisions.

### Catalog/RFQ Reviewer (`catalog_manager`)
Can manage catalog products/SKUs/aliases/units/attributes; view RFQs; resolve ambiguous lines, select products or mark a line unmatched with a reason; and inspect past decisions.

Cannot approve commercial proposals, alter submitted quote values or export final quotations unless a later explicit permission is added. MVP users have exactly one role; do not create mixed roles to bypass constraints.

### Administrator (`admin`)
Can manage users/memberships, organization settings and approval thresholds; manage catalog; view all organization records/audit history; deactivate users and revoke sessions. Admins also cannot approve proposals they created.

## 4.2 Authorization requirements

- Enforce permissions in FastAPI services/endpoints, not only by hiding buttons.
- Every organization-owned query/mutation must enforce the authenticated user's organization scope.
- IDs do not grant access. Return `404` for inaccessible resources by default to avoid leaking existence.
- Check permission and current state inside the write transaction.
- Define role rules in one permission-policy module rather than inconsistent endpoint conditionals.
- Failed protected mutations must not alter domain state. Record security events when appropriate.
- `GET /api/v1/auth/me` returns safe user profile, organization, role, permission map, locale and timezone. The frontend permission map controls display only; backend remains authoritative.

## 4.3 Demo accounts

| Role | Email |
|---|---|
| Sales Representative | `sales@forgeflow.demo` |
| Sales Manager | `manager@forgeflow.demo` |
| Catalog/RFQ Reviewer | `catalog@forgeflow.demo` |
| Administrator | `admin@forgeflow.demo` |

**Demo password:** `ForgeFlowDemo!2026`. These accounts may only be seeded when `DEMO_MODE=true`; never use for real/customer data. The login page must offer a visible “Use demo account” chooser so visitors can enter a role quickly, while clearly displaying that data is synthetic.

---

# 5. Product information architecture

## 5.1 Application shell

- Persistent left sidebar: 248 px expanded, 72 px collapsed on wide screens.
- Top bar: 64 px with page context/breadcrumb, global search/command trigger, organization label, theme toggle, in-app activity indicator and profile menu.
- Main page gutters: 28–32 px desktop, 24 px tablet, 16 px mobile.
- Shared page heading: title, optional one-line description, breadcrumb when nested, primary action.
- Use right-side drawers for quick create/edit when context should remain visible. RFQ review and quotation revision review get full routes, not cramped modal-only experiences.
- Use a responsive 12-column content grid; main workbenches may use full width.

## 5.2 Navigation (in order)

1. Overview
2. CRM: Accounts, Opportunities, Activities & Tasks
3. Procurement Workflow: RFQs, Quotations
4. Catalog
5. Reviews & Approvals (manager; pending-count badge)
6. Activity & Audit (role-restricted)
7. Settings (role-specific entries)

Contacts must be reachable from Accounts; also implement a dedicated Contacts index if it does not delay the primary workflow. Sidebar must indicate current route, use icon + text when expanded, accessible labels when collapsed, and status counts that do not rely on color alone.

## 5.3 Routes and required views

| Route | Required behavior |
|---|---|
| `/login` | Login, role demo chooser, validation/error/loading state and synthetic-data notice. |
| `/app/dashboard` | Role-aware KPIs, pipeline, tasks, activity, RFQs and approvals; real API data. |
| `/app/accounts` | Search/filter/sort/paginate accounts, create action, archive filter and empty state. |
| `/app/accounts/[accountId]` | Summary, contacts, opportunities, RFQs, quotes, activity, related-record actions. |
| `/app/contacts` | Searchable contact index linked to accounts; create/edit drawer. |
| `/app/opportunities` | Table/pipeline view, owner/stage/value/close-date filters and search. |
| `/app/opportunities/[opportunityId]` | Summary, stage rail, activity timeline, linked RFQs/quotes/tasks and stage actions. |
| `/app/tasks` | My/team tasks, due dates, priorities, completion and overdue status. |
| `/app/catalog` | Searchable products, SKU/specs/unit/price, aliases and authorized edit controls. |
| `/app/rfqs` | RFQ index with account, opportunity, status, owner, line count and unresolved count. |
| `/app/rfqs/new` | Create RFQ, CSV drop/file picker, template download, mapping and import preview. |
| `/app/rfqs/[rfqId]/review` | Signature RFQ workbench: original/normalized fields, candidate explanations, review actions/history. |
| `/app/quotes` | Quote table with state, customer, revision, values, owner and approval state. |
| `/app/quotes/[quoteId]` | Overview, items, status, activity/revisions and export eligibility. |
| `/app/quotes/[quoteId]/revisions/[revisionId]` | Revision detail, diffs, calculation trace, rules, actors, timestamps and permitted decisions. |
| `/app/approvals` | Role-filtered pending queue, aging/impact and links to complete review. |
| `/app/activity` | Paginated activity/audit feed with filters. |
| `/app/settings/team` | Admin-only members; activate/deactivate or change role. Invitation is simulated; no email sent. |
| `/app/settings/organization` | Admin-only name, currency/locale/timezone and demo notice. |
| `/app/settings/approval-rules` | Admin edits policy thresholds with validation and audit. |

Every route must have working normal, loading, error, empty and permission states where relevant. No dead-end placeholder routes.

---

# 6. Detailed functional requirements

## 6.1 Authentication and sessions

- Accept email/password; trim and lowercase email before lookup.
- Hash passwords with `pwdlib[argon2]` (Argon2). Never store plaintext passwords.
- Generate a cryptographically random opaque session token; persist only its hash in PostgreSQL.
- Set the token in an `HttpOnly`, `SameSite=Lax`, `Path=/` cookie with `Secure` enabled under HTTPS. Never put auth tokens in `localStorage`/`sessionStorage`.
- Maximum session lifetime: 12 hours. Idle timeout: 60 minutes. Renew activity for legitimate requests but do not exceed maximum lifetime without reauthentication.
- Logout revokes the server-side session and expires the cookie. Password reset/change and user deactivation revoke all sessions for that user.
- Login error is generic and does not reveal whether an email exists. Rate-limit attempts by IP and account identifier. Never log passwords/tokens.
- Cookie-authenticated writes require CSRF protection (CSRF token/header plus strict Origin/Referer checks). GET/HEAD/OPTIONS must not mutate state.
- Route browser API traffic through same-origin `/api/v1` in development and deployment.
- Unauthenticated `/app/*` routes redirect to login; `/auth/me` returns current user safely; a revoked/expired token must fail on the next API call.

## 6.2 CRM — Accounts and contacts

### Account fields

`id` UUID; `organization_id`; `name` required 2–120 chars; `legal_name` optional max 160; `account_type` enum `customer|prospect|partner|supplier` (default customer); `industry` optional controlled text; `website` optional validated HTTP/HTTPS URL; `phone` max 32; `email` valid if present; optional structured billing/shipping addresses; `notes` max 2,000 plain-text chars; `owner_user_id`; `status` `active|archived`; timestamps and actor IDs.

### Contact fields

`id`, `organization_id`, `account_id`, required `first_name` (1–80 chars), required `last_name` (1–80), optional `job_title` (max 100), valid email if present, phone max 32, `is_primary`, `status` `active|archived`, timestamps and actor IDs. At most one primary contact per account; enforce with transaction/service validation.

### Behavior

- Accounts searchable by account/legal name, email and phone; filters: status, type, owner, industry; sorting: name, type, owner, created/updated date.
- Account detail includes summary values derived from related records, contacts, opportunities, RFQs, quotes and activity.
- Archive confirmation explains historical records remain accessible but the account is excluded from new-record selectors. Do not delete accounts/contacts referenced by business records; archive them.
- Duplicate warnings may detect case-insensitive email/name conflicts but must never silently merge records.
- Every create/update/archive creates audit history.
- Forms show inline field errors plus a screen-reader-accessible error summary; lists query the backend for search/filter/pagination rather than filtering only loaded rows.

## 6.3 CRM — Opportunities and pipeline

### Fields

`id`, `organization_id`, `account_id`, optional `primary_contact_id`, required `name` (3–140 chars), optional plain-text `description` (max 2,000), `stage` (`lead|qualified|solutioning|proposal|negotiation|won|lost`), non-negative `estimated_value NUMERIC(14,2)`, `currency_code` equal to organization currency in MVP, optional `expected_close_date`, `owner_user_id`, loss reason, `won_at`, `lost_at`, timestamps, creator/updater and `version`.

### Rules

- Pipeline order: Lead → Qualified → Solutioning → Proposal → Negotiation → Won/Lost.
- Won/lost are terminal until explicit “Reopen opportunity”; reopening requires a reason and returns the record to `qualified`.
- Moving to `lost` requires a reason from `price|timing|competitor|no_response|other`, plus explanation for `other`.
- An opportunity cannot be marked won unless one linked quote is approved and marked accepted, or manager/admin chooses “Mark won without an accepted quote” and supplies a reason. Audit the override.
- Open pipeline value excludes won/lost. Dashboard labels must distinguish open pipeline, won value and lost value.
- Provide both a searchable table and grouped stage/pipeline view. Stage changes use an accessible explicit menu/select, not required drag-and-drop.
- Stage update uses expected-version protection and creates an activity/audit event.

## 6.4 Activities and tasks

Activity types: `note`, `call`, `meeting`, `follow_up`, `email_note`, `stage_change`, `rfq_created`, `quote_created`, `quote_submitted`, `quote_approved`, `quote_rejected`, `export_created`. `email_note` is a manual CRM entry, not an email integration.

Task fields: `id`, `organization_id`, required title (max 160), optional description (max 1,000), related record type/id, assignee, creator, optional UTC due timestamp, priority `low|normal|high`, status `open|completed|cancelled`, `completed_at`, timestamps, `version`.

- Default task view: assigned to me, open first; overdue status uses both text and icon, not color alone.
- Completing a task offers a 10-second Undo toast. Completion and reopening each create distinct events.
- Managers can see/reassign team tasks. Dashboard shows five upcoming/open tasks and overdue count.
- No email/push reminders in MVP; task due status is in-app only.

## 6.5 Catalog management

### Product fields

`id`, `organization_id`, required SKU (2–64 chars, trimmed/uppercase, unique per organization), required product name (2–180), optional description (max 1,000), required category, optional manufacturer and manufacturer part number, `base_unit`, `sell_price NUMERIC(14,4)`, `unit_cost NUMERIC(14,4)` internal-only, `tax_rate_percent NUMERIC(5,2)` between 0 and 100, `stock_status` (`in_stock|limited|backorder|discontinued`, informational only), structured `attributes` JSONB, `is_active`, timestamps/actors and `version`.

Initial supported units: `ea`, `box`, `pack`, `m`, `mm`, `cm`, `kg`, `g`, `l`, `ml`, `set`.

Product attributes may include nominal size, pressure/class, grade/material, dimensions and thread type. Only documented schema fields are eligible for matching; JSONB must not become a dumping ground for arbitrary fields.

### Aliases and behavior

Aliases are separate rows with `id`, `organization_id`, `product_id`, `alias_text`, normalized alias, creator and timestamp. Prevent an alias from ambiguously pointing to conflicting catalog products without explicit review. Catalog search supports SKU, product name, MPN, alias and key attributes. Catalog manager/admin can create/edit/deactivate products/aliases. Deactivation blocks new matching but does not change snapshots in previous RFQs/quotes. Catalog price/cost/spec changes are audited. Never show internal cost on customer-facing quote exports. Seed with approximately 100 synthetic products, reusing the existing Normalizer catalog where practical.

## 6.6 RFQ creation and CSV import

### Accepted file contract

CSV with a header row, UTF-8 or UTF-8-with-BOM. Required columns: `description`, `quantity`. Recognized optional columns: `sku`, `manufacturer`, `manufacturer_part_number`, `unit`, `specifications`, `notes`. Unknown columns are ignored but reported; they must not crash processing.

Template:

```csv
sku,description,quantity,unit,manufacturer,manufacturer_part_number,specifications,notes
,Industrial steel pipe,12,ea,Northstar Components,NS-P-100,"size=25mm; material=steel",
```

### Import UI and validation

- Drag/drop area and conventional “Choose CSV file” button (drop zone is not the only way to upload).
- Maximum size 5 MiB; maximum 500 data rows per RFQ.
- Validate extension, MIME hint and actual contents on the server; never trust only client checks or file names.
- Parse with Python standard `csv` reader, RFC 4180-compatible behavior; never split rows manually on commas.
- Preview headers and first 10 data rows before final import.
- Offer explicit mapping from source headers to canonical columns. Auto-detection may suggest mapping but required headers cannot be silently mis-mapped. Persist header mapping in import metadata.
- Report valid rows, warning rows, rejected rows, ignored columns, blank rows and duplicates.
- Fatal file-level parsing errors create no partial RFQ. Row-level validation problems can remain as reviewable error lines if row boundaries are valid.
- Store source filename, SHA-256, size, row number, raw line fields, normalized values and diagnostics. Do not retain the original file blob after parsing in MVP.
- Warn when the same content hash was already imported; never silently duplicate an RFQ.

### RFQ fields

`id`, `organization_id`, `account_id`, required `opportunity_id`, unique human-readable `rfq_number` such as `RFQ-2026-0001`, `title`, optional customer reference, source filename/hash/row count, `imported_at`, `imported_by`, status `needs_review|ready_to_quote|quoted|cancelled`, owner, timestamps and `version`.

### RFQ line fields

`id`, `organization_id`, `rfq_id`, source row number; raw SKU/description/quantity/unit/specification/manufacturer/MPN/notes; normalized description/quantity/unit/attributes; `normalization_status` `valid|warning|invalid`; `match_status` `exact_match|suggested|needs_review|matched|unmatched`; nullable `selected_product_id`; nullable `resolution_reason`; integer `version`; timestamps/actors. Unique `(rfq_id, source_row_number)`.

### Import sequence

1. Validate auth/organization, account/opportunity, file size, encoding, row count and required columns.
2. Parse CSV via standard library.
3. Run existing deterministic normalization domain where practical; preserve Unicode NFKC, quantity extraction, structured spec extraction and unit/dimension checks already supported.
4. Run catalog matching using SKU/MPN/alias/specification constraints, unit compatibility and explainable scoring/reason codes.
5. Save RFQ, import job, lines, candidates and diagnostics transactionally (or via a safe staged import that cannot expose a half-created RFQ).
6. Return import report and navigate to RFQ review.
7. RFQ may become `ready_to_quote` only when all blocking lines have an accepted product match. For MVP, unmatched lines **block** quote conversion; remove from quote only using an explicit audited action.

### Matching safety rules

- Same normalized input + same catalog snapshot + same rule version must yield identical outputs, candidates, scores, reason codes and ranking.
- Exact SKU/MPN match outranks alias and fuzzy text similarity.
- Hard conflicts such as incompatible nominal size, pressure/class, material/grade or unit must eliminate/demote candidates according to existing matching rules. High text similarity must not override a known hard conflict.
- Preserve safe abstention: uncertain cases become `needs_review` or `unmatched`, not an arbitrary confident match.
- Preserve existing thresholds and frozen synthetic evaluation cases. No threshold tweaking merely to improve a demo. A threshold change requires a new rule version, documented evaluation, regression results and trade-off explanation.
- Display reason tags such as `Exact SKU`, `Manufacturer part number`, `Alias match`, `Compatible unit`, `Material matches`, `Size conflict`, `Insufficient evidence`.
- A score is a ranking signal, not a calibrated probability. Label it “Match score”/“Similarity score”, never “94% certain” without calibration evidence.
- No LLM/external model for matching in MVP.
- Every manual accept/reject/override records actor, timestamp, prior selection, new selection, reason and line version.

## 6.7 RFQ review studio — signature screen

This is one of the two highest-priority screens and receives more design/QA attention than a normal CRUD page.

### Desktop layout (≥1280 px)

- Header: RFQ number/title, account, opportunity, status, update time, line-count summary and primary action.
- Progress strip: `Imported → Normalized → Review → Ready to quote` with current stage emphasized.
- Action/filter row: search lines, status filter, “Needs review” toggle, manufacturer filter, reset filters and safe bulk actions.
- Sticky-header table columns: row checkbox; source row number; raw customer description; normalized interpretation (description/quantity/unit/specs); suggested product (SKU/name/key specs); matching rationale/score and status; review action.
- Selecting a row opens a side panel without losing table scroll position. Include raw input, normalized fields, candidates/reasons, hard incompatibilities, catalog details, selected result, decision history and manual resolution.
- Sticky summary shows resolved/total, unresolved and invalid counts, and next valid action.
- “Continue to quotation” stays disabled while blocking lines remain; explain why beside the button and to assistive tech.

### States and actions

- `Exact match`: subtle green/teal + check icon + visible text.
- `Suggested`: blue/indigo + search/spark icon + visible text.
- `Needs review`: amber + alert icon + visible text.
- `Unmatched`: neutral/red + alert icon + “No safe match”.
- `Resolved manually`: green + user-check icon + visible text.
- Color is never the only state indicator and numeric similarity is never the only explanation.
- `Accept suggestion`: confirm then send candidate/product ID plus `expected_version`.
- `Choose different product`: searchable catalog picker with compatibility data and active status.
- `Mark unmatched`: reason enum `not_in_catalog|insufficient_specification|incompatible_unit|other`; detail required for `other`.
- `Revert decision`: only before quote conversion; creates a new audited decision and never deletes history.
- `Bulk accept exact matches`: only server-designated safe exact matches; confirmation summary; atomic all-or-nothing batch requiring each expected version. If any is stale, report conflict and commit none.
- `Re-run matching`: catalog manager/admin only; creates a new candidate version and preserves manual decisions unless reviewer explicitly clears them.
- `Continue to quotation`: create/open quote draft with resolved products and immutable product/spec snapshots.

### Acceptance criteria

Raw text remains visible after normalization. SKU/name/unit/specs are visible before acceptance. Hard incompatibility requires explicit manual review and reason. Reload preserves decisions. Two users acting on one old version result in a predictable `409` for the second action, not a silent overwrite. The conflict banner offers “Reload latest version” and explains nothing was committed. Keyboard users can navigate rows/panel/candidates/actions and focus returns to the originating row.

## 6.8 Quotation creation and deterministic pricing

### Purpose
Turn reviewed RFQ lines into a quotation whose every amount can be explained, reproduced and safely revised. Quote calculations are business-critical domain logic: do not calculate final currency amounts in React, SQL, or a model call.

### Quote identity and required fields

Each quote has a server-generated human-readable number (for example `FF-Q-2026-000123`), UUID, organization ID, linked account, linked opportunity, source RFQ, current immutable revision ID, current revision number, currency, status, validity date, payment terms, delivery terms, customer-facing notes, internal notes, creator, owner, created/updated timestamps and optimistic-concurrency version.

For MVP, organization currency is INR (`INR`, symbol `₹`, locale `en-IN`). Store currency explicitly on every quote and revision. Do not silently convert currencies. Multi-currency conversion is out of scope. Render amounts using `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })` in the UI; server calculation and stored amounts use decimal types.

Each quote line snapshots the catalog SKU, catalog product name, description/specification, unit, requested quantity, unit selling price, optional unit cost for authorized internal margin review, discount percentage, tax rate and source RFQ line. A later catalog edit must never rewrite an existing quote revision.

### Domain-owned calculation rules

The Python quote-calculation module is the sole source of truth for ForgeFlow quote math. Use `decimal.Decimal` constructed from validated decimal strings / database `NUMERIC` values; never binary floating point for financial calculations. Use explicit `ROUND_HALF_UP` rounding to the configured currency precision (two decimal places for INR in this release). Every operation must have unit tests for rounding boundaries, zero values, maximum supported precision and negative/invalid input.

For each line:

```text
gross_amount    = round_currency(quantity * unit_price)
discount_amount = round_currency(gross_amount * discount_percent / 100)
taxable_amount  = gross_amount - discount_amount
tax_amount      = round_currency(taxable_amount * tax_rate_percent / 100)
line_total      = taxable_amount + tax_amount
```

Quote subtotal is the sum of line gross amounts. Total discount is the sum of line discount amounts. Taxable subtotal is the sum of line taxable amounts. Tax total is the sum of line tax amounts. Quote grand total is the sum of line totals. Line values are rounded first as explicitly shown; totals are sums of stored line-level results, not a second calculation on unrounded aggregate values. Taxes are modeled as a flat percentage per line for the demo; compound taxes, jurisdiction-specific compliance and real GST filing behavior are out of scope.

If internal unit cost is populated and authorized, line gross profit is `taxable_amount - (quantity * unit_cost)` rounded according to the domain's cost precision. Margin percentage is `gross_profit / taxable_amount * 100`; if taxable amount is zero, margin is `null`, never infinity or a fabricated value. Internal cost and margin must never appear in customer-facing quotation exports or responses available to a sales role without permission.

The calculation function must be pure: validated input in, calculation result plus explanation/trace in, no network, database or UI dependency. Return per-line intermediate values, quote totals, applied rules, rounding method, calculator version and a stable input fingerprint. Persist a calculation snapshot with each quote revision so an older quote can be explained even after code or catalog data changes.

### Quote policies (explicit demo defaults)

- Any unresolved, unmatched, invalid or stale RFQ line blocks quote creation from that RFQ.
- A line discount above 5% requires a manager approval.
- A quote grand total above ₹500,000 requires a manager approval.
- A quote with internal gross margin below 15% requires a manager approval when cost data exists. If cost data is absent, do not infer margin; apply the other rules normally.
- These thresholds are configuration values stored in organization settings, seeded with the values above, and visible to administrators. Changes to policy affect new proposals; they do not silently rewrite the rules or snapshot associated with an existing approval.
- Any change to quantity, unit price, discount, tax, terms that are approval-controlled, or quote lines creates a new draft revision. It never mutates an already approved/sent revision in place.
- “Approve” is not allowed to the same user who proposed the relevant change when the maker-checker rule applies. Admin status does not bypass this separation of duties.
- A quote in `approved` state can be exported as final. A quote in `draft`, `pending_approval`, `rejected`, `stale` or `cancelled` state cannot be exported as an approved customer quotation.

### Quote state machine

```text
draft -> pending_approval -> approved -> sent
  |             |             |
  |             +-> rejected  +-> superseded (after an approved newer revision is explicitly committed)
  +-> cancelled
```

A quote may move from `draft` to `approved` directly only when no configured approval condition applies. A rejected proposal does not automatically reject the quote itself; it rejects the proposed revision and returns the quote workspace to an editable state based on the last committed revision. An approved quote can be marked `sent` only by an authorized sales user and only after a successful export or explicitly recorded delivery action; the demo does not pretend to send email.

### Quote builder screen

- Header: quote number, account, source opportunity, status, revision, last updated, validity date and actions allowed to the current role.
- Main canvas: editable line-item table with SKU/product, description, quantity, unit, unit price, discount, tax, line total and row actions.
- Right summary panel: subtotal, discount, taxable subtotal, tax, grand total, approval flags and next action. The panel updates optimistically for responsiveness, but server responses replace optimistic totals; the server is authoritative.
- Customer preview: separate preview mode styled as a printable quotation, with organization/customer details, items, payment/delivery/validity terms, totals and a visible draft/approved state.
- Calculation inspector: select a total or line value to see the inputs and ordered calculation steps. This is a business explanation, not executable code.
- Revision strip: committed revision and any active draft/proposal; clearly label what is saved versus what is only proposed.
- Save has explicit pending, saved, validation error and conflict states. Do not show a successful toast until the server confirms persistence.

### Acceptance criteria

For known fixtures, browser-displayed totals exactly equal server-calculated values after the response. Invalid precision, negative quantity, discount outside `0..100`, tax outside the configured valid range, missing SKU snapshot or invalid units are rejected with field-level messages. Catalog changes do not alter historic quote revisions. Internal cost/margin are permission-filtered on the server. Quotes needing approval cannot be sent or exported as final until the required approvals are committed.

## 6.9 Reviewable quotation proposals: Model Change Review Lab concepts

ForgeFlow adapts the *patterns* demonstrated by Model Change Review Lab: proposal-before-write, before/after diffs, atomic commit, revision-aware invalidation, audit history and formula-level traceability. Its existing financial-model formulas and UI are not copied into the quotation system. ForgeFlow's own Python `Decimal` quote calculator is authoritative for quote amounts.

### Proposal purpose and payload

A quote change proposal is an isolated, reviewable set of operations against a specific committed revision. It stores: proposal UUID/number, quote ID, base revision ID and version, proposer, reason, creation time, proposed operations, normalized change summary, calculation snapshot for before/after, policy-check results, current status, optional reviewer/comment, idempotency key and final commit references.

Allowed operations for MVP:

- Set quantity for a quote line.
- Set unit selling price for a quote line.
- Set discount percentage for a quote line.
- Set applicable tax rate within the configured allowed range.
- Add a line using an existing active catalog product and reviewed RFQ source line.
- Remove a line from a proposed new revision (never delete it from prior revisions).
- Update validity date, payment terms or delivery terms.

Each operation includes an operation ID, target line or quote field, old value, proposed value, reason and UI ordering. The server validates operations against an allowlist; clients cannot submit arbitrary object patches, change the organization ID, choose an arbitrary approval status or change audit fields.

### Proposal lifecycle

```text
draft -> pending_review -> approved -> committed
  |           |              |
  +-> cancelled|              +-> stale (base revision changed before commit)
              +-> rejected
              +-> stale
```

An implementation may represent `approved` and `committed` as separate states so approval is auditable before commit. For eligible low-risk changes with no required approval, the user may explicitly commit a validated proposal directly; the same revision check, transaction and audit requirements still apply. The standard demonstration flow uses manager approval followed by commit.

### Core invariants

1. Creating or editing a proposal never mutates the canonical/current quote revision.
2. The proposal's `base_revision_id` and `base_version` are mandatory and immutable after submission.
3. The server loads the current committed revision, checks the base revision/version, revalidates permissions and approval rules, reapplies the operation list to a fresh domain object, and reruns the authoritative calculation immediately before committing.
4. Commit creates a new immutable quote revision, updates the quote's current revision pointer/version, records the proposal commitment and appends audit events in a single database transaction.
5. A stale proposal returns HTTP `409 Conflict` with a stable error code such as `STALE_BASE_REVISION`; no quote revision, current pointer or approval record is partially written.
6. If the database transaction fails, the operation has no partial externally visible commit. Roll back all writes and return a correlation/request ID.
7. An approval is tied to the exact proposal and base revision. Any proposal edit after submission invalidates prior approval and requires resubmission; approved proposals cannot be edited.
8. A proposal cannot be approved by its proposer when maker-checker is required. Authorization is checked server-side on every action.
9. Retrying the same commit with the same idempotency key returns the original successful result without creating a duplicate revision. Reusing a key with a different payload is rejected.
10. Every before/after calculation in the UI is reconstructed or verified by the server; the client never gets to set the committed total independently.

### Commit and concurrency implementation

Use SQLAlchemy transaction scope plus a row lock (`SELECT ... FOR UPDATE`) on the quote row or an equivalent compare-and-swap update using the expected version. Check exact current revision/version *inside* the transaction. Enforce uniqueness for committed proposal IDs and idempotency keys in the database. Use Postgres constraints/transactions as the integrity backstop; an in-memory mutex alone is insufficient. Keep transaction duration short and do not perform network calls while holding row locks.

Response contract for stale version: `409`, `code: "STALE_BASE_REVISION"`, current revision number, a safe current revision summary and message “This proposal was based on an older quotation revision. No changes were committed. Reload the current quotation and create or reconcile a new proposal.” Never return internal cost information to an unauthorized role.

### Formula and change traceability

The calculation inspector records a structured trace for each displayed number:

- Output key (for example `quote.total` or `line:<uuid>.tax`).
- Ordered named inputs and their decimal values.
- Operation/percentage and rounding boundary.
- Rule/calculator version.
- Before and after value for proposal comparisons.
- Source line, catalog snapshot or user change that supplied the input.

This is a structured trace produced by deterministic code, not a promise to execute an arbitrary spreadsheet formula graph. The interface must explain dependencies in plain language and preserve trace snapshots with the revision.

### Acceptance criteria

A proposal preview does not change the canonical total. The old and proposed values are both shown with the absolute and percentage delta where mathematically defined. Accepting a proposal creates exactly one new revision. Simultaneous commits based on one old revision cannot both silently succeed. Repeating a commit with the same idempotency key does not create a duplicate. Rejected, cancelled and stale proposals remain visible in history.

## 6.10 Manager approval queue and review workspace

### Queue requirements

Show proposals requiring review, with tabs/filters for `Pending`, `Approved`, `Rejected`, `Stale` and `All`. Default sorting is pending items first, then oldest pending first, so work does not disappear beneath recently updated records. Table columns: proposal ID, quote/customer, proposer, submitted at, base/current revision, requested change summary, current total, proposed total, delta, triggered rules and status.

Filter/search by quote, customer, proposer, date range, status and triggered approval rule. Search and filters must be reflected in URL query parameters so views can be bookmarked/reloaded. Empty, loading, error and no-results states are mandatory.

### Review detail requirements

- A clear heading with quote/customer and proposal status.
- A change-by-change diff grouped by line or quote-level term.
- Explicit prior value → proposed value; never indicate direction by color alone.
- Recalculated subtotal, discount, taxes, grand total, and margin only when authorized.
- Triggered policy checklist with rule explanation.
- Calculation inspector and link to source RFQ/customer opportunity.
- Proposer identity, submitted time, stated reason and prior review history.
- Required reviewer comment for rejection; approval comment is optional but supported.
- Actions `Approve`, `Reject`, and `Return/Request revision` only when state, permissions and revision permit them. For MVP, “Request revision” is implemented as rejection with a structured reason and editable follow-up proposal; it is not a separate hidden state.
- On approval, commit atomically as specified in section 6.9, show the created revision number, and refresh dependent quote/opportunity data.

### Acceptance criteria

Sales representatives cannot access or perform manager-only review actions by changing the client request. A manager cannot approve their own proposal where separation of duties applies. A changed base revision prevents stale approval/commit. Approval result, actor, time, comment, rule checks and new revision are persisted and visible in permitted audit history.

## 6.11 Export generation and guardrails

### PDF quote export

Use WeasyPrint in the backend to render an HTML/CSS quotation template to PDF. The template must be versioned with source code. The browser preview is helpful but the final downloadable PDF is generated from the server's committed quote revision, not arbitrary client HTML.

PDF content: ForgeFlow Demo / synthetic organization branding; quotation number; issue/valid-until dates; seller and customer business details; opportunity reference where appropriate; line SKU, description, specifications, quantity, unit, unit price, discount, tax and line total; subtotal, discounts, taxes and grand total; payment/delivery terms; notes; page numbering; and approved/draft status. Internal notes, cost, margin, matcher confidence internals and access tokens must never appear in customer-facing PDF. Use a clear “DRAFT — NOT APPROVED” watermark for internal preview downloads if draft previews are explicitly enabled; no draft can be exported from the primary final-download action.

The PDF must use a supported font, handle long descriptions, repeat table headers over page breaks, keep totals together where possible, and display “No valid expiry date” only when the field is genuinely absent and allowed; never invent dates. If production fonts or renderer dependencies are missing, deployment validation must fail visibly rather than quietly producing broken glyphs.

### CSV export

- RFQ exports include permitted line fields, decisions, product SKU and review state; include raw descriptions only according to role policy.
- Quote exports use the approved committed revision and customer-safe fields.
- Always use RFC 4180-compatible quoting and UTF-8 encoding.
- Neutralize spreadsheet formula injection in string cells whose first meaningful character is `=`, `+`, `-`, `@`, tab, carriage return or line feed. Prefix unsafe textual values with an apostrophe or another documented safe representation before CSV quoting. Do not modify numeric domain values merely because negative numbers are valid numeric data; distinguish typed numeric fields from untrusted text.
- Exports must not leak data from another organization or hidden/internal cost fields.

### Export authorization and events

The server rechecks role, organization membership, quote status, approval state and revision identity at request time. Final quote PDF export requires `approved` or `sent` state on the exact current revision; exporting a superseded revision is allowed only via an explicitly labeled permitted historical export route for manager/admin. A draft preview, if included, must be visually watermarked and must not be mistaken for a final quote.

Record export event UUID, actor, organization, resource, revision, format, result, timestamp and request ID. Do not store the full rendered customer document in application logs. Use private temporary storage or streamed responses; securely clean up temporary artifacts. Set appropriate content type and safe filename; avoid embedding untrusted customer values in paths/headers.

### Acceptance criteria

A quote requiring approval cannot be exported as final. PDF totals exactly match its committed revision. CSV cells with malicious spreadsheet prefixes are safely neutralized. No export route is exposed without backend authorization. Cross-organization resource IDs return a non-disclosing not-found/forbidden response according to the API's documented policy.

## 6.12 Activities, audit trail and notifications

Maintain two related but distinct concepts:

- **Activity timeline:** user-facing business events, e.g. account created, meeting note added, task completed, RFQ imported, match accepted, proposal submitted, quote approved/exported.
- **Audit events:** security and integrity events with structured actor, organization, target entity, action, timestamp, request/correlation ID and minimal before/after snapshots for sensitive fields.

Audit rows are append-only at the application level: normal APIs cannot update/delete them. Capture login success/failure where appropriate, user/role changes, catalog changes, manual matching decisions, quote revision creation, proposal transitions, approvals, export attempts/results, policy changes and conflicts that are material to workflow integrity. Never log passwords, session IDs, bearer tokens, CSRF tokens, raw authentication secrets or unnecessary personal data.

Activity entries can be displayed newest-first with actor, event verb, target, relative timestamp and an absolute timestamp on hover/focus. Filters by event type, actor and date are required. The MVP uses in-app badges and an actionable “Pending approvals” queue, not email/SMS/push delivery. Notification counts must come from server state and be refreshed after relevant mutations; no permanently hard-coded badge counts.

---

# 7. Visual design and UX specification

This section is normative. The implementation must follow the named design tokens, components and interaction rules consistently rather than inventing a different UI pattern on every page. The goal is a confident, modern B2B product with strong visual hierarchy, high information density where useful and generous breathing room where decisions are complex.

## 7.1 Required frontend stack

| Concern | Required choice | Rules |
|---|---|---|
| Framework | Next.js App Router, latest compatible stable Next.js 16.x at implementation time | TypeScript strict mode; use App Router conventions; avoid legacy Pages Router for new routes. |
| UI runtime | React 19 + TypeScript | Do not use `any` to bypass domain contracts; prefer generated/API-inferred types. |
| Styling | Tailwind CSS 4 | Design tokens are CSS variables; avoid an unmaintained second utility system. |
| Accessible component primitives | shadcn/ui with **Base UI** primitives consistently | Use the current documented Base UI variant. Do not mix Radix and Base UI implementations of the same primitive. Components are copied into the codebase and must be reviewed like product code. |
| Motion | `motion` package, imports from `motion/react` | Use motion for transitions and interaction polish, not as a substitute for component state. Respect reduced-motion preferences. |
| Icons | `lucide-react` | Use one consistent outline icon family; do not mix emoji and icons in navigation or status badges. |
| Server state | TanStack Query | Use for API cache, retries where safe, invalidation and mutation lifecycle. It does not replace domain validation. |
| Tables | TanStack Table | Use for filtering, sorting, selection and table state; semantic HTML/rendered cells remain under application control. |
| Large-list virtualization | TanStack Virtual only if measured RFQ/catalog rows need it | Do not virtualize short tables by default; accessibility and row focus must remain robust. |
| Forms | React Hook Form + Zod | Client-side validation improves UX; FastAPI/Pydantic remains authoritative. Keep schemas aligned and test contract drift. |
| Charts | Recharts | Use only for meaningful trends or summaries. Supply labels, tooltips, loading/empty states and textual equivalents. |
| Toasts | `sonner` | Success toast only after server success; failures must also be explained inline at the affected control. |
| Dates | `date-fns` and `date-fns-tz` | Store UTC timestamps; display in configured `Asia/Kolkata` zone and show exact time in detail views. Dates such as quote validity are date-only values, not midnight UTC timestamps. |
| CSV file selection | `react-dropzone` | The server validates file type/content/size; the file input must still be keyboard operable. |
| Command palette | `cmdk` if needed for search/command UX | Commands are real actions, respect role permissions, and have keyboard navigation. |
| API types | `openapi-typescript` generated from FastAPI OpenAPI | Generate into a committed or reproducibly generated file; never hand-maintain a second incompatible API schema. |
| Unit/component tests | Vitest + React Testing Library + `@testing-library/user-event` | Test behavior and accessibility semantics, not fragile internal implementation details. |
| End-to-end | Playwright + `@axe-core/playwright` | Test real workflows in Chromium in CI; include accessible-name and critical page scans. |

Do not add another component kit (MUI, Chakra, Ant Design, Mantine) on top of this stack. Do not use arbitrary component-generator templates that introduce a second design system. Use CSS variables and a small documented component layer.

## 7.2 Visual concept and brand direction

**Product personality:** focused, dependable, precise, contemporary, premium-but-practical. Make the experience feel closer to a thoughtfully crafted modern SaaS product than a legacy ERP. It must still look credible for industrial purchasing and quote review—not like a consumer social app.

**Visual principles:**

1. Clear hierarchy: page title and next action first; status/context second; dense business data third.
2. Calm surfaces: mostly neutral backgrounds, thin borders and restrained shadows; reserve bright primary color for calls to action and current selection.
3. Deliberate accent: indigo/violet primary with teal/green for confirmed safe actions, amber for human review, red for destructive or blocking conditions. Never convey state with hue alone.
4. Consistent geometry: aligned gutters, standardized table density, coherent radii and reusable headers.
5. Progressive disclosure: show decision-critical values in the main screen and place full trace details in a side panel or inspector.
6. High craftsmanship: coherent demo data, no broken placeholder avatars, no empty charts pretending to be real data, no random gradients, no default HTML controls where a design-system component exists.

### Wordmark / application shell

Use “ForgeFlow” as a working product name. Do not copy Auribises' logo or imply endorsement/official affiliation. Create a simple in-app mark with Lucide `workflow` or a custom abstract geometric mark; logo is not a blocker for shipping product workflows.

Desktop sidebar: 248px expanded, 72px icon-only collapsed. Header/topbar: 64px tall. Content maximum width: 1600px; main content gutters 28px at wide desktop, 24px tablet, 16px mobile. Use a clear page title row with at most one primary action and a `More` menu for secondary actions.

Sidebar groups:
- **Workspace:** Overview, Accounts, Contacts, Opportunities, Tasks.
- **Quoting:** RFQs, Catalog, Quotations, Approvals.
- **Administration:** Activity & Audit, Team & Roles, Settings (show only what the role may access).

The active navigation item uses a tinted surface, accent indicator and visible accessible state. Collapsed sidebar items have tooltips and accessible names. Sidebar collapse preference may be persisted locally; security-sensitive state must not be stored as trusted client state.

## 7.3 Color tokens

Implement the following semantic tokens as CSS custom properties in `globals.css`. Components should use semantic token names, not scattered one-off hex values. These are the required initial palette; contrast may be strengthened if a measured combination fails WCAG 2.2 AA, but semantic intent should remain stable.

### Light theme

| Token | Hex | Intended use |
|---|---|---|
| `--background` | `#F7F8FB` | App canvas |
| `--surface` | `#FFFFFF` | Cards, dialogs, menus, drawers |
| `--surface-muted` | `#F1F3F8` | Hover/secondary surfaces, table header |
| `--foreground` | `#171B26` | Primary text |
| `--muted-foreground` | `#687084` | Secondary text; verify contrast at each size |
| `--border` | `#E2E6EF` | Subtle dividers and outlines |
| `--primary` | `#5B55D9` | Primary action/current selection |
| `--primary-hover` | `#4B45C6` | Primary hover/active |
| `--primary-soft` | `#F0EFFF` | Selected backgrounds, non-text accent |
| `--success` | `#167A57` | Confirmed/success text and icons |
| `--success-soft` | `#E8F7EF` | Success background |
| `--warning` | `#946200` | Caution / needs review |
| `--warning-soft` | `#FFF5D9` | Review background |
| `--destructive` | `#B42335` | Errors/destructive actions |
| `--destructive-soft` | `#FDECEF` | Error background |
| `--info` | `#245BC7` | Informational status |
| `--sidebar` | `#171A28` | Primary sidebar background |
| `--sidebar-foreground` | `#E7E9F1` | Sidebar labels |
| `--sidebar-muted` | `#A1A8BB` | Secondary/sidebar icons |

### Dark theme

| Token | Hex | Intended use |
|---|---|---|
| `--background` | `#0D1119` | App canvas |
| `--surface` | `#151B27` | Cards, dialogs, drawers |
| `--surface-muted` | `#1B2332` | Secondary/hover surface |
| `--foreground` | `#EEF1F8` | Primary text |
| `--muted-foreground` | `#A2ABC0` | Secondary text |
| `--border` | `#293346` | Dividers/outlines |
| `--primary` | `#A6A0FF` | Primary action/current selection |
| `--primary-hover` | `#B9B4FF` | Hover/active |
| `--primary-soft` | `#29264D` | Selected surface |
| `--success` | `#6BD3A2` | Confirmed/success |
| `--warning` | `#F4C66B` | Caution/review |
| `--destructive` | `#FF8794` | Error/destructive |
| `--info` | `#8CB5FF` | Informational |
| `--sidebar` | `#090C13` | Sidebar background |

The sidebar may retain its deep surface in either theme, but labels/icons must pass contrast checks. Do not reduce text opacity indiscriminately. Test all text/background, input, focus-ring, icon and chart series combinations with axe plus manual contrast checks. Status chips include icon and text as well as color.

## 7.4 Typography, spacing and geometry

- Use `geist` for Geist Sans and Geist Mono (or the official self-hostable Geist package compatible with the app). Do not depend on a third-party font request for essential page rendering.
- Page title: 26–30px desktop, 24px tablet, 22–24px mobile; weight 600–700; line height 1.2.
- Section title: 16–18px, weight 600.
- Card title: 14–16px, weight 600.
- Body/default form text: 14px; compact tables may use 13px only if readability and zoom remain acceptable.
- Supporting text: 12–13px with contrast verified; critical status/errors must not be tiny or low contrast.
- Numeric totals: use tabular numerals; use Geist Mono only for technical IDs/code snippets, not every data point.
- Use a 4px spacing base with a standardized scale: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64` px. Do not use arbitrary one-off spacing unless a component requires it.
- Radii: 8px controls/small cards, 12px standard cards, 16px major workspace panels; pill radius only for compact status tags. Use consistent 1px borders. Keep shadows soft and reserved for floating elevation; use borders rather than shadows to separate ordinary panels.
- Buttons and inputs: 40px standard height, 36px compact, 44px comfortable touch target where space allows. Destructive and high-consequence actions must not be tiny adjacent icon-only buttons.

## 7.5 Required component inventory

Create a documented component layer in `frontend/components/` around shadcn/ui + Base UI. At minimum implement:

- `AppShell`, `AppSidebar`, `AppHeader`, `Breadcrumbs`, `PageHeader`, `PageContainer`.
- `Button` variants: primary, secondary/outline, ghost, destructive, link; size variants and loading/disabled semantics.
- `StatusBadge` with a typed shared status-to-label/icon/semantic-color mapping.
- `MetricCard`, `EmptyState`, `ErrorState`, `LoadingSkeleton`, `InlineError`, `FormField`, `ConfirmDialog`, `UnsavedChangesDialog`.
- `DataTable` based on TanStack Table: sorting, filtering, selection, pagination, column visibility when needed, empty/error/loading states and responsive alternative layout.
- `SearchInput`, `FilterBar`, `DateRangeFilter`, `Combobox`, `CatalogProductPicker`, `CommandPalette` (if enabled).
- `SlideOver/Sheet`, `Resizable workspace panels` only if keyboard-safe and library support is stable, `Tabs`, `Tooltip`, `Popover`, `DropdownMenu`, `Dialog`, `AlertDialog`, `Progress`, `Separator`.
- `MoneyText`, `DateTimeText`, `UserAvatar/InitialsAvatar`, `ActivityTimeline`, `AuditEventRow`.
- Domain components: `OpportunityStageBadge`, `PipelineBoard`, `RfqLineStatus`, `MatchCandidateCard`, `RfqReviewTable`, `NormalizationDiff`, `QuoteLineEditor`, `QuoteTotalsPanel`, `CalculationTrace`, `RevisionDiff`, `ProposalChangeRow`, `ApprovalDecisionPanel`, `QuoteDocumentPreview`.

Requirements:
- Shared components expose typed props and variants; page components must not restyle the same shared button/status semantics ad hoc.
- Forms must associate labels/descriptions/errors with controls and preserve field values when validation fails.
- Dialogs/sheets must manage focus on open/close; Escape closes non-destructive overlays; focus returns to invoking control. Block dismissal only during a consequential in-flight mutation when losing the form would be harmful, and explain why.
- Tooltips are additive, not the only label for a control. Icon-only buttons need accessible names and clear hover/focus feedback.
- Do not render nested interactive elements (e.g. button inside a button or link inside a row button). Whole rows may navigate only if interactive children remain independently usable.

## 7.6 Motion and animation rules

Use Motion (`motion/react`) for selected page/surface transitions. Keep animations short, consistent, interruptible and purposeful. Do not animate every element or make the RFQ table feel slow.

| Interaction | Duration target | Behavior |
|---|---:|---|
| Hover/focus surface | 100–140ms | Small color/border change; no scale bounce |
| Button press | 70–100ms | Subtle down-state; never delays activation |
| Popover/tooltip | 100–140ms | Opacity + 2–4px y movement |
| Dialog/drawer | 180–240ms | Opacity + subtle 6–10px translation; no oversized spring |
| Page/shell transition | 140–180ms | Fade plus at most 6px vertical shift; preserve perceived continuity |
| Sidebar collapse | 180–220ms | Width/label transition with no content jump or clipped focus outline |
| KPI/chart first reveal | 250–450ms | One-time reveal when entering the view; values remain understandable without motion |
| Match decision feedback | 120–180ms | Status change/highlight; do not animate entire table or shift row unexpectedly |

- Use restrained easing such as a standard ease-out for entrances and ease-in for exits. Avoid overshooting spring behavior on enterprise workflows.
- Respect `prefers-reduced-motion` through CSS and Motion's reduced-motion hook/configuration. Reduced-motion mode removes nonessential transforms, animated number counts and chart reveals while preserving state changes and feedback.
- Avoid parallax, scroll-jacking, auto-playing videos, background particles, spinning logos, animated cursors and infinite decorative loops.
- Never delay network actions to let an animation finish. The interface must remain responsive during transitions.
- Animate list inserts/removals only when stable keys exist and layout shift stays small. If focus is in a row that changes state, keep focus stable and announce relevant status via a live region.
- Every interactive state must work with animation disabled.

## 7.7 Responsive behavior

### Desktop: 1280px and above

- Persistent sidebar; dashboard uses a 12-column grid with carefully aligned cards.
- RFQ review uses table + detail side panel and sticky summary/action bar.
- Quote builder uses editor (roughly two-thirds) + totals/preview panel (roughly one-third), collapsing panels gracefully when needed.

### Tablet: 768–1279px

- Sidebar collapses to icon-only or a drawer depending on available width.
- Two-column card layouts become one or two columns based on content width, not device labels alone.
- RFQ table offers visible column prioritization, horizontal scrolling within its bounded table container (not the entire page) or a row-card alternative. Critical raw text and match decision remain discoverable.
- Quote totals may be a collapsible sticky bottom panel; it must not obscure keyboard focus or form controls.

### Mobile: below 768px

- Drawer navigation and 16px page gutters.
- Use page-specific cards/stacked details instead of forcing a full desktop table into a narrow viewport. Keep raw/normalized values, product match and decision actions together in each RFQ line card.
- Quote line editing occurs in a focused sheet or detail page, not in a squeezed multi-column row.
- Sticky primary actions account for safe areas and do not overlap toasts, inputs or dialogs.
- Charts become compact and retain accessible textual summaries.

At all widths: no document-level horizontal overflow, no inaccessible hover-only actions, no hover information required to finish a task, no truncation of values that are necessary for a decision without a way to inspect them. Support browser zoom to 200% and test keyboard navigation at each responsive breakpoint.

## 7.8 Page-specific design requirements

### Overview dashboard

- Welcome/context heading and one primary action (typically “New RFQ” or “New opportunity” based on role/organization workflow).
- Four role-relevant KPI cards with labels, values, trend/time window where supported, and a small explanatory caption.
- Opportunity pipeline/funnel or stage distribution that links to filtered records.
- “Needs attention” list: overdue tasks, RFQs blocked by review, proposals awaiting approval, expiring quotes. Each item links to its exact workflow record.
- Recent activity timeline and a clear empty state for a new organization.
- Charts use actual persisted/seeded values; no decorative charts made from hard-coded random arrays. Empty datasets show guidance rather than fake zero trend lines.

### CRM pages

- Accounts list: company, primary contact, open opportunity count, quote value where permissioned, last activity, owner, status.
- Account detail uses tabs Overview, Contacts, Opportunities, RFQs/Quotes, Activity. Tabs preserve URL/state where sensible.
- Opportunities support both pipeline board and table/list view; drag-and-drop, if offered, is an enhancement and not the only way to change stage. Stage changes confirm when they have downstream consequences.
- Forms are divided into sensible sections, not one overwhelming modal with dozens of fields. Create/edit uses side sheet for short forms and full page for complex opportunity/quote workflows.
- Tasks show owner, due date, priority, linked account/opportunity and completed/open state. Overdue items are labeled explicitly, not only colored red.

### RFQ review workspace

Implement as a signature product screen. Use a stable left/main/right composition at desktop:
- Left contextual rail (or compact header) with RFQ progress, customer, import file name, import time, processing state and filters.
- Center area with the RFQ line table and inline raw/normalized values; maintain visible raw customer input alongside system interpretation.
- Right detail inspector for selected line, selected candidate, compatibility facts, rejection/explanation reasons, manual choice and historical decision.
- Bottom/sticky summary with resolved/total, needs review, unmatched/invalid counts, save state and the next valid action.

Provide keyboard shortcuts only where discoverable and non-conflicting; display them in the command menu/help. Avoid auto-changing row selection after a mutation in a way that disorients keyboard users. Use status icon + label + supporting copy; similarity scores are supporting evidence, not the final decision by themselves.

### Quote and revision workspace

- High-quality printable customer preview next to the editable quote.
- Use a visually distinct “Committed revision” versus “Proposed changes” state.
- Diff rows align old/new values so a manager can compare without mental arithmetic.
- Financial deltas include sign, absolute amount and percentage when defined. Negative/positive colors supplement a textual “increase/decrease” label.
- Pricing assumptions, discount rules, tax and line totals are inspectable in the calculation trace.
- Final actions are contextual: Save draft, Propose changes, Submit for approval, Approve and commit, Export approved quote. Never display mutually contradictory primary buttons.

## 7.9 Loading, empty, error and success states

Every page/API interaction must implement the following states as applicable:

- Initial loading: skeleton shaped like the final layout, not a full-screen spinner unless authentication/session bootstrapping genuinely blocks the app.
- Background refresh: retain readable existing data and show a subtle refreshing indicator; avoid flashing the whole page.
- Empty: explain what this entity is, why the list is empty and one appropriate next action, if permitted.
- Filtered-empty: say no results match the current filters and provide “Clear filters”.
- Validation error: inline field error plus summary/focus behavior for long forms; preserve valid user-entered data.
- Server error: explain the action failed, retain recoverable input and offer a safe retry when the operation is idempotent.
- Conflict/stale revision: dedicated warning state, explain no change was committed, provide reload/compare path and prevent repeated blind retries.
- Permission denied: explain the action is unavailable for the account; do not rely on hidden UI alone for authorization.
- Success: update server-backed state first, then toast/confirmation and inline status. The user must see the created ID/revision for important mutations.
- Destructive confirmation: name the entity and impact; require explicit confirmation. If the action is irreversible, say so and prefer archival/cancellation where possible.

Avoid generic “Something went wrong” when the API provides a safe specific error. Show request/correlation ID in a “Details” disclosure for support without exposing stack traces or secrets.

## 7.10 Accessibility acceptance standards

Target WCAG 2.2 AA. This is a design/engineering target and must be validated rather than assumed.

- All workflows usable with keyboard alone. Visible focus ring is always present and not clipped by drawers/sticky headers.
- Semantic headings, landmarks, buttons, links, forms, status announcements and table headers.
- Labels and error associations for each input; errors announced and focusable.
- Contrast meets applicable WCAG thresholds for text, controls, focus indicators and meaningful non-text graphics.
- Do not communicate state with color alone; use labels/icons/patterns where appropriate.
- Motion reduced according to OS preference. No flashing content.
- Target size and spacing meet WCAG 2.2 minimum requirements or documented exceptions for dense controls, with larger touch targets preferred on mobile.
- Every modal/dialog handles focus trapping and restoration. Every table filter/row action is keyboard reachable.
- Automated axe checks are required for top-level pages and key workflows; a clean automated scan is not a substitute for manual keyboard/screen-reader review.

## 7.11 UI quality gate

A feature is not complete just because its API works. The PR is not ready until the page has: responsive states, loading/empty/error/success states, keyboard usability, visible focus, real data, consistent shared components, useful microcopy, reduced-motion compliance, no console warnings, and a tested complete interaction path. Capture Playwright screenshots at desktop (1440×900), tablet (1024×768) and mobile (390×844) for the dashboard, RFQ review, quote builder and approval review during final QA.

# 8. Dashboard metrics and reporting

## 8.1 Metric definitions

Every metric must have a documented definition, source query, time window and permission policy. The first release is an operational dashboard, not a BI system.

- **Open opportunities:** count of opportunities not in `won`, `lost` or `archived` stage.
- **Open pipeline value:** sum of each open opportunity's expected amount in the organization currency. Do not apply probability-weighted forecasting unless a separately named weighted metric is implemented.
- **Quotes awaiting approval:** count of quotes/proposals requiring human approval and currently pending.
- **Open RFQ lines requiring review:** count of unresolved review-blocking RFQ lines visible to the current organization/role.
- **Overdue tasks:** incomplete tasks whose due date is before the organization's current local date; calculate using `Asia/Kolkata` by default.
- **Quotes expiring soon:** approved/sent quotes whose validity date falls within the next seven calendar days and are not already expired.
- **Conversion rate:** only show if denominator, period and cohort rule are documented. For the demo, use won opportunities divided by opportunities closed in the selected period; exclude open opportunities from the denominator.

Do not combine different currencies. Multi-currency conversion is out of scope; monetary values within one organization must be INR. If inconsistent currency data is detected, show a clear warning rather than summing incompatible values.

## 8.2 Date ranges and charts

Default dashboard date range is the current calendar month in `Asia/Kolkata`. Offer 7 days, 30 days, current month, last month and custom range where useful; display the active range. If no historical data exists, show a neutral empty state and a link to create relevant records.

Use Recharts for a limited set of high-value visuals: opportunity stage distribution, quote activity over time and RFQ review outcomes. Each chart requires a title, date window, legend where needed, and a textual summary or table equivalent. Charts cannot be the only representation of a critical KPI. Avoid 3D charts, overcrowded pie charts, decorative gradients and meaningless chart animations.

## 8.3 Dashboard acceptance criteria

Metrics are derived from persisted records using documented filters. Counts refresh after successful mutations and navigation/revalidation. Clicking a KPI opens a corresponding filtered list. Empty datasets do not fabricate trends. Users never see another organization's values or unauthorized quote margin.

---

# 9. Architecture and repository conventions

## 9.1 Architecture decision: modular monolith

Implement a modular monolith with one Next.js frontend, one FastAPI API service and one PostgreSQL database. This fits the prototype and existing project foundations. Do not introduce microservices, event brokers, Kubernetes or distributed service communication in the MVP.

**Logical flow:** Browser → Next.js UI → FastAPI `/api/v1` → domain services → SQLAlchemy/PostgreSQL. Domain modules receive validated values and repository interfaces; they do not import FastAPI request objects or React concerns. API handlers enforce authentication/authorization and translate errors; domain functions decide business outcomes; repository/unit-of-work code persists them.

The backend is authoritative for authentication, membership/roles, resource visibility, RFQ decisions, quote calculations, proposal validation, approvals, revision versions and exports. Client state is for presentation and local form drafts only.

## 9.2 Reuse existing project code deliberately

Before implementation, inspect the current default branches of these projects and run existing tests. Do not assume a summary or old snapshot substitutes for code inspection.

- RFQ Normalizer: `https://github.com/Satjeet2005/RFQ-line-item-normalizer`
- Model Change Review Lab: `https://github.com/Satjeet2005/model-change-review-lab`

Reuse the RFQ Normalizer's pure Python normalization/matching domain implementation and tests as a reviewed starting point. Preserve determinism, unit/spec compatibility checks, safe abstention and human-in-the-loop decisions. Do not change thresholds merely to make the demo appear more automated. Existing benchmark datasets are synthetic; metrics must be reported with that qualification.

Reuse Model Change Review Lab's *workflow patterns*: isolated proposals, before/after diff, atomic commit, stale-proposal invalidation, revision safety and auditable calculation traces. Do not import its financial model assumptions/formulas as the quote calculator. ForgeFlow uses one Python `Decimal` quote-calculation authority so quote calculations and quote commits share a server-side domain boundary. Document nontrivial ports, behavior changes or rejected reuse in `docs/architecture-decisions/`.

Keep both existing projects independently runnable. Do not create circular runtime dependencies or call the standalone projects over HTTP at runtime. Adapt required domain code into ForgeFlow's version-controlled package after reviewing licensing/provenance. Preserve upstream attribution/license obligations and keep existing repos buildable.

## 9.3 Repository structure

Use a single Git repository with this structure unless inspected source code requires a documented adjustment:

```text
forgeflow/
├── README.md
├── PRD.md
├── Makefile
├── compose.yaml
├── .env.example
├── .gitignore
├── docs/
│   ├── architecture.md
│   ├── demo-script.md
│   ├── data-dictionary.md
│   ├── API.md
│   ├── security.md
│   ├── test-plan.md
│   └── architecture-decisions/
├── frontend/
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── app/
│   │   ├── (auth)/login/page.tsx
│   │   ├── (workspace)/layout.tsx
│   │   ├── (workspace)/overview/page.tsx
│   │   ├── (workspace)/accounts/...
│   │   ├── (workspace)/opportunities/...
│   │   ├── (workspace)/tasks/...
│   │   ├── (workspace)/catalog/...
│   │   ├── (workspace)/rfqs/...
│   │   ├── (workspace)/quotes/...
│   │   ├── (workspace)/approvals/...
│   │   ├── (workspace)/activity/...
│   │   ├── (workspace)/settings/...
│   │   ├── globals.css
│   │   └── layout.tsx
│   ├── components/{ui,layout,data-display,forms,domain}/
│   ├── features/{auth,accounts,contacts,opportunities,tasks,catalog,rfqs,quotes,approvals,activity,settings}/
│   ├── lib/{api,auth,formatters,schemas,utils}/
│   ├── hooks/
│   └── tests/e2e/
└── backend/
    ├── pyproject.toml
    ├── uv.lock
    ├── alembic.ini
    ├── alembic/versions/
    ├── app/
    │   ├── main.py
    │   ├── config.py
    │   ├── api/v1/
    │   ├── auth/
    │   ├── db/
    │   ├── models/
    │   ├── schemas/
    │   ├── repositories/
    │   ├── services/
    │   ├── domain/{rfq,quotes,proposals,workflows,audit}/
    │   ├── exports/
    │   └── seed/
    └── tests/{unit,integration,security,fixtures}/
```

Folder names indicate boundaries, not permission to create empty abstractions. Keep API route files thin. Pure domain functions must be unit-testable without a DB or live web server. The repo may use expanded folder structures rather than literal brace notation shown above.

## 9.4 API conventions and error contract

- Prefix all application endpoints with `/api/v1`.
- API JSON fields use `snake_case`; if the UI prefers `camelCase`, use one explicit consistent conversion strategy.
- Use UUIDs for opaque resource identifiers; human-readable RFQ/quote numbers are for display/search only.
- Paginated collections use `{ items, page, page_size, total }`. Default page size 25, maximum 100. Allowlist sort/filter fields.
- Mutations affecting a revision/resource accept expected version or `If-Match` ETag. Use `409` for stale/conflicting state, `422` for domain validation, `401` for missing/invalid session, `403` for disallowed operation, `404` for missing/inaccessible resources per the non-disclosure policy, `429` for rate limit and `500` only for unexpected errors.
- Error JSON: `code`, `message`, optional field `details`, and `request_id`. Details must be safe/actionable and contain no SQL, stack traces or cross-tenant data.
- Backend OpenAPI is the canonical API schema. Generate TypeScript API types; do not return ORM models directly.
- All mutations validate authorization and state transitions on the server. Hiding/disabling a UI control is never the access-control boundary.
- GET requests never mutate state. Use explicit command endpoints for approvals/commits rather than hiding consequential behavior in generic `PATCH` calls. Prefer archive/cancel over hard delete for business records with audit history.
- No endpoint returns session cookies, password hashes, secrets or cost/margin to unauthorized roles.

## 9.5 Server/client component boundary

Use React Server Components for shell/layout and read-oriented initial rendering where compatible with the chosen session/API strategy. Use Client Components for interactive forms, tables, dialogs, Motion, charts and local drafts. Avoid marking an entire route tree `use client` without need. Keep browser APIs and client-only dependencies below the client boundary. Session secrets must never be exposed to JavaScript.

# 10. Persistence model and integrity constraints

This section is the required logical model. The implementer may choose SQLAlchemy table naming conventions, but may not omit the constraints or invariants. Use UUID primary keys, UTC-aware timestamps, explicit organization scoping and Alembic migrations. Any row belonging to a customer organization must include `organization_id` directly or through a documented parent relation; repositories must scope every read and write to the authenticated organization.

## 10.1 Core tables

| Table | Purpose and required fields |
|---|---|
| `organizations` | `id`, `name`, `slug`, `currency` (INR for MVP), `timezone`, `settings_json`, `created_at`, `updated_at`. Unique slug; validate configured rules. |
| `users` | `id`, `email_normalized`, `display_name`, `password_hash`, `is_active`, `created_at`, `updated_at`. Unique normalized email. Password hashes are Argon2id. Never store plaintext password. |
| `organization_memberships` | `id`, `organization_id`, `user_id`, `role`, `is_active`, `created_at`. Unique `(organization_id,user_id)`; role restricted to declared enum. |
| `sessions` | `id`, `user_id`, `organization_id`, `token_hash`, `created_at`, `last_seen_at`, `expires_at`, `revoked_at`, minimal safe metadata. Unique token hash. Cookie token itself is never stored raw. |
| `accounts` | `id`, `organization_id`, `name`, `legal_name`, `industry`, `website`, `phone`, `email`, `billing_address_json`, `shipping_address_json`, `notes`, `owner_user_id`, `status`, `created_by`, timestamps, `version`. |
| `contacts` | `id`, `organization_id`, `account_id`, `first_name`, `last_name`, `job_title`, `email`, `phone`, `is_primary`, `notes`, `created_by`, timestamps, `version`. Foreign key to account; no cross-organization parent. |
| `opportunities` | `id`, `organization_id`, `account_id`, `name`, `description`, `stage`, `expected_amount NUMERIC`, `currency`, `probability_percent NUMERIC`, `expected_close_date DATE`, `owner_user_id`, `source`, `closed_reason`, timestamps, `version`. Amount nonnegative; valid stage enum. |
| `tasks` | `id`, `organization_id`, `title`, `description`, `status`, `priority`, `due_date DATE`, `assignee_user_id`, optional `account_id`, `opportunity_id`, `quote_id`, `completed_at`, `created_by`, timestamps, `version`. Linked records must belong to same organization. |
| `activities` | `id`, `organization_id`, `actor_user_id`, `entity_type`, `entity_id`, `event_type`, human-readable summary, safe metadata JSON, `occurred_at`. Business timeline; no auth secrets. |
| `catalog_products` | `id`, `organization_id`, `sku`, `name`, `description`, `specification_json`, `unit`, `manufacturer`, `category`, `unit_cost NUMERIC NULL`, `default_unit_price NUMERIC`, `default_tax_rate NUMERIC`, `is_active`, `version`, created/updated audit fields. Unique normalized SKU per organization; nonnegative cost/prices; archived products stay available to old snapshots but cannot be newly selected. |
| `catalog_aliases` | `id`, `organization_id`, `product_id`, `alias_text`, normalized alias, `alias_type`, `created_by`, `created_at`. Index normalized alias; prevent duplicate equivalent aliases for the same product where possible. |
| `rfqs` | `id`, `organization_id`, `rfq_number`, `account_id`, optional `opportunity_id`, `source_filename`, `source_file_hash`, `status`, `imported_by`, `imported_at`, `line_count`, `version`, timestamps. Unique RFQ number per organization. |
| `rfq_import_jobs` | `id`, `organization_id`, `rfq_id`, `status`, `source_file_hash`, `row_count`, `error_count`, safe validation report JSON, `started_at`, `completed_at`, `created_by`, request ID. Do not store files indefinitely unless there is an explicit retention rule. |
| `rfq_lines` | `id`, `organization_id`, `rfq_id`, `source_row_number`, `raw_description`, raw parsed fields JSON, `normalized_description`, normalized `quantity NUMERIC`, `unit`, `specification_json`, `match_status`, `selected_product_id NULL`, `decision_reason`, `decision_by`, `decision_at`, `version`, timestamps. Unique source row within RFQ; preserve original raw text. |
| `rfq_match_candidates` | `id`, `organization_id`, `rfq_line_id`, `product_id`, `rank`, `match_method`, `score NUMERIC NULL`, `explanation_json`, `compatibility_flags`, `matcher_version`, `candidate_set_version`, `created_at`. Persist explanations and rejected/hard-incompatible reasons where useful; never call the score a probability unless calibrated as one. |
| `quotes` | `id`, `organization_id`, `quote_number`, `account_id`, `opportunity_id`, optional `rfq_id`, `current_revision_id NULL`, `current_version`, `status`, `created_by`, `owner_user_id`, timestamps, `valid_until DATE`, unique quote number per organization. |
| `quote_revisions` | `id`, `organization_id`, `quote_id`, `revision_number`, `parent_revision_id NULL`, `currency`, `snapshot_json` or normalized revision-level columns, `calculation_snapshot_json`, `calculator_version`, `input_fingerprint`, `created_by`, `created_at`, `commit_reason`, `is_committed`. Unique `(quote_id,revision_number)`; committed revisions are immutable. |
| `quote_revision_lines` | `id`, `organization_id`, `revision_id`, optional source `rfq_line_id`, optional source catalog product ID, product/SKU/specification snapshot, quantity/unit/unit price/discount/tax/cost snapshot with `NUMERIC`, line calculation snapshot, stable line ordering. No cascade deletion of historical revision lines. |
| `quote_change_proposals` | `id`, `organization_id`, `quote_id`, `base_revision_id`, `base_version`, `status`, `proposer_user_id`, optional `reviewer_user_id`, reason, reviewer comment, `proposed_changes_json`, before/after calculation snapshots, submitted/decided/committed times, `idempotency_key`, resulting revision ID. Unique idempotency scope; proposal edits after submission disallowed. |
| `quote_proposal_changes` | Optional normalized child table for individual proposal operations: ID, proposal ID, operation order/type, target key/line, old/new values JSON, reason. Use this table when it improves queryability; if JSON is chosen for operations, validate it against strict versioned Pydantic schemas. |
| `quote_approval_decisions` | `id`, `organization_id`, `quote_id`, proposal ID, exact base revision ID, reviewer ID, decision (`approved`/`rejected`), comment, policy-check snapshot, `decided_at`, created revision ID nullable. Append-only decision history. |
| `export_events` | `id`, `organization_id`, `actor_user_id`, entity type/ID, revision ID, format, result, request ID, timestamp, safe failure code, optional file hash. No raw token or full private document body. |
| `audit_events` | `id`, `organization_id`, actor ID nullable (system actions supported), action, entity type/ID, event time, request ID, safe before/after snapshot, reason and metadata JSON. Append-only to application roles. |

## 10.2 Constraints and indexing

- Use PostgreSQL `NUMERIC(p,s)` (choose and document sufficient precision per field) for currency/decimal quantity/rates where precision matters. Never use `REAL`/`DOUBLE PRECISION` for money.
- Foreign keys must prevent orphaned parent relationships. Prefer non-cascading delete on quotes, revisions, proposals, audit events and RFQ decisions; archived entities preserve history.
- Add indexes for organization-scoped list queries, e.g. `(organization_id, updated_at)`, status/date lookups, owner/assignee, quote number, SKU, RFQ parent and proposal status. Use unique constraints as the final defense for identifiers/idempotency.
- Use check constraints for nonnegative quantities/prices, percentage bounds, enumerated states where practical, positive revision numbers and valid version increments.
- Cross-table tenant consistency must be enforced through service validation and, where it can be safely represented, composite foreign keys that include `organization_id`. Never trust only the route path to establish a tenant.
- A quote's current revision pointer must refer to one revision of that same quote. Enforce transactionally; do not point to a revision from a different quote.
- Use transactions to persist business state and associated audit/activity events together where event completeness is required. A failed business mutation must not leave a success audit event.
- Migrations are forward-only for normal development. Never run an automated destructive database reset against production. `reset-db` must refuse unless environment is explicitly development/test.

## 10.3 Retention and synthetic data

Only seeded synthetic contacts, supplier accounts and catalog products are included. Do not use real customer names, real email inboxes, production catalogs or copyrighted customer documents in screenshots/demo seeds. Seed contact addresses use reserved `.example` domains. Demo data and benchmark results must be labeled synthetic in documentation and the demo UI.

---

# 11. API surface (required MVP contract)

This is the minimum REST capability set. The implementation may add routes only when necessary and documented. Exact request/response fields must be defined with Pydantic schemas and appear in generated OpenAPI. Endpoints below are relative to `/api/v1`.

## 11.1 Authentication and session

- `POST /auth/login` — verify credentials, create opaque session, set secure `HttpOnly` cookie, rotate CSRF token according to chosen double-submit/synchronizer implementation; return safe user/membership profile.
- `POST /auth/logout` — revoke current session and expire cookie.
- `GET /auth/me` — current user and active organization/role, no secrets.
- `POST /auth/switch-organization` — only if the user belongs to multiple organizations; revalidate membership, rotate session/CSRF as specified.
- `POST /auth/change-password` — authenticated user only; require current password and policy validation; revoke other sessions where feasible.

## 11.2 Overview and operational queries

- `GET /dashboard/summary?from=YYYY-MM-DD&to=YYYY-MM-DD` — role-safe, defined metrics.
- `GET /dashboard/attention` — overdue tasks, RFQ blockers, approval tasks and expiring quotes with pagination.
- `GET /activity` — paginated organization-scoped activity filters.
- `GET /audit-events` — authorized manager/admin audit filters and safe snapshots.

## 11.3 CRM entities

- `GET /accounts`, `POST /accounts`, `GET /accounts/{account_id}`, `PATCH /accounts/{account_id}`, `POST /accounts/{account_id}/archive`.
- `GET /accounts/{account_id}/contacts`, `POST /accounts/{account_id}/contacts`, `PATCH /contacts/{contact_id}`, `POST /contacts/{contact_id}/archive`.
- `GET /opportunities`, `POST /opportunities`, `GET /opportunities/{opportunity_id}`, `PATCH /opportunities/{opportunity_id}`, `POST /opportunities/{opportunity_id}/stage`.
- `GET /tasks`, `POST /tasks`, `GET /tasks/{task_id}`, `PATCH /tasks/{task_id}`, `POST /tasks/{task_id}/complete`, `POST /tasks/{task_id}/reopen`.
- `GET /accounts/{id}/timeline`, `GET /opportunities/{id}/timeline`.

## 11.4 Catalog

- `GET /catalog/products` — paginated text/SKU/category/manufacturer/active filters.
- `POST /catalog/products`, `GET /catalog/products/{product_id}`, `PATCH /catalog/products/{product_id}`, `POST /catalog/products/{product_id}/archive`.
- `GET /catalog/products/{product_id}/aliases`, `POST /catalog/products/{product_id}/aliases`, `DELETE /catalog/aliases/{alias_id}` where not relied upon by audit/history.
- `POST /catalog/import` — optional CSV import using the same defensive parsing limits; errors are row-based and actionable. This is lower priority than core RFQ import but expected for a credible reusable product if the main flow is complete.

## 11.5 RFQ workflow

- `GET /rfqs`, `POST /rfqs/import` (multipart CSV plus account/opportunity context), `GET /rfqs/{rfq_id}`, `GET /rfqs/{rfq_id}/lines`.
- `GET /rfqs/{rfq_id}/lines/{line_id}` — line detail plus current candidates and decision history.
- `POST /rfqs/{rfq_id}/lines/{line_id}/decision` — accept candidate, choose product, mark unmatched or request a safe re-match; expected version required.
- `POST /rfqs/{rfq_id}/lines/bulk-decision` — only eligible exact-match lines; atomic or explicitly designed per-item response. MVP default is atomic all-or-nothing.
- `POST /rfqs/{rfq_id}/rematch` — catalog manager/admin only; preserves manual decisions unless an explicit `clear_manual_decisions=true` option is authorized and confirmed.
- `GET /rfqs/{rfq_id}/export.csv` — permitted CSV format only, scope and cell neutralization checks.
- `POST /rfqs/{rfq_id}/create-quote` — create a quote draft only if blocking lines are zero; include expected RFQ version and source snapshots.

CSV import schema is described in section 6.6. Server must reject a file exceeding configured byte/row limits before expensive processing. A malicious/invalid row produces a clear row error and does not silently become an accepted line.

## 11.6 Quote and proposal workflow

- `GET /quotes`, `POST /quotes` (manual quote creation is allowed only from authorized product lines), `GET /quotes/{quote_id}`, `GET /quotes/{quote_id}/revisions`, `GET /quotes/{quote_id}/revisions/{revision_id}`.
- `PATCH /quotes/{quote_id}/draft` — update an editable draft only with expected version; if there is an existing committed quote, changes should normally go via proposal workflow.
- `POST /quotes/{quote_id}/proposals` — create proposal against current revision, with idempotency key and allowed operations.
- `GET /quotes/{quote_id}/proposals`, `GET /proposals/{proposal_id}`.
- `PATCH /proposals/{proposal_id}` — edit only while proposal is `draft`; submitting changes invalidates any prior decision.
- `POST /proposals/{proposal_id}/submit` — validate policy and freeze proposal operations/base revision.
- `POST /proposals/{proposal_id}/approve` — authorized manager; maker-checker and exact revision validation.
- `POST /proposals/{proposal_id}/reject` — authorized manager; comment/reason required.
- `POST /proposals/{proposal_id}/commit` — permitted state only; transactional revision creation and concurrency check; idempotent retry semantics.
- `POST /quotes/{quote_id}/submit-for-approval` — submit initial quote revision when policy requires review.
- `POST /quotes/{quote_id}/approve-initial` — manager approval for initial quote; enforce separation of duties.
- `POST /quotes/{quote_id}/cancel` — authorized actor and documented state rules.
- `POST /quotes/{quote_id}/mark-sent` — authorized user, requires current approved revision, idempotency and delivery method recorded as `manual_demo`.
- `GET /quotes/{quote_id}/calculation-trace?revision_id=...` — permission-filtered explanation trace.

Every command endpoint must specify authorization, state preconditions, version checks, idempotency needs, side effects and error responses in `docs/API.md`. Do not overload a generic `PATCH` endpoint to perform approvals/commits implicitly.

## 11.7 Approval queue and export

- `GET /approvals?status=pending&...` — role-safe pending review queue.
- `GET /proposals/{proposal_id}/diff` — server-produced before/after structured diff.
- `GET /quotes/{quote_id}/export.pdf?revision_id=...` — final approved export or explicitly watermarked draft preview based on route/policy.
- `GET /quotes/{quote_id}/export.csv?revision_id=...` — customer-safe field set by default.
- `GET /exports/{export_event_id}` — show status/metadata of an existing export event where needed.

## 11.8 Users, settings and audit

- `GET /team`, `POST /team/invitations` only if the invitation workflow is implemented; otherwise seed accounts and admin-create users, but no fake “invite sent” UX.
- `PATCH /team/{membership_id}` — change role/active state, admin-only; audit required and prevent removal/demotion of the last active admin.
- `GET /settings/organization`, `PATCH /settings/organization` — admin-only; validate currency/timezone/thresholds and emit audit event.
- `GET /audit-events` — manager/admin according to declared policy; filter by actor/entity/date/event type.

## 11.9 API contract test

For each implemented route, tests must verify success shape, authentication requirement, authorization, validation failures, tenant isolation, missing record behavior and relevant conflict/idempotency paths. OpenAPI is generated and checked in CI; regenerate TypeScript bindings and fail CI if committed bindings are stale.

# 12. Security, privacy and failure handling

Security is part of the core product behavior. The demo must not teach unsafe patterns or rely on “nobody will guess the URL.” Use the OWASP Application Security Verification Standard as a verification reference for the applicable controls.

## 12.1 Authentication and sessions

- Hash passwords using Argon2id through a maintained password-hashing library. Never log or return passwords or hashes.
- Use random high-entropy opaque session tokens, store only a cryptographic hash of the token in the database and set the browser cookie with `HttpOnly`, `Secure` in HTTPS environments, `SameSite=Lax` or stricter when compatible, and a narrow path/domain.
- Set explicit session expiry and idle-expiry policy, revoke on logout, rotate session identifiers after login and privilege changes, and validate the persisted session on protected API requests.
- Use server-side session validation for every protected operation. Middleware redirects improve navigation but are not authorization.
- Because authentication uses cookies, implement and test CSRF protection for mutating requests (e.g. session-bound anti-CSRF token in a dedicated header plus Origin/Referer validation for same-origin deployment). Do not accept state-changing GET requests.
- Apply rate limits to login and other sensitive endpoints; return a generic login failure that does not reveal whether an email exists. Add minimal temporary lock/backoff after repeated failures without enabling trivial permanent denial of service.
- Demo credentials are permitted only when `DEMO_MODE=true`, and all seeded accounts use a prominently documented shared demo password. Production startup must refuse if demo accounts are enabled or the default/demo secret is still configured.

## 12.2 Authorization and tenant isolation

- Roles: `sales_rep`, `sales_manager`, `catalog_manager`, `admin`.
- Every protected route resolves active user + active organization membership + role, then checks action permissions, record organization and relevant state transition.
- Queries are scoped by `organization_id` at repository/query level. A client-supplied organization ID never grants access.
- A sales rep may access their organization's permitted customer/sales data, create/edit allowed records, process RFQs, draft quotes and propose changes. They cannot change catalog policies, approve their own changes requiring manager approval, read audit data restricted to management, or view unit costs/margins unless an explicit permission is granted.
- A sales manager can access team pipeline, relevant quotes, approval queue, approve/reject proposals from other users and review audit trail as configured. They cannot bypass maker-checker by approving their own proposal.
- A catalog manager can manage products/aliases, inspect matching evidence, rematch RFQs and review catalog-related audit history; no manager approval privilege is implied by the catalog role alone.
- An admin can manage users/roles/organization settings and catalog, but does not bypass proposal approval separation-of-duties or revision safety. Privileged actions are audited.
- If a resource does not exist or is outside the user's organization, follow the consistent non-disclosing `404`/`403` policy documented for the endpoint. Never return another tenant's record, counts, names or existence hints.

## 12.3 Input and output safety

- Validate request bodies with Pydantic v2 and explicit lengths/enums/ranges. Limit CSV bytes, rows, columns, field lengths and processing time. Reject malformed encodings and formulas as untrusted text; never execute imported values.
- Prevent CSV formula injection as defined in section 6.11. Escape user content in HTML templates; never inject raw customer fields into PDF HTML without proper escaping. Quote customer content must not become arbitrary HTML/CSS.
- Use parameterized ORM/query expressions; no string-concatenated SQL with user inputs. If any raw SQL is required for locking, parameterize it.
- Set suitable request size limits, security headers and strict CORS policy. When deployed same-origin behind a reverse proxy, permit only the configured trusted frontend/origin; never wildcard credentialed CORS.
- Do not expose debug stack traces in deployed environments. Structured logs include request ID and safe route/action metadata; credentials and sensitive document contents are excluded.
- PDF rendering must restrict local file/network access as practical to prevent server-side request forgery or arbitrary file reads. Do not allow untrusted user HTML, remote images or URL-fed CSS to load during PDF rendering.
- Do not store raw uploaded RFQ files indefinitely. For MVP, parse upload in memory/temporary storage with size caps; retain only source hash, safe filename and structured rows unless a separately documented retention need is implemented.

## 12.4 Error handling and recovery

Every mutation has explicit response handling for: offline/network failure, `401` session expiry, `403` permission, `404`, `409` stale version/state, `422` validation, `429` rate limit and unexpected `5xx`.

- On `401`, preserve non-sensitive unsaved form state where feasible, redirect to login and explain the session expired. Never preserve credentials.
- On `409`, do not automatically retry a non-idempotent command; show the current version conflict and offer reload/compare.
- On `422`, map safe field errors to controls and preserve other user input.
- On timeout/connection loss for a mutation, show an uncertain-outcome message and query the operation/resource status or retry with the same idempotency key before repeating side effects.
- Log server exceptions with correlation IDs; return only safe details to the client.
- Handle deleted/archived related records and disabled users without corrupting historical snapshots.

## 12.5 Security verification criteria

- Automated tests attempt cross-tenant ID access for each entity family.
- Authorization tests call restricted endpoints directly, not only through hidden UI.
- CSRF, cookie flags, login rate limit, session revocation and session expiry have tests.
- CSV injection and PDF HTML escaping have malicious-input fixtures.
- Concurrency tests attempt duplicate/stale proposal commits.
- No secrets exist in Git, generated screenshots, fixtures or client bundles. `.env` and local credentials are ignored; only `.env.example` is committed.

---

# 13. Performance, reliability and observability targets

These are project acceptance targets for the seeded demo environment, not externally guaranteed SLAs. Measure on a documented local/deployment machine and report actual results honestly.

- Initial authenticated overview: target p95 API response under 500 ms on seeded local data, excluding cold deployment start and large file processing.
- Normal list/detail API calls: target p95 under 300 ms for 25-row page on seeded dataset, excluding network distance; use measured evidence rather than claim by design.
- CSV import: validate and return clear progress/result for up to the configured default maximum of 5,000 rows and 2 MiB; limits must be configurable and enforced before heavy processing. Do not hold a long transaction while parsing every line.
- RFQ review action: preserve scroll/focus; show pending feedback immediately and reconcile to authoritative response. No mutation should block the entire workspace unnecessarily.
- A normal navigation or row mutation must not rerender an unrelated, large RFQ dataset without cause. Profile before adding memoization or virtualization.
- Avoid uncontrolled request waterfalls. TanStack Query stale time and invalidation rules should be explicit per feature; mutation responses should update/invalidate related account/opportunity/RFQ/quote/approval/dashboard keys.
- Backend `/health/live` only indicates process liveness; `/health/ready` checks database readiness without exposing credentials. Public health response contains no environment variables or connection strings.
- Use standard Python logging with JSON-like structured fields in deployed environments: timestamp, level, request_id, route/operation, actor ID if safe, duration and status. Never log full session cookies, user tokens, passwords or whole uploaded documents.
- Add frontend error boundary and a user-friendly unexpected error screen; do not show source stack traces.
- Add a simple readiness/deployment smoke-test script for login, authenticated summary, DB migration status and quotation PDF generation.

If a performance target cannot be reached, document the measured result, bottleneck and next optimization. Do not falsify values or introduce Redis/queues merely to match a target for this MVP.

---

# 14. Testing and quality engineering

The product is not complete if only the happy-path UI works. Test deterministic domain behavior, database transactions, permissions, conflicts, generated documents and the real user workflows.

## 14.1 Required tooling

### Backend

- Python 3.12.
- `uv` for reproducible dependency management; commit `uv.lock`.
- FastAPI, Pydantic v2, SQLAlchemy 2.0, psycopg 3 and Alembic.
- `pytest`, `httpx`, `ruff` for lint/format, and type checking via `mypy` or `pyright` if adopted consistently. Pick one type checker and configure it in CI.
- Isolated test database; tests must fail closed if `TEST_DATABASE_URL` points at the non-test/application DB.

### Frontend

- Node.js 22 LTS (pin/declare the supported major), `pnpm` with one exact version committed via `packageManager` field and lockfile.
- TypeScript strict mode, ESLint with Next.js rules, Prettier (or one consistent formatter, not competing formatters).
- Vitest, React Testing Library, `user-event`, Playwright and `@axe-core/playwright`.

## 14.2 Domain unit tests

Required tests for RFQ logic:

- Unicode NFKC and punctuation/case/whitespace normalization.
- Unit normalization and supported conversions; refuse unknown or incompatible units.
- Quantity and specification parsing, including fractions and malformed/ambiguous values.
- Exact SKU, alias match, compatible attribute match, hard incompatibility and unmatched cases.
- Explicit safe abstention where there is insufficient evidence.
- Deterministic output for identical input/catalog/version.
- Candidate explanation corresponds to the actual rule path; do not describe a failed compatibility check as a safe match.
- CSV parser row-level failures, duplicate SKU/reference conditions, empty file and malicious cells.

Required tests for quotation/proposal logic:

- Rounding and Decimal precision boundaries; no binary float money.
- Discounts/tax/line total and aggregate total match published formulas.
- Missing/zero taxable total produces a `null` margin instead of divide-by-zero.
- Catalog price changes do not alter existing revision snapshots.
- Every allowed proposal operation; rejection of unknown fields/opcodes/unauthorized updates.
- Before/after diff stable ordering and accurate values.
- Approval policy edge cases at exact threshold and just above/below threshold.
- Maker-checker and role rules.
- Stale base revision, duplicate idempotency key, changed payload on same key and failed transaction rollback.
- Audit event emitted for successful sensitive mutation and not emitted as a success when transaction fails.
- CSV formula neutralization and PDF escape/render fixtures.

Coverage target: at least 85% line coverage for pure domain modules, with decision/branch coverage focused on safety invariants. Coverage percentage is not a substitute for required edge-case tests.

## 14.3 API/database integration tests

Test each endpoint's success and failure contracts, all role restrictions, tenant scoping, transaction rollback, uniqueness constraints, SQL `NUMERIC` round-trips, pagination validation, archive/historical relations, optimistic concurrency and migration from an empty DB. Run integration tests against a real PostgreSQL instance rather than assuming SQLite has equivalent transaction/locking semantics.

Coverage target: at least 70% overall backend line coverage in addition to the explicit domain/security checklist.

## 14.4 Frontend component tests

- Forms show field-level errors and preserve input after invalid submission.
- `StatusBadge` labels/icons/colors agree with shared status mapping.
- Tables support sorting/filtering/selection and readable empty/error/loading states.
- Dialog/sheet focus is trapped/restored and Escape behavior is correct.
- RFQ row resolution updates the correct row and does not steal focus.
- Quote preview/diff labels increases/decreases and formats currency/date consistently.
- Permission-restricted actions are hidden/disabled with clear explanation, while server authorization remains independently tested.
- Reduced-motion preference removes nonessential transitions.

## 14.5 Required Playwright end-to-end scenarios

1. **Fresh demo sign-in:** log in as sales rep; confirm role-correct sidebar and overview values.
2. **CRM workflow:** create account, contact, opportunity and task; reload and verify data persisted.
3. **RFQ happy path:** import a valid synthetic CSV, inspect normalized lines, accept exact matches, manually resolve one ambiguous row, mark an unmatched row with reason, and confirm quote creation remains blocked until blocking lines are resolved according to policy.
4. **Quotation path:** create quote from resolved RFQ, inspect calculations, save a draft, refresh, and confirm totals/revision state are persisted.
5. **Maker-checker flow:** sales rep proposes a discount; same sales rep cannot approve it; manager sees the proposal, reviews diff/policy and approves/commits; verify a new immutable revision and matching total.
6. **Concurrency conflict:** create proposal against revision N; commit another update to revision N+1; attempt old proposal commit; receive `409`, no duplicate revision, no successful approval and visible conflict/reload action.
7. **Export guard:** draft final-export request is rejected; after approved commit, download PDF; extract/inspect text in test to ensure amounts are correct and internal margin does not appear. Verify CSV injection payloads are neutralized.
8. **Tenant isolation:** user in organization A cannot read/mutate organization B resources even if a valid UUID is injected in URL/body.
9. **Permission check:** sales rep attempts manager approval endpoint directly and is rejected.
10. **Accessibility critical path:** login, RFQ review, proposal comparison and approval workflow keyboard operation + axe check.
11. **Responsive QA:** capture screenshots at 1440×900, 1024×768 and 390×844 for key pages, verify no document horizontal overflow and all main actions accessible.
12. **Network/error states:** simulate `422`, `409`, `401` and a recoverable network failure; ensure useful messages and no falsely successful toast.

## 14.6 CI and command contract

A pull request/merge to the default branch must run formatting, lint, type checks, unit tests, backend integration tests against PostgreSQL, frontend component tests, build and a focused Playwright workflow. If CI resources require separating fast PR checks from nightly/full browser checks, all required safety/concurrency and one core end-to-end path must still block merges.

Create these root Makefile commands with consistent behavior:

- `make up` — start local database and services; apply migrations safely; seed only when explicitly configured or database is fresh.
- `make down` — stop services, preserve database volume.
- `make seed` — idempotently seed synthetic development/demo data.
- `make reset-db` — destructive reset only when `APP_ENV` is `development` or `test`; fail closed otherwise.
- `make lint` — Python Ruff plus frontend lint.
- `make typecheck` — TypeScript and configured Python type checker.
- `make test` — backend unit/integration and frontend unit tests.
- `make test-e2e` — Playwright core paths.
- `make build` — production frontend/backend image build.
- `make check` — run every required local quality gate in deterministic order.

Document required environment variables and expected output for each command. No command may report success when a dependency/test stage failed.

# 15. Seed data and guided demonstration

The demo must feel like an actual business workspace from first sign-in. Do not seed disconnected random numbers simply to fill cards. Seed entities must relate to one another and reproduce the complete demo journey.

## 15.1 Demo organization

- Organization: `ForgeFlow Demo Manufacturing`.
- Slug: `forgeflow-demo`.
- Currency: INR.
- Timezone: `Asia/Kolkata`.
- Organization data is explicitly synthetic and is intended to be disposable.
- Demo mode is enabled only with `DEMO_MODE=true` and is disabled by default in production.

## 15.2 Required demo accounts

Create at least four active users, one per role, with stable documented demo email addresses under a reserved `.example` domain, for example:

- `sales.rep@forgeflow.example` — `sales_rep`.
- `sales.manager@forgeflow.example` — `sales_manager`.
- `catalog.manager@forgeflow.example` — `catalog_manager`.
- `admin@forgeflow.example` — `admin`.

When and only when demo mode is enabled, seed the documented shared password `ForgeFlowDemo!2026`. Show a visible demo-credentials panel on the login page only in demo mode, and state that these credentials are not for production. Never render the credentials into production bundles or production logs. Production must require a non-demo admin setup path and strong secret values.

## 15.3 Required coherent records

Seed:

- 8–12 synthetic industrial customer accounts across plausible supplier/buyer categories.
- 12–20 synthetic contacts linked to those accounts with reserved `.example` emails.
- 8–12 opportunities across discovery, qualification, proposal, negotiation, won and lost states; open amounts and close dates must be coherent with stages.
- 15–25 tasks including upcoming and overdue examples, assigned to role-appropriate users and linked to real seeded accounts/opportunities.
- Approximately 100 synthetic catalog products covering pipes, fittings, fasteners, valves, seals and consumables, with SKUs, units, attributes, aliases and intentionally similar but incompatible examples.
- At least three RFQs: one primarily exact-match, one containing safe suggestions/ambiguous candidates and one with unmatched or invalid rows that demonstrates quote blocking.
- At least three quotes: one draft, one awaiting approval and one approved/sent historical flow where every total is consistent with the quote calculation engine.
- At least one pending discount proposal, one rejected/stale proposal, one committed proposal with revision history, and at least one conflict scenario that can be demonstrated without damaging shared baseline data.
- Activity and audit events produced by seed/setup scripts so the timeline and review histories look plausible.

Seeds are deterministic and idempotent. Do not duplicate rows each time `make seed` runs. Keep predictable fixture references for E2E tests. Provide a demo reset procedure that only resets the demo/development database and makes its destructive nature clear.

## 15.4 Sample RFQ data

Ship a clearly labeled synthetic CSV such as `fixtures/demo-rfq-ambiguous.csv` with documented headers and rows. Include normal cases (SKU/alias exact match), noncritical formatting variance, unit conversion supported by the domain, an ambiguous or insufficient-specification case requiring review, a hard-incompatible case that must not be confidently proposed, a catalog miss and at least one invalid row for the import validation UI. The sample should not include a real company's quotation or catalog. Tests and README must not present frozen synthetic benchmark metrics as production accuracy claims.

## 15.5 Guided demo mode and talk track

Provide a compact “Demo path” help/guide reachable from the user menu or dashboard. It should link to actual seeded records:

1. Open a named seeded opportunity.
2. Open its linked RFQ and inspect a raw description versus normalized fields.
3. Resolve one ambiguous line and observe the audit history.
4. Create/open a quotation and inspect line totals and calculation trace.
5. Propose a discount as sales rep; explain that the original quote remains unchanged.
6. Switch to the manager account, review the exact diff and approval policy, and approve/commit the change.
7. Download the approved PDF, then demonstrate the stale-proposal conflict in an isolated test fixture/resettable scenario.

The product's help content must not claim to be an Auribises deployment, an Auribises client product or production-proven software.

---

# 16. Local development, configuration and deployment

## 16.1 Runtime and package management

- Frontend: Node.js 22 LTS, pnpm pinned to a specific package-manager version in `frontend/package.json`, committed `pnpm-lock.yaml`.
- Backend: Python 3.12, `uv` with committed `uv.lock`.
- Database: PostgreSQL 16 (same major locally and in deployed demo unless a documented compatibility reason exists).
- Local environment: Docker Engine with Docker Compose v2.
- Build in reproducible containers. Do not require a developer to install global Node packages or global Python dependencies.
- Pin dependencies through lockfiles. Use compatible stable patch releases at implementation time; the PRD names library families and required major compatibility, while the lockfile is the exact installed-version source of truth.

## 16.2 Environment variables

Commit only `.env.example` with descriptions and non-secret local placeholders. Required variables include:

```dotenv
APP_ENV=development
DEMO_MODE=true
APP_SECRET_KEY=replace-with-a-long-random-local-secret
DATABASE_URL=postgresql+psycopg://forgeflow:forgeflow_dev@db:5432/forgeflow
FRONTEND_ORIGIN=http://localhost:3000
SESSION_COOKIE_NAME=forgeflow_session
SESSION_TTL_HOURS=12
SESSION_IDLE_TTL_MINUTES=60
CSRF_COOKIE_NAME=forgeflow_csrf
LOG_LEVEL=INFO
MAX_CSV_BYTES=2097152
MAX_CSV_ROWS=5000
```

The application must validate configuration at startup. In production, `APP_SECRET_KEY` must be strong and non-default, `DEMO_MODE` must be false, HTTPS cookie settings must be enforced and debug/reload must be disabled. Fail fast with a safe actionable configuration message if required settings are invalid. Do not expose config values through a public API.

The exact local DB username/password in the example are development-only and must never be reused in public deployments. Docker database ports should bind to loopback locally by default; only the reverse proxy's HTTP/HTTPS ports are exposed in a public deployment.

## 16.3 Docker Compose services

At minimum define:

- `db`: PostgreSQL with persistent local volume, healthcheck, non-superuser application credentials and no public bind by default.
- `backend`: FastAPI served by Uvicorn; waits for DB health, runs migrations using an explicit one-shot or startup migration step, starts only once DB is ready.
- `frontend`: production-capable Next.js build/serve configuration; dev command may be supplied separately for local development.
- Optional `proxy`: Caddy or the deployment platform's supported reverse proxy, configured for TLS and same-origin API routing in deployed environments.

Do not run multiple competing Alembic migrations concurrently from every worker replica. Use a dedicated deployment migration step/job or a single controlled startup migration gate. Migrations must finish successfully before new application version receives traffic.

## 16.4 Routing and deployment shape

Use a single public origin for the demonstration when possible:

- `/` serves the Next.js application.
- `/api/v1/*` routes to FastAPI.
- `/health/live` and `/health/ready` expose safe health state according to policy.

Deploy behind HTTPS through a maintained reverse proxy/hosting platform such as Coolify plus Caddy/Traefik if that is the chosen infrastructure. The app must not depend on an Auribises-owned environment. Only ports 80/443 need to be public for the final demo; Postgres must not be publicly exposed. Configure trusted proxy headers correctly, secure cookies and origin checks. Provide HTTPS throughout; do not publish a production-like login on HTTP.

If a split-origin deployment becomes necessary, specify allowed CORS origins exactly and test credentialed requests and CSRF protections. Same-origin is preferred for simplicity and safety.

## 16.5 Release procedure

1. Build frontend and backend images from a clean checkout.
2. Run all CI checks and ensure lockfiles are current.
3. Validate deployment environment variables and secrets.
4. Back up the database before destructive or schema-affecting release procedures.
5. Run migrations in the controlled migration step.
6. Start services and verify liveness/readiness, login, dashboard, catalog query, one RFQ action, proposal conflict protection and PDF output.
7. Run a seeded synthetic demo smoke test; do not use production-real data.
8. Confirm no stack traces or secrets appear in browser logs, API responses or deployment output.
9. Record deployment URL, release commit, migration revision, smoke-test outcome and known limitations in `docs/deployment-report.md` or README.

## 16.6 Backup and reset rules

- Document a PostgreSQL backup and restore command for the target demo hosting setup.
- Reset/seed functionality is development/demo-only. It must inspect `APP_ENV` and fail closed when that is not an allowed environment.
- Do not automatically delete a database or volume as a side effect of `make down` or deployment.
- Document safe rollback expectations if a migration is not backward-compatible. Do not claim a migration can be rolled back unless a reverse migration and data implications are tested.

---

# 17. Implementation plan and delivery phases

The coding agent must complete phases in order, keep `PRD.md` updated only through explicit decision records, and run the appropriate tests after every phase. Do not start with a decorative dashboard and postpone domain foundations until late.

## Phase 0 — repository inspection and architecture baseline

**Tasks**
- Inspect RFQ Normalizer and Model Change Review Lab repositories and actual tree/dependencies.
- Run existing tests/builds. Record current baseline and any failing tests before copying/adapting logic.
- Review license/provenance constraints before copying code.
- Scaffold the ForgeFlow monorepo and pin Node/pnpm/Python/uv/PostgreSQL versions as specified.
- Configure lint/typecheck/test commands, pre-commit/CI checks and `.env.example`.
- Write architecture decision record for module reuse, shared invariants, session/CSRF design and deployment path.

**Exit criteria**
- Clean clone can build/start a minimal frontend, API and DB.
- CI can migrate a fresh PostgreSQL DB and run a trivial health test.
- Existing source tests are documented; no baseline failure is misrepresented as a ForgeFlow regression or success.

## Phase 1 — design system and authenticated application shell

**Tasks**
- Implement tokens, typography, light/dark themes, responsive shell, sidebar, header, buttons, inputs, table primitives, dialog/sheet, status badges, loading/empty/error states and toast behavior.
- Build login screen and role-aware workspace navigation.
- Implement safe session cookie, CSRF guard, login throttling, logout, expiry and `GET /auth/me`.
- Add role/permission helpers in backend and direct endpoint authorization tests.
- Create a consistent sample landing/overview shell with no fake live metrics.

**Exit criteria**
- Four seeded roles can sign in and see appropriate navigation.
- Protected API calls fail without valid session, expired sessions revoke correctly, and CSRF tests pass.
- Key screens meet keyboard/focus and responsive shell acceptance criteria.

## Phase 2 — CRM, catalog and seeded operational data

**Tasks**
- Implement organizations/memberships (minimal fixed organization demo), accounts, contacts, opportunities, tasks, activity stream and catalog CRUD/archive/search.
- Implement DB migrations, repositories and Pydantic request/response contracts.
- Add deterministic seeded synthetic records.
- Build overview metrics from real persisted records.
- Add search/filter/pagination patterns and actionable empty states.

**Exit criteria**
- CRM CRUD persists and reloads correctly; archive does not destroy related history.
- Role checks, validation, tenant isolation and dashboard metric tests pass.
- No fake buttons; every displayed control either works or is explicitly absent.

## Phase 3 — RFQ ingestion and signature review studio

**Tasks**
- Adapt reviewed RFQ normalization/matching domain logic.
- Implement CSV parser and safety/size limits, import reports, RFQ/RFQ line persistence, candidate snapshots, safe decisions and decision history.
- Build signature RFQ workbench with table, selected-line inspector, raw-versus-normalized comparison, compatibility explanation, keyboard controls and responsive line cards.
- Implement expected-version mutation, atomic bulk exact-match acceptance and stale conflict UX.
- Add rule-driven quote-creation gate.

**Exit criteria**
- Synthetic RFQ path works end-to-end; unresolved/hard-incompatible lines cannot silently progress.
- Determinism, parsing, permission and concurrency tests pass.
- Desktop, tablet and mobile review screen is visually verified.

## Phase 4 — quote engine, quote builder and calculation trace

**Tasks**
- Implement Decimal calculator with explicit rounding and calculation snapshots.
- Create immutable quote revisions and quote line snapshots.
- Build quote builder, totals panel, customer-facing preview and calculation inspector.
- Implement approval threshold/policy checks and role-safe margin visibility.
- Add unit tests for every formula, boundary and precision rule.

**Exit criteria**
- Server result is authoritative; client calculations are only previews.
- Catalog changes cannot change historic quotes; quote PDF preview shows correct values.
- Totals, taxes and roundings pass deterministic fixtures.

## Phase 5 — proposal/review/atomic commit and approvals

**Tasks**
- Implement allowed proposal operations, lifecycle, before/after diff, maker-checker, idempotency and exact base revision/version binding.
- Implement manager queue/review detail screen, reject reason, approval decision, commit transaction and audit entries.
- Add concurrent/stale update integration tests against PostgreSQL.
- Add explicit stale conflict and retry UI.

**Exit criteria**
- Proposal never mutates canonical quote until successful commit.
- Stale/duplicate requests cannot result in silent overwrites or duplicate revisions.
- Unauthorized and self-approval attempts fail at the API.

## Phase 6 — export safety, finishing and end-to-end demo

**Tasks**
- Build versioned WeasyPrint PDF template, CSV exports and guardrails.
- Finish activity/audit views, role-specific dashboard attention lists, settings and all UI states.
- Finish responsive design, reduced motion, accessibility and error handling.
- Add full Playwright paths, axe scans and screenshot captures.
- Add demo guide and walkthrough script.

**Exit criteria**
- The complete 4-minute demo works from a clean seeded DB.
- Final export is guarded and contains no forbidden internal fields.
- Required screenshots, keyboard tests, axe checks and no-overflow checks pass.

## Phase 7 — deployment, documentation and handoff

**Tasks**
- Build production containers and deploy HTTPS app.
- Test fresh migration and seeded demo on deployed environment.
- Verify production mode cannot load shared demo accounts.
- Document architecture, API, setup, demo login, tests, deployment, limitations and measured results.
- Produce concise implementation report with completed/not-completed checklist; do not call incomplete features complete.

**Exit criteria**
- Public demo works; health checks are safe; DB is not publicly exposed.
- Clean-checkout setup is reproducible and tests/README instructions match actual commands.
- Known limitations and current deployed commit are documented honestly.

---

# 18. Release acceptance checklist

A checked item must have observable evidence (automated test, manual test recording, deployed behavior or reviewed artifact). Do not mark an item complete because code exists.

## 18.1 Product workflow

- [ ] Login, logout, session expiry and role-aware navigation work.
- [ ] Sales rep can create/manage permitted accounts, contacts, opportunities and tasks.
- [ ] Opportunity pipeline stages and dashboard counts match persisted records.
- [ ] Catalog can search by SKU/name/alias and shows active/inactive state.
- [ ] CSV RFQ imports validate file/headers/rows and provide actionable errors.
- [ ] Original RFQ text remains visible next to normalized text.
- [ ] Match decisions are explainable and uncertain/hard-incompatible cases require human action.
- [ ] Decisions persist after reload and have actor/time/history.
- [ ] Bulk exact-match action is atomic and version-safe.
- [ ] Quote cannot be created when blocking RFQ lines remain.
- [ ] Quotes snapshot catalog information and preserve committed revisions immutably.
- [ ] Price calculations match Decimal reference fixtures for rounding/discount/tax/line and grand totals.
- [ ] Quote calculation trace shows inputs, rules, intermediate values and rounding.
- [ ] Proposal preview does not mutate committed state.
- [ ] Proposal diff shows exact old/new values and overall financial impact.
- [ ] Maker-checker separation and approval thresholds are enforced server-side.
- [ ] Commit is atomic; stale revisions fail with a clear `409` conflict.
- [ ] Idempotent retry cannot create duplicate quote revisions.
- [ ] Approved export reflects exactly the approved revision and correct totals.
- [ ] Draft/blocked quote cannot be exported as final.
- [ ] CSV formula injection is neutralized without corrupting valid numeric fields.
- [ ] Activity timeline and protected audit trail display actual events.

## 18.2 Design/UX

- [ ] All pages use defined color, typography, spacing, radii and component tokens.
- [ ] Navigation, tables, forms, dialogs, badges, buttons and empty/error states use the shared design system.
- [ ] Dashboard, RFQ workbench, quote editor and approval review are responsive at desktop/tablet/mobile dimensions.
- [ ] RFQ review is the visual signature screen and remains understandable at dense data volume.
- [ ] Motion is purposeful and respects reduced-motion preference.
- [ ] No loading spinner persists indefinitely; network states are represented and recoverable.
- [ ] No primary action is a decorative/nonfunctional mock button.
- [ ] Keyboard users can complete the critical RFQ-to-quote-to-approval workflow.
- [ ] Focus is visible, predictable and restored after dialogs/sheets.
- [ ] Color is never the only state indicator; contrast and labels are checked.
- [ ] No document horizontal overflow at 390px mobile viewport or 200% browser zoom for key flows.
- [ ] Charts have a textual or tabular equivalent and are based on real persisted values.
- [ ] Playwright screenshots of the four signature pages are reviewed at documented breakpoints.

## 18.3 Architecture, quality and operations

- [ ] Clean checkout can start local services using documented commands.
- [ ] DB schema is reproducible from migrations only.
- [ ] Seed command is idempotent and destructive reset refuses production environments.
- [ ] OpenAPI and generated frontend types are synchronized.
- [ ] Backend permissions and tenant isolation are tested at the API/database boundary.
- [ ] Domain unit tests and PostgreSQL integration tests pass.
- [ ] Type checking, lint/format, frontend component tests, critical Playwright flows and production build pass.
- [ ] Logs include safe request IDs and omit credentials/sensitive payloads.
- [ ] Health checks do not disclose secrets.
- [ ] Production deployment uses HTTPS and does not expose PostgreSQL.
- [ ] No demo credential/default secret is enabled in production.
- [ ] PDF export works in the actual deployment image with required renderer/fonts installed.
- [ ] README setup commands match actual behavior; limitations and synthetic-data caveat are clear.
- [ ] Deployment commit/version and smoke-test result are recorded.

## 18.4 Release blocker policy

Any failure involving cross-tenant access, unauthorized approval, stale revision corruption, incorrect quote totals, final export of unapproved data, leaked credentials/internal margin, lost audit history or an unusable critical keyboard workflow is a release blocker. Cosmetic defects may be triaged only if they do not make the main demo confusing, inconsistent or unprofessional.

---

# 19. Required project documentation and implementation handoff

The coding agent must create and keep current the following artifacts alongside the code:

1. **`README.md`:** product overview; key workflow; exact architecture; technology list; prerequisites; local setup; demo accounts (clearly demo-only); seed/reset instructions; commands; screenshots; deployed URL if public; testing; limitations and synthetic-data warning.
2. **`PRD.md`:** this specification, copied verbatim as the canonical project requirement document before development. Update only through documented changes rather than silently changing intent.
3. **`docs/architecture.md`:** component diagram, API/database boundaries, authoritative domain rules and proposal commit sequence.
4. **`docs/API.md`:** implemented endpoint table with payload schemas, permissions, state preconditions, version/idempotency behavior and response/error examples.
5. **`docs/data-dictionary.md`:** table/field descriptions, enums, constraints, retention and indexes.
6. **`docs/security.md`:** authentication/session/CSRF design, role-permission matrix, tenant isolation and production setup requirements.
7. **`docs/test-plan.md`:** test inventory, exact commands, test data, critical invariants and current coverage evidence.
8. **`docs/demo-script.md`:** a 3–4 minute demo flow with exact seeded records/users and reset method.
9. **`docs/deployment-report.md` or README deployment section:** deployment steps, current commit/version, public URL, health/smoke-test results and known limitations.
10. **`docs/architecture-decisions/`:** brief records for major non-obvious choices, especially reuse from existing repos, quote calculation authority, matching thresholds, session/CSRF strategy and concurrency approach.
11. **`IMPLEMENTATION_REPORT.md`:** phase checklist, completed and incomplete requirements, commands actually executed and outcomes, deployed URL/commit, known bugs, measured performance if measured, and the next most important work.

The implementation report must distinguish facts from targets. Do not claim that tests were run unless they were run, or that a public service is live unless it was verified. Do not claim real business impact from synthetic evaluation data.

---

# 20. Definition of done

ForgeFlow is done for the Auribises demonstration only when:

1. The required end-to-end user journey works against a persistent PostgreSQL database from a clean environment.
2. The three product areas are visibly integrated: CRM provides customer/opportunity context, the RFQ engine produces reviewable product lines, and the proposal/revision workflow controls quotation changes.
3. The visual quality gate and accessibility/responsive criteria pass for the dashboard, RFQ review studio, quote editor and approval workspace.
4. Deterministic matching and Decimal pricing behavior are independently unit-tested; database locking, authorization, tenant isolation and atomic revision commit are integration-tested against PostgreSQL.
5. The manager-checker flow is demonstrated with separate seeded identities; stale revision conflict and export gating can be reproduced live.
6. PDF/CSV exports are generated server-side from authoritative persisted state, with customer-safe fields and correct totals.
7. All visible controls on the critical path are functional; loading, validation, empty, error, success and conflict states are implemented.
8. The application is deployed under HTTPS, the database is private, the demo credentials are enabled only for demo mode and smoke checks pass.
9. A clean reader can start the project using README instructions and can understand the architecture from the accompanying docs.
10. The implementation report honestly identifies any deferred requirement and no release-blocking security/data integrity failure remains.

**Delivery priority:** a complete, polished, trustworthy core workflow is more valuable than a larger feature list with inconsistent UI or unsafe state transitions. If schedule pressure requires scope reduction, remove nonessential charts, secondary CRM fields or optional catalog-import extras before compromising RFQ review quality, server-side authorization, deterministic pricing, revision safety, approval controls or export guardrails.

---

# 21. Reference documentation

Use official documentation for implementation details and verify the current compatible version when setting up lockfiles. This list defines preferred libraries, not a requirement to upgrade automatically to an incompatible major version.

## Product context and source repositories

- Auribises official website: https://auribises.com/
- RFQ Line-Item Normalizer repository: https://github.com/Satjeet2005/RFQ-line-item-normalizer
- RFQ Normalizer PRD: https://github.com/Satjeet2005/RFQ-line-item-normalizer/blob/main/PRD.md
- RFQ Normalizer acceptance checklist: https://github.com/Satjeet2005/RFQ-line-item-normalizer/blob/main/PRD_ACCEPTANCE_CHECKLIST.md
- Model Change Review Lab repository: https://github.com/Satjeet2005/model-change-review-lab
- Model Change Review Lab architecture/README: https://github.com/Satjeet2005/model-change-review-lab/blob/master/README.md

## Frontend, design and interaction

- Next.js App Router: https://nextjs.org/docs/app
- Tailwind CSS: https://tailwindcss.com/docs
- shadcn/ui: https://ui.shadcn.com/docs
- Base UI: https://base-ui.com/
- Motion for React: https://motion.dev/docs/react
- Motion reduced-motion guidance: https://motion.dev/docs/react-use-reduced-motion
- Lucide React: https://lucide.dev/guide/react/
- TanStack Query: https://tanstack.com/query/latest/docs/framework/react/overview
- TanStack Table: https://tanstack.com/table/latest/docs/introduction
- TanStack Virtual: https://tanstack.com/virtual/latest/docs/introduction
- React Hook Form: https://react-hook-form.com/
- Zod: https://zod.dev/
- Recharts: https://recharts.org/en-US/
- Sonner: https://sonner.emilkowal.ski/
- date-fns: https://date-fns.org/
- react-dropzone: https://react-dropzone.js.org/
- Geist font: https://vercel.com/font

## Backend, database and exports

- FastAPI: https://fastapi.tiangolo.com/tutorial/
- Pydantic: https://docs.pydantic.dev/latest/
- SQLAlchemy ORM: https://docs.sqlalchemy.org/en/20/orm/
- PostgreSQL transaction isolation: https://www.postgresql.org/docs/current/transaction-iso.html
- PostgreSQL constraints: https://www.postgresql.org/docs/current/ddl-constraints.html
- Alembic: https://alembic.sqlalchemy.org/en/latest/
- WeasyPrint: https://doc.courtbouillon.org/weasyprint/stable/
- openapi-typescript: https://openapi-ts.dev/

## Testing, accessibility and security

- Vitest: https://vitest.dev/guide/
- React Testing Library: https://testing-library.com/docs/react-testing-library/intro/
- Playwright: https://playwright.dev/docs/intro
- axe-core: https://github.com/dequelabs/axe-core
- WCAG 2.2 quick reference: https://www.w3.org/WAI/WCAG22/quickref/
- OWASP Application Security Verification Standard: https://asvs.owasp.org/
- OWASP Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- OWASP Cross-Site Request Forgery Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- OWASP CSV Injection: https://owasp.org/www-community/attacks/CSV_Injection

---

**End of canonical PRD.** Any implementation deviation must be recorded explicitly in the architecture/implementation report with the reason, impact and test evidence.
