# ForgeFlow — Phase 2 Coding Agent Prompt

**Assignment:** Implement Phase 2 only: CRM, Catalog, Seeded Operational Data, and real dashboard metrics.  
**Source of truth:** repository-root `PRD.md`, especially Sections 6.2–6.5, 8, 9, 10.1, 11.2–11.4, 14, 15.2–15.3, and the Phase 2 roadmap.  
**Handoff input:** read the latest foundation agent handoff/report before coding.  
**Expected agent level:** medium-reasoning coding agent; decisions and acceptance criteria below are intentionally explicit.

---

## 1. Mission and scope boundary

You are the **Phase 2 Implementation Agent** for ForgeFlow. Phase 0 and Phase 1 have reportedly been completed: the monolith scaffold, PostgreSQL 16, Alembic foundation migration, secure cookie sessions, CSRF protection, login throttling, RBAC helpers, design tokens, shared UI primitives, responsive shell, OpenAPI type generation and quality gates exist. **Verify the actual repository state yourself before relying on any of these claims.** Do not represent inherited claims as independently verified until commands have been run.

Implement the following connected product slice:

1. Accounts and contacts management.
2. Opportunities and pipeline management.
3. Tasks and activity timeline.
4. Industrial catalog and catalog aliases.
5. Deterministic synthetic CRM/catalog seed data.
6. Real backend-backed dashboard summary and attention queue.
7. Responsive, polished frontend pages for these modules, wired to real API data.
8. Tests, generated API types, documentation and quality verification.

### Explicitly out of scope

Do **not** implement RFQ import/normalization/matching (Phase 3), quotes/pricing calculations (Phase 4), quote proposals/approvals (Phase 5), final exports or later phases. Do not add database tables or fake behavior for future RFQ/quote flows merely to fill the UI. Prepare clean integration seams for those phases.

Do not replace authentication, rewrite the design system, change the primary stack, introduce microservices, add Redis/Kafka/Kubernetes, call external paid APIs, introduce LLM behavior, or change unrelated modules.

### Files/components that must not be modified

Do not modify these existing files as part of Phase 2 unless a build defect makes a change strictly unavoidable. If a blocker is found, explain it, make the smallest compatible change, add a test, and document it in `docs/agent-handoff.md`:

- `backend/app/auth/session.py` — session-token hashing/lifetime/revocation.
- `backend/app/auth/passwords.py` — Argon2id password behavior.
- `backend/app/auth/csrf.py` — CSRF and origin validation.
- `frontend/lib/api/client.ts` — shared fetch wrapper and automatic CSRF handling.
- `frontend/app/globals.css` (or the actual equivalent token file) — PRD-pinned light/dark design tokens.
- `PRD.md` — immutable product requirements.

Preserve the existing package-manager lockfiles, app shell, shared UI components, route guards, feature registry structure and test-database safety guards. Do not rename routes or refactor the app shell just for preference.

---

## 2. Mandatory discovery before implementation

Do this first, in this order:

1. Inspect `git status`, active branch, top-level directory, actual route tree, existing migrations, SQLAlchemy Base/model registration, app router inclusion, config names, permission helpers, shared response/error contracts, seed scripts and existing tests. Never overwrite user changes or assume path names from this prompt are exact without checking the repository.
2. Read all of `PRD.md`, then read `docs/agent-handoff.md` and `docs/architecture.md` if they exist. Read the foundation agent's final report in full.
3. Run the current clean baseline commands in the repo (at minimum `make check` and `make test-e2e`, plus any documented migration/integration command). Record the exact baseline results. If a command fails before your changes, keep the evidence and distinguish it from regressions you introduce.
4. Inspect `backend/app/auth/rbac.py`, `backend/app/api/v1/router.py` (or current router assembly), base model/mixin conventions, API error handling, `frontend/lib/api/client.ts`, generated `frontend/lib/api/schema.d.ts`, TanStack Query setup, `feature-registry.ts`, and shared UI components. Extend existing patterns; do not build parallel implementations.
5. Review existing `demo_seed.py` and the current role identities/organization fixture. Preserve the four existing demo login accounts and password convention; do not invent a second seed path or hard-code demo credentials into production code.
6. Document any real contradiction between the PRD and this phase handoff in `docs/architecture-decisions/` before implementing the disputed schema. Use the explicit resolutions in Section 4 of this prompt rather than asking routine questions.

Do not start Phase 3 work while doing discovery.

---

## 3. Required implementation order

Follow this exact sequence and keep the app runnable after each logical step:

1. Resolve and record the schema naming decisions below in ADRs.
2. Add the Phase 2 SQLAlchemy models, migration, constraints and indexes.
3. Add organization-scoped repositories/services and Pydantic v2 schemas.
4. Add API endpoints, server-side authorization, audit/activity events and tests.
5. Expand idempotent synthetic seed data and validate dashboard queries against it.
6. Generate the OpenAPI frontend contract using the repository's actual documented command (the handoff expects `make openapi-generate`).
7. Implement frontend feature pages with the existing design system and shared API hooks.
8. Connect dashboard summary and attention queue to API data; remove placeholder metrics.
9. Enable feature navigation only after each page and its permissions are truly working.
10. Run all checks, test E2E paths at the required viewport sizes, fix regressions, and update documentation/handoff.

Never stop at scaffolding, model definitions without routes, API-only CRUD, or static mock pages. Every in-scope UI action shown must work end to end or not be shown.

---

## 4. Data model decisions and naming conflicts

The PRD's functional sections and its logical schema table have a few naming/relationship differences. Do not create duplicate columns to satisfy both spellings. Use these explicit decisions and document them in ADRs:

