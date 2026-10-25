import csv
import io
import math
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, List, Optional, Sequence, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.auth.dependencies import AuthenticatedContext
from app.auth.rbac import Role
from app.domain.rfq.adapter import build_matcher_catalog
from app.domain.rfq.matcher import ProposedMatcher
from app.domain.rfq.normalizer import normalize_line
from app.models.catalog import CatalogAlias, CatalogProduct
from app.models.quote import Quote
from app.models.rfq import (
    RFQ,
    RFQLine,
    RFQLineDecision,
    RFQMatchCandidate,
)
from app.schemas.crm import PaginatedResponse
from app.schemas.rfq import (
    CandidateResponse,
    DecisionHistoryItem,
    RFQBulkDecisionRequest,
    RFQBulkDecisionResponse,
    RFQCreateQuoteRequest,
    RFQCreateQuoteResponse,
    RFQLineDecisionRequest,
    RFQLineDetailResponse,
    RFQLineResponse,
    RFQRematchRequest,
    RFQResponse,
)
from app.services.activity_service import record_activity
from app.services.quote_service import create_initial_quote_revision_from_rfq


def sanitize_csv_cell(val: Any) -> str:
    """Neutralize spreadsheet formula injection (=, +, -, @, tab, cr)."""
    if val is None:
        return ""
    s = str(val)
    if s and s[0] in ("=", "+", "-", "@", "\t", "\r"):
        return f"'{s}"
    return s


def build_candidate_response(
    cand: RFQMatchCandidate,
    ctx: AuthenticatedContext,
) -> CandidateResponse:
    """Builds a CandidateResponse with role-based unit_cost masking."""
    prod = cand.product
    can_view_cost = ctx.membership.role in (Role.CATALOG_MANAGER, Role.ADMIN)

    return CandidateResponse(
        id=cand.id,
        product_id=prod.id,
        product_sku=prod.sku,
        product_name=prod.name,
        product_category=prod.category,
        product_base_unit=prod.base_unit,
        sell_price=prod.sell_price,
        unit_cost=prod.unit_cost if can_view_cost else None,
        rank=cand.rank,
        match_method=cand.match_method,
        similarity_score=float(cand.similarity_score),
        is_disqualified=cand.is_disqualified,
        flags=cand.flags_json or [],
        reasons=cand.reasons_json or [],
        attributes=cand.explanation_json.get("attributes", {}) if cand.explanation_json else {},
    )


def compute_rfq_readiness(
    rfq: RFQ,
    lines: Sequence[RFQLine],
) -> Tuple[int, int, int, int, bool, List[str]]:
    """
    Evaluates server-side RFQ readiness and calculates dynamic line stats:
    Returns: (resolved_count, needs_review_count, invalid_count, exact_count, is_ready_to_quote, blocking_reasons)
    """
    resolved_count = 0
    needs_review_count = 0
    invalid_count = 0
    exact_count = 0
    blocking_reasons: List[str] = []

    for line_item in lines:
        if line_item.normalization_status == "invalid":
            invalid_count += 1
        elif line_item.match_status == "matched":
            resolved_count += 1
        elif line_item.match_status == "exact_match":
            exact_count += 1
            needs_review_count += 1
        elif line_item.match_status in ("needs_review", "suggested", "unmatched"):
            needs_review_count += 1

    if invalid_count > 0:
        blocking_reasons.append(f"{invalid_count} lines have invalid normalization errors")

    unresolved_count = len(lines) - resolved_count
    if unresolved_count > 0:
        blocking_reasons.append(
            f"{unresolved_count} lines require product resolution before quoting"
        )

    is_ready = len(lines) > 0 and invalid_count == 0 and unresolved_count == 0
    return (
        resolved_count,
        needs_review_count,
        invalid_count,
        exact_count,
        is_ready,
        blocking_reasons,
    )


# ==================== RFQ List & Details ====================


