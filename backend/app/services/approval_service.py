"""
Authoritative Approval Service for ForgeFlow.
Manages approval queues, maker-checker separation of duties, proposal review decisions,
and initial quote approval workflows.
"""

import math
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthenticatedContext
from app.auth.rbac import Role
from app.domain.proposals.lifecycle import assert_maker_checker
from app.models.proposal import QuoteApprovalDecision, QuoteChangeProposal
from app.models.quote import Quote, QuoteRevision
from app.models.user import User
from app.schemas.proposals import (
    ApprovalDecisionRequest,
    ApprovalDecisionResponse,
    ApprovalQueueItemResponse,
    InitialQuoteDecisionRequest,
    InitialQuoteSubmitRequest,
    PaginatedApprovalsResponse,
)
from app.services.activity_service import record_activity
from app.services.proposal_service import get_proposal_or_404
from app.services.quote_service import get_quote_or_404, is_cost_visible


def list_approval_queue(
    db: Session,
    ctx: AuthenticatedContext,
    status_filter: Optional[str] = "pending",
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
) -> PaginatedApprovalsResponse:
    """
    Returns role-filtered pending approval queue for sales managers and admins.
    """
    if ctx.membership.role not in [Role.SALES_MANAGER, Role.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "PERMISSION_DENIED",
                "message": "Only sales managers and administrators have permission to access the approval queue.",
            },
        )

    queue_items: List[ApprovalQueueItemResponse] = []
    can_cost = is_cost_visible(ctx)

    # 1. Fetch Proposals
    prop_query = select(QuoteChangeProposal).where(
        QuoteChangeProposal.organization_id == ctx.organization.id
    )
    if status_filter == "pending":
        prop_query = prop_query.where(QuoteChangeProposal.status == "pending_review")
    elif status_filter and status_filter not in ["all", "any"]:
        prop_query = prop_query.where(QuoteChangeProposal.status == status_filter)

    proposals = list(db.scalars(prop_query.order_by(QuoteChangeProposal.created_at.desc())).all())

    for p in proposals:
        q = p.quote
        q_num = q.quote_number if q else "UNKNOWN"
        proposer_name = p.proposer.display_name if p.proposer else "Unknown"

        # Search filter
        if search:
            search_lower = search.lower()
            if (
                search_lower not in p.proposal_number.lower()
                and search_lower not in q_num.lower()
                and search_lower not in proposer_name.lower()
                and search_lower not in p.proposer_reason.lower()
            ):
                continue

        fi = (p.diff_summary_json or {}).get("financial_impact", {})
        total_val = Decimal(str(fi.get("proposed_grand_total", "0.00")))
        disc_pct = (
            Decimal(str(fi.get("proposed_discount_percent", "0.00")))
            if fi.get("proposed_discount_percent") is not None
            else None
        )
        margin_pct = (
            Decimal(str(fi.get("proposed_margin_percent", "0.00")))
            if (can_cost and fi.get("proposed_margin_percent") is not None)
            else None
        )

        policy_snap = p.policy_snapshot_json or {}
        triggered_rules = [
            t.get("rule_name", "")
            for t in policy_snap.get("triggers", policy_snap.get("rules_triggered", []))
            if t.get("rule_name")
        ]

        queue_items.append(
            ApprovalQueueItemResponse(
                item_type="proposal",
                id=p.id,
                quote_id=p.quote_id,
                quote_number=q_num,
                proposal_id=p.id,
                title=f"{p.proposal_number}: {p.proposer_reason[:60]}",
                proposer_user_id=p.proposer_user_id,
                proposer_name=proposer_name,
                status=p.status,
                total_value=total_val,
                discount_percent=disc_pct,
                margin_percent=margin_pct,
                pending_since=p.submitted_at or p.created_at,
                requires_manager_approval=policy_snap.get(
                    "requires_manager_approval", policy_snap.get("requires_approval", True)
                ),
                triggered_rules=triggered_rules,
            )
        )

    # 2. Fetch Initial Quotes awaiting approval
    quote_query = select(Quote).where(
        Quote.organization_id == ctx.organization.id,
    )
    if status_filter == "pending":
        quote_query = quote_query.where(Quote.status == "pending_approval")
    elif status_filter in ["all", "any"]:
        quote_query = quote_query.where(Quote.status.in_(["pending_approval", "approved"]))
    elif status_filter == "approved":
        quote_query = quote_query.where(Quote.status == "approved")
    else:
        quote_query = quote_query.where(Quote.status == "pending_approval")

    quotes = list(db.scalars(quote_query.order_by(Quote.updated_at.desc())).all())

    for q in quotes:
        if (
            status_filter not in ["all", "any"]
            and q.status != "pending_approval"
            and status_filter == "pending"
        ):
            continue

        creator = db.scalar(select(User).where(User.id == q.created_by))
        creator_name = creator.display_name if creator else "Unknown"

        if search:
            search_lower = search.lower()
            if (
                search_lower not in q.quote_number.lower()
                and search_lower not in creator_name.lower()
            ):
                continue

        rev = db.scalar(select(QuoteRevision).where(QuoteRevision.id == q.current_revision_id))
        calc_snap = rev.calculation_snapshot_json if rev else {}
        totals = calc_snap.get("totals", {})
        total_val = Decimal(str(totals.get("grand_total", "0.00")))
        disc_pct = (
            Decimal(str(totals.get("overall_discount_percent", "0.00")))
            if totals.get("overall_discount_percent") is not None
            else None
        )
        margin_pct = (
            Decimal(str(totals.get("overall_margin_percent", "0.00")))
            if (can_cost and totals.get("overall_margin_percent") is not None)
            else None
        )

        policy_snap = calc_snap.get("policy_evaluation", {})
        triggered_rules = [
            t.get("rule_name", "")
            for t in policy_snap.get("triggers", policy_snap.get("rules_triggered", []))
            if t.get("rule_name")
        ]

        queue_items.append(
            ApprovalQueueItemResponse(
                item_type="initial_quote",
                id=q.id,
                quote_id=q.id,
                quote_number=q.quote_number,
                proposal_id=None,
                title=f"{q.quote_number}: Initial Quotation Approval",
                proposer_user_id=q.created_by,
                proposer_name=creator_name,
                status=q.status,
                total_value=total_val,
                discount_percent=disc_pct,
                margin_percent=margin_pct,
                pending_since=q.updated_at or q.created_at,
                requires_manager_approval=policy_snap.get(
                    "requires_manager_approval", policy_snap.get("requires_approval", True)
                ),
                triggered_rules=triggered_rules,
            )
        )

    # Sort pending items first, then by pending_since desc
    queue_items.sort(
        key=lambda it: (
            0 if it.status in ["pending_review", "pending_approval"] else 1,
            -it.pending_since.timestamp(),
        )
    )

    total = len(queue_items)
    pages = math.ceil(total / page_size) if total > 0 else 1
    offset = (page - 1) * page_size
    paged_items = queue_items[offset : offset + page_size]

    return PaginatedApprovalsResponse(
        items=paged_items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


def approve_proposal(
    db: Session,
    ctx: AuthenticatedContext,
    proposal_id: uuid.UUID,
    request: ApprovalDecisionRequest,
) -> ApprovalDecisionResponse:
    if ctx.membership.role not in [Role.SALES_MANAGER, Role.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "PERMISSION_DENIED",
                "message": "Only sales managers and administrators can approve change proposals.",
            },
        )

    proposal = get_proposal_or_404(db, ctx, proposal_id)
    quote = proposal.quote

    # Maker-Checker Invariant
    try:
        assert_maker_checker(
            proposer_user_id=proposal.proposer_user_id,
            reviewer_user_id=ctx.user.id,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "MAKER_CHECKER_VIOLATION", "message": str(e)},
        ) from e

    # Stale base revision check
    if quote.current_revision_id != proposal.base_revision_id:
        proposal.status = "stale"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "STALE_BASE_REVISION",
                "message": "This proposal was based on an older quotation revision. No changes were committed. Reload the current quotation and create or reconcile a new proposal.",
            },
        )

    if proposal.status != "pending_review":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "INVALID_STATE_TRANSITION",
                "message": f"Proposal '{proposal.proposal_number}' is in status '{proposal.status}' and cannot be approved. Only 'pending_review' proposals can be approved.",
            },
        )

    # Check idempotency retry
    if request.idempotency_key:
        existing_dec = db.scalar(
            select(QuoteApprovalDecision).where(
                QuoteApprovalDecision.organization_id == ctx.organization.id,
                QuoteApprovalDecision.idempotency_key == request.idempotency_key,
            )
        )
        if existing_dec:
            return ApprovalDecisionResponse(
                id=existing_dec.id,
                proposal_id=existing_dec.proposal_id,
                quote_id=existing_dec.quote_id,
                reviewer_user_id=existing_dec.reviewer_user_id,
                reviewer_name=ctx.user.display_name,
                decision=existing_dec.decision,
                rejection_reason=existing_dec.decision_comment
                if existing_dec.decision == "rejected"
                else None,
                notes=existing_dec.decision_comment
                if existing_dec.decision == "approved"
                else None,
                policy_snapshot_at_decision=existing_dec.policy_snapshot_json,
                created_at=existing_dec.created_at,
            )

    now = datetime.now(timezone.utc)

    decision = QuoteApprovalDecision(
        id=uuid.uuid4(),
        organization_id=ctx.organization.id,
        quote_id=proposal.quote_id,
        proposal_id=proposal.id,
        base_revision_id=proposal.base_revision_id,
        base_version=proposal.base_version,
        reviewer_user_id=ctx.user.id,
        decision="approved",
        decision_comment=request.notes,
        policy_snapshot_json=proposal.policy_snapshot_json,
        decided_at=now,
        created_revision_id=None,
        idempotency_key=request.idempotency_key,
        created_at=now,
    )
    db.add(decision)

    proposal.status = "approved"
    proposal.reviewer_user_id = ctx.user.id
    proposal.reviewer_comment = request.notes
    proposal.decided_at = now
    proposal.updated_at = now

    record_activity(
        db=db,
        organization_id=ctx.organization.id,
        entity_type="proposal",
        entity_id=proposal.id,
        event_type="proposal.approved",
        summary=f"Approved proposal {proposal.proposal_number}",
        metadata_json={
            "proposal_number": proposal.proposal_number,
            "quote_id": str(quote.id),
            "decision": "approved",
            "notes": request.notes,
        },
        actor_user_id=ctx.user.id,
    )

    db.commit()
    db.refresh(decision)

    return ApprovalDecisionResponse(
        id=decision.id,
        proposal_id=decision.proposal_id,
        quote_id=decision.quote_id,
        reviewer_user_id=decision.reviewer_user_id,
        reviewer_name=ctx.user.display_name,
        decision=decision.decision,
        rejection_reason=None,
        notes=decision.decision_comment,
        policy_snapshot_at_decision=decision.policy_snapshot_json,
        created_at=decision.created_at,
    )


