# ForgeFlow Phase 5 Agent Prompt — Review-Before-Write Proposals, Maker-Checker Approvals, and Atomic Quote Commit

> **Assignment:** Implement Phase 5 only in the existing ForgeFlow repository.
>
> **Source of truth:** `PRD.md` is binding. Read it in full before coding, with special attention to Sections 4, 6.8–6.9, 7, 9–12, 14, 15, and Phase 5 in Section 17. Then read `docs/agent-handoff.md`, `docs/architecture.md`, `docs/API.md`, `docs/data-dictionary.md`, `docs/security.md`, `docs/test-plan.md`, and the Phase 4 implementation report if present. Follow the actual current code and database schema as well as the PRD.
>
> **Do not ask routine questions.** Inspect, decide from the PRD, implement, test, fix, document, and hand off. If a genuine contradiction cannot be resolved from the PRD/current code, record a concise ADR before proceeding. Do not silently change the PRD.

---

## 1. Mission and completion outcome

Implement ForgeFlow **Phase 5: proposal/review/atomic commit and approvals**. The user must be able to create a change proposal against a specific quotation revision, inspect an exact server-produced before/after diff and recalculated financial impact, submit it for review, have a different authorized user approve or reject it, and commit an approved proposal as a new immutable quote revision in one database transaction.

Also implement the initial-quotation approval path specified by the PRD so quotes whose initial commercial terms trigger approval can be reviewed safely. Implement a real role-filtered approval queue and the revision/proposal review experience. Existing CRM, RFQ ingestion/review, deterministic Decimal pricing, calculation trace, quote builder, auth/session security, design tokens, and app shell must continue to work.

### Phase 5 end-state

The following complete workflow must work against the real application and PostgreSQL, not just mocks:

1. A sales representative opens a persisted quote with committed revision N.
2. They create an isolated proposal with a reason and explicit allowlisted operations (for example, changing a line discount from 3% to 8%).
3. The backend reads revision N, applies operations to an isolated domain snapshot, runs the authoritative Phase 4 Decimal calculator and policy evaluator, builds before/after snapshots, trace information and a normalized diff, and persists a draft proposal. **Revision N and the quote's current-revision pointer remain unchanged.**
4. The proposer edits only while the proposal is a draft, then submits it. The server revalidates and freezes the payload/base revision, calculates policy checks, records a policy snapshot and sends it to pending review.
5. A sales manager/admin who did not propose the proposal sees it in `/app/approvals`, opens its review screen, inspects every change, the business reason, financial impact and policy triggers, then approves or rejects with an appropriate comment/reason.
6. On approval, the approval decision is bound to that exact proposal and base revision. A separate commit action creates revision N+1, moves `quotes.current_revision_id` to N+1, updates quote status/version consistently, links the proposal to the committed revision, and appends audit/activity records atomically.
7. Repeating the same commit with the same idempotency key returns the original successful result without duplicate revisions. A stale proposal, changed base revision or concurrent commit returns a clear `409` and produces no partial writes.
8. The initial quote approval flow enforces the same server-side maker-checker and revision safety constraints.

The essential invariant is **review before write**: a proposal must never mutate the canonical/current quote revision until its valid commit succeeds.

---

## 2. Scope boundaries

### In scope

- `quote_change_proposals` persistence and, where useful, normalized child `quote_proposal_changes` rows.
- Append-only `quote_approval_decisions` records.
- Strict proposal operation schemas and allowlist validation.
- Proposal lifecycle, reason/comment requirements, before/after diff, policy snapshot and calculation snapshots.
- Maker-checker separation of duties and role-based authorization.
- Initial quotation submission/approval for policy-gated quotes.
- Atomic transactional commit to a new immutable quote revision.
- Optimistic concurrency, database locking/compare-and-swap, idempotency and stale-state handling.
- `/app/approvals` queue, proposal review detail, quote revision/proposal history integration and conflict/retry UX.
- Real API endpoints specified in PRD Section 11.6–11.7.
- Audit/activity events and updated dashboard counts where the current metrics already have an approval seam.
- Optional admin approval-policy settings only if the existing foundation has the required setting model/UI or the PRD explicitly requires their completion for this phase. Thresholds must remain configuration-driven, validated, audited and snapshotted; do not silently hardcode a second policy implementation.
- Tests, documentation, demo fixture extension and handoff.

### Out of scope — do not implement in Phase 5

- PDF generation, final customer exports or email delivery (Phase 6).
- ERP integrations, external e-signature, payment processing, email/WhatsApp delivery or a real invitation service.
- AI/LLM-generated proposal operations, auto-approval or model-driven commercial decisions.
- Rewriting the CRM, RFQ matcher or Phase 4 pricing engine.
- Recalculating or editing existing committed historical revisions in place.
- A separate microservice or distributed lock infrastructure.
- Replacing the current authentication, CSRF, UI component system, database session approach, design tokens or application shell.

A draft/customer-preview watermark and quote preview that already exists in Phase 4 should continue to work, but final exports are not part of this assignment.

---

## 3. Read and verify the actual foundation first

Before modifying code:

1. Inspect `git status`, current branch and working tree. Preserve unrelated changes; do not reset, overwrite or clean files you did not create.
2. Read `PRD.md` in full and the latest `docs/agent-handoff.md`.
3. Inspect the actual Phase 4 models, migrations, service layer, quote calculator, policy evaluator, trace serializer, quote routes, frontend quote detail/builder, generated OpenAPI types, activity/audit utilities, roles/permissions and test fixtures. Do not assume file paths match the delivery report exactly.
4. Confirm the authoritative quote calculator is the existing pure-Python `backend/app/domain/quotes/` Decimal implementation and that it uses the PRD's `ROUND_HALF_UP` boundaries. **Reuse it; do not introduce browser-authoritative or duplicate business calculations.**
5. Confirm proposal-relevant data already stored in `quote_revisions` and `quote_revision_lines`: revision IDs, sequence number, immutable snapshot, calculation snapshot, calculator version, input fingerprint, quote/version linkage and line snapshots. Extend through new migration(s); do not rewrite applied migrations.
6. Run the baseline checks before changes and capture results. At minimum run the root quality gate (`make check`) and `make test-e2e` or the repository's documented equivalents. Record pre-existing failures separately from regressions.
7. Confirm API client CSRF handling, current OpenAPI type-generation command, frontend cache/query conventions and accessible dialog/sheet patterns.
8. Review any existing approval-related code and feature registry before adding duplicates.

If a foundational behavior differs from the report, trust the actual code/migrations and explain the difference in `docs/agent-handoff.md`. Never claim tests passed based only on the pasted report.

---

## 4. Non-negotiable domain invariants

All requirements in this section are mandatory. Implement them in domain/service functions and validate at the API and database boundaries where appropriate.

### 4.1 Proposal isolation

- Creating a proposal does not change `quotes.current_revision_id`, quote totals, committed revision snapshots or an approved/sent quote state.
- Editing a proposal is allowed only in `draft` state. Submitted proposals are immutable. To make a submitted proposal change, cancel/reject it and create a new proposal against the current revision.
- A proposal is bound to an exact `base_revision_id` and `base_version` at creation. Those fields become immutable and may never be changed by clients.
- Recalculate the proposed scenario using the existing authoritative quote calculator. Clients may send desired operations but may not send an authoritative resulting total, margin, approval status, reviewer identity, calculated tax, trace output or committed revision ID.
- Store both the immutable base snapshot and the validated proposed calculation/snapshot (using the existing Phase 4 snapshot patterns). Store calculator/policy versions and the input fingerprint needed to reproduce or audit the decision.

### 4.2 Allowlisted proposal operations

Support only the operations permitted by PRD Section 6.9:

1. Set a quote line quantity.
2. Set a quote line unit selling price.
3. Set a quote line discount percentage.
4. Set the applicable line tax rate within allowed bounds.
5. Add a quote line from an existing active catalog product and a reviewed/resolved RFQ source line belonging to the quote/RFQ relationship.
6. Remove a line from the proposed new revision. Never delete the historical line from prior revisions.
7. Update quote validity date.
8. Update payment terms.
9. Update delivery terms.

Requirements for every operation:

- Every item has a generated/validated `operation_id`, explicit allowlisted `type`, target field/line reference where applicable, `old_value`, `proposed_value`, a non-empty human-readable reason, and stable UI ordering.
- Validate operation payloads with strict versioned Pydantic schemas (`extra='forbid'` or equivalent) and domain-level validation. Reject unknown opcodes, unknown fields, malformed UUIDs, unsupported precision, negative quantities/prices, invalid percentage/rate bounds, duplicate conflicting operations on the same field, line references outside the quote and unauthorized field edits.
- If multiple operations target the same field, reject the proposal with a clear validation error instead of silently choosing a winner.
- Client-provided `old_value` is for display intent only; the server reconstructs the true old value from the base revision and rejects a mismatch. The server is authoritative for every diff.
- Add-line uses a product and RFQ source line from the same organization and valid quote/RFQ/account/opportunity context. Snapshot SKU/name/specification/unit/price/tax as required by Phase 4; do not make old quote revisions depend on future catalog mutation.
- Removing a line produces a tombstone/diff entry in the proposal and excludes it only from the proposed new snapshot; prior revisions remain immutable.
- Proposal operations cannot change tenant/organization, quote ownership, proposer/reviewer, approval status, revision IDs, calculation snapshots, totals, audit fields, or arbitrary JSON.
- Preserve the existing pricing engine's `Decimal`, rounding, trace, fingerprint and policy semantics. Do not copy financial formulas from Model Change Review Lab.

### 4.3 Lifecycle

Use the PRD lifecycle exactly (states may have clear implementation-specific names only if documented and compatible with the API):

```text
draft -> pending_review -> approved -> committed
  |             |            |
  +-> cancelled |            +-> stale (base revision changed before commit)
                +-> rejected
                +-> stale
```

- `draft`: operations can be edited; cannot be approved or committed.
- `pending_review`: proposal is frozen; queue-visible to authorized reviewers; cannot be edited.
- `approved`: an append-only approval decision exists for this exact proposal/base revision; proposal is still not committed until commit succeeds.
- `rejected`: terminal for the proposal; must retain reviewer and reason/comment.
- `cancelled`: proposer/authorized actor may cancel only under documented preconditions; terminal; audit the action.
- `stale`: proposal no longer targets the quote's current revision/version; no commit permitted. Persist/derive stale state safely and keep the reason visible.
- `committed`: new immutable revision exists, quote pointer/version changed, and committed result is linked. Terminal.
- A rejected proposal does not automatically reject/cancel the quote. The quote's last committed revision remains current and can be used as the basis for a new proposal.
- No repeated/reentrant state transition is allowed unless it is a documented idempotent retry for the exact same command/key.