def list_rfqs(
    db: Session,
    ctx: AuthenticatedContext,
    status_filter: Optional[str] = None,
    account_id: Optional[uuid.UUID] = None,
    opportunity_id: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 25,
) -> PaginatedResponse[RFQResponse]:
    page = max(1, page)
    page_size = min(max(1, page_size), 100)

    query = select(RFQ).where(RFQ.organization_id == ctx.organization.id)

    # Sales rep data isolation
    if ctx.membership.role == Role.SALES_REP:
        query = query.where(
            or_(
                RFQ.assigned_rep_user_id == ctx.user.id,
                RFQ.created_by == ctx.user.id,
            )
        )

    if status_filter:
        query = query.where(RFQ.status == status_filter)
    if account_id:
        query = query.where(RFQ.account_id == account_id)
    if opportunity_id:
        query = query.where(RFQ.opportunity_id == opportunity_id)
    if search:
        p = f"%{search.strip()}%"
        query = query.where(
            or_(
                RFQ.rfq_number.ilike(p),
                RFQ.title.ilike(p),
                RFQ.customer_reference.ilike(p),
                RFQ.source_filename.ilike(p),
            )
        )

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    pages = math.ceil(total / page_size) if total > 0 else 1

    query = (
        query.options(
            selectinload(RFQ.account),
            selectinload(RFQ.opportunity),
            selectinload(RFQ.assigned_rep),
            selectinload(RFQ.lines),
        )
        .order_by(RFQ.imported_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rfqs = db.execute(query).scalars().all()

    items = []
    for r in rfqs:
        resp = RFQResponse.model_validate(r)
        resp.account_name = r.account.name if r.account else None
        resp.opportunity_name = r.opportunity.name if r.opportunity else None
        resp.assigned_rep_name = r.assigned_rep.display_name if r.assigned_rep else None

        res_c, nr_c, inv_c, ex_c, is_ready, blockers = compute_rfq_readiness(r, r.lines)
        resp.resolved_lines_count = res_c
        resp.needs_review_lines_count = nr_c
        resp.invalid_lines_count = inv_c
        resp.exact_matches_count = ex_c
        resp.is_ready_to_quote = is_ready
        resp.blocking_reasons = blockers
        items.append(resp)

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


def get_rfq_or_404(
    db: Session,
    ctx: AuthenticatedContext,
    rfq_id: uuid.UUID,
) -> RFQ:
    rfq = db.execute(
        select(RFQ)
        .where(RFQ.id == rfq_id, RFQ.organization_id == ctx.organization.id)
        .options(
            selectinload(RFQ.account),
            selectinload(RFQ.opportunity),
            selectinload(RFQ.assigned_rep),
            selectinload(RFQ.lines).selectinload(RFQLine.selected_product),
            selectinload(RFQ.lines)
            .selectinload(RFQLine.candidates)
            .selectinload(RFQMatchCandidate.product),
        )
    ).scalar_one_or_none()

    if not rfq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "RFQ_NOT_FOUND",
                "message": f"RFQ '{rfq_id}' not found.",
            },
        )

    # Sales rep check
    if (
        ctx.membership.role == Role.SALES_REP
        and rfq.assigned_rep_user_id != ctx.user.id
        and rfq.created_by != ctx.user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "RFQ_NOT_FOUND",
                "message": f"RFQ '{rfq_id}' not found.",
            },
        )

    return rfq


def get_rfq_response(
    db: Session,
    ctx: AuthenticatedContext,
    rfq_id: uuid.UUID,
) -> RFQResponse:
    rfq = get_rfq_or_404(db, ctx, rfq_id)
    resp = RFQResponse.model_validate(rfq)
    resp.account_name = rfq.account.name if rfq.account else None
    resp.opportunity_name = rfq.opportunity.name if rfq.opportunity else None
    resp.assigned_rep_name = rfq.assigned_rep.display_name if rfq.assigned_rep else None

    res_c, nr_c, inv_c, ex_c, is_ready, blockers = compute_rfq_readiness(rfq, rfq.lines)
    resp.resolved_lines_count = res_c
    resp.needs_review_lines_count = nr_c
    resp.invalid_lines_count = inv_c
    resp.exact_matches_count = ex_c
    resp.is_ready_to_quote = is_ready
    resp.blocking_reasons = blockers
    return resp


# ==================== Lines & Review Studio ====================


