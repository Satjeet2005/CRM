"""
Authoritative Proposal Service for ForgeFlow.
Manages QuoteChangeProposal lifecycle: creation, draft edits, submission, diff calculation,
and atomic commit to a new immutable QuoteRevision.
"""

import math
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthenticatedContext
from app.auth.rbac import Role
from app.domain.proposals.diff import compute_proposal_diff
from app.domain.proposals.lifecycle import (
    assert_can_transition,
    assert_maker_checker,
)
from app.domain.proposals.operations import (
    ProposalOperation,
    apply_operations_to_quote,
)
from app.domain.quotes.calculator import QuoteCalculationResult, QuoteLineInput, calculate_quote
from app.domain.quotes.policies import QuotePolicyConfig, evaluate_quote_policies
from app.models.catalog import CatalogProduct
from app.models.organization import Organization
from app.models.proposal import QuoteApprovalDecision, QuoteChangeProposal
from app.models.quote import Quote, QuoteRevision, QuoteRevisionLine
from app.schemas.proposals import (
    ApprovalDecisionResponse,
    CreateProposalRequest,
    PaginatedProposalsResponse,
    ProposalDetailResponse,
    ProposalDiffResponse,
    ProposalListItemResponse,
    UpdateProposalDraftRequest,
)
from app.services.activity_service import record_activity
from app.services.quote_service import get_quote_or_404, is_cost_visible


def serialize_for_json(obj: Any) -> Any:
    if isinstance(obj, (Decimal, uuid.UUID)):
        return str(obj)
    if isinstance(obj, dict):
        return {k: serialize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [serialize_for_json(item) for item in obj]
    return obj


def _mask_diff_costs(diff: Dict[str, Any], can_view_cost: bool) -> Dict[str, Any]:
    if can_view_cost:
        return diff

    masked_diff = dict(diff)

    # Mask financial impact
    fi = dict(diff.get("financial_impact", {}))
    fi["base_total_cost"] = None
    fi["proposed_total_cost"] = None
    fi["cost_delta"] = None
    fi["base_margin_percent"] = None
    fi["proposed_margin_percent"] = None
    fi["margin_delta_percent"] = None
    masked_diff["financial_impact"] = fi

    # Mask modified lines
    mod_lines = []
    for item in diff.get("modified_lines", []):
        line_item = dict(item)
        line_item.pop("unit_cost", None)
        line_item.pop("line_cost", None)
        line_item.pop("margin_percent", None)
        line_item.pop("old_unit_cost", None)
        line_item.pop("new_unit_cost", None)
        mod_lines.append(line_item)
    masked_diff["modified_lines"] = mod_lines

    # Mask added lines
    add_lines = []
    for item in diff.get("added_lines", []):
        line_item = dict(item)
        line_item.pop("unit_cost", None)
        line_item.pop("line_cost", None)
        line_item.pop("margin_percent", None)
        add_lines.append(line_item)
    masked_diff["added_lines"] = add_lines

    # Mask removed lines
    rem_lines = []
    for item in diff.get("removed_lines", []):
        line_item = dict(item)
        line_item.pop("unit_cost", None)
        line_item.pop("line_cost", None)
        line_item.pop("margin_percent", None)
        rem_lines.append(line_item)
    masked_diff["removed_lines"] = rem_lines

    # Mask unchanged lines
    unchanged_lines = []
    for item in diff.get("unchanged_lines", []):
        line_item = dict(item)
        line_item.pop("unit_cost", None)
        line_item.pop("line_cost", None)
        line_item.pop("margin_percent", None)
        unchanged_lines.append(line_item)
    masked_diff["unchanged_lines"] = unchanged_lines

    return masked_diff


def get_proposal_or_404(
    db: Session,
    ctx: AuthenticatedContext,
    proposal_id: uuid.UUID,
) -> QuoteChangeProposal:
    proposal = db.scalar(
        select(QuoteChangeProposal).where(
            QuoteChangeProposal.id == proposal_id,
            QuoteChangeProposal.organization_id == ctx.organization.id,
        )
    )
    if not proposal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "PROPOSAL_NOT_FOUND",
                "message": f"Change proposal '{proposal_id}' was not found in your organization.",
            },
        )
    return proposal


