import dataclasses
import logging
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.crm import Activity
from app.models.export import ExportEvent, QuoteCustomerDelivery
from app.models.proposal import QuoteApprovalDecision, QuoteChangeProposal
from app.models.quote import Quote, QuoteRevision
from app.models.rfq import RFQLine, RFQLineDecision

logger = logging.getLogger("forgeflow.audit")

SHA256_HEX_REGEX = re.compile(r"^[a-f0-9]{64}$")


@dataclasses.dataclass
class AuditCheckResult:
    check_name: str
    status: str  # "PASS", "FAIL", "NOT_CHECKABLE"
    details: str
    violations: list[str] = dataclasses.field(default_factory=list)


@dataclasses.dataclass
class AuditVerificationReport:
    total_checks: int
    passed_checks: int
    failed_checks: int
    uncheckable_checks: int
    results: list[AuditCheckResult]

    @property
    def is_clean(self) -> bool:
        return self.failed_checks == 0


def verify_database_audit_integrity(
    db: Session, org_id: str | None = None
) -> AuditVerificationReport:
    """
    Read-only verification of database audit integrity, relational consistency,
    maker-checker separation, and deliverable cryptographic checksum validity.
    Never modifies, auto-repairs, or deletes any database rows.
    """
    results: list[AuditCheckResult] = []

    # 1. Quote current revision pointer integrity
    stmt_quotes = select(Quote)
    if org_id:
        stmt_quotes = stmt_quotes.where(Quote.organization_id == org_id)
    quotes = db.scalars(stmt_quotes).all()

    q_pointer_violations = []
    for q in quotes:
        if q.current_revision_id:
            rev = db.get(QuoteRevision, q.current_revision_id)
            if not rev:
                q_pointer_violations.append(
                    f"Quote {q.quote_number} points to missing revision {q.current_revision_id}"
                )
            elif rev.quote_id != q.id or rev.organization_id != q.organization_id:
                q_pointer_violations.append(
                    f"Quote {q.quote_number} points to foreign revision {rev.id}"
                )
    results.append(
        AuditCheckResult(
            check_name="quote_current_revision_pointer_integrity",
            status="PASS" if not q_pointer_violations else "FAIL",
            details=f"Verified {len(quotes)} quote revision pointer(s)",
            violations=q_pointer_violations,
        )
    )

    # 2. Revision sequential numbering per quote
    rev_seq_violations = []
    for q in quotes:
        revs = db.scalars(
            select(QuoteRevision)
            .where(QuoteRevision.quote_id == q.id)
            .order_by(QuoteRevision.revision_number.asc())
        ).all()
        expected = 1
        for r in revs:
            if r.revision_number != expected:
                rev_seq_violations.append(
                    f"Quote {q.quote_number} has non-sequential revision #{r.revision_number} (expected #{expected})"
                )
            expected += 1
    results.append(
        AuditCheckResult(
            check_name="quote_revision_numbering_sequential",
            status="PASS" if not rev_seq_violations else "FAIL",
            details=f"Verified revision sequence across {len(quotes)} quote(s)",
            violations=rev_seq_violations,
        )
    )

    # 3. Proposal committed status & revision resolution
    stmt_props = select(QuoteChangeProposal)
    if org_id:
        stmt_props = stmt_props.where(QuoteChangeProposal.organization_id == org_id)
    proposals = db.scalars(stmt_props).all()

    prop_commit_violations = []
    for p in proposals:
        if p.status == "committed":
            if not p.resulting_revision_id:
                prop_commit_violations.append(
                    f"Proposal {p.proposal_number} is marked 'committed' but has null resulting_revision_id"
                )
            else:
                rev = db.get(QuoteRevision, p.resulting_revision_id)
                if not rev or rev.quote_id != p.quote_id:
                    prop_commit_violations.append(
                        f"Proposal {p.proposal_number} resulting_revision_id {p.resulting_revision_id} does not resolve"
                    )
        elif p.resulting_revision_id:
            prop_commit_violations.append(
                f"Proposal {p.proposal_number} has status '{p.status}' but possesses resulting_revision_id {p.resulting_revision_id}"
            )
    results.append(
        AuditCheckResult(
            check_name="proposal_committed_status_integrity",
            status="PASS" if not prop_commit_violations else "FAIL",
            details=f"Verified {len(proposals)} proposal commit pointer(s)",
            violations=prop_commit_violations,
        )
    )

    # 4. Maker-Checker separation of duties on proposals
    maker_checker_violations = []
    for p in proposals:
        if p.reviewer_user_id and p.proposer_user_id == p.reviewer_user_id:
            maker_checker_violations.append(
                f"Maker-checker violation: User {p.proposer_user_id} authored and reviewed proposal {p.proposal_number}"
            )
        if p.status == "rejected" and not (p.reviewer_comment and p.reviewer_comment.strip()):
            maker_checker_violations.append(
                f"Rejection rationale violation: Proposal {p.proposal_number} rejected without explanation comment"
            )
    results.append(
        AuditCheckResult(
            check_name="maker_checker_separation_and_rejection_mandate",
            status="PASS" if not maker_checker_violations else "FAIL",
            details=f"Audited {len(proposals)} proposal authorization record(s)",
            violations=maker_checker_violations,
        )
    )

    # 5. Immutable quote approval decisions audit log
    stmt_decisions = select(QuoteApprovalDecision)
    if org_id:
        stmt_decisions = stmt_decisions.where(QuoteApprovalDecision.organization_id == org_id)
    decisions = db.scalars(stmt_decisions).all()

    decision_violations = []
    for d in decisions:
        if not d.reviewer_user_id or not d.decision:
            decision_violations.append(f"Decision {d.id} missing mandatory reviewer or outcome")
        if d.decision == "rejected" and not (d.decision_comment and d.decision_comment.strip()):
            decision_violations.append(f"Decision {d.id} is 'rejected' without recorded comment")
    results.append(
        AuditCheckResult(
            check_name="approval_decisions_immutable_audit_log",
            status="PASS" if not decision_violations else "FAIL",
            details=f"Verified {len(decisions)} formal approval decision record(s)",
            violations=decision_violations,
        )
    )

    # 6. RFQ line decisions organization and actor integrity
    stmt_rfq_dec = select(RFQLineDecision)
    rfq_decisions = db.scalars(stmt_rfq_dec).all()
    rfq_dec_violations = []
    for rd in rfq_decisions:
        line = db.get(RFQLine, rd.rfq_line_id)
        if not line:
            rfq_dec_violations.append(
                f"RFQ decision {rd.id} points to missing line {rd.rfq_line_id}"
            )
        if not rd.actor_user_id:
            rfq_dec_violations.append(f"RFQ decision {rd.id} missing actor_user_id")
    results.append(
        AuditCheckResult(
            check_name="rfq_line_decisions_audit_integrity",
            status="PASS" if not rfq_dec_violations else "FAIL",
            details=f"Audited {len(rfq_decisions)} human RFQ line decision record(s)",
            violations=rfq_dec_violations,
        )
    )

    # 7. Customer delivery ledger SHA-256 format & deliverable relations
    stmt_deliv = select(QuoteCustomerDelivery)
    if org_id:
        stmt_deliv = stmt_deliv.where(QuoteCustomerDelivery.organization_id == org_id)
    deliveries = db.scalars(stmt_deliv).all()

    delivery_violations = []
    for deliv in deliveries:
        if not SHA256_HEX_REGEX.match(deliv.sha256_hash):
            delivery_violations.append(
                f"Delivery {deliv.id} has invalid SHA-256 hash format: '{deliv.sha256_hash}'"
            )
        quote_obj = db.get(Quote, deliv.quote_id)
        if not quote_obj or quote_obj.organization_id != deliv.organization_id:
            delivery_violations.append(
                f"Delivery {deliv.id} points to non-existent or foreign quote {deliv.quote_id}"
            )
        rev = db.get(QuoteRevision, deliv.revision_id)
        if not rev or rev.quote_id != deliv.quote_id:
            delivery_violations.append(
                f"Delivery {deliv.id} points to mismatched revision {deliv.revision_id}"
            )
        if not deliv.exported_by_user_id:
            delivery_violations.append(f"Delivery {deliv.id} missing exported_by_user_id")
    results.append(
        AuditCheckResult(
            check_name="customer_delivery_ledger_sha256_and_relation_integrity",
            status="PASS" if not delivery_violations else "FAIL",
            details=f"Audited {len(deliveries)} persisted customer deliverable record(s)",
            violations=delivery_violations,
        )
    )

    # 8. Export events audit log validation
    stmt_events = select(ExportEvent)
    if org_id:
        stmt_events = stmt_events.where(ExportEvent.organization_id == org_id)
    events = db.scalars(stmt_events).all()

    event_violations = []
    for ev in events:
        if not ev.entity_id or not ev.format or not ev.result:
            event_violations.append(f"Export event {ev.id} missing mandatory audit fields")
        if ev.sha256_hash and not SHA256_HEX_REGEX.match(ev.sha256_hash):
            event_violations.append(
                f"Export event {ev.id} has malformed SHA-256 hash: '{ev.sha256_hash}'"
            )
    results.append(
        AuditCheckResult(
            check_name="export_events_forensics_log_integrity",
            status="PASS" if not event_violations else "FAIL",
            details=f"Audited {len(events)} export attempt event(s)",
            violations=event_violations,
        )
    )

    # 9. CRM activity timeline consistency
    stmt_act = select(Activity)
    if org_id:
        stmt_act = stmt_act.where(Activity.organization_id == org_id)
    activities = db.scalars(stmt_act).all()

    act_violations = []
    for a in activities:
        if not a.event_type or not a.entity_type:
            act_violations.append(f"Activity {a.id} missing event_type or entity_type metadata")
    results.append(
        AuditCheckResult(
            check_name="crm_activity_timeline_consistency",
            status="PASS" if not act_violations else "FAIL",
            details=f"Verified {len(activities)} business activity timeline event(s)",
            violations=act_violations,
        )
    )

    # Compile report summary
    total = len(results)
    passed = sum(1 for r in results if r.status == "PASS")
    failed = sum(1 for r in results if r.status == "FAIL")
    uncheckable = sum(1 for r in results if r.status == "NOT_CHECKABLE")

    return AuditVerificationReport(
        total_checks=total,
        passed_checks=passed,
        failed_checks=failed,
        uncheckable_checks=uncheckable,
        results=results,
    )