def list_rfq_lines(
    db: Session,
    ctx: AuthenticatedContext,
    rfq_id: uuid.UUID,
    match_status: Optional[str] = None,
    needs_review_only: bool = False,
    page: int = 1,
    page_size: int = 50,
) -> PaginatedResponse[RFQLineResponse]:
    rfq = get_rfq_or_404(db, ctx, rfq_id)
    page = max(1, page)
    page_size = min(max(1, page_size), 200)

    query = select(RFQLine).where(RFQLine.rfq_id == rfq.id)

    if match_status:
        query = query.where(RFQLine.match_status == match_status)
    if needs_review_only:
        query = query.where(RFQLine.match_status != "matched")

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    pages = math.ceil(total / page_size) if total > 0 else 1

    query = (
        query.options(
            selectinload(RFQLine.selected_product),
            selectinload(RFQLine.candidates).selectinload(RFQMatchCandidate.product),
        )
        .order_by(RFQLine.source_row_number.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    lines = db.execute(query).scalars().all()

    items = []
    for line_item in lines:
        resp = RFQLineResponse.model_validate(line_item)
        resp.specifications = line_item.specifications_json or {}
        resp.diagnostics = line_item.diagnostics_json or {}
        resp.candidate_count = len(line_item.candidates)

        if line_item.selected_product:
            resp.selected_product = CandidateResponse(
                id=uuid.uuid4(),
                product_id=line_item.selected_product.id,
                product_sku=line_item.selected_product.sku,
                product_name=line_item.selected_product.name,
                product_category=line_item.selected_product.category,
                product_base_unit=line_item.selected_product.base_unit,
                sell_price=line_item.selected_product.sell_price,
                unit_cost=line_item.selected_product.unit_cost
                if ctx.membership.role in (Role.CATALOG_MANAGER, Role.ADMIN)
                else None,
                rank=1,
                match_method="selected",
                similarity_score=1.0,
                is_disqualified=False,
                flags=[],
                reasons=[],
                attributes=line_item.selected_product.attributes_json or {},
            )

        if line_item.candidates:
            top_cand = line_item.candidates[0]
            resp.top_candidate = build_candidate_response(top_cand, ctx)

        items.append(resp)

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


def get_rfq_line_detail(
    db: Session,
    ctx: AuthenticatedContext,
    rfq_id: uuid.UUID,
    line_id: uuid.UUID,
) -> RFQLineDetailResponse:
    rfq = get_rfq_or_404(db, ctx, rfq_id)

    line = db.execute(
        select(RFQLine)
        .where(RFQLine.id == line_id, RFQLine.rfq_id == rfq.id)
        .options(
            selectinload(RFQLine.selected_product),
            selectinload(RFQLine.candidates).selectinload(RFQMatchCandidate.product),
            selectinload(RFQLine.decisions).selectinload(RFQLineDecision.actor),
            selectinload(RFQLine.decisions).selectinload(RFQLineDecision.selected_product),
        )
    ).scalar_one_or_none()

    if not line:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "LINE_NOT_FOUND",
                "message": f"RFQ line '{line_id}' not found.",
            },
        )

    candidates = [build_candidate_response(c, ctx) for c in line.candidates]
    top_cand = candidates[0] if candidates else None

    selected_product_resp = None
    if line.selected_product:
        selected_product_resp = CandidateResponse(
            id=uuid.uuid4(),
            product_id=line.selected_product.id,
            product_sku=line.selected_product.sku,
            product_name=line.selected_product.name,
            product_category=line.selected_product.category,
            product_base_unit=line.selected_product.base_unit,
            sell_price=line.selected_product.sell_price,
            unit_cost=line.selected_product.unit_cost
            if ctx.membership.role in (Role.CATALOG_MANAGER, Role.ADMIN)
            else None,
            rank=1,
            match_method="selected",
            similarity_score=1.0,
            is_disqualified=False,
            flags=[],
            reasons=[],
            attributes=line.selected_product.attributes_json or {},
        )

    decisions = []
    for d in line.decisions:
        decisions.append(
            DecisionHistoryItem(
                id=d.id,
                actor_user_id=d.actor_user_id,
                actor_name=d.actor.display_name if d.actor else "System",
                decision_type=d.decision_type,
                previous_match_status=d.previous_match_status,
                new_match_status=d.new_match_status,
                previous_product_name=None,
                selected_product_name=d.selected_product.name if d.selected_product else None,
                reason_code=d.reason_code,
                reason_notes=d.reason_notes,
                line_version_before=d.line_version_before,
                line_version_after=d.line_version_after,
                created_at=d.created_at,
            )
        )

    return RFQLineDetailResponse(
        id=line.id,
        rfq_id=line.rfq_id,
        source_row_number=line.source_row_number,
        raw_sku=line.raw_sku,
        raw_description=line.raw_description,
        raw_quantity=line.raw_quantity,
        raw_unit=line.raw_unit,
        raw_specifications=line.raw_specifications,
        raw_manufacturer=line.raw_manufacturer,
        raw_part_number=line.raw_part_number,
        raw_notes=line.raw_notes,
        normalized_description=line.normalized_description,
        parsed_quantity=line.parsed_quantity,
        canonical_unit=line.canonical_unit,
        specifications=line.specifications_json or {},
        diagnostics=line.diagnostics_json or {},
        normalization_status=line.normalization_status,
        match_status=line.match_status,
        selected_product_id=line.selected_product_id,
        selected_product=selected_product_resp,
        top_candidate=top_cand,
        candidate_count=len(line.candidates),
        resolution_reason_code=line.resolution_reason_code,
        resolution_notes=line.resolution_notes,
        version=line.version,
        updated_at=line.updated_at,
        candidates=candidates,
        decision_history=decisions,
    )