def _resolve_base_revision_and_lines(
    db: Session,
    ctx: AuthenticatedContext,
    quote: Quote,
    base_revision_id: uuid.UUID,
) -> Tuple[QuoteRevision, List[QuoteRevisionLine]]:
    base_rev = db.scalar(
        select(QuoteRevision).where(
            QuoteRevision.id == base_revision_id,
            QuoteRevision.quote_id == quote.id,
            QuoteRevision.organization_id == ctx.organization.id,
        )
    )
    if not base_rev:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "BASE_REVISION_NOT_FOUND",
                "message": f"Base revision '{base_revision_id}' does not exist for this quotation.",
            },
        )

    if quote.current_revision_id != base_rev.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "STALE_BASE_REVISION",
                "message": "This proposal was based on an older quotation revision. No changes were committed. Reload the current quotation and create or reconcile a new proposal.",
            },
        )

    lines = list(
        db.scalars(
            select(QuoteRevisionLine)
            .where(QuoteRevisionLine.revision_id == base_rev.id)
            .order_by(QuoteRevisionLine.line_order.asc())
        ).all()
    )

    return base_rev, lines


def _recalculate_proposal_scenario(
    db: Session,
    ctx: AuthenticatedContext,
    quote: Quote,
    base_revision: QuoteRevision,
    base_lines: List[QuoteRevisionLine],
    raw_ops: List[Dict[str, Any]],
) -> Tuple[Dict[str, Any], Dict[str, Any], Dict[str, Any], Any]:
    # 1. Base calculator inputs
    base_calc_inputs: List[QuoteLineInput] = [
        QuoteLineInput(
            line_id=str(ln.id),
            line_order=ln.line_order,
            sku=ln.sku,
            name=ln.product_name,
            description=ln.description,
            unit=ln.unit,
            quantity=ln.quantity,
            unit_price=ln.unit_price,
            discount_percent=ln.discount_percent,
            tax_rate_percent=ln.tax_rate_percent,
            unit_cost=ln.unit_cost,
            rfq_line_id=str(ln.rfq_line_id) if ln.rfq_line_id else None,
            catalog_product_id=str(ln.catalog_product_id) if ln.catalog_product_id else None,
        )
        for ln in base_lines
    ]

    base_calc_result: QuoteCalculationResult = calculate_quote(
        base_calc_inputs, currency=base_revision.currency or "INR"
    )

    base_terms_data: Dict[str, Any] = {
        "valid_until": quote.valid_until.isoformat() if quote.valid_until else None,
        "payment_terms": quote.payment_terms or "Net 30",
        "delivery_terms": quote.delivery_terms or "Ex-Works",
    }

    # 2. Enrich add_line operations with product details if needed
    enriched_ops_data: List[Dict[str, Any]] = []
    for op_dict in raw_ops:
        data = dict(op_dict)
        if "type" in data and "op_type" not in data:
            data["op_type"] = data.pop("type")
        if "target_line_id" in data and "line_id" not in data:
            data["line_id"] = (
                str(data.pop("target_line_id")) if data.get("target_line_id") else None
            )
        if "field" in data and "field_name" not in data:
            data["field_name"] = data.pop("field")
        if "value" in data and "proposed_value" not in data:
            data["proposed_value"] = (
                str(data.pop("value")) if data.get("value") is not None else None
            )

        if data.get("op_type") == "add_line" and data.get("payload"):
            payload = dict(data["payload"])
            prod_id_str = payload.get("catalog_product_id")
            if prod_id_str:
                prod = db.scalar(
                    select(CatalogProduct).where(
                        CatalogProduct.id == uuid.UUID(prod_id_str),
                        CatalogProduct.organization_id == ctx.organization.id,
                    )
                )
                if not prod:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail={
                            "code": "PRODUCT_NOT_FOUND",
                            "message": f"Catalog product '{prod_id_str}' was not found.",
                        },
                    )
                payload["sku"] = prod.sku
                payload["product_name"] = prod.name
                payload["description"] = prod.description or prod.name
                payload["unit"] = prod.base_unit or "nos"
                payload["unit_cost"] = prod.unit_cost
                if "unit_price" not in payload or payload["unit_price"] is None:
                    payload["unit_price"] = prod.sell_price
                if "tax_rate_percent" not in payload or payload["tax_rate_percent"] is None:
                    payload["tax_rate_percent"] = prod.tax_rate_percent or Decimal("18.00")
            data["payload"] = payload

        enriched_ops_data.append(data)

    # 3. Parse ProposalOperation domain objects
    try:
        domain_ops = [ProposalOperation.from_dict(d) for d in enriched_ops_data]
    except (ValueError, KeyError) as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "INVALID_PROPOSAL_OPERATIONS", "message": str(e)},
        ) from e

    # 4. Apply operations to quote
    try:
        proposed_calc_inputs, proposed_terms = apply_operations_to_quote(
            base_lines=base_calc_inputs,
            base_terms=base_terms_data,
            operations=domain_ops,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "INVALID_PROPOSAL_OPERATIONS", "message": str(e)},
        ) from e

    # 5. Authoritative calculation & policy evaluation
    proposed_calc_result = calculate_quote(
        proposed_calc_inputs, currency=base_revision.currency or "INR"
    )

    org = db.scalar(select(Organization).where(Organization.id == ctx.organization.id))
    policy_config = QuotePolicyConfig.from_dict(org.settings_json if org else None)
    policy_result = evaluate_quote_policies(proposed_calc_result, policy_config)

    # 6. Structured diff
    diff = compute_proposal_diff(
        base_calc=base_calc_result,
        proposed_calc=proposed_calc_result,
        base_terms=base_terms_data,
        proposed_terms=proposed_terms,
        can_view_cost=True,
    )
    diff["policy_snapshot"] = policy_result.to_dict()

    base_snapshot = {
        "lines": [
            {
                "id": str(ln.id),
                "line_order": ln.line_order,
                "rfq_line_id": str(ln.rfq_line_id) if ln.rfq_line_id else None,
                "catalog_product_id": str(ln.catalog_product_id) if ln.catalog_product_id else None,
                "sku": ln.sku,
                "product_name": ln.product_name,
                "description": ln.description,
                "unit": ln.unit,
                "quantity": str(ln.quantity),
                "unit_price": str(ln.unit_price),
                "discount_percent": str(ln.discount_percent),
                "tax_rate_percent": str(ln.tax_rate_percent),
                "unit_cost": str(ln.unit_cost) if ln.unit_cost is not None else None,
            }
            for ln in base_lines
        ],
        "terms": base_terms_data,
        "calculation": serialize_for_json(base_calc_result.to_snapshot_json()),
    }

    proposed_calc_snapshot = serialize_for_json(proposed_calc_result.to_snapshot_json())
    proposed_calc_snapshot["terms"] = proposed_terms
    proposed_calc_snapshot["policy_evaluation"] = policy_result.to_dict()

    return (
        serialize_for_json(base_snapshot),
        proposed_calc_snapshot,
        serialize_for_json(diff),
        policy_result,
    )