def reject_proposal(
    db: Session,
    ctx: AuthenticatedContext,
    proposal_id: uuid.UUID,
    request: ApprovalDecisionRequest,
) -> ApprovalDecisionResponse:
    if ctx.membership.role not in [Role.SALES_MANAGER, Role.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "PERMISSION_DENIED",
                "message": "Only sales managers and administrators can reject change proposals.",
            },
        )

    if not request.rejection_reason or not request.rejection_reason.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "REJECTION_REASON_REQUIRED",
                "message": "A non-empty rejection reason is required to reject a change proposal.",
            },
        )

    proposal = get_proposal_or_404(db, ctx, proposal_id)
    quote = proposal.quote

    # Maker-Checker
    try:
        assert_maker_checker(
            proposer_user_id=proposal.proposer_user_id,
            reviewer_user_id=ctx.user.id,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "MAKER_CHECKER_VIOLATION", "message": str(e)},
        ) from e

    if proposal.status != "pending_review":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "INVALID_STATE_TRANSITION",
                "message": f"Proposal '{proposal.proposal_number}' is in status '{proposal.status}' and cannot be rejected.",
            },
        )

    now = datetime.now(timezone.utc)

    decision = QuoteApprovalDecision(
        id=uuid.uuid4(),
        organization_id=ctx.organization.id,
        quote_id=proposal.quote_id,
        proposal_id=proposal.id,
        base_revision_id=proposal.base_revision_id,
        base_version=proposal.base_version,
        reviewer_user_id=ctx.user.id,
        decision="rejected",
        decision_comment=request.rejection_reason,
        policy_snapshot_json=proposal.policy_snapshot_json,
        decided_at=now,
        created_revision_id=None,
        idempotency_key=request.idempotency_key,
        created_at=now,
    )
    db.add(decision)

    proposal.status = "rejected"
    proposal.reviewer_user_id = ctx.user.id
    proposal.reviewer_comment = request.rejection_reason
    proposal.decided_at = now
    proposal.updated_at = now

    record_activity(
        db=db,
        organization_id=ctx.organization.id,
        entity_type="proposal",
        entity_id=proposal.id,
        event_type="proposal.rejected",
        summary=f"Rejected proposal {proposal.proposal_number}: {request.rejection_reason}",
        metadata_json={
            "proposal_number": proposal.proposal_number,
            "quote_id": str(quote.id),
            "rejection_reason": request.rejection_reason,
        },
        actor_user_id=ctx.user.id,
    )

    db.commit()
    db.refresh(decision)

    return ApprovalDecisionResponse(
        id=decision.id,
        proposal_id=decision.proposal_id,
        quote_id=decision.quote_id,
        reviewer_user_id=decision.reviewer_user_id,
        reviewer_name=ctx.user.display_name,
        decision=decision.decision,
        rejection_reason=decision.decision_comment,
        notes=None,
        policy_snapshot_at_decision=decision.policy_snapshot_json,
        created_at=decision.created_at,
    )