# ==================== Decisions & Bulk Actions ====================


def record_line_decision(
    db: Session,
    ctx: AuthenticatedContext,
    rfq_id: uuid.UUID,
    line_id: uuid.UUID,
    payload: RFQLineDecisionRequest,
    request_id: Optional[str] = None,
) -> RFQLineDetailResponse:
    rfq = get_rfq_or_404(db, ctx, rfq_id)

    if rfq.status == "quoted":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "RFQ_ALREADY_QUOTED",
                "message": "Cannot modify lines on an already converted RFQ.",
            },
        )

    line = db.execute(
        select(RFQLine)
        .where(RFQLine.id == line_id, RFQLine.rfq_id == rfq.id)
        .options(
            selectinload(RFQLine.selected_product),
            selectinload(RFQLine.candidates),
        )
    ).scalar_one_or_none()

    if not line:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "LINE_NOT_FOUND",
                "message": f"RFQ line '{line_id}' not found.",
            },
        )

    # Optimistic concurrency check
    if line.version != payload.expected_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "STALE_VERSION",
                "message": f"Line version conflict. Expected {payload.expected_version}, current is {line.version}.",
                "current_version": line.version,
            },
        )

    old_status = line.match_status
    prev_product_id = line.selected_product_id
    new_product_id: Optional[uuid.UUID] = None

    if payload.action == "accept_suggestion":
        # Resolve to top candidate or candidate_id
        if payload.candidate_id:
            cand = next((c for c in line.candidates if c.id == payload.candidate_id), None)
            if not cand:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={
                        "code": "CANDIDATE_NOT_FOUND",
                        "message": "Candidate not found on this line.",
                    },
                )
            new_product_id = cand.product_id
        else:
            if not line.candidates:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={"code": "NO_CANDIDATE", "message": "No candidate available to accept."},
                )
            new_product_id = line.candidates[0].product_id

        new_status = "matched"

    elif payload.action == "choose_product":
        if not payload.product_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "MISSING_PRODUCT_ID",
                    "message": "Product ID required for choose_product.",
                },
            )
        # Verify product exists in organization and is active
        prod = db.execute(
            select(CatalogProduct).where(
                CatalogProduct.id == payload.product_id,
                CatalogProduct.organization_id == ctx.organization.id,
                CatalogProduct.is_active.is_(True),
            )
        ).scalar_one_or_none()

        if not prod:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "code": "PRODUCT_NOT_FOUND",
                    "message": "Selected product is not found or is inactive.",
                },
            )

        new_product_id = prod.id
        new_status = "matched"

    elif payload.action == "mark_unmatched":
        new_product_id = None
        new_status = "unmatched"

    elif payload.action == "revert":
        new_product_id = None
        # Revert back to suggested or needs_review depending on top candidate
        new_status = (
            "exact_match"
            if (line.candidates and line.candidates[0].similarity_score == Decimal("1.0000"))
            else "needs_review"
        )

    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "INVALID_ACTION",
                "message": f"Action '{payload.action}' is not supported.",
            },
        )

    # Record decision audit
    now = datetime.now(timezone.utc)
    decision = RFQLineDecision(
        organization_id=ctx.organization.id,
        rfq_line_id=line.id,
        actor_user_id=ctx.user.id,
        decision_type=payload.action,
        previous_match_status=old_status,
        new_match_status=new_status,
        previous_product_id=prev_product_id,
        selected_product_id=new_product_id,
        reason_code=payload.reason_code,
        reason_notes=payload.notes,
        line_version_before=line.version,
        line_version_after=line.version + 1,
        candidate_set_version=rfq.candidate_set_version,
        request_id=request_id,
        created_at=now,
    )
    db.add(decision)

    # Update line
    line.match_status = new_status
    line.selected_product_id = new_product_id
    line.resolution_reason_code = payload.reason_code
    line.resolution_notes = payload.notes
    line.resolved_by = ctx.user.id
    line.resolved_at = now
    line.version += 1
    line.updated_at = now

    # Record Activity
    record_activity(
        db=db,
        organization_id=ctx.organization.id,
        entity_type="rfq_line",
        entity_id=line.id,
        event_type="line_decision",
        summary=f"Line #{line.source_row_number} decision '{payload.action}' by {ctx.user.display_name}",
        metadata_json={
            "action": payload.action,
            "new_status": new_status,
            "rfq_number": rfq.rfq_number,
        },
        actor_user_id=ctx.user.id,
    )

    # Recalculate parent RFQ status
    all_lines = db.execute(select(RFQLine).where(RFQLine.rfq_id == rfq.id)).scalars().all()
    _, _, _, _, is_ready, _ = compute_rfq_readiness(rfq, all_lines)
    if is_ready:
        rfq.status = "ready_to_quote"
    elif rfq.status == "ready_to_quote" and not is_ready:
        rfq.status = "needs_review"

    rfq.version += 1
    rfq.updated_at = now

    db.commit()
    return get_rfq_line_detail(db, ctx, rfq_id, line_id)