def create_proposal(
    db: Session,
    ctx: AuthenticatedContext,
    quote_id: uuid.UUID,
    payload: CreateProposalRequest,
) -> QuoteChangeProposal:
    # 1. Idempotency check
    if payload.idempotency_key:
        existing = db.scalar(
            select(QuoteChangeProposal).where(
                QuoteChangeProposal.organization_id == ctx.organization.id,
                QuoteChangeProposal.idempotency_key == payload.idempotency_key,
            )
        )
        if existing:
            return existing

    # 2. Load quote and base revision
    quote = get_quote_or_404(db, ctx, quote_id)
    base_revision, base_lines = _resolve_base_revision_and_lines(
        db, ctx, quote, payload.base_revision_id
    )

    # 3. Re-calculate scenario & policy
    ops_dicts = []
    for op in payload.operations:
        d = op.model_dump(exclude_unset=True)
        if "reason" not in d or not d["reason"]:
            d["reason"] = payload.justification
        ops_dicts.append(d)

    base_snapshot, proposed_snapshot, diff, policy_result = _recalculate_proposal_scenario(
        db, ctx, quote, base_revision, base_lines, ops_dicts
    )

    # 4. Generate proposal number
    prop_count = (
        db.scalar(
            select(func.count(QuoteChangeProposal.id)).where(
                QuoteChangeProposal.quote_id == quote.id,
                QuoteChangeProposal.organization_id == ctx.organization.id,
            )
        )
        or 0
    )
    quote_num_clean = quote.quote_number.replace("QT-", "")
    proposal_number = f"PROP-{quote_num_clean}-{prop_count + 1:02d}"

    now = datetime.now(timezone.utc)
    proposal = QuoteChangeProposal(
        id=uuid.uuid4(),
        organization_id=ctx.organization.id,
        quote_id=quote.id,
        proposal_number=proposal_number,
        base_revision_id=base_revision.id,
        base_version=base_revision.revision_number,
        status="draft",
        proposer_user_id=ctx.user.id,
        reviewer_user_id=None,
        proposer_reason=payload.justification,
        reviewer_comment=None,
        proposed_changes_json=serialize_for_json(ops_dicts),
        base_snapshot_json=base_snapshot,
        proposed_snapshot_json=proposed_snapshot,
        diff_summary_json=diff,
        policy_snapshot_json=policy_result.to_dict(),
        calculator_version=diff.get("financial_impact", {}).get(
            "calculator_version", "forgeflow-quote-calculator/1.0.0"
        ),
        input_fingerprint=diff.get("financial_impact", {}).get("proposed_fingerprint", ""),
        idempotency_key=payload.idempotency_key,
        resulting_revision_id=None,
        version=1,
        created_at=now,
        updated_at=now,
    )

    db.add(proposal)
    db.flush()

    record_activity(
        db=db,
        organization_id=ctx.organization.id,
        entity_type="proposal",
        entity_id=proposal.id,
        event_type="proposal.created",
        summary=f"Created proposal {proposal.proposal_number} for quote {quote.quote_number}",
        metadata_json={
            "proposal_number": proposal.proposal_number,
            "quote_id": str(quote.id),
            "quote_number": quote.quote_number,
            "base_revision_number": base_revision.revision_number,
            "operations_count": len(payload.operations),
        },
        actor_user_id=ctx.user.id,
    )

    db.commit()
    db.refresh(proposal)
    return proposal