### 4.4 Approval and maker-checker

- Only `sales_manager` or `admin` may approve/reject a commercial quote/proposal. A `catalog_manager` does not gain commercial approval authority merely from catalog permissions. A `sales_rep` cannot approve or reject.
- **A proposer may never approve their own proposal, including when the proposer has `sales_manager` or `admin` role.** Compare stable user IDs server-side. UI hiding/disablement is additional, not the security boundary.
- Apply maker-checker to initial quote approval as well: the user who created/submitted the quote may not approve it. A seeded/demo quote must have a distinct proposer and manager reviewer in the demonstrable approval flow.
- Approval decision is tied to exact `proposal_id`, `base_revision_id`, `base_version`, policy snapshot and submitted operation payload/fingerprint. No approval can be reused across a changed proposal or another quote/revision.
- Proposal edits after submission are prohibited. If draft changes are ever accepted after a prior decision for a documented case, invalidate the old decision and require fresh submission/approval; simplest preferred behavior is to disallow edits outside draft.
- Rejection requires a non-empty reviewer comment/reason with a documented maximum length (use PRD constraints if defined). Do not allow a blank rejection.
- Approval/commit endpoints revalidate the user's active membership, permission, quote/organization relationship, proposal state and base revision.
- Admin status never bypasses maker-checker, state constraints, revision checks, tenant isolation or audit recording.

### 4.5 Policy decisions

Use the existing Phase 4 pure policy evaluator and current configured policy values:

- line discount **greater than 5.00%** requires manager approval;
- grand total **greater than ₹500,000.00** requires manager approval;
- gross margin **below 15.00%** requires approval when cost data exists;
- where cost is absent, do not invent or infer margin; evaluate the other rules normally.

Important:

- Re-evaluate policies against the proposed calculation at submit time, then revalidate the relevant base/version and policy semantics when approval/commit occurs as required by the PRD. Persist the exact policy version/configuration and results reviewed by the approver. A configuration change must not silently change a decision already under review; define and document whether policy version mismatch requires resubmission. Follow PRD's rule that changes affect new proposals and do not silently rewrite an existing approval snapshot.
- Policy results are backend-calculated, not client-submitted. Store `requires_approval`, triggered rules, threshold values, measured values and the policy version/configuration snapshot.
- A proposal with required approval cannot be committed without a valid approval decision by a distinct authorized user. A validated low-risk proposal whose calculated policy result requires no approval may be explicitly committed using the PRD-permitted direct-commit path; it still requires current revision/version validation, authorization, transaction safety and idempotency.
- Do not misrepresent warning-only policies as approval-required unless the PRD/config says so.

### 4.6 Atomic commit and concurrency

The commit operation must have a real PostgreSQL concurrency boundary:

1. Begin transaction.
2. Load and lock the quote row (`SELECT ... FOR UPDATE`) or use a transactionally correct compare-and-swap/expected-version approach. Never rely on an in-memory mutex.
3. Validate organization, quote state, proposal status, base revision ID/version, current revision pointer, proposer/reviewer identities, approval decision and idempotency request.
4. Re-load the authoritative current revision within the transaction and reapply the frozen allowlisted operations to a fresh domain representation.
5. Run the existing Decimal calculator and policy evaluator. Compare server-calculated snapshot/fingerprint with the submitted/frozen proposal's expected data. Reject inconsistent/stale data; never trust client totals.
6. Allocate a unique next sequential revision number under concurrency control; add immutable `quote_revisions` and `quote_revision_lines` snapshots with full calculator and trace metadata consistent with Phase 4.
7. Update `quotes.current_revision_id`, quote version and status atomically.
8. Mark proposal `committed`, save the resulting revision reference and commit metadata, and insert `quote_approval_decisions`/audit/activity records in the same transaction as appropriate.
9. Persist a successful idempotency result for this exact key/payload.
10. Commit transaction. If any operation fails, roll back all writes; no orphan revision, moved pointer, partial decision or success audit event may remain.

Stale conditions return HTTP `409` with stable code `STALE_BASE_REVISION`, the current revision number and safe current-revision summary. Recommended message from PRD: “This proposal was based on an older quotation revision. No changes were committed. Reload the current quotation and create or reconcile a new proposal.” Never disclose cost or margin fields to unauthorized roles.

Idempotency:

- Require an idempotency key for proposal create/commit operations where the PRD requires it; use bounded, validated values and scope uniqueness to organization + endpoint/action as documented.
- Same key + same canonical request payload returns the original successful result (same proposal/commit/revision ID).
- Same key + a different canonical payload returns a stable `409`/validation error; never reinterpret it as a new operation.
- Protect with database unique constraints and transaction handling. An in-process cache is not sufficient.
- A repeated approve/reject request must not create multiple approval decisions for the same decision command. Return the original outcome when a valid retry is detected or return a consistent state conflict.

### 4.7 Immutable and append-only records