def bulk_accept_exact_matches(
    db: Session,
    ctx: AuthenticatedContext,
    rfq_id: uuid.UUID,
    payload: RFQBulkDecisionRequest,
    request_id: Optional[str] = None,
) -> RFQBulkDecisionResponse:
    """
    All-or-nothing atomic bulk acceptance of exact match candidates.
    If ANY line is stale, unauthorized, ineligible, or invalid, rolls back completely.
    """
    rfq = get_rfq_or_404(db, ctx, rfq_id)

    if rfq.status == "quoted":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "RFQ_ALREADY_QUOTED",
                "message": "Cannot bulk-accept lines on an already converted RFQ.",
            },
        )

    if not payload.line_ids:
        return RFQBulkDecisionResponse(accepted_count=0, line_ids=[])

    # Load target lines ordered by ID to avoid database deadlocks
    target_lines = (
        db.execute(
            select(RFQLine)
            .where(
                RFQLine.id.in_(payload.line_ids),
                RFQLine.rfq_id == rfq.id,
                RFQLine.organization_id == ctx.organization.id,
            )
            .options(
                selectinload(RFQLine.candidates),
            )
            .order_by(RFQLine.id.asc())
        )
        .scalars()
        .all()
    )

    if len(target_lines) != len(payload.line_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "LINES_NOT_FOUND",
                "message": "One or more requested line IDs do not belong to this RFQ.",
            },
        )

    # 1. Strict atomic validation loop
    for line in target_lines:
        line_id_str = str(line.id)
        expected_ver = payload.expected_versions.get(line_id_str)

        if expected_ver is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "MISSING_EXPECTED_VERSION",
                    "message": f"Expected version missing for line {line_id_str}.",
                },
            )

        if line.version != expected_ver:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "STALE_VERSION",
                    "message": f"Bulk acceptance failed: Line #{line.source_row_number} version conflict (expected {expected_ver}, current {line.version}). Committing none.",
                    "stale_line_id": line_id_str,
                },
            )

        if line.normalization_status == "invalid":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "INVALID_LINE",
                    "message": f"Line #{line.source_row_number} has invalid normalization and cannot be accepted.",
                },
            )

        if line.match_status != "exact_match":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "INELIGIBLE_FOR_BULK_ACCEPT",
                    "message": f"Line #{line.source_row_number} is in '{line.match_status}' status, not 'exact_match'. Committing none.",
                },
            )

        if not line.candidates:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "NO_CANDIDATE",
                    "message": f"Line #{line.source_row_number} has no candidate to accept.",
                },
            )

    # 2. All rows validated: apply updates atomically
    now = datetime.now(timezone.utc)
    for line in target_lines:
        top_cand = line.candidates[0]
        old_status = line.match_status

        decision = RFQLineDecision(
            organization_id=ctx.organization.id,
            rfq_line_id=line.id,
            actor_user_id=ctx.user.id,
            decision_type="accept_suggestion",
            previous_match_status=old_status,
            new_match_status="matched",
            previous_product_id=line.selected_product_id,
            selected_product_id=top_cand.product_id,
            reason_code="BULK_EXACT_ACCEPT",
            reason_notes="Bulk exact match acceptance",
            line_version_before=line.version,
            line_version_after=line.version + 1,
            candidate_set_version=rfq.candidate_set_version,
            request_id=request_id,
            created_at=now,
        )
        db.add(decision)

        line.match_status = "matched"
        line.selected_product_id = top_cand.product_id
        line.resolution_reason_code = "BULK_EXACT_ACCEPT"
        line.resolved_by = ctx.user.id
        line.resolved_at = now
        line.version += 1
        line.updated_at = now

    # Record Activity for batch
    record_activity(
        db=db,
        organization_id=ctx.organization.id,
        entity_type="rfq",
        entity_id=rfq.id,
        event_type="bulk_decision",
        summary=f"Bulk-accepted {len(target_lines)} exact matches on RFQ '{rfq.rfq_number}' by {ctx.user.display_name}",
        metadata_json={"count": len(target_lines), "rfq_number": rfq.rfq_number},
        actor_user_id=ctx.user.id,
    )

    # Re-evaluate RFQ status
    all_lines = db.execute(select(RFQLine).where(RFQLine.rfq_id == rfq.id)).scalars().all()
    _, _, _, _, is_ready, _ = compute_rfq_readiness(rfq, all_lines)
    if is_ready:
        rfq.status = "ready_to_quote"

    rfq.version += 1
    rfq.updated_at = now

    db.commit()
    return RFQBulkDecisionResponse(
        accepted_count=len(target_lines),
        line_ids=[line_item.id for line_item in target_lines],
    )