def list_proposals(
    db: Session,
    ctx: AuthenticatedContext,
    quote_id: uuid.UUID,
    page: int = 1,
    page_size: int = 20,
    status_filter: Optional[str] = None,
) -> PaginatedProposalsResponse:
    quote = get_quote_or_404(db, ctx, quote_id)

    query = select(QuoteChangeProposal).where(
        QuoteChangeProposal.quote_id == quote.id,
        QuoteChangeProposal.organization_id == ctx.organization.id,
    )

    if status_filter:
        query = query.where(QuoteChangeProposal.status == status_filter)

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    pages = math.ceil(total / page_size) if total > 0 else 1

    proposals = list(
        db.scalars(
            query.order_by(QuoteChangeProposal.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
    )

    items = []
    for p in proposals:
        proposer_name = p.proposer.display_name if p.proposer else None
        target_rev = p.resulting_revision.revision_number if p.resulting_revision else None
        items.append(
            ProposalListItemResponse(
                id=p.id,
                quote_id=p.quote_id,
                quote_number=quote.quote_number,
                base_revision_id=p.base_revision_id,
                base_revision_number=p.base_version,
                target_revision_number=target_rev,
                title=f"{p.proposal_number}: {p.proposer_reason[:60]}",
                status=p.status,
                proposer_user_id=p.proposer_user_id,
                proposer_name=proposer_name,
                operations_count=len(p.proposed_changes_json or []),
                created_at=p.created_at,
                updated_at=p.updated_at,
            )
        )

    return PaginatedProposalsResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


def get_proposal_detail(
    db: Session,
    ctx: AuthenticatedContext,
    proposal_id: uuid.UUID,
) -> ProposalDetailResponse:
    proposal = get_proposal_or_404(db, ctx, proposal_id)
    quote = proposal.quote

    proposer_name = proposal.proposer.display_name if proposal.proposer else None
    target_rev = (
        proposal.resulting_revision.revision_number if proposal.resulting_revision else None
    )

    decisions = [
        ApprovalDecisionResponse(
            id=d.id,
            proposal_id=d.proposal_id,
            quote_id=d.quote_id,
            reviewer_user_id=d.reviewer_user_id,
            reviewer_name=d.reviewer.display_name if d.reviewer else None,
            decision=d.decision,
            rejection_reason=d.decision_comment if d.decision == "rejected" else None,
            notes=d.decision_comment if d.decision == "approved" else None,
            policy_snapshot_at_decision=d.policy_snapshot_json,
            created_at=d.created_at,
        )
        for d in proposal.decisions
    ]

    return ProposalDetailResponse(
        id=proposal.id,
        quote_id=proposal.quote_id,
        quote_number=quote.quote_number if quote else None,
        base_revision_id=proposal.base_revision_id,
        base_revision_number=proposal.base_version,
        target_revision_number=target_rev,
        title=f"{proposal.proposal_number}: {proposal.proposer_reason[:60]}",
        description=proposal.reviewer_comment,
        justification=proposal.proposer_reason,
        status=proposal.status,
        proposer_user_id=proposal.proposer_user_id,
        proposer_name=proposer_name,
        operations=proposal.proposed_changes_json or [],
        policy_snapshots=proposal.policy_snapshot_json,
        decisions=decisions,
        created_at=proposal.created_at,
        updated_at=proposal.updated_at,
    )


def get_proposal_diff_response(
    db: Session,
    ctx: AuthenticatedContext,
    proposal_id: uuid.UUID,
) -> ProposalDiffResponse:
    proposal = get_proposal_or_404(db, ctx, proposal_id)
    raw_diff = proposal.diff_summary_json or {}

    can_cost = is_cost_visible(ctx)
    masked = _mask_diff_costs(raw_diff, can_cost)

    return ProposalDiffResponse(
        terms_diff=masked.get("terms_diff", {}),
        modified_lines=masked.get("modified_lines", []),
        added_lines=masked.get("added_lines", []),
        removed_lines=masked.get("removed_lines", []),
        unchanged_lines=masked.get("unchanged_lines", []),
        financial_impact=masked.get("financial_impact", {}),
        policy_snapshot=masked.get("policy_snapshot"),
    )


def update_proposal_draft(
    db: Session,
    ctx: AuthenticatedContext,
    proposal_id: uuid.UUID,
    payload: UpdateProposalDraftRequest,
) -> QuoteChangeProposal:
    proposal = get_proposal_or_404(db, ctx, proposal_id)

    if proposal.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "PROPOSAL_NOT_DRAFT",
                "message": f"Proposal '{proposal.proposal_number}' is in status '{proposal.status}' and cannot be edited. Edits are permitted only in 'draft' status.",
            },
        )

    if proposal.proposer_user_id != ctx.user.id and ctx.membership.role != Role.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "PERMISSION_DENIED",
                "message": "Only the proposer or an administrator may edit a draft proposal.",
            },
        )

    quote = proposal.quote
    base_revision, base_lines = _resolve_base_revision_and_lines(
        db, ctx, quote, proposal.base_revision_id
    )

    if payload.justification is not None:
        proposal.proposer_reason = payload.justification

    if payload.operations is not None:
        ops_dicts = []
        for op in payload.operations:
            d = op.model_dump(exclude_unset=True)
            if "reason" not in d or not d["reason"]:
                d["reason"] = proposal.proposer_reason
            ops_dicts.append(d)

        base_snapshot, proposed_snapshot, diff, policy_result = _recalculate_proposal_scenario(
            db, ctx, quote, base_revision, base_lines, ops_dicts
        )
        proposal.proposed_changes_json = serialize_for_json(ops_dicts)
        proposal.base_snapshot_json = base_snapshot
        proposal.proposed_snapshot_json = proposed_snapshot
        proposal.diff_summary_json = diff
        proposal.policy_snapshot_json = policy_result.to_dict()
        proposal.calculator_version = diff.get("financial_impact", {}).get(
            "calculator_version", "forgeflow-quote-calculator/1.0.0"
        )
        proposal.input_fingerprint = diff.get("financial_impact", {}).get(
            "proposed_fingerprint", ""
        )

    proposal.version += 1
    proposal.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(proposal)
    return proposal


