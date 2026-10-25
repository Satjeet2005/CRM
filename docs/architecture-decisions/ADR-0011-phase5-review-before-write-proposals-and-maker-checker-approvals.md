# ADR-0011: Phase 5 Review-Before-Write Proposals, Maker-Checker Authorization, and Atomic Commit Architecture

## Status
Accepted

## Context
ForgeFlow unifies CRM, RFQ line-item normalization, and commercial quote governance. In Phase 4, an authoritative pure-Python Decimal pricing engine and immutable revision snapshot architecture (`quote_revisions`, `quote_revision_lines`) were established.

Phase 5 introduces quotation governance concepts adapted from Model Change Review Lab:
1. **Proposal Isolation (Review Before Write)**: Commercial changes to committed quotations cannot mutate active revisions directly. Instead, proposed operations branch into an isolated change proposal.
2. **Allowlisted Operations**: Only explicit, strictly validated operations (changing line quantity, unit price, discount %, tax %, adding/removing lines, or editing validity/payment/delivery terms) are permitted.
3. **Maker-Checker Security Invariant**: Proposers cannot approve their own change proposals or initial quotes requiring manager review, even if they hold `sales_manager` or `admin` roles.
4. **Authoritative Server Diff & Traceability**: The backend reconstructs true before/after line diffs, financial impact deltas, and recalculates policy evaluations using the Phase 4 pricing engine.
5. **Atomic Commit & Concurrency Safety**: When approved, committing a proposal creates a new immutable revision $N+1$, repoints `quotes.current_revision_id`, updates quote version/status, and logs audit events in a single database transaction under row-level locking (`SELECT ... FOR UPDATE`). Stale proposals or concurrent commits fail closed with `HTTP 409 Conflict` (`STALE_BASE_REVISION`).

## Decisions

### 1. Proposal Persistence & Lifecycle
We create table `quote_change_proposals` capturing:
- `base_revision_id` and `base_version`: Immutable anchor bound to the quote's committed revision at creation.
- Strict lifecycle states: `draft -> pending_review -> approved -> committed` (with terminal paths `rejected`, `cancelled`, and `stale`).
- `proposed_changes_json`: Validated array of typed operation objects matching PRD Section 6.9 allowlist.
- Calculation snapshots: Storing base and proposed recalculation snapshots and policy evaluations computed authoritatively by `app.domain.quotes.calculator`.

### 2. Append-Only Approval Decisions
Table `quote_approval_decisions` stores an immutable, append-only ledger of manager reviews:
- Captures `reviewer_user_id`, `decision` (`approved` or `rejected`), `decision_comment`, timestamp, and policy snapshot.
- Rejection requires a non-empty comment.
- Serves both proposal reviews and initial quote approvals (`proposal_id` is nullable for initial quote approvals).

### 3. Maker-Checker Enforcement
Enforced authoritatively at the API and domain service boundaries:
```python
if proposal.proposer_user_id == ctx.user.id:
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={
            "code": "MAKER_CHECKER_VIOLATION",
            "message": "Proposers cannot approve their own proposals.",
        },
    )
```
For initial quote approval:
```python
if quote.created_by == ctx.user.id:
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={
            "code": "MAKER_CHECKER_VIOLATION",
            "message": "Quote creators cannot approve their own initial quotations.",
        },
    )
```
Admin status never bypasses this invariant.

### 4. Atomic Commit with Row-Level Lock & Idempotency
`POST /api/v1/proposals/{proposal_id}/commit` executes:
1. `SELECT * FROM quotes WHERE id = ... FOR UPDATE` (database row lock).
2. Verifies proposal is in `approved` status.
3. Compares `quote.current_revision_id == proposal.base_revision_id`. If unequal, transitions proposal to `stale` and raises `HTTP 409 Conflict` (`STALE_BASE_REVISION`).
4. Re-applies allowlisted operations to base revision lines, recalculates totals with `calculate_quote`, and allocates revision $N+1$.
5. Inserts new `QuoteRevision` and `QuoteRevisionLine` rows.
6. Updates `quote.current_revision_id = new_revision.id`, updates quote version, updates proposal status to `committed`.
7. Records audit activity and idempotency key response in the same transaction.

### 5. Server-Side RBAC Redaction
In proposal details, queue listings, before/after diffs, and calculation traces, cost and margin metrics (`unit_cost`, `line_cost`, `line_gross_profit`, `margin_percent`, `total_cost`, `total_gross_profit`, `overall_margin_percent`) are strictly scrubbed to `null` on the server before serialization for unauthorized roles (`sales_rep`, `sales_manager`).

## Consequences
- Guarantees review-before-write safety without risky in-place revision edits.
- Eliminates race conditions and lost updates on commercial quotes.
- Provides 100% auditable traceability conforming to OWASP ASVS and PRD Section 6.9.