def submit_initial_quote_for_approval(
    db: Session,
    ctx: AuthenticatedContext,
    quote_id: uuid.UUID,
    request: InitialQuoteSubmitRequest,
) -> Quote:
    quote = get_quote_or_404(db, ctx, quote_id)

    if quote.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "INVALID_STATE_TRANSITION",
                "message": f"Quote '{quote.quote_number}' is in status '{quote.status}' and cannot be submitted for approval.",
            },
        )

    if not quote.current_revision_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "MISSING_REVISION",
                "message": "Quote does not have an active revision to submit for approval.",
            },
        )

    now = datetime.now(timezone.utc)
    quote.status = "pending_approval"
    quote.updated_at = now

    record_activity(
        db=db,
        organization_id=ctx.organization.id,
        entity_type="quote",
        entity_id=quote.id,
        event_type="quote.submitted_for_approval",
        summary=f"Submitted quote {quote.quote_number} for manager approval",
        metadata_json={
            "quote_number": quote.quote_number,
            "notes": request.notes,
        },
        actor_user_id=ctx.user.id,
    )

    db.commit()
    db.refresh(quote)
    return quote


def approve_initial_quote(
    db: Session,
    ctx: AuthenticatedContext,
    quote_id: uuid.UUID,
    request: InitialQuoteDecisionRequest,
) -> ApprovalDecisionResponse:
    if ctx.membership.role not in [Role.SALES_MANAGER, Role.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "PERMISSION_DENIED",
                "message": "Only sales managers and administrators can approve quotations.",
            },
        )

    quote = get_quote_or_404(db, ctx, quote_id)

    # Maker-Checker: Creator cannot approve own initial quote
    try:
        assert_maker_checker(
            proposer_user_id=quote.created_by,
            reviewer_user_id=ctx.user.id,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "MAKER_CHECKER_VIOLATION", "message": str(e)},
        ) from e

    if quote.status != "pending_approval":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "INVALID_STATE_TRANSITION",
                "message": f"Quote '{quote.quote_number}' is in status '{quote.status}' and cannot be reviewed. Status must be 'pending_approval'.",
            },
        )

    rev = db.scalar(select(QuoteRevision).where(QuoteRevision.id == quote.current_revision_id))
    if not rev:
        raise HTTPException(status_code=500, detail="Active quote revision not found.")

    if request.decision == "rejected":
        if not request.rejection_reason or not request.rejection_reason.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "REJECTION_REASON_REQUIRED",
                    "message": "A non-empty rejection reason is required to reject a quotation.",
                },
            )

    now = datetime.now(timezone.utc)

    decision = QuoteApprovalDecision(
        id=uuid.uuid4(),
        organization_id=ctx.organization.id,
        quote_id=quote.id,
        proposal_id=None,
        base_revision_id=rev.id,
        base_version=rev.revision_number,
        reviewer_user_id=ctx.user.id,
        decision=request.decision,
        decision_comment=request.rejection_reason
        if request.decision == "rejected"
        else request.notes,
        policy_snapshot_json=(rev.calculation_snapshot_json or {}).get("policy_evaluation", {}),
        decided_at=now,
        created_revision_id=rev.id if request.decision == "approved" else None,
        idempotency_key=request.idempotency_key,
        created_at=now,
    )
    db.add(decision)

    if request.decision == "approved":
        quote.status = "approved"
        rev.is_committed = True
    else:
        quote.status = "draft"

    quote.updated_at = now

    record_activity(
        db=db,
        organization_id=ctx.organization.id,
        entity_type="quote",
        entity_id=quote.id,
        event_type=f"quote.{request.decision}",
        summary=f"{request.decision.capitalize()} quote {quote.quote_number}",
        metadata_json={
            "quote_number": quote.quote_number,
            "decision": request.decision,
            "comment": decision.decision_comment,
        },
        actor_user_id=ctx.user.id,
    )

    db.commit()
    db.refresh(decision)

    return ApprovalDecisionResponse(
        id=decision.id,
        proposal_id=None,
        quote_id=decision.quote_id,
        reviewer_user_id=decision.reviewer_user_id,
        reviewer_name=ctx.user.display_name,
        decision=decision.decision,
        rejection_reason=decision.decision_comment if decision.decision == "rejected" else None,
        notes=decision.decision_comment if decision.decision == "approved" else None,
        policy_snapshot_at_decision=decision.policy_snapshot_json,
        created_at=decision.created_at,
    )