def submit_proposal(
    db: Session,
    ctx: AuthenticatedContext,
    proposal_id: uuid.UUID,
) -> QuoteChangeProposal:
    proposal = get_proposal_or_404(db, ctx, proposal_id)

    try:
        assert_can_transition(proposal.status, "pending_review")
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "INVALID_STATE_TRANSITION", "message": str(e)},
        ) from e

    quote = proposal.quote
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

    now = datetime.now(timezone.utc)
    proposal.status = "pending_review"
    proposal.submitted_at = now
    proposal.updated_at = now

    record_activity(
        db=db,
        organization_id=ctx.organization.id,
        entity_type="proposal",
        entity_id=proposal.id,
        event_type="proposal.submitted",
        summary=f"Submitted proposal {proposal.proposal_number} for review",
        metadata_json={
            "proposal_number": proposal.proposal_number,
            "quote_id": str(quote.id),
            "quote_number": quote.quote_number,
            "status": "pending_review",
        },
        actor_user_id=ctx.user.id,
    )

    db.commit()
    db.refresh(proposal)
    return proposal


def cancel_proposal(
    db: Session,
    ctx: AuthenticatedContext,
    proposal_id: uuid.UUID,
) -> QuoteChangeProposal:
    proposal = get_proposal_or_404(db, ctx, proposal_id)

    try:
        assert_can_transition(proposal.status, "cancelled")
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "INVALID_STATE_TRANSITION", "message": str(e)},
        ) from e

    now = datetime.now(timezone.utc)
    proposal.status = "cancelled"
    proposal.cancelled_at = now
    proposal.updated_at = now

    record_activity(
        db=db,
        organization_id=ctx.organization.id,
        entity_type="proposal",
        entity_id=proposal.id,
        event_type="proposal.cancelled",
        summary=f"Cancelled proposal {proposal.proposal_number}",
        metadata_json={
            "proposal_number": proposal.proposal_number,
            "quote_id": str(proposal.quote_id),
        },
        actor_user_id=ctx.user.id,
    )

    db.commit()
    db.refresh(proposal)
    return proposal