1. **Opportunity amount:** use canonical Python/DB/API field `estimated_value` (`NUMERIC(14,2)`, non-negative), as named in PRD Section 6.3 and the supplied Phase 2 handoff. Do not also add `expected_amount`. If the existing scaffold already has a canonical field, inspect it and only retain it if changing it would break an established contract; document the exception.
2. **Catalog fields:** use the functional product field names from PRD Section 6.5 and the supplied phase handoff: `base_unit`, `sell_price` (`NUMERIC(14,4)`), `unit_cost` (`NUMERIC(14,4)`, internal-only), `tax_rate_percent` (`NUMERIC(5,2)`), and structured `attributes_json`/mapped JSONB attributes. Do not duplicate these as `default_unit_price`, `unit`, or `default_tax_rate`. Document the naming reconciliation with PRD Section 10.1.
3. **Task links:** the phase note mentions generic `related_entity_type`/`related_entity_id`, while PRD Section 10.1 specifies relational links. Prioritize referential integrity for entities implemented now: nullable `account_id` and `opportunity_id` foreign keys; do not add an unenforced polymorphic ID as the only relation. Add `quote_id` only when the quote model is implemented in a later phase. If the existing foundation already has a typed relationship abstraction, inspect and reuse it safely. Record the resolution.
4. **Archive vs delete:** never cascade-delete an account/contact/product and thereby remove business history. Use archival/deactivation. Parent foreign keys must reject deletion when referenced. Archiving a parent keeps its historical child records readable, but hides it from selectors for new records. A contact primary flag must remain valid after archive operations.
5. **Task due date:** use the existing canonical schema if already established; otherwise store a timezone-aware UTC due timestamp (`due_at`) as required by the detailed task behavior. Dashboard overdue logic must compare against the organization's local calendar date (`Asia/Kolkata` in the demo). If the codebase uses a `DATE` field already, retain `due_date` and explicitly document that tasks have date-level, not time-of-day, precision. Do not create both fields.
6. **Future dashboard metrics:** the quote-approval and RFQ-review tables do not exist in Phase 2 and must not be fabricated. Keep stable response fields for `quotes_awaiting_approval` and `open_rfq_review_lines`, but represent them as `null` with an explicit availability marker/message until the future phase implements their data sources. The UI must say “Available when quotations/RFQs are enabled” (or equivalent concise copy), not present a false `0`. Once a real source exists in a later phase, the same fields may return real counts. Document this temporary Phase 2 response behavior in ADR/API docs.
7. **Contact primary uniqueness:** enforce at most one active primary contact per account, including concurrent requests. Use a partial unique index where supported plus transactional service handling, or an equivalent database-safe constraint. Do not rely only on a frontend toggle.
8. **Audit:** an entity's business mutation and its activity/audit event must commit in the same DB transaction. A failed mutation must not leave a success activity. Activity records are append-only through the API.

Keep response JSON `snake_case`, UUID IDs, UTC timestamps, organization scoping and existing error contract. Use PostgreSQL constraints as the final integrity layer.

---

## 5. Migration and SQLAlchemy models