def rematch_rfq(
    db: Session,
    ctx: AuthenticatedContext,
    rfq_id: uuid.UUID,
    payload: RFQRematchRequest,
    request_id: Optional[str] = None,
) -> RFQResponse:
    """
    Re-runs deterministic catalog matching against the latest catalog snapshot.
    Preserves manual decisions unless clear_manual_decisions=True.
    Restricted to catalog_manager and admin.
    """
    if ctx.membership.role not in (Role.CATALOG_MANAGER, Role.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "FORBIDDEN",
                "message": "Only Catalog Reviewers and Administrators may re-run RFQ matching.",
            },
        )

    rfq = get_rfq_or_404(db, ctx, rfq_id)
    if rfq.status == "quoted":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "RFQ_ALREADY_QUOTED",
                "message": "Cannot re-match an already converted RFQ.",
            },
        )

    # Build fresh matcher catalog snapshot
    catalog_products = (
        db.execute(
            select(CatalogProduct).where(
                CatalogProduct.organization_id == ctx.organization.id,
                CatalogProduct.is_active.is_(True),
            )
        )
        .scalars()
        .all()
    )

    catalog_aliases = (
        db.execute(
            select(CatalogAlias).where(
                CatalogAlias.organization_id == ctx.organization.id,
            )
        )
        .scalars()
        .all()
    )

    matcher_catalog = build_matcher_catalog(catalog_products, catalog_aliases)
    matcher = ProposedMatcher(matcher_catalog)

    # Increment candidate set version
    new_cand_set_ver = rfq.candidate_set_version + 1
    now = datetime.now(timezone.utc)

    lines = (
        db.execute(
            select(RFQLine)
            .where(RFQLine.rfq_id == rfq.id)
            .order_by(RFQLine.source_row_number.asc())
        )
        .scalars()
        .all()
    )

    for line in lines:
        is_manually_resolved = line.match_status == "matched"
        if is_manually_resolved and not payload.clear_manual_decisions:
            continue

        if not line.raw_description:
            continue

        norm_res = normalize_line(
            raw_input=line.raw_description,
            quantity_input=line.raw_quantity,
            unit_input=line.raw_unit,
        )

        match_res = matcher.match(
            line=norm_res,
            hint_sku=line.raw_sku,
            hint_mpn=line.raw_part_number,
        )

        if payload.clear_manual_decisions and is_manually_resolved:
            line.selected_product_id = None
            line.resolution_reason_code = None
            line.resolution_notes = None

        line.match_status = match_res.match_status
        line.version += 1
        line.updated_at = now

        # Add new candidates
        for rank_idx, c in enumerate(match_res.candidates, start=1):
            prod_uuid = None
            if c.product_id:
                try:
                    prod_uuid = uuid.UUID(c.product_id)
                except ValueError:
                    pass

            if not prod_uuid:
                prod = next((p for p in catalog_products if p.sku == c.sku), None)
                if prod:
                    prod_uuid = prod.id

            if prod_uuid:
                cand = RFQMatchCandidate(
                    organization_id=ctx.organization.id,
                    rfq_line_id=line.id,
                    product_id=prod_uuid,
                    rank=rank_idx,
                    match_method=c.match_method,
                    similarity_score=Decimal(str(c.similarity)),
                    is_disqualified=c.disqualified,
                    flags_json=c.flags,
                    reasons_json=match_res.reason_codes if rank_idx == 1 else [],
                    explanation_json={"attributes": c.attributes, "flags": c.flags},
                    matcher_version="1.0.0-final",
                    candidate_set_version=new_cand_set_ver,
                    created_at=now,
                )
                db.add(cand)

    rfq.candidate_set_version = new_cand_set_ver
    rfq.version += 1
    rfq.updated_at = now

    # Evaluate new status
    _, _, _, _, is_ready, _ = compute_rfq_readiness(rfq, lines)
    rfq.status = "ready_to_quote" if is_ready else "needs_review"

    # Record activity
    record_activity(
        db=db,
        organization_id=ctx.organization.id,
        entity_type="rfq",
        entity_id=rfq.id,
        event_type="rfq_rematched",
        summary=f"RFQ '{rfq.rfq_number}' rematched (v{new_cand_set_ver}) by {ctx.user.display_name}",
        metadata_json={
            "candidate_set_version": new_cand_set_ver,
            "clear_manual": payload.clear_manual_decisions,
        },
        actor_user_id=ctx.user.id,
    )

    db.commit()
    return get_rfq_response(db, ctx, rfq_id)