def commit_proposal(
    db: Session,
    ctx: AuthenticatedContext,
    proposal_id: uuid.UUID,
    idempotency_key: Optional[str] = None,
) -> QuoteRevision:
    # 1. Idempotency check on already committed proposal
    proposal = get_proposal_or_404(db, ctx, proposal_id)
    if proposal.status == "committed" and proposal.resulting_revision_id:
        resulting = db.scalar(
            select(QuoteRevision).where(QuoteRevision.id == proposal.resulting_revision_id)
        )
        if resulting:
            return resulting

    # 2. Lock quote row
    quote = db.scalar(
        select(Quote)
        .where(Quote.id == proposal.quote_id, Quote.organization_id == ctx.organization.id)
        .with_for_update()
    )
    if not quote:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "QUOTE_NOT_FOUND", "message": "Quote not found."},
        )

    # 3. Check stale concurrency condition
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

    # 4. State precondition check
    policy_snapshot = proposal.policy_snapshot_json or {}
    requires_approval = policy_snapshot.get(
        "requires_manager_approval", policy_snapshot.get("requires_approval", True)
    )

    if requires_approval and proposal.status != "approved":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "APPROVAL_REQUIRED",
                "message": f"Proposal '{proposal.proposal_number}' requires manager approval before it can be committed. Current status is '{proposal.status}'.",
            },
        )
    elif not requires_approval and proposal.status not in ["approved", "pending_review"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "INVALID_STATE_TRANSITION",
                "message": f"Proposal cannot be committed from status '{proposal.status}'.",
            },
        )

    # 5. Maker-checker check: ensure approval was done by someone other than proposer
    if requires_approval:
        decision = db.scalar(
            select(QuoteApprovalDecision)
            .where(
                QuoteApprovalDecision.proposal_id == proposal.id,
                QuoteApprovalDecision.decision == "approved",
            )
            .order_by(QuoteApprovalDecision.created_at.desc())
        )
        if not decision:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "MISSING_APPROVAL_DECISION",
                    "message": "Approved status requires an authoritative QuoteApprovalDecision record.",
                },
            )
        assert_maker_checker(
            proposer_user_id=proposal.proposer_user_id,
            reviewer_user_id=decision.reviewer_user_id,
        )

    # 6. Re-apply operations to authoritative base revision lines
    base_revision = db.scalar(
        select(QuoteRevision).where(QuoteRevision.id == proposal.base_revision_id)
    )
    if not base_revision:
        raise HTTPException(status_code=500, detail="Base revision record missing.")

    base_lines = list(
        db.scalars(
            select(QuoteRevisionLine)
            .where(QuoteRevisionLine.revision_id == base_revision.id)
            .order_by(QuoteRevisionLine.line_order.asc())
        ).all()
    )

    base_snapshot, proposed_snapshot, diff, policy_result = _recalculate_proposal_scenario(
        db, ctx, quote, base_revision, base_lines, proposal.proposed_changes_json or []
    )

    # 7. Allocate next revision N+1
    max_rev = (
        db.scalar(
            select(func.max(QuoteRevision.revision_number)).where(
                QuoteRevision.quote_id == quote.id
            )
        )
        or 0
    )
    next_rev_num = max_rev + 1

    now = datetime.now(timezone.utc)
    terms_dict = proposed_snapshot.get("terms", {})

    new_revision = QuoteRevision(
        id=uuid.uuid4(),
        organization_id=ctx.organization.id,
        quote_id=quote.id,
        revision_number=next_rev_num,
        parent_revision_id=base_revision.id,
        currency=base_revision.currency or "INR",
        snapshot_json={
            "source_proposal_id": str(proposal.id),
            "source_proposal_number": proposal.proposal_number,
            "account_id": str(quote.account_id),
            "opportunity_id": str(quote.opportunity_id),
            "terms": {
                "payment_terms": terms_dict.get("payment_terms") or quote.payment_terms or "Net 30",
                "delivery_terms": terms_dict.get("delivery_terms")
                or quote.delivery_terms
                or "Ex-Works",
            },
        },
        calculation_snapshot_json=proposed_snapshot,
        calculator_version=diff.get("financial_impact", {}).get(
            "calculator_version", "forgeflow-quote-calculator/1.0.0"
        ),
        input_fingerprint=diff.get("financial_impact", {}).get("proposed_fingerprint", ""),
        created_by=ctx.user.id,
        commit_reason=f"Committed from proposal {proposal.proposal_number}: {proposal.proposer_reason}",
        is_committed=True,
        version=1,
        created_at=now,
        updated_at=now,
    )
    db.add(new_revision)
    db.flush()

    # 8. Create QuoteRevisionLine rows
    for ln in proposed_snapshot.get("lines", []):
        rev_line = QuoteRevisionLine(
            id=uuid.uuid4(),
            organization_id=ctx.organization.id,
            revision_id=new_revision.id,
            line_order=ln["line_order"],
            rfq_line_id=uuid.UUID(ln["rfq_line_id"]) if ln.get("rfq_line_id") else None,
            catalog_product_id=uuid.UUID(ln["catalog_product_id"])
            if ln.get("catalog_product_id")
            else None,
            sku=ln["sku"],
            product_name=ln["name"],
            description=ln.get("description", ""),
            unit=ln["unit"],
            quantity=Decimal(str(ln["quantity"])),
            unit_price=Decimal(str(ln["unit_price"])),
            discount_percent=Decimal(str(ln["discount_percent"])),
            tax_rate_percent=Decimal(str(ln["tax_rate_percent"])),
            gross_amount=Decimal(str(ln["gross_amount"])),
            discount_amount=Decimal(str(ln["discount_amount"])),
            taxable_amount=Decimal(str(ln["taxable_amount"])),
            tax_amount=Decimal(str(ln["tax_amount"])),
            line_total=Decimal(str(ln["line_total"])),
            unit_cost=Decimal(str(ln["unit_cost"])) if ln.get("unit_cost") is not None else None,
            line_cost=Decimal(str(ln["line_cost"])) if ln.get("line_cost") is not None else None,
            line_gross_profit=Decimal(str(ln["line_gross_profit"]))
            if ln.get("line_gross_profit") is not None
            else None,
            margin_percent=Decimal(str(ln["margin_percent"]))
            if ln.get("margin_percent") is not None
            else None,
            created_at=now,
            updated_at=now,
        )
        db.add(rev_line)

    # 9. Update Quote pointer and terms
    quote.current_revision_id = new_revision.id
    quote.version += 1
    quote.status = "approved"
    if terms_dict.get("payment_terms"):
        quote.payment_terms = terms_dict["payment_terms"]
    if terms_dict.get("delivery_terms"):
        quote.delivery_terms = terms_dict["delivery_terms"]
    if terms_dict.get("valid_until"):
        quote.valid_until = datetime.fromisoformat(terms_dict["valid_until"]).date()
    quote.updated_at = now

    # 10. Update proposal status and pointer
    proposal.status = "committed"
    proposal.resulting_revision_id = new_revision.id
    proposal.committed_at = now
    proposal.updated_at = now

    # 11. Record activity
    record_activity(
        db=db,
        organization_id=ctx.organization.id,
        entity_type="proposal",
        entity_id=proposal.id,
        event_type="proposal.committed",
        summary=f"Committed proposal {proposal.proposal_number} as revision #{next_rev_num}",
        metadata_json={
            "proposal_number": proposal.proposal_number,
            "quote_id": str(quote.id),
            "quote_number": quote.quote_number,
            "resulting_revision_number": next_rev_num,
            "resulting_revision_id": str(new_revision.id),
        },
        actor_user_id=ctx.user.id,
    )

    db.commit()
    db.refresh(new_revision)
    return new_revision