Create migration `0002_crm_and_catalog.py` (use the repository's existing Alembic naming/revision conventions). Do not edit the already-applied foundation migration. Include these tables:

### 5.1 `accounts`

Required fields:

- `id UUID` primary key.
- `organization_id UUID` non-null FK to organizations.
- `name` required, trimmed, 2–120 characters.
- `legal_name` optional, max 160 characters.
- `account_type`: `customer | prospect | partner | supplier`, default `customer`.
- `industry` optional controlled/free text, max length consistent with schema.
- `website` optional valid HTTP/HTTPS URL.
- `phone` optional, max 32 characters.
- `email` optional valid email.
- `billing_address_json`, `shipping_address_json` optional structured JSON objects; validate fields and size.
- `notes` optional plain text, max 2,000 characters; do not accept HTML as executable markup.
- `owner_user_id` nullable/required according to the existing user/ownership pattern; any assigned owner must be an active user in the same organization.
- `status`: `active | archived`, default active.
- `created_by`, `updated_by` (or existing common actor fields), `created_at`, `updated_at`, `version`.

Indexes: organization + status, organization + name, owner/status as useful for observed query patterns. Enforce no cross-organization owner assignments in service validation and, where possible, composite FK constraints.

### 5.2 `contacts`

- `id`, `organization_id`, `account_id`, first/last name (1–80 chars each), optional `job_title` (max 100), optional valid email and phone (max 32), `is_primary`, notes, `status` (`active | archived`), creator/updater, timestamps and `version`.
- `account_id` must point to an account in the same organization. No hard deletes for normal CRUD.
- At most one active primary contact per account. Service must correctly demote the old primary and promote the new one in one transaction. A conflicting concurrent promotion must fail safely.
- Archiving a contact must not erase activities/history.

### 5.3 `opportunities`

- `id`, `organization_id`, `account_id`, nullable `primary_contact_id`, `name` (3–140 chars), description (max 2,000), stage, non-negative `estimated_value NUMERIC(14,2)`, `currency_code` fixed to organization currency and INR for the demo, `probability_percent` within 0–100, optional `expected_close_date DATE`, `owner_user_id`, optional `source`, `loss_reason`, `loss_detail`, `won_at`, `lost_at`, creator/updater, timestamps, `version`.
- Stages: `lead`, `qualified`, `solutioning`, `proposal`, `negotiation`, `won`, `lost`.
- Account, primary contact and owner must belong to the same organization; contact must belong to the opportunity's account.
- Won/lost are terminal. Reopening requires an explicit reason and returns to `qualified`.
- Moving to `lost` requires one of `price | timing | competitor | no_response | other`; `other` requires an explanation.
- Moving to `won` requires a linked approved/accepted quote in the completed product. Because quote tables are out of Phase 2, **only a sales manager/admin may use “Mark won without an accepted quote” with a non-empty reason**, and that override must be recorded in activity/audit metadata. Do not allow a sales rep to bypass the rule.
- Stage changes require expected version (`expected_version` or existing `If-Match` convention), reject stale updates with HTTP 409, and produce one `stage_change` event on success.
- A “reopen” route is distinct from the normal stage-change route and requires a reason.

### 5.4 `tasks`

- `id`, `organization_id`, `title` (required, max 160), description (max 1,000), status (`open | completed | cancelled`), priority (`low | normal | high`), canonical due field per Section 4, assignee user, optional `account_id`, `opportunity_id`, creator, `completed_at`, timestamps, `version`.
- Any account/opportunity/assignee must belong to the same organization. Relationship combinations must be consistent; do not let a task's account and opportunity refer to different accounts.
- `sales_rep` can view/manage own assigned tasks within policy; managers can view/reassign team tasks. Backend enforces this.
- Completion/reopening are explicit command endpoints; update `completed_at` correctly and create distinct activity events. Completing a task must be reversible by explicit reopen. The UI's Undo toast should invoke the real reopen endpoint; it must not only restore client state.
- Overdue = open task with due value before the current date/time boundary defined in the PRD, interpreted in `Asia/Kolkata` for the demo.

### 5.5 `activities`

- `id`, `organization_id`, nullable actor for system seeding only (normal mutations require authenticated actor), `entity_type`, `entity_id`, event type, human-readable summary, safe JSON metadata, `occurred_at` UTC.
- Event types include the PRD's CRM/task values: `note`, `call`, `meeting`, `follow_up`, `email_note`, `stage_change`, and future-compatible event strings for RFQ/quote events. Phase 2 must emit at least account/contact/opportunity/task/catalog create/update/archive and task completion/reopen events. `email_note` is only a manually entered CRM note; do not send email.
- Activity API is read-only; do not implement edit/delete endpoints. Never store passwords, session tokens, cookies, CSRF tokens or unnecessary personal data in metadata.
- Ensure every activity is scoped to the same organization as its target. Since generic entity IDs cannot use a regular FK across different table types, validate target existence/organization in the service for supported entity types.

### 5.6 `catalog_products`

- `id`, `organization_id`, SKU, name, description, category, manufacturer, manufacturer part number, `base_unit`, `sell_price NUMERIC(14,4) >= 0`, nullable `unit_cost NUMERIC(14,4) >= 0`, `tax_rate_percent NUMERIC(5,2)` constrained to 0–100 with default 18, structured JSONB `attributes_json`, informational `stock_status` (`in_stock | limited | backorder | discontinued`), `is_active`, creator/updater, timestamps and `version`.
- SKU normalization: trim and uppercase before persistence; length 2–64; unique normalized SKU per organization.
- Supported units: `ea`, `box`, `pack`, `m`, `mm`, `cm`, `kg`, `g`, `l`, `ml`, `set`.
- Product name 2–180 chars; description max 1,000. Validate JSON attributes against known safe fields such as size, material, pressure class, dimensions and thread type. Do not permit arbitrary unbounded JSON blobs.
- Price, cost and tax use `Decimal`/PostgreSQL NUMERIC end to end; never Python float for stored currency fields.
- `unit_cost` must be excluded at the response-schema layer for unauthorized roles, not hidden only by CSS. Until the PRD authorizes otherwise, allow it only to `catalog_manager` and `admin`; `sales_rep` and `sales_manager` must not receive it in any API response/list/detail/export. Test serialization to catch leaks.
- Product archive/deactivation removes it from new selection/search results by default but does not delete aliases or historic business references.
- Changes to SKU/name/spec/price/cost/tax/active state create a safe activity event. Do not log internal cost values in broadly visible activity metadata.

### 5.7 `catalog_aliases`

- `id`, `organization_id`, `product_id`, `alias_text`, normalized alias, `created_by`, `created_at`.
- Trim and normalize deterministically with Unicode normalization/casefolding using existing project utilities where appropriate.
- Alias must point to an active product in the same organization when created. Alias text length must be bounded and nonempty.
- Prevent equivalent duplicate aliases for a product; detect aliases matching another product and return a clear conflict or review-required response rather than silently redirecting them.
- Alias list/add/delete endpoints must apply role rules and audit successful changes. Deletion is allowed only when it does not violate existing future historical references; if uncertain, soft-disable or follow an established catalog-history pattern. Do not implement matching behavior in Phase 2.

### 5.8 Migration requirements

- Add check constraints, unique constraints and indexes for real query/integrity needs.
- Import all models in the current model registry / `__init__.py` so Alembic metadata sees them.
- Fresh install and upgrade from the Phase 1 migration must both work.
- Do not reset the DB as part of migration.
- Add migration tests or verification demonstrating that Alembic upgrade reaches head and a second upgrade invocation is safe.

---

## 6. Backend schemas, services, and API

Follow existing FastAPI, Pydantic v2, SQLAlchemy 2.0, Psycopg 3, error-handler and session conventions. Keep router functions thin. Put transaction logic, tenant scope, state rules, actor resolution, and event creation in services/repositories according to existing architecture. Avoid a generic CRUD abstraction that obscures each entity's business constraints.

### 6.1 Shared API contract

- Prefix is `/api/v1`.
- JSON uses `snake_case`.
- Follow existing common error envelope (`code`, `message`, optional safe `details`, `request_id`).
- Use `401` for missing/invalid session; `403` for forbidden actions; default `404` for nonexistent or cross-tenant resources; `409` for stale version/state/duplicate conflicts; `422` for invalid domain input; `429` for rate limits.
- List endpoints use backend pagination and deterministic sorting. Use the repository's existing response envelope if one exists; otherwise implement a consistent response with `items`, `total`, `page`, `page_size` (and `pages` if useful). Do not introduce inconsistent per-route formats.
- Bound `page_size` (maximum 100) and reject unreasonable values. Define stable sort options; never interpolate untrusted field names into SQL.
- Search/filter must run in PostgreSQL, not just over whatever rows the frontend has loaded.
- All mutations validate tenant, owner, linked record and role inside the transaction. Do not trust organization ID supplied by the client; derive it from authenticated membership/session.
- Do not return ORM internals, password/session fields, arbitrary metadata or internal costs to unauthorized roles.
- Protect all writes with CSRF as currently configured. Do not weaken CSRF or change the session cookie implementation.

### 6.2 Schemas to implement

Create or extend the actual existing files as appropriate:

- `backend/app/schemas/crm.py`: `AccountCreate`, `AccountUpdate`, `AccountResponse`, `ContactCreate`, `ContactUpdate`, `ContactResponse`, `OpportunityCreate`, `OpportunityUpdate`, `OpportunityStageUpdate`, `OpportunityReopenRequest`, `OpportunityResponse`, `TaskCreate`, `TaskUpdate`, `TaskResponse`, `ActivityResponse`.
- `backend/app/schemas/catalog.py`: `CatalogProductCreate`, `CatalogProductUpdate`, `CatalogProductResponse`, `CatalogAliasCreate`, `CatalogAliasResponse`.
- `backend/app/schemas/dashboard.py`: `DashboardSummaryResponse`, stage-breakdown item, `AttentionItemResponse` and pagination as needed.

Use strict Pydantic validation, field length limits, controlled enums, valid URL/email checks, non-negative decimal values and `extra="forbid"` for write payloads unless the established schema policy says otherwise. Partial `PATCH` payloads must distinguish omitted fields from explicitly supplied nulls.

### 6.3 Required routers/endpoints

Mount using the existing `router.py` conventions; do not create duplicate app instances.

**Accounts**

- `GET /api/v1/accounts`: search name/legal name/email/phone; filters for status, account type, owner and industry; supported sort; pagination.
- `POST /api/v1/accounts`
- `GET /api/v1/accounts/{account_id}`
- `PATCH /api/v1/accounts/{account_id}` (version-aware)
- `POST /api/v1/accounts/{account_id}/archive`
- `GET /api/v1/accounts/{account_id}/contacts`
- `POST /api/v1/accounts/{account_id}/contacts`
- `GET /api/v1/accounts/{account_id}/timeline`

Account archive is soft archive. It must explain that historical records remain, and archived accounts must be excluded from selectors for new opportunities/contacts unless the operation is explicitly read-only. Do not physically delete.

**Contacts**

- `GET /api/v1/contacts`: search name/email/phone, filter by account/status/primary, paginate.
- `PATCH /api/v1/contacts/{contact_id}` (version-aware)
- `POST /api/v1/contacts/{contact_id}/archive`

Creating a contact occurs through the nested account route or an existing compatible route. Validate primary contact changes atomically.

**Opportunities**

- `GET /api/v1/opportunities`: search, account/stage/owner/expected close/status filters, sorting, pagination.
- `POST /api/v1/opportunities`
- `GET /api/v1/opportunities/{opportunity_id}`
- `PATCH /api/v1/opportunities/{opportunity_id}`
- `POST /api/v1/opportunities/{opportunity_id}/stage` with `stage`, `expected_version`, and reason data for lost/won override.
- `POST /api/v1/opportunities/{opportunity_id}/reopen` with required reason and expected version.
- `GET /api/v1/opportunities/{opportunity_id}/timeline`

Stage updates must validate state transitions, loss reason rules, terminal states, accepted-quote prerequisite/Phase-2 manager override, version conflicts and audit events on the server.

**Tasks**

- `GET /api/v1/tasks`: filters for assignee, status, priority, due/overdue, related account/opportunity, search, sort, pagination.
- `POST /api/v1/tasks`
- `GET /api/v1/tasks/{task_id}`
- `PATCH /api/v1/tasks/{task_id}` (version-aware)
- `POST /api/v1/tasks/{task_id}/complete`
- `POST /api/v1/tasks/{task_id}/reopen`

Complete/reopen are explicit commands, not only changes to a status field. Ensure `completed_at`, version, activity and response all commit together. The server is authoritative on assignee/role rules.

**Catalog**

- `GET /api/v1/catalog/products`: search SKU/name/MPN/alias and relevant safe attributes; filters for category, manufacturer, stock status and active state; pagination and sort.
- `POST /api/v1/catalog/products`
- `GET /api/v1/catalog/products/{product_id}`
- `PATCH /api/v1/catalog/products/{product_id}` (version-aware)
- `POST /api/v1/catalog/products/{product_id}/archive`
- `GET /api/v1/catalog/products/{product_id}/aliases`
- `POST /api/v1/catalog/products/{product_id}/aliases`
- `DELETE /api/v1/catalog/aliases/{alias_id}` only if safe according to the established catalog history approach; otherwise implement an explicit deactivation route and document it.

Only `catalog_manager` and `admin` can create/update/archive products and aliases. Do not allow sales representatives/managers to mutate the catalog in Phase 2.

**Dashboard**

- `GET /api/v1/dashboard/summary?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/v1/dashboard/attention` (paginated)
- `GET /api/v1/activity` (paginated, filters by entity/event/actor/date where allowed)

Dashboard values must be calculated from persisted records and have documented definitions/date range/timezone. No hard-coded KPI values or chart fixture arrays in production route components. Summary must include:

- open opportunities count: stage not `won`/`lost`;
- open pipeline INR value: sum `estimated_value` for open opportunities; do not probability-weight;
- overdue open task count: use the defined Asia/Kolkata day boundary;
- opportunity stage distribution for current date range, with a clearly documented cohort rule;
- quote-awaiting-approval and RFQ-review-line counts as unavailable (`null` plus an availability status) until their tables exist; never pretend the unimplemented workflow has zero outstanding work.

If you add total active accounts or catalog products as additional summary fields, ensure they're real queries and the UI has definitions; do not add gratuitous metrics. Do not implement quote/RFQ tables here.

Attention queue in Phase 2 must contain real items from:

1. overdue open tasks;
2. open high-priority tasks due today/soon;
3. opportunities requiring follow-up (only if there is a well-defined persisted due/activity field; otherwise omit instead of inventing);
4. avoid duplicate attention rows for one underlying issue.

Sort most urgent first, return type/title/description/target entity/due time/severity, and honor role/tenant visibility. If no attention exists, return an empty list; the UI should show a designed empty state rather than fake items.

### 6.4 Authorization matrix for Phase 2

Use the existing `rbac.py` policy helpers and extend them only if the current matrix lacks a necessary permission. Put backend checks behind shared permission functions, not ad hoc repeated string checks.

- `sales_rep`: create/read/update records they own or are assigned to according to PRD; create accounts/contacts/opportunities/tasks; update and stage-change permitted opportunities; read catalog sell-facing fields; complete/reopen own tasks. Cannot edit/archive catalog, view `unit_cost`, reassign team tasks or see records beyond assigned visibility.
- `sales_manager`: organization-wide CRM/opportunity/task visibility, assignment/reassignment, permitted edits/archive, team pipeline, activity history. Cannot see `unit_cost` unless the PRD or current explicit permission grants it; for this phase, do not expose it.
- `catalog_manager`: catalog product/alias CRUD/archive, access to `unit_cost`, read organization-wide accounts/opportunities as needed for catalog work, task access per current policy. Cannot edit opportunity commercial state or approve any future proposals.
- `admin`: organization-level access to Phase 2 records and catalog, access to `unit_cost`, and broad audit visibility. Admin is not an automatic bypass for cross-organization scoping.

When policy is unclear, inspect current `rbac.py` and `PRD.md`, then document the smallest safe decision. Do not change the role names or the authentication mechanism.

### 6.5 Transaction and concurrency invariants

- Every create/update/archive/stage/complete/reopen/alias mutation that changes meaningful business state emits an activity record in the same transaction.
- All tenant-owned reads and writes are scoped by the authenticated organization; include tests that try another organization's UUID.
- Enforce optimistic concurrency for important mutable resources using the existing `expected_version` or `If-Match` convention. A stale mutation returns `409` with a safe error code and current-version hint, but not a leaked private resource.
- Version increments only on successful mutations.
- Primary-contact updates and opportunity stage updates must be atomic.
- Don't implement hard deletion for historical CRM/catalog entities.
- Do not leak `unit_cost` via ORM auto-serialization, nested response, activity metadata, exception, debug log or frontend API generated type. API types may contain optional restricted fields only if the role-specific server contract intentionally supports them; tests must assert actual runtime omission.

---

## 7. Synthetic seed data

Expand the existing `backend/app/seed/demo_seed.py` (or the real discovered location). Use only `DEMO_MODE=true`; preserve current demo login setup. Seed generation must be deterministic and idempotent. Do not create new rows on every seed run and do not overwrite records modified by a user unless the documented reset command explicitly resets the demo database.

### Required fixture shape

- Exactly 10 industrial/B2B accounts (within the PRD's 8–12 range) across customer/prospect/supplier/partner types and several industries.
- Exactly 16 synthetic contacts with names, roles, reserved `.example` email addresses and plausible synthetic phone numbers. Every contact has an account; define a primary contact for selected accounts without violating one-primary constraint.
- Exactly 10 opportunities across all stages: Lead, Qualified, Solutioning, Proposal, Negotiation, Won and Lost. Values should range plausibly from INR 45,000 to INR 1,850,000. Use amounts, owner, close dates, probability and stage consistently. Won/lost records have the necessary close fields and reason fields. Seed historical win records with clear synthetic override/activity provenance if there is no quote module yet.
- Exactly 18 tasks across low/normal/high priority and open/completed/cancelled states; include overdue, due today, upcoming, and completed tasks assigned to appropriate seeded users and connected to real accounts/opportunities.
- Approximately 100 catalog products across pipes, valves, fittings, fasteners, gaskets, seals and consumables. Include normalized SKU, units, manufacturer, manufacturer part number where relevant, category, sensible sell price, internal unit cost, tax rate, stock status, controlled attribute JSON and useful aliases. Include intentionally similar but distinct products without implementing matching behavior yet.
- Credible activity stream entries generated through explicit deterministic seed fixtures. Include recent account/opportunity/task/catalog events so the activity UI is useful. Keep all data internally coherent.

Use fixed UUIDs or deterministic natural keys plus stable lookup/upsert logic so E2E tests can target records reliably. Do not generate random IDs/names on each run. Never use real emails; use reserved domains such as `forgeflow.example`. Mark seed data clearly in UI or workspace metadata as synthetic demo data.

### Seed safety

- `make seed` only runs when safe under the existing `DEMO_MODE`/environment safety guards.
- Running seed twice produces the same records and no duplicates.
- `make reset-db` remains explicitly destructive and must still fail closed in production-like settings.
- Do not hard-code credentials in production bundles or seed when demo mode is false.

---

## 8. Frontend implementation requirements

Read the PRD's visual system and use the existing design tokens/components. This phase is not permission to redesign the product visual language. Build pages that feel like a coherent, premium B2B SaaS product—not generic CRUD templates.

### 8.1 Common page behavior

Every page must have:

- correct `PageHeader` title/description and a primary action only where permitted;
- backend-backed search/filter/pagination where applicable;
- an intentional loading skeleton, empty state, error/retry state and permission-denied state;
- accessible headings, labels, focus order, button names, keyboard operation and visible focus;
- no color-only status meaning; status badges contain text and an icon/label as specified by the shared component;
- optimistic UI only when safe and reversible; on `409`, do not silently retry or overwrite. Show a conflict message and reload/compare action;
- working forms with inline server field errors; close/reset behavior after successful submission; no fake controls;
- responsive layout verified at desktop 1440×900, tablet 1024×768 and mobile 390×844;
- correct reduced-motion behavior and no console errors/warnings.

Use existing TanStack Query provider/hooks and API client. Invalidate/refetch the relevant query keys after successful mutations. Do not call `fetch` ad hoc from each page. Follow the existing generated OpenAPI type convention and regenerate after backend contracts change.

### 8.2 Accounts page and detail

Route should use the actual current route convention under `frontend/app/app/(workspace)/`—inspect the route tree before writing paths.

Accounts index must include:

- title “Accounts” and concise description;
- search that queries backend names/legal names/email/phone;
- filters for Active/Archived, account type, industry and owner where allowed;
- paginated table with account name, type/status, industry, owner, contact/opportunity summary counts if supported by efficient queries, and updated date;
- accessible row navigation and clear “New account” action where allowed;
- create/edit drawer or dedicated form with fields required by PRD, labels, inline validation and safe address inputs;
- archive confirmation that tells users records are retained and existing history preserved;
- duplicate warning when matching likely duplicate names/email exists. Never auto-merge duplicates.

Account detail must show the account summary, contacts with primary indicator, related opportunities, recent timeline and meaningful empty states. Do not render non-existent RFQ/quote counts as zero; show “Available in a later workflow phase” only for those future domains.

### 8.3 Contacts directory

- Search by full name/email/phone; filter by account/status/primary where supported.
- Columns: name, role/title, account, email, phone, primary, status.
- Link the account name to account detail.
- Create from the account detail workflow or nested API, and edit/archive through accessible form/drawer.
- Primary contact toggle must reflect atomic backend behavior and surface 409/conflict if simultaneous updates conflict.

### 8.4 Opportunities page

Provide both **Pipeline** and **Table** views with a simple accessible toggle. Do not use drag-and-drop as a required stage-update interaction.

Pipeline:

- Columns in exact order: Lead, Qualified, Solutioning, Proposal, Negotiation, Won, Lost.
- Each card displays opportunity name, account, value in INR, owner initials/name and expected close date.
- Columns and cards are keyboard reachable; narrow screens use a horizontal scroll region with visible affordance or a list fallback that does not cause page-wide overflow.
- Stage update uses a native accessible select/menu and confirmation when moving to terminal `Won`/`Lost`.

Table:

- Search opportunity/account/name; filters by stage, owner, expected close-date range; backend pagination.
- Columns: opportunity, account, stage, value, probability, owner, expected close, last updated.
- Create/edit form validates account/contact relationship, value/currency, probability and close-date inputs.
- Lost requires reason and optional detail; terminal reopening requires a reason. Won-without-quote override is only shown to manager/admin, asks for a non-empty reason, and explains that a quotation workflow is not yet enabled in Phase 2.
- Stage/status is always conveyed by text, not color alone.

### 8.5 Tasks page

- Default to “Assigned to me” and open tasks first according to PRD; managers may change assignee filter to view team tasks.
- Search and filters: status, priority, due/overdue, assignee, account/opportunity.
- Task row/list shows title, associated account/opportunity, priority, assignee, due date/time and explicit status.
- Overdue includes readable “Overdue” label and icon, not just a red color.
- Completing a task updates the server, then displays a 10-second Undo toast calling the real reopen endpoint. If undo fails, refetch server state and show an error.
- Create/edit task drawer supports title, description, due field, priority, assignee (permission dependent) and valid entity association.
- Task counts/overdue badges come from query data, never hard-coded values.

### 8.6 Catalog page

- Search by SKU/name/manufacturer part number/alias and relevant attributes where supported.
- Filters: category, manufacturer, stock status, active/archived.
- Table columns: SKU, product, category, base unit, sell price, tax rate, stock status and active status. Never show `unit_cost` to unauthorized roles.
- Create/edit product drawer includes SKU, name, description, category, manufacturer, MPN, base unit, sell price, authorized unit cost, tax rate, stock state and structured attributes. Use sensible select controls for units and stock states; no arbitrary JSON textarea as the primary workflow.
- Product details drawer shows aliases, normalized SKU, product attributes and permitted cost fields. Alias add/delete has validation, duplicate/conflict feedback and activity history where available.
- Archive/deactivate is confirmed and clearly states it remains in historical records.
- If no result exists, offer a clear reset-filter action; do not show unrelated demo products.

### 8.7 Activity feed

- Show actual persisted activity from `GET /api/v1/activity` with date, actor, concise summary, entity link and event type.
- Support simple filters for event type/actor/date if they are included in the backend query contract.
- Do not fabricate a timeline from seeded frontend arrays. Prefer seed-generated DB records.
- Restrict organization-wide feed based on role policy; entity detail must not leak inaccessible records.

### 8.8 Dashboard

Connect actual `/app/dashboard` route (using the real route tree) to `GET /api/v1/dashboard/summary` and `GET /api/v1/dashboard/attention`.

- Active date range is visible; default current calendar month in Asia/Kolkata. Support the date options specified in PRD if not already present.
- Display open opportunities and open pipeline INR value with definitions available via tooltip/help text.
- Display overdue tasks from real data.
- Display stage distribution from backend aggregation using Recharts and accessible text/table equivalent.
- Future RFQ/quote metrics remain visibly unavailable until their real tables/services are implemented; do not display 0 or placeholder chart bars.
- Attention panel shows real urgent tasks with links to actual task/opportunity details. Empty state if none.
- Keep current visual token values unchanged; use shared card and chart wrappers if they exist.
- No loading state may remain indefinitely. Handle session expiry, API errors and retry correctly.

### 8.9 Navigation and permissions

Only set `enabled: true` in `feature-registry.ts` for a Phase 2 feature after its route, query, permission restrictions, empty/error/loading states and at least one end-to-end interaction work.

Enable Accounts, Contacts, Opportunities, Tasks, Catalog and Activity only if those pages are implemented. Do not enable RFQs, Quotations or Reviews/Approvals in Phase 2. If a role may not access a page, hide/disable it according to the existing navigation contract and still enforce permissions in the backend.

---

## 9. API types and frontend integration

- Run the project's `make openapi-generate` command after the API is stable. If the command does not exist, inspect the package scripts/Makefile, fix the underlying contract command in a documented small change, and then run it. Never hand-edit generated `schema.d.ts` to simulate server types.
- Generated type diff must be committed and reproducible from the current FastAPI OpenAPI document.
- Build typed TanStack Query hooks in the existing feature module pattern (accounts, contacts, opportunities, tasks, catalog, dashboard/activity) or reuse the current hooks convention.
- Use one query-key factory per module with organization/user scoping from authenticated state where appropriate.
- Define mutation invalidation deliberately. A successful create updates the relevant list/detail/dashboard/activity. Stage changes invalidate opportunities, dashboard and timeline. Task completion invalidates tasks, dashboard and activity. Product mutations invalidate catalog searches/details and activity.
- Errors must use the shared typed API error mapper, not duplicated message parsing per screen.
- Do not store authoritative server records only in local React state. Local state may hold active filters, drawer visibility and unsaved form values.

---

## 10. Test requirements (release blocking)

Write targeted tests for each business rule. Avoid empty assertions or tests that only check a response is `200` without checking persisted effects, access rules or payload shape.

### 10.1 Backend unit tests

Cover:

- account/contact validation, normalized text/URL/email handling and primary-contact assignment;
- account/contact archive semantics and exclusion from new-record selectors;
- opportunity value/probability bounds and cross-organization relationship rejection;
- permitted stage transitions and terminal `won`/`lost` behavior;
- lost reason requirement and `other` detail requirement;
- won override role/reason requirement in Phase 2;
- reopen reason and transition to `qualified`;
- task complete/reopen timestamp/status rules and relationship consistency;
- SKU normalization, uniqueness, unit allowlist, tax/price bounds and JSON attribute validation;
- alias normalization/duplicate conflict behavior;
- dashboard query functions for open pipeline, stage distribution and overdue tasks at Asia/Kolkata day boundaries;
- response filtering that excludes `unit_cost` for `sales_rep` and `sales_manager`.

### 10.2 Backend integration/security tests

Create `backend/tests/integration/test_crm_api.py` or the equivalent existing folder structure. Against real PostgreSQL test DB, cover:

- account CRUD/archive and persistence after request/client reload;
- nested contacts and primary uniqueness (including concurrent or constraint-level conflict if feasible);
- opportunities CRUD, stage changes, stale version `409`, invalid terminal transitions and authorization;
- tasks list filters, creation, completion and reopening, with activity records committed in the same transaction;
- catalog CRUD/archive/alias routes, SKU uniqueness, and hidden `unit_cost` in list/detail/nested/unauthorized responses;
- search/pagination/sort/filter correctness;
- tenant isolation for list, detail, nested relations and mutations across every resource family;
- `404` non-disclosure for inaccessible records where established by the app;
- mutation rollback leaves no activity record when domain/DB validation fails;
- role-matrix access checks for each endpoint family;
- actual dashboard metrics matching fixture state, not hard-coded expected zeros;
- future metric availability status remains unavailable/null until quote/RFQ sources exist;
- activity endpoint organization/role scoping.

Tests must use the existing fail-closed test DB guard. Do not weaken/skip it. Do not point `TEST_DATABASE_URL` at the normal development DB. Run the DB integration suite with a dedicated test DB.

### 10.3 Frontend tests

Add Vitest/Testing Library tests for:

- account filters/search and empty/loading/error/retry states;
- account/contact form validation, server field errors and successful submission;
- opportunity Pipeline/Table switch, stage select behavior, lost/won reason validation and 409 stale conflict handling;
- task filters and completing/undoing a task using API mutation success/failure;
- catalog SKU/category filters, alias validation, archive confirmation and absence of unit cost for unauthorized roles;
- dashboard API data rendering and non-fabricated future metric states;
- activity loading/empty/error states;
- permission-dependent action visibility without relying on that visibility for security.

Mock network boundaries in component tests; do not mock the component's local function that is the behavior under test. Keep integration/security assertions in backend tests.

### 10.4 Playwright / accessibility E2E

Add E2E coverage for at least these real journeys:

1. Log in as sales rep, create account, add contact, create opportunity, reload and verify persisted records.
2. Switch opportunity from Lead to Qualified; verify stage distribution/dashboard updates and activity timeline records the change.
3. Create and complete a task; verify overdue/dashboard state changes and Undo reopens the task through the API.
4. Login as catalog manager, create a product and alias; verify search finds the SKU/alias and a sales rep cannot access catalog mutation.
5. Verify sales manager can see team-wide opportunity view and `unit_cost` remains absent from responses for sales roles.
6. Navigate accounts/contacts/opportunities/tasks/catalog/dashboard/activity at desktop, tablet and mobile dimensions; no unwanted page-wide horizontal overflow.
7. Run `axe-core` scans on key routes, follow existing project's accessibility test conventions, and manually inspect keyboard/focus behavior for forms, drawers, popovers, tables and stage controls.

Do not run all browser tests against an already-mutated shared seed state unless each test resets only its own fixtures or uses deterministic unique test records. Keep E2E deterministic and isolated.

---

## 11. Required docs and handoff updates

Update only docs relevant to Phase 2; preserve the source PRD unchanged.

- `docs/API.md`: endpoint inventory, schemas/pagination, filters, status codes, role permissions, expected-version behavior and examples; clearly mark future RFQ/quote endpoints as not implemented.
- `docs/data-dictionary.md`: table/field definitions, constraints, enums, indexes, soft archive behavior and naming ADRs.
- `docs/test-plan.md`: new tests and exact commands/results, separating pre-existing failures from regressions.
- `docs/architecture.md`: module/service/repository boundaries and dashboard query/data flow, without inventing new infrastructure.
- `docs/architecture-decisions/`: decisions for the schema naming conflicts in Section 4, task relationship modeling and temporary future dashboard metric availability.
- `docs/demo-script.md`: update the first section of the guided demo to show real account/contact/opportunity/task/catalog data; leave RFQ/quote steps marked as later phases until implemented.
- `docs/agent-handoff.md`: report exactly what was implemented; migration revision; API routes; models; UI routes; seed identities; test command results; known limits; and the next agent's explicit Phase 3 scope. Avoid saying “100% complete” unless every acceptance requirement has evidence.

Do not change `PRD.md` to make unfinished requirements appear satisfied. If a real inconsistency needs a resolution, record it in an ADR and mention it in the handoff.

---

## 12. Local commands and quality gates

Use the existing command contract. At completion, run and report actual results for:

```bash
make up
make seed
make openapi-generate
make lint
make typecheck
make test
make test-e2e
make build
make check
```

If commands combine multiple checks or the repository names them differently, inspect the current Makefile and report the exact equivalent commands that were actually run. Do not fabricate a successful result for an unavailable command. Fix failures introduced by Phase 2. If an inherited baseline failure remains, document its exact reproduction and why it is unrelated.

Also verify:

- Alembic head matches the new Phase 2 migration.
- Startup and seed work twice without duplicate records.
- Production frontend/backend builds pass.
- OpenAPI generation produces no unexplained stale diff.
- No browser console warnings or failed API requests during the tested journeys.
- No untracked secrets, `.env` files, local DB dumps, or huge generated test artifacts enter Git.

---

## 13. Definition of done

Phase 2 is complete only when all of the following are true:

- [ ] CRM/catalog migration upgrades a fresh Phase 1 database without modifying the old migration.
- [ ] Accounts, contacts, opportunities, tasks, activities, products and aliases persist in PostgreSQL with constraints/indexes and version semantics.
- [ ] All required in-scope routes exist with Pydantic validation, organization scope, role checks, filters/search/pagination and consistent errors.
- [ ] Account/contact/opportunity/task/catalog mutations create reliable activity history transactionally.
- [ ] Archive/deactivate preserves history; no accidental cascade delete exists.
- [ ] Primary-contact, opportunity-stage, task-state, SKU and alias invariants are tested.
- [ ] Unauthorized users cannot view/edit restricted records or see unit cost in any response.
- [ ] Seed data has coherent fixed synthetic accounts, contacts, opportunities, tasks, catalog products and activities and is idempotent.
- [ ] Dashboard summary and attention data comes from real queries, follows role scope/date rules, and future metrics are explicitly unavailable rather than fake zeros.
- [ ] Frontend pages are polished, responsive, accessible and use the existing design system; every visible action works.
- [ ] Navigation is enabled only for working modules; Phase 3/4 navigation remains disabled.
- [ ] Generated API contract is reproducible.
- [ ] Backend unit/integration/security tests, frontend tests, E2E/accessibility checks, typecheck, lint and production builds are green or any exact blocker is disclosed.
- [ ] Docs and `docs/agent-handoff.md` are updated so the next agent can begin Phase 3 without rediscovering Phase 2 choices.

---

## 14. Final report format

When finishing, respond with this exact structure:

1. **Phase 2 implementation summary** — what works end to end.
2. **Migration/data model** — migration revision, constraints and schema ADRs.
3. **API implementation** — endpoint groups, filters, roles and error/concurrency behavior.
4. **Frontend implementation** — real routes/screens, key interactions, visual/responsive/accessibility work.
5. **Demo data** — counts, deterministic/idempotent behavior and safety restrictions.
6. **Verification table** — command, `PASS`/`FAIL`/`BLOCKED`, measured result, and any inherited baseline failure.
7. **Known limitations** — only concrete remaining gaps; future RFQ/quote features should remain explicitly out of scope.
8. **Key files** — implementation and test locations.
9. **Handoff to Phase 3 agent** — exact starting point, preserved invariants, and instructions to read `PRD.md` plus updated `docs/agent-handoff.md` before implementing RFQ ingestion/normalization only.

**Final instruction:** implement Phase 2 end to end with disciplined scope. Preserve the verified Phase 0/1 foundation, use the PRD and this prompt as the contract, keep the UI polished, and prove business rules with tests. Do not jump ahead to RFQ or quotation functionality.
