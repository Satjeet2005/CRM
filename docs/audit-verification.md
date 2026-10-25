# ForgeFlow Relational & Audit Verification Tool

ForgeFlow enforces enterprise-grade auditability, revision safety, maker-checker duty separation, and cryptographic document delivery tracking.

The **Audit Verification Tool** (`make verify-audit`) is a read-only diagnostics and operational auditing suite designed to verify that the live database satisfies all 9 core structural and commercial invariants.

---

## 1. Execution & CLI Interface

### Running via Makefile
```bash
make verify-audit
```

### Running via Python Module
```bash
cd backend
uv run python -m app.cli.verify_audit
```

### Options & Flags
- `--json`: Outputs results in machine-readable JSON format for SIEM/automated monitoring ingestion.
- `--verbose`: Emits detailed verification diagnostics for every entity examined.

### Exit Codes
- **`0`**: All 9 relational and business invariants passed with zero discrepancies.
- **`1`**: One or more invariants failed, or an unhandled database exception occurred.

---

## 2. The 9 Relational & Commercial Invariants

| # | Invariant Name | Scope | Description & Safety Guarantee |
| :--- | :--- | :--- | :--- |
| **1** | **Quote Current Revision Pointer** | `Quote` -> `QuoteRevision` | Every quote's `current_revision_id` must be non-null and belong strictly to that same `quote_id`. Revisions from different quotes cannot be cross-referenced. |
| **2** | **Revision Sequence Monotonicity** | `QuoteRevision` | Revisions within each quote must possess contiguous sequence numbers `[1, 2, ...]` without duplicates or numbering gaps. |
| **3** | **Committed Proposal Alignment** | `QuoteChangeProposal` | Any proposal with `status = 'committed'` must reference a non-null `resulting_revision_id` pointing to a valid committed revision for that quote. |
| **4** | **Maker-Checker Separation of Duties** | `QuoteChangeProposal` | The user who approved or rejected a commercial proposal (`decided_by_user_id`) must NEVER be the user who authored/proposed it (`proposer_user_id`). Prevents self-approval of discounts and margins. |
| **5** | **Proposal Decision Completeness** | `QuoteChangeProposal` | All decided proposals (`approved`, `rejected`) must possess non-null `decided_at` and `decision_reason`. Rejected proposals must explicitly document commercial rationale. |
| **6** | **RFQ Line Decision Integrity** | `RFQLineDecision` | Line-item catalog matches and overrides must link to an authenticated `actor_user_id`, a valid `rfq_line_id`, and record matching rationale. |
| **7** | **Delivery Checksum Integrity** | `QuoteCustomerDelivery` | The recorded `sha256_hash` must match the re-computed SHA-256 digest of stored customer artifacts byte-for-byte. |
| **8** | **Export Governance & Draft Gate** | `QuoteCustomerDelivery` | Quotes with `status = 'draft'` must NEVER have recorded customer export deliveries with `export_type = 'customer_final'`. Draft exports must fail closed. |
| **9** | **CRM Activity Audit Trail** | `Activity` | Every committed quotation, approved change proposal, and customer document delivery must emit a structured immutable CRM activity log record. |

---

## 3. Sample Output

### Standard Terminal Output
```text
======================================================================
  FORGEFLOW RELATIONAL & AUDIT INTEGRITY VERIFIER
======================================================================
[INFO] Connecting to database...
[INFO] Verifying Invariant 1: Quote Current Revision Pointers... [PASS] (Verified 12 quotes)
[INFO] Verifying Invariant 2: Revision Sequence Monotonicity...   [PASS] (Verified 18 revisions)
[INFO] Verifying Invariant 3: Committed Proposal Alignment...    [PASS] (Verified 7 proposals)
[INFO] Verifying Invariant 4: Maker-Checker Duty Separation...    [PASS] (0 duty violations)
[INFO] Verifying Invariant 5: Proposal Decision Completeness...  [PASS] (All decisions complete)
[INFO] Verifying Invariant 6: RFQ Line Decision Integrity...     [PASS] (Verified 24 decisions)
[INFO] Verifying Invariant 7: Delivery Checksum Integrity...     [PASS] (Verified 5 customer files)
[INFO] Verifying Invariant 8: Export Governance & Draft Gate...  [PASS] (No unauthorized deliveries)
[INFO] Verifying Invariant 9: CRM Activity Audit Trail...        [PASS] (All milestones tracked)
======================================================================
AUDIT VERIFICATION SUMMARY: 9/9 INVARIANTS SATISFIED (STATUS: CLEAN)
======================================================================
```

### JSON Output (`--json`)
```json
{
  "status": "PASS",
  "invariants_checked": 9,
  "invariants_passed": 9,
  "invariants_failed": 0,
  "failures": [],
  "timestamp": "2026-10-25T03:35:00.000000Z"
}
```

---

## 4. Invariant Failure Remediation Runbook

If `make verify-audit` returns exit code 1:

### If Invariant 4 Fails (Maker-Checker Violation):
- **Impact**: Severe compliance violation (self-approval).
- **Remediation**:
  1. Inspect the failing proposal ID from CLI diagnostics:
     ```bash
     docker compose exec backend uv run python -m app.cli.verify_audit --verbose
     ```
  2. Flag the affected proposal for immediate executive review.
  3. Ensure application role assignments prevent users from assuming dual `sales_rep` and `sales_manager` roles on the same quotation.

### If Invariant 7 Fails (Delivery Checksum Mismatch):
- **Impact**: Document tampering or file corruption detected.
- **Remediation**:
  1. Identify affected delivery record in `quote_customer_deliveries`.
  2. Verify storage volume filesystem health.
  3. Regenerate and re-sign delivery document from the immutable revision snapshot.