- Historical quote revisions, accepted/rejected approval decisions and finalized proposal operations are immutable through ordinary application endpoints.
- Audit events should be append-only at the application layer. Do not edit old audit rows to describe later actions.
- Persist associated quote/proposal mutation and audit/activity event in the same transaction when completeness is required.
- No physical deletion of quotes, revisions, proposals or approval decisions to “undo” a workflow. Use state transitions and compensating new revisions.

---

## 5. Persistence and migrations

Create a new forward migration, expected to be named `0005_quote_proposals_and_approvals.py` or the next correct revision ID based on the actual migration tree. Do not edit/recreate migrations `0001`–`0004` or reset data to bypass migration problems.

### 5.1 `quote_change_proposals`

Implement the schema from PRD Section 10.1 with types and constraints matching the actual project conventions. At minimum persist:

- `id` UUID primary key;
- `organization_id`, `quote_id` foreign keys;
- unique organization-scoped proposal number if the existing numbering convention supports it;
- `base_revision_id`, `base_version` (immutable after creation/submission);
- `status` constrained to the defined lifecycle;
- `proposer_user_id`, optional `reviewer_user_id`;
- required proposer reason and optional reviewer comment/rejection reason;
- versioned `proposed_changes_json` / normalized operation payload or normalized child rows;
- base/before and proposed/after calculation snapshots;
- policy-check result and policy-config/version snapshot;
- calculator version and canonical input fingerprint(s);
- idempotency key and request fingerprint as needed;
- submitted/decided/committed/cancelled timestamps;
- resulting revision ID nullable until commit;
- created/updated timestamps and optimistic version if the repository's conventions require it.

### 5.2 `quote_proposal_changes` (if normalized)

Use a child table when it improves querying or validation. If operations are persisted as JSON, strictly validate the entire JSON against a versioned schema and include all fields needed for audit/review. Don't persist the same mutable truth twice without a documented authority.

### 5.3 `quote_approval_decisions`

At minimum persist:

- UUID ID, `organization_id`, `quote_id`, proposal ID nullable for initial quote approval, exact base revision ID/version;
- reviewer user ID and `decision` (`approved`/`rejected`);
- required decision comment for rejection and optional approval note;
- policy-check/configuration snapshot and proposal/input fingerprint;
- decision timestamp;
- resulting revision ID nullable until committed;
- created timestamp and any idempotency key required for decision retries.

Decision records are append-only. Use constraints to prevent ambiguous duplicate decisions for a single submitted proposal where appropriate, while still retaining a legitimate later decision history if the PRD/state model explicitly permits it.

### 5.4 Database integrity

- Add indexes for organization, quote, status, proposer, reviewer and queue ordering (`submitted_at`/`created_at`).
- Use foreign keys and same-organization relationship validation; prevent cross-tenant proposal/revision/quote references.
- Add `CHECK` constraints for positive base/revision versions and allowed statuses/types where supported.
- Enforce proposal idempotency uniqueness at the database level.
- Validate that proposal base revision belongs to its quote/organization; enforce transactionally and with composite constraints if practical in the existing schema.
- Ensure a resulting revision belongs to the same quote and organization.
- Keep foreign-key behavior historical-data-safe (no cascade deletes through business history).

---

## 6. Backend domain/service architecture

Keep routers thin and use current repository conventions. Prefer explicit modules such as these if compatible with the actual tree:

```text
backend/app/domain/proposals/
  operations.py       # strict operation definitions and domain validation
  diff.py             # deterministic structured before/after diff
  lifecycle.py        # allowed transitions and state preconditions
  policy_snapshot.py  # pure snapshot comparison/version rules if required
backend/app/services/proposal_service.py
backend/app/services/approval_service.py
backend/app/repositories/proposal_repository.py
backend/app/schemas/proposals.py
backend/app/schemas/approvals.py
backend/app/api/v1/proposals.py
backend/app/api/v1/approvals.py   # or use current router convention
```

Do not create one-file-per-layer abstractions that merely forward calls without adding a responsibility. Avoid circular imports and keep pure domain code independent of FastAPI/SQLAlchemy wherever practical.

### 6.1 Domain helpers required

Implement unit-testable functions for:

- validating operation shape and target field;
- applying an operation set to an isolated revision snapshot;
- detecting conflicting operations and validating old-value expectations;
- deterministic before/after line/field diff generation;
- calculating proposal-level financial impact using existing calculator output;
- evaluating lifecycle transitions;
- maker-checker eligibility;
- idempotency payload canonicalization/fingerprinting;
- deciding which data is safe for each role.

The domain/service layer must use the current Phase 4 pricing engine and policy evaluator. Do not fork or rewrite them.

### 6.2 API endpoints

Implement and document the endpoints in the PRD. Names may follow existing router conventions, but path/method behavior must be compatible with PRD Section 11.6–11.7:

- `POST /api/v1/quotes/{quote_id}/proposals` — create isolated draft proposal; validate idempotency key, base revision/version and operation payload.
- `GET /api/v1/quotes/{quote_id}/proposals` — list proposals for this quote, role-safe and paginated if consistent with repository patterns.
- `GET /api/v1/proposals/{proposal_id}` — return proposal state, base revision summary, proposed scenario, policy snapshot and relevant history with field-level role redaction.
- `PATCH /api/v1/proposals/{proposal_id}` — update operations/reason only while `draft`; require proposal expected version; revalidate and recalculate isolated scenario. Do not edit after submit.
- `POST /api/v1/proposals/{proposal_id}/submit` — run full validation and policy evaluation, freeze proposal, record submission time/snapshot, transition to pending review or documented direct-path state.
- `POST /api/v1/proposals/{proposal_id}/approve` — authorized manager/admin only, maker-checker enforced, bind decision to exact proposal/base snapshot. No commit happens implicitly unless the PRD allows and the implementation decision is documented; preferred design is an explicit subsequent commit.
- `POST /api/v1/proposals/{proposal_id}/reject` — authorized manager/admin; non-empty reason/comment; append decision and audit.
- `POST /api/v1/proposals/{proposal_id}/commit` — transaction-safe, idempotent, stale-guarded commit with `Idempotency-Key` or the exact header/field convention chosen in one ADR/API contract.
- `GET /api/v1/proposals/{proposal_id}/diff` — server-produced structured line-by-line and field-by-field diff, before/after calculated impact and safe policy indicators.
- `GET /api/v1/approvals?status=pending&...` — role-filtered approval queue with pagination/filter/sort following repository conventions.
- `POST /api/v1/quotes/{quote_id}/submit-for-approval` — freeze/submit initial quote revision for policy-required approval, with expected quote/revision version.
- `POST /api/v1/quotes/{quote_id}/approve-initial` — authorized manager/admin, maker-checker and exact revision checks, append decision; update approved state only under valid transaction and documented status model.
- `POST /api/v1/quotes/{quote_id}/cancel` only if required for correct integration with the PRD quote state machine and supported by the actual current implementation. If out of scope, document the reason and do not create dead endpoints.

### 6.3 API contract requirements

For every mutation document in `docs/API.md`:

- permission/role requirements;
- request model and required expected version/revision;
- lifecycle preconditions;
- idempotency requirements;
- transaction and side effects;
- stable success response;
- error code/status, including `401`, `403`, `404`, `409`, `422` and validation issues as relevant;
- redaction rules.

Use the existing consistent error envelope: `code`, `message`, optional safe `details`, `request_id`. Keep API names/fields in the project's established JSON naming convention. Do not expose SQL details, tracebacks, internal costs/margins, sessions or unrelated tenant existence in errors. Use explicit command endpoints for approve/reject/commit; never hide a consequential workflow transition inside generic `PATCH`.

### 6.4 Organization scoping and permissions

Every query and related-record resolution must scope to the authenticated user's active organization. Do not first load by ID globally and assume that later authorization repairs the leak. Validate quote, proposal, base revision, line, RFQ source line, catalog product, proposer and reviewer organizations together.

- `sales_rep`: can create/manage their permitted drafts and proposals, view their permitted quote/proposal history and submit proposals. Cannot review/approve/reject commercial proposals.
- `sales_manager`: can see organization/team approval queue and review another user's submitted proposals; cannot approve own proposal; cannot bypass concurrency/state rules.
- `catalog_manager`: catalog access only; no commercial approval permissions unless explicitly granted by the existing PRD (do not infer them).
- `admin`: can manage organization policy/settings as defined by PRD and review eligible proposals, but cannot approve a proposal they created.
- API authorization is authoritative. Hiding a button is not authorization.
- Preserve server-side role-based cost/margin and trace redaction from Phase 4. Approval diffs and responses must not reveal internal cost, line cost, gross profit or margin to `sales_rep`/other unauthorized roles. Scrub structured trace nodes and snapshots, not only top-level display fields.

---

## 7. Frontend implementation and visual quality

The existing ForgeFlow visual design system is a contract. Make the approval/review experience feel as polished as the RFQ Review Studio and quote builder without altering global design tokens.

### 7.1 Required routes

- `/app/approvals` — real role-filtered approval queue.
- Quote detail/revision routes should expose proposal history and links to the exact proposal/diff/revision without confusing draft state and committed state.
- Use `/app/quotes/[quoteId]/revisions/[revisionId]` for a revision detail/trace/diff view if the route pattern in the current app matches the PRD; follow current routing conventions exactly.
- A dedicated proposal review route may be added if it produces a clearer full-page review experience, but document the canonical route in `docs/architecture.md` and use it consistently.

Do not add a second visual system or global layout. Reuse the existing app shell, tokens, Base UI/shadcn components, Motion conventions, TanStack Query, generated API types, table and sheet/dialog primitives.

### 7.2 Approval queue information architecture

Build a useful manager queue from real persisted proposals/initial quotes, not seeded-only client-side arrays. Each row/card should show as permitted:

- quote number and customer/account;
- opportunity and quote owner/proposer;
- proposal number and short change summary;
- current committed revision and proposal base revision;
- submitted age/time and queue age;
- proposed total and absolute/percentage commercial impact;
- triggered policy rules (e.g., discount over threshold, grand total over threshold, margin below threshold) without revealing restricted margin/cost data;
- current lifecycle state and clear next action.

Required behaviors: pending-first default, status filters consistent with API, search by quote/customer/proposer, sort by age/impact where safe, pagination where the dataset requires it, clear empty state, loading skeleton, retryable error state, permission-denied state and accessible row/card actions. Do not use arbitrary urgency scores or fake counts.

### 7.3 Review-before-write detail experience

The reviewer must see the full change before deciding. Include:

1. **Review header:** quote/customer, proposer, submission timestamp, base revision, proposal status and explicit “nothing committed yet” indicator while pending.
2. **Business reason:** original proposal reason and per-operation reasons.
3. **Before/after diff:** grouped quote-level term changes and line-level changes; for each changed field show old value, proposed value, unit, line/product reference and calculation effect. Added/removed lines must be represented explicitly.
4. **Impact summary:** base total, proposed total, absolute delta and percentage delta; subtotal/discount/tax/grand total as applicable; show margin only to roles permitted to know it.
5. **Policy review:** triggered rules with configured threshold and measured value, reviewer-readable explanation, whether approval is required, and the exact policy snapshot/version reviewed.
6. **Calculation trace:** reuse the Phase 4 trace system for before/after. Show inputs, arithmetic operation, rounding boundary and source snapshots; respect Phase 4 server redaction.
7. **History:** proposal lifecycle events and prior decisions/comments, with actor and timestamp.
8. **Decision actions:** Approve and Reject with distinct confirmation flows, required reason/comment for rejection, explicit no-self-approval explanation, and disabled state while a mutation is pending.
9. **Conflict/stale behavior:** show a visible stale warning, why the proposal cannot proceed, and an actionable link to the current quote revision; do not offer a misleading “force commit”.

### 7.4 Proposer experience

- Add a proposal creation flow from the current quote builder for a quote with a committed revision.
- Allow only the operation types in Section 4.2. Use typed forms and contextual per-operation explanations; never expose a JSON editor as the primary UX.
- Provide a reason for the overall proposal and a reason for every operation. Validate locally for fast feedback, but repeat all validation on the server.
- Show isolated live proposal preview, server-confirmed totals and change summary. Clearly label unsaved draft/proposed numbers so they cannot be mistaken for committed totals.
- Allow editing while draft, save/cancel draft, submit for review, view submission state and cancel only if lifecycle conditions permit.
- Once submitted, make the payload visibly read-only.
- When an operation creates a proposal, invalidate/update TanStack Query keys for quote detail, revisions, proposals, dashboard and approvals as appropriate. Never show “approved” or “committed” optimistically before server success.

### 7.5 Motion, interaction and responsiveness

- Use only existing Motion conventions and timings specified by PRD design-system section. Transitions are subtle; no motion should delay submit/approve/reject/commit.
- Respect `prefers-reduced-motion`.
- Ensure focus is visible and moves into dialogs/sheets appropriately, remains contained for modal interactions and returns to the initiating control on close.
- Status is never communicated by color alone; use labels/icons/text.
- At ≥1280px, use a dense but breathable queue table and two-column review layout where readable. At tablet width, preserve hierarchy with fewer columns and reveal details in stacked rows/cards. At mobile, use stacked cards and full-width action buttons; don't shrink the diff into illegible columns or create page-level horizontal overflow. If a diff requires horizontal reading, constrain scrolling to the diff region and supply accessible table semantics.
- Test at 1440×900, 1024×768 and 390×844, matching existing E2E conventions.
- Provide loading, empty, error, stale, permission, submitted, rejected, approved and committed states. Do not add dead-end buttons or fake notifications.

### 7.6 Frontend state safety

- TanStack Query server data is authoritative. Browser-local forms are draft presentation state only.
- Do not calculate or assert authoritative commercial totals on the client; any live preview must be labelled pending and be replaced by server calculations.
- Use generated OpenAPI TypeScript types after endpoint/schema changes. Do not hand-maintain incompatible DTO duplicates.
- For 409 conflicts, preserve the user's draft content when safe, explain that no commit happened, and offer reload/reconcile or create-new-proposal actions. Never auto-retry a commit with a different key or new base revision.

---

## 8. Audit, activity, and visibility

Record events for at least:

- proposal created;
- draft proposal edited (can be summarized or record meaningful field changes, but do not log sensitive secret data);
- proposal submitted;
- proposal cancelled;
- proposal approved;
- proposal rejected with reason reference/comment as policy permits;
- proposal marked stale if this is persisted as a state change;
- proposal committed and target revision created;
- initial quote submitted for approval;
- initial quote approved/rejected;
- failed stale/duplicate commit attempts where the existing security/audit policy requires an event (never create a success event for failure).

Use existing activity and audit utilities and event naming conventions. Keep business activity separate from auth/security logs if the current architecture separates them. Write state mutation and successful audit/activity event in the same transaction when necessary to guarantee consistency.

Do not log passwords, cookies, raw session tokens, secrets or complete customer-sensitive traces. Apply the same role-safe filtering on history/detail/diff/queue endpoints as on quote endpoints.

---

## 9. Demo data and deterministic demonstration

Extend the existing idempotent seed process only; don't replace Phase 2/3 data or generate duplicates on repeat runs. Gate all demo seeding behind the existing `DEMO_MODE=true` behavior.

Create or update coherent synthetic scenarios covering:

1. At least one quote with a draft proposal and no committed mutation yet.
2. At least one pending discount proposal from a `sales_rep`, submitted against a known committed revision and awaiting a different manager.
3. At least one rejected proposal with a realistic, non-empty reviewer comment.
4. At least one committed proposal that has produced revision N+1 and retains visible revision/proposal history.
5. At least one stale proposal based on an older revision, safely reproducible without corrupting shared demo baseline data.
6. At least one initial quotation awaiting approval, with proposer and reviewer identities different.
7. If practical, one low-risk no-approval proposal for explicitly demonstrated direct commit, while keeping the standard demo focused on the maker-checker manager path.