# ==================== Export & Quote Gate ====================


def export_rfq_csv(
    db: Session,
    ctx: AuthenticatedContext,
    rfq_id: uuid.UUID,
) -> str:
    """Generates RFC 4180 CSV export with formula injection neutralization."""
    rfq = get_rfq_or_404(db, ctx, rfq_id)

    lines = (
        db.execute(
            select(RFQLine)
            .where(RFQLine.rfq_id == rfq.id)
            .options(
                selectinload(RFQLine.selected_product),
                selectinload(RFQLine.candidates).selectinload(RFQMatchCandidate.product),
            )
            .order_by(RFQLine.source_row_number.asc())
        )
        .scalars()
        .all()
    )

    out = io.StringIO()
    writer = csv.writer(out)

    # Headers
    writer.writerow(
        [
            "Line #",
            "Raw Description",
            "Normalized Description",
            "Quantity",
            "Unit",
            "Normalization Status",
            "Match Status",
            "Resolved SKU",
            "Resolved Product Name",
            "Top Candidate SKU",
            "Top Candidate Score",
            "Resolution Reason",
        ]
    )

    for line_item in lines:
        resolved_sku = line_item.selected_product.sku if line_item.selected_product else ""
        resolved_name = line_item.selected_product.name if line_item.selected_product else ""

        top_cand_sku = line_item.candidates[0].product.sku if line_item.candidates else ""
        top_cand_score = (
            f"{float(line_item.candidates[0].similarity_score):.4f}" if line_item.candidates else ""
        )

        writer.writerow(
            [
                sanitize_csv_cell(line_item.source_row_number),
                sanitize_csv_cell(line_item.raw_description),
                sanitize_csv_cell(line_item.normalized_description),
                sanitize_csv_cell(line_item.parsed_quantity),
                sanitize_csv_cell(line_item.canonical_unit),
                sanitize_csv_cell(line_item.normalization_status),
                sanitize_csv_cell(line_item.match_status),
                sanitize_csv_cell(resolved_sku),
                sanitize_csv_cell(resolved_name),
                sanitize_csv_cell(top_cand_sku),
                sanitize_csv_cell(top_cand_score),
                sanitize_csv_cell(line_item.resolution_reason_code or ""),
            ]
        )

    # Record Activity
    record_activity(
        db=db,
        organization_id=ctx.organization.id,
        entity_type="rfq",
        entity_id=rfq.id,
        event_type="rfq_exported",
        summary=f"RFQ '{rfq.rfq_number}' exported to CSV by {ctx.user.display_name}",
        metadata_json={"lines": len(lines)},
        actor_user_id=ctx.user.id,
    )
    db.commit()

    return out.getvalue()