Requirements:

- All customers, products, amounts, reasons and users are synthetic. Keep `.example` email conventions.
- Monetary amounts and all snapshots must be calculated by the existing quote calculator; never hand-enter inconsistent totals.
- Keep seeded data idempotent. Use stable natural keys or known IDs and update only the deterministic fixtures you own. Running `make seed` twice must not create duplicate proposals, decisions or revisions.
- Demo queue counters should come from real rows and match endpoint output.
- Document exact demo users/roles and reproducible clicks in `docs/demo-script.md`; do not expose demo credentials in production mode.

---

## 10. Testing and acceptance requirements

Test the domain, API, database transaction boundaries, role policies, frontend interactions and browser flows. Do not reduce or skip existing test suites to create a green report.

### 10.1 Domain unit tests

At minimum cover:

- valid/invalid operation payloads; unknown operations/fields; missing reason;
- duplicate/conflicting operations; stale old-value mismatch; invalid decimal precision and all bounds;
- applying each supported operation to an isolated snapshot;
- add-line source/product organization mismatch, inactive product, unreviewed or unrelated RFQ line;
- remove-line behavior preserving historical revision lines;
- deterministic diff and stable ordering/fingerprint;
- draft-only edit transitions and all allowed/forbidden lifecycle transitions;
- policy trigger boundary values: discount exactly 5.00% vs greater than 5.00%, grand total exactly ₹500,000 vs greater, margin exactly 15.00% vs below, and missing cost data;
- maker-checker equality and inequality for sales rep, sales manager and admin;
- idempotency canonicalization: same key/same payload vs same key/different payload;
- before/after trace and safe redaction behavior.

### 10.2 PostgreSQL integration tests

At minimum cover:

- migration from existing Phase 4 schema to Phase 5 schema without dropping data;
- create proposal leaves quote pointer/version/revision count unchanged;
- edit is allowed only while draft; submit freezes payload;
- proposal list/detail/diff are organization-scoped;
- manager can approve another user's valid proposal;
- proposer cannot approve own proposal, including manager/admin;
- sales_rep and catalog_manager cannot hit approval endpoints successfully;
- rejection requires a reason and produces no new committed revision;
- successful approval followed by commit creates exactly one new immutable revision and updates pointer/version in one transaction;
- initial quote approval uses exact revision and maker-checker;
- current revision changes after proposal creation/submission yields 409, no partial writes;
- database failure during commit rolls back revision, pointer, proposal status, decision and success audit;
- two concurrent commit attempts result in exactly one new revision and deterministic outcomes;
- same idempotency key/same payload returns same result without duplicate revision; reused key/different payload is rejected;
- tampered client totals/snapshots/status/organization/reviewer IDs are ignored or rejected;
- unauthorized roles never receive cost/margin fields in proposal JSON, diffs, traces, queue items, errors or history;
- all seeded proposal/approval fixtures and related revisions are idempotent.

Use the existing dedicated test database and fail-closed safeguards. No test may point to or reset the normal development/prod database.

### 10.3 Frontend component tests

Cover:

- queue filtering and state rendering from API-derived fixtures;
- reviewer diff display for changed/added/removed quote lines;
- no-self-approval UI explanation and disabled action;
- reject dialog requires a reason;
- submit/approve/reject/commit pending states and server error handling;
- 409 stale conflict UX preserves safe draft input and offers reload/reconcile;
- cost/margin values do not render for unauthorized user roles;
- keyboard navigation, dialog focus, accessible labels and status announcements.

### 10.4 Playwright end-to-end scenarios

Add realistic E2E tests using the actual backend and seeded PostgreSQL data. Keep all existing auth, CRM, RFQ, quote, responsive and Axe tests passing.

Required Phase 5 flows:

1. Sales rep creates a discount proposal; before/after totals are shown; committed quote stays unchanged.
2. Proposal submission freezes the draft and places it in the manager queue.
3. The same proposer, including when logged in as admin/manager, cannot approve it through the UI or direct API.
4. A distinct manager opens queue item, compares exact diff/policy results and approves.
5. Explicit commit creates revision N+1; quote list/detail shows the new revision and correct totals; proposal history records actors and times.
6. Manager rejects a proposal with a reason; no new revision is created and quote remains on its previous revision.
7. Concurrent or stale proposal returns a clear `409`; no duplicate/partial revision exists and user can load current revision.
8. Same commit idempotency key does not create duplicate revision; key reuse with different payload is rejected.
9. Initial quote requiring approval cannot become approved through a same-user approval; a different authorized manager can approve valid matching revision.
10. Unauthorized role cannot load approval queue or call approve/reject endpoint.
11. Queue and detail screens work at desktop/tablet/mobile viewports with zero horizontal document overflow.
12. Axe accessibility scan on approval queue and review detail has zero serious/critical violations; record any pre-existing violations separately and don't dismiss them silently.

### 10.5 Full quality gates

Run the repository's real commands, at minimum:

- `make lint`
- `make typecheck`
- `make test`
- `make build`
- `make test-e2e` (or the exact documented equivalent)
- `make openapi-generate` after adding/updating schemas/endpoints, then verify the generated diff is reproducible
- fresh migration smoke test against a dedicated clean test database