def create_quote_from_rfq(
    db: Session,
    ctx: AuthenticatedContext,
    rfq_id: uuid.UUID,
    payload: RFQCreateQuoteRequest,
    request_id: Optional[str] = None,
) -> RFQCreateQuoteResponse:
    """
    Authoritative quote-readiness & conversion gate.
    Verifies that RFQ is in ready_to_quote status and has zero blocking lines.
    Transitions RFQ to 'quoted' and creates the minimal Quote draft shell.
    """
    rfq = get_rfq_or_404(db, ctx, rfq_id)

    # 1. Optimistic locking on RFQ
    if rfq.version != payload.expected_rfq_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "STALE_VERSION",
                "message": f"RFQ version conflict. Expected {payload.expected_rfq_version}, current is {rfq.version}.",
                "current_version": rfq.version,
            },
        )

    # 2. Check if already quoted
    existing_quote = db.execute(select(Quote).where(Quote.rfq_id == rfq.id)).scalars().first()

    if existing_quote or rfq.status == "quoted":
        quote_num = existing_quote.quote_number if existing_quote else "UNKNOWN"
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "RFQ_ALREADY_QUOTED",
                "message": f"RFQ '{rfq.rfq_number}' has already been converted to Quote '{quote_num}'.",
                "quote_id": str(existing_quote.id) if existing_quote else None,
                "quote_number": quote_num,
            },
        )

    # 3. Evaluate readiness
    lines = db.execute(select(RFQLine).where(RFQLine.rfq_id == rfq.id)).scalars().all()
    _, _, _, _, is_ready, blockers = compute_rfq_readiness(rfq, lines)

    if not is_ready:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "RFQ_NOT_READY_TO_QUOTE",
                "message": f"RFQ '{rfq.rfq_number}' cannot be converted to a quote: {'; '.join(blockers)}",
                "blocking_reasons": blockers,
            },
        )

    # 4. Generate Quote Number (e.g. QT-2026-0001)
    year = datetime.now(timezone.utc).year
    prefix = f"QT-{year}-"
    latest_q = db.scalar(
        select(Quote.quote_number)
        .where(Quote.organization_id == ctx.organization.id, Quote.quote_number.like(f"{prefix}%"))
        .order_by(Quote.quote_number.desc())
        .limit(1)
    )

    if latest_q:
        try:
            q_num = int(latest_q.split("-")[-1]) + 1
        except ValueError:
            q_num = 1
    else:
        q_num = 1

    quote_number = f"{prefix}{q_num:04d}"
    now = datetime.now(timezone.utc)

    # 5. Create Quote Draft Header
    quote = Quote(
        organization_id=ctx.organization.id,
        quote_number=quote_number,
        rfq_id=rfq.id,
        opportunity_id=rfq.opportunity_id,
        account_id=rfq.account_id,
        status="draft",
        created_by=ctx.user.id,
        version=1,
        notes=payload.notes,
        created_at=now,
    )
    db.add(quote)
    db.flush()

    # 6. Create initial draft revision from RFQ line items
    revision = create_initial_quote_revision_from_rfq(db, ctx, quote, rfq, lines)

    # 7. Update RFQ status to 'quoted'
    rfq.status = "quoted"
    rfq.version += 1
    rfq.updated_at = now

    # 8. Record Activities
    record_activity(
        db=db,
        organization_id=ctx.organization.id,
        entity_type="rfq",
        entity_id=rfq.id,
        event_type="rfq_converted_to_quote",
        summary=f"RFQ '{rfq.rfq_number}' converted to Quote '{quote.quote_number}' by {ctx.user.display_name}",
        metadata_json={
            "quote_id": str(quote.id),
            "quote_number": quote.quote_number,
            "revision_id": str(revision.id),
        },
        actor_user_id=ctx.user.id,
    )

    record_activity(
        db=db,
        organization_id=ctx.organization.id,
        entity_type="quote",
        entity_id=quote.id,
        event_type="quote_created",
        summary=f"Quote draft '{quote.quote_number}' initialized from RFQ '{rfq.rfq_number}'",
        metadata_json={
            "rfq_id": str(rfq.id),
            "rfq_number": rfq.rfq_number,
            "revision_id": str(revision.id),
        },
        actor_user_id=ctx.user.id,
    )

    db.commit()
    db.refresh(quote)

    return RFQCreateQuoteResponse(
        quote_id=quote.id,
        quote_number=quote.quote_number,
        status=quote.status,
        rfq_id=rfq.id,
        opportunity_id=rfq.opportunity_id,
        account_id=rfq.account_id,
        current_revision_id=revision.id,
    )