Run commands after the final changes, not merely before the last commit. Capture actual pass/fail outputs and do not claim a quality gate is green if a command was skipped, blocked or failed.

---

## 11. Documentation and agent handoff

Update these files using actual implementation evidence:

- `docs/API.md`: all new proposal/approval endpoints, request/response contracts, roles, lifecycle preconditions, idempotency semantics, errors and redaction rules.
- `docs/architecture.md`: proposal isolation, transaction boundary, locking/CAS strategy, lifecycle, calculator/policy reuse and component boundaries.
- `docs/data-dictionary.md`: new proposal/decision/optional operation tables, indexes and constraints.
- `docs/security.md`: maker-checker, reviewer permissions, tenant consistency, cost/margin redaction and idempotency controls.
- `docs/test-plan.md`: cases and commands actually run, including concurrency and transaction tests.
- `docs/demo-script.md`: working end-to-end proposal → manager review → commit and rejection/stale scenarios.
- `docs/agent-handoff.md`: Phase 5 completion details and exact Phase 6 scope.
- Add an ADR documenting any nontrivial choice regarding proposal operations persistence, commit/idempotency, initial-quote approval state modeling, or policy-snapshot drift.
- Keep `PRD.md` unchanged. If a product-level contradiction requires amendment, use a dedicated ADR/change proposal and do not silently alter the source of truth.

The handoff must state:

- exact migration IDs and database tables added;
- files/modules created/changed;
- endpoint list and permissions;
- lifecycle/state transitions implemented;
- locking/CAS approach and idempotency contract;
- test commands and observed results, with `PASS` / `FAIL` / `BLOCKED`;
- any unimplemented requirements or known limitations;
- confirmation that Phase 1–4 regressions were checked;
- exact next assignment: Phase 6 only — guarded PDF/CSV exports, audit/dashboard finishing, full end-to-end demo polish and deployment-facing verification, following PRD.

---

## 12. Protected files and behaviors

Do not rewrite or weaken these foundations to make approval implementation easier:

- `PRD.md` — source of truth.
- Phase 4 Decimal calculator modules under `backend/app/domain/quotes/` (including money/rounding/calculator/policies/trace) — keep them authoritative; extend through stable interfaces only when necessary and tested.
- `backend/app/auth/session.py`, `passwords.py`, `csrf.py` and current rate limiting/session behavior.
- Frontend `client.ts` or its real equivalent — preserve CSRF/error conventions.
- `frontend/app/globals.css` design tokens and the established light/dark themes.
- Existing generated OpenAPI types process, DB/test safety guardrails, CRM/catalog/RFQ endpoints and migrations.

Do not alter an applied migration to add proposal tables. Add a forward migration. Do not perform destructive database reset against a production-like environment. Do not expose internal cost/margin through proposal snapshots or traces. Do not weaken tests, matching rules or role checks.

---

## 13. Suggested execution order

1. Read PRD, agent handoff and Phase 4 code; verify baseline checks and git status.
2. Map current quote/revision schema, policy settings, trace fields, role permissions, audit helpers and API response conventions.
3. Write a short implementation plan/ADR covering lifecycle, proposal persistence, policy snapshots and idempotency.
4. Implement migration and SQLAlchemy models; verify migration forward-only against current Phase 4 data.
5. Implement strict operation schemas and pure domain helpers; add unit tests before service endpoints.
6. Implement proposal services, lifecycle/state transitions, policy evaluation reuse and server-produced diffs.
7. Implement approval decision service with strict maker-checker checks.
8. Implement transactional commit using row locking/CAS, idempotency constraints, immutable revision creation and same-transaction audit/activity.
9. Implement initial quote approval behavior and approval queue API.
10. Regenerate OpenAPI TypeScript types.
11. Build proposal creation/review/manager queue UI reusing design system; implement all loading/error/empty/permission/stale states.
12. Extend deterministic, idempotent demo seed fixtures.
13. Write domain/integration/component/E2E/accessibility tests; run all existing and new quality gates; fix regressions.
14. Review security risks, inspect final diffs and docs, update `docs/agent-handoff.md`.
15. Produce a truthful Phase 5 completion report.

Do not proceed to Phase 6 export implementation as a shortcut to showing a completed quote. The task is complete when the proposal lifecycle, approval queue, maker-checker rule, revision-safe atomic commit and their UI/tests all work correctly.

---

## 14. Required final implementation report

Return a concise but evidence-backed report with these headings:

1. **Scope delivered** — list each Phase 5 requirement and status.
2. **Database/migrations** — migration IDs, tables, constraints and indexes.
3. **Workflow model** — actual lifecycle and initial-quote approval path.
4. **Security/concurrency** — maker-checker, role authorization, tenant scoping, lock/CAS and idempotency behavior.
5. **API/UI** — routes, screens and important states.
6. **Verification** — every command executed, `PASS`/`FAIL`/`BLOCKED`, observed counts/timings if available; explicitly distinguish reported baselines from commands actually run now.
7. **Docs/demo data** — changed files and reproducible demo path.
8. **Known issues/limitations** — truthful and specific.
9. **Next step** — direct the next agent to read `PRD.md` and `docs/agent-handoff.md`, then implement Phase 6 only.

A correct Phase 5 implementation is not merely a functional Approve button. It is a revision-safe, auditable, transactionally correct, role-secure proposal system with a polished review experience and proof in automated tests.
