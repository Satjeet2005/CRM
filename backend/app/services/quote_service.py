"""
Authoritative Quotation Service for ForgeFlow.
Manages Quote lifecycle, atomic conversion from RFQ, revision snapshots, draft edits, and calculation traces.
"""

import math
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Sequence

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthenticatedContext
from app.auth.rbac import Role
from app.domain.quotes.calculator import (
    QuoteLineInput,
    calculate_quote,
)
from app.domain.quotes.policies import (
    QuotePolicyConfig,
    evaluate_quote_policies,
)
from app.models.catalog import CatalogProduct
from app.models.crm import Account, Opportunity
from app.models.organization import Organization
from app.models.quote import Quote, QuoteRevision, QuoteRevisionLine
from app.models.rfq import RFQ, RFQLine
from app.models.user import User
from app.schemas.quote import (
    CalculationTraceResponse,
    PaginatedQuotesResponse,
    QuoteDetailResponse,
    QuoteDraftUpdateRequest,
    QuoteListItemResponse,
    QuoteRevisionLineResponse,
    QuoteRevisionResponse,
    QuoteTotalsSchema,
)
from app.services.activity_service import record_activity


def is_cost_visible(ctx: AuthenticatedContext) -> bool:
    """
    Evaluates whether the user's role has permission to view internal cost and margin fields.
    Strictly forbidden for sales_rep and sales_manager.
    """
    if "catalog:cost" in ctx.permissions:
        return True
    return ctx.membership.role in [Role.CATALOG_MANAGER, Role.ADMIN]


def get_quote_or_404(db: Session, ctx: AuthenticatedContext, quote_id: uuid.UUID) -> Quote:
    stmt = select(Quote).where(
        Quote.id == quote_id,
        Quote.organization_id == ctx.organization.id,
    )
    quote = db.scalar(stmt)
    if not quote:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "QUOTE_NOT_FOUND",
                "message": f"Quote '{quote_id}' was not found in your organization.",
            },
        )
    return quote


def create_initial_quote_revision_from_rfq(
    db: Session,
    ctx: AuthenticatedContext,
    quote: Quote,
    rfq: RFQ,
    rfq_lines: Sequence[RFQLine],
) -> QuoteRevision:
    """
    Creates the first draft revision (Revision 1) from reviewed RFQ lines in the conversion transaction.
    """
    if not rfq_lines:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "RFQ_EMPTY_LINES",
                "message": "Cannot create quotation from RFQ with zero line items.",
            },
        )

    # 1. Fetch organization policy config
    org = db.scalar(select(Organization).where(Organization.id == ctx.organization.id))
    policy_config = QuotePolicyConfig.from_dict(org.settings_json if org else None)

    # 2. Build QuoteLineInput for authoritative calculator
    calculator_inputs: List[QuoteLineInput] = []
    line_product_map: Dict[int, CatalogProduct] = {}

    for idx, rfq_line in enumerate(sorted(rfq_lines, key=lambda ln: ln.source_row_number), start=1):
        if not rfq_line.selected_product_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "RFQ_LINE_MISSING_PRODUCT",
                    "message": (
                        f"Line #{rfq_line.source_row_number} ('{rfq_line.raw_description}') does not have an "
                        "assigned catalog product. Quotation conversion requires all lines to be resolved to catalog products."
                    ),
                },
            )

        product = db.scalar(
            select(CatalogProduct).where(
                CatalogProduct.id == rfq_line.selected_product_id,
                CatalogProduct.organization_id == ctx.organization.id,
            )
        )
        if not product:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "PRODUCT_NOT_FOUND",
                    "message": f"Catalog product '{rfq_line.selected_product_id}' for line #{rfq_line.source_row_number} was not found.",
                },
            )

        if product.sell_price is None or product.sell_price < Decimal("0"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "PRODUCT_MISSING_PRICE",
                    "message": f"Catalog product '{product.sku}' does not have a valid list selling price.",
                },
            )

        line_product_map[idx] = product
        qty = rfq_line.parsed_quantity or Decimal("1.0000")
        if qty <= Decimal("0"):
            qty = Decimal("1.0000")

        calculator_inputs.append(
            QuoteLineInput(
                line_id=str(rfq_line.id),
                line_order=idx,
                sku=product.sku,
                name=product.name,
                description=product.description or rfq_line.raw_description,
                unit=product.base_unit or rfq_line.canonical_unit or "nos",
                quantity=qty,
                unit_price=product.sell_price,
                discount_percent=Decimal("0.00"),
                tax_rate_percent=product.tax_rate_percent or Decimal("18.00"),
                unit_cost=product.unit_cost,
                rfq_line_id=str(rfq_line.id),
                catalog_product_id=str(product.id),
            )
        )

    # 3. Authoritative Decimal calculation
    calc_result = calculate_quote(calculator_inputs, currency="INR")

    # 4. Pure Policy evaluation
    policy_result = evaluate_quote_policies(calc_result, policy_config)

    # 5. Embed policy evaluation in calculation snapshot
    calc_snapshot = calc_result.to_snapshot_json()
    calc_snapshot["policy_evaluation"] = policy_result.to_dict()

    now = datetime.now(timezone.utc)

    # 6. Create QuoteRevision 1
    revision = QuoteRevision(
        id=uuid.uuid4(),
        organization_id=ctx.organization.id,
        quote_id=quote.id,
        revision_number=1,
        parent_revision_id=None,
        currency="INR",
        snapshot_json={
            "source_rfq_id": str(rfq.id),
            "source_rfq_number": rfq.rfq_number,
            "account_id": str(quote.account_id),
            "opportunity_id": str(quote.opportunity_id),
            "terms": {
                "payment_terms": quote.payment_terms or "Net 30",
                "delivery_terms": quote.delivery_terms or "Ex-Works",
            },
        },
        calculation_snapshot_json=calc_snapshot,
        calculator_version=calc_result.calculator_version,
        input_fingerprint=calc_result.input_fingerprint,
        created_by=ctx.user.id,
        commit_reason="Initial draft created from RFQ conversion",
        is_committed=False,
        version=1,
        created_at=now,
        updated_at=now,
    )
    db.add(revision)
    db.flush()

    # 7. Create QuoteRevisionLine records
    for l_calc in calc_result.lines:
        prod = line_product_map[l_calc.line_order]
        rfq_line_match = next((rl for rl in rfq_lines if str(rl.id) == l_calc.line_id), None)

        rev_line = QuoteRevisionLine(
            id=uuid.uuid4(),
            organization_id=ctx.organization.id,
            revision_id=revision.id,
            line_order=l_calc.line_order,
            rfq_line_id=rfq_line_match.id if rfq_line_match else None,
            catalog_product_id=prod.id,
            sku=l_calc.sku,
            product_name=l_calc.name,
            description=l_calc.description,
            unit=l_calc.unit,
            quantity=l_calc.quantity,
            unit_price=l_calc.unit_price,
            discount_percent=l_calc.discount_percent,
            tax_rate_percent=l_calc.tax_rate_percent,
            unit_cost=l_calc.unit_cost,
            gross_amount=l_calc.gross_amount,
            discount_amount=l_calc.discount_amount,
            taxable_amount=l_calc.taxable_amount,
            tax_amount=l_calc.tax_amount,
            line_total=l_calc.line_total,
            line_cost=l_calc.line_cost,
            line_gross_profit=l_calc.line_gross_profit,
            margin_percent=l_calc.margin_percent,
            created_at=now,
            updated_at=now,
        )
        db.add(rev_line)

    quote.current_revision_id = revision.id
    db.flush()

    return revision


def mask_revision_lines_for_role(
    lines: List[QuoteRevisionLine],
    can_view_cost: bool,
) -> List[QuoteRevisionLineResponse]:
    """
    Transforms database lines into schema responses with server-side RBAC cost/margin masking.
    """
    out: List[QuoteRevisionLineResponse] = []
    for rev_line in sorted(lines, key=lambda x: x.line_order):
        out.append(
            QuoteRevisionLineResponse(
                id=rev_line.id,
                line_order=rev_line.line_order,
                rfq_line_id=rev_line.rfq_line_id,
                catalog_product_id=rev_line.catalog_product_id,
                sku=rev_line.sku,
                product_name=rev_line.product_name,
                description=rev_line.description,
                unit=rev_line.unit,
                quantity=rev_line.quantity,
                unit_price=rev_line.unit_price,
                discount_percent=rev_line.discount_percent,
                tax_rate_percent=rev_line.tax_rate_percent,
                gross_amount=rev_line.gross_amount,
                discount_amount=rev_line.discount_amount,
                taxable_amount=rev_line.taxable_amount,
                tax_amount=rev_line.tax_amount,
                line_total=rev_line.line_total,
                unit_cost=rev_line.unit_cost if can_view_cost else None,
                line_cost=rev_line.line_cost if can_view_cost else None,
                line_gross_profit=rev_line.line_gross_profit if can_view_cost else None,
                margin_percent=rev_line.margin_percent if can_view_cost else None,
            )
        )
    return out


def mask_totals_for_role(
    calc_snap: Dict[str, Any],
    can_view_cost: bool,
) -> QuoteTotalsSchema:
    """
    Transforms raw totals from calculation snapshot into QuoteTotalsSchema, applying cost masking.
    """
    totals_raw = calc_snap.get("totals", {})
    return QuoteTotalsSchema(
        subtotal=Decimal(totals_raw.get("subtotal", "0.00")),
        total_discount=Decimal(totals_raw.get("total_discount", "0.00")),
        taxable_subtotal=Decimal(totals_raw.get("taxable_subtotal", "0.00")),
        tax_total=Decimal(totals_raw.get("tax_total", "0.00")),
        grand_total=Decimal(totals_raw.get("grand_total", "0.00")),
        total_cost=Decimal(totals_raw["total_cost"])
        if can_view_cost and totals_raw.get("total_cost") is not None
        else None,
        total_gross_profit=Decimal(totals_raw["total_gross_profit"])
        if can_view_cost and totals_raw.get("total_gross_profit") is not None
        else None,
        overall_margin_percent=Decimal(totals_raw["overall_margin_percent"])
        if can_view_cost and totals_raw.get("overall_margin_percent") is not None
        else None,
    )


def build_quote_revision_response(
    revision: QuoteRevision,
    can_view_cost: bool,
) -> QuoteRevisionResponse:
    calc_snap = revision.calculation_snapshot_json or {}
    policy_eval = calc_snap.get("policy_evaluation")

    return QuoteRevisionResponse(
        id=revision.id,
        quote_id=revision.quote_id,
        revision_number=revision.revision_number,
        parent_revision_id=revision.parent_revision_id,
        currency=revision.currency,
        calculator_version=revision.calculator_version,
        input_fingerprint=revision.input_fingerprint,
        is_committed=revision.is_committed,
        version=revision.version,
        snapshot_json=revision.snapshot_json or {},
        totals=mask_totals_for_role(calc_snap, can_view_cost),
        lines=mask_revision_lines_for_role(revision.lines, can_view_cost),
        policy_evaluation=policy_eval,
        created_by=revision.created_by,
        created_at=revision.created_at,
        updated_at=revision.updated_at,
    )


def build_quote_detail_response(
    db: Session,
    ctx: AuthenticatedContext,
    quote: Quote,
) -> QuoteDetailResponse:
    can_view_cost = is_cost_visible(ctx)

    acc = db.scalar(select(Account).where(Account.id == quote.account_id))
    opp = db.scalar(select(Opportunity).where(Opportunity.id == quote.opportunity_id))
    creator = db.scalar(select(User).where(User.id == quote.created_by))
    rfq = db.scalar(select(RFQ).where(RFQ.id == quote.rfq_id)) if quote.rfq_id else None

    current_rev_resp: Optional[QuoteRevisionResponse] = None
    requires_approval = False
    triggers: List[Dict[str, Any]] = []

    if quote.current_revision_id:
        rev = db.scalar(
            select(QuoteRevision).where(
                QuoteRevision.id == quote.current_revision_id,
                QuoteRevision.organization_id == ctx.organization.id,
            )
        )
        if rev:
            current_rev_resp = build_quote_revision_response(rev, can_view_cost)
            policy_eval = rev.calculation_snapshot_json.get("policy_evaluation", {})
            requires_approval = policy_eval.get("requires_manager_approval", False)
            triggers = policy_eval.get("triggers", [])

    return QuoteDetailResponse(
        id=quote.id,
        organization_id=quote.organization_id,
        quote_number=quote.quote_number,
        rfq_id=quote.rfq_id,
        rfq_number=rfq.rfq_number if rfq else None,
        opportunity_id=quote.opportunity_id,
        opportunity_name=opp.name if opp else "Unknown Opportunity",
        account_id=quote.account_id,
        account_name=acc.name if acc else "Unknown Account",
        status=quote.status,
        created_by=quote.created_by,
        created_by_name=creator.display_name if creator else "System",
        version=quote.version,
        notes=quote.notes,
        current_revision_id=quote.current_revision_id,
        valid_until=quote.valid_until,
        payment_terms=quote.payment_terms,
        delivery_terms=quote.delivery_terms,
        created_at=quote.created_at,
        updated_at=quote.updated_at,
        current_revision=current_rev_resp,
        requires_manager_approval=requires_approval,
        approval_triggers=triggers,
    )


def get_quote_detail(
    db: Session,
    ctx: AuthenticatedContext,
    quote_id: uuid.UUID,
) -> QuoteDetailResponse:
    quote = get_quote_or_404(db, ctx, quote_id)
    return build_quote_detail_response(db, ctx, quote)


def list_quote_revisions(
    db: Session,
    ctx: AuthenticatedContext,
    quote_id: uuid.UUID,
) -> List[QuoteRevisionResponse]:
    quote = get_quote_or_404(db, ctx, quote_id)
    can_view_cost = is_cost_visible(ctx)

    revisions = db.scalars(
        select(QuoteRevision)
        .where(
            QuoteRevision.quote_id == quote.id,
            QuoteRevision.organization_id == ctx.organization.id,
        )
        .order_by(QuoteRevision.revision_number.desc())
    ).all()
    return [build_quote_revision_response(rev, can_view_cost) for rev in revisions]


def get_quote_revision_detail(
    db: Session,
    ctx: AuthenticatedContext,
    quote_id: uuid.UUID,
    revision_id: uuid.UUID,
) -> QuoteRevisionResponse:
    quote = get_quote_or_404(db, ctx, quote_id)
    can_view_cost = is_cost_visible(ctx)

    revision = db.scalar(
        select(QuoteRevision).where(
            QuoteRevision.id == revision_id,
            QuoteRevision.quote_id == quote.id,
            QuoteRevision.organization_id == ctx.organization.id,
        )
    )
    if not revision:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "REVISION_NOT_FOUND",
                "message": f"Revision '{revision_id}' was not found on Quote '{quote.quote_number}'.",
            },
        )
    return build_quote_revision_response(revision, can_view_cost)


def list_quotes(
    db: Session,
    ctx: AuthenticatedContext,
    status_filter: Optional[str] = None,
    account_id: Optional[uuid.UUID] = None,
    opportunity_id: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> PaginatedQuotesResponse:
    query = select(Quote).where(Quote.organization_id == ctx.organization.id)

    if status_filter:
        query = query.where(Quote.status == status_filter)
    if account_id:
        query = query.where(Quote.account_id == account_id)
    if opportunity_id:
        query = query.where(Quote.opportunity_id == opportunity_id)
    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.outerjoin(Account, Quote.account_id == Account.id).where(
            or_(
                Quote.quote_number.ilike(search_fmt),
                Account.name.ilike(search_fmt),
            )
        )

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    stmt = query.order_by(Quote.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    quotes = db.scalars(stmt).all()

    items: List[QuoteListItemResponse] = []
    for q in quotes:
        acc = db.scalar(select(Account).where(Account.id == q.account_id))
        opp = db.scalar(select(Opportunity).where(Opportunity.id == q.opportunity_id))
        creator = db.scalar(select(User).where(User.id == q.created_by))
        rfq = db.scalar(select(RFQ).where(RFQ.id == q.rfq_id)) if q.rfq_id else None

        grand_total = Decimal("0.00")
        curr = "INR"
        rev_num = 1
        requires_approval = False

        if q.current_revision_id:
            rev = db.scalar(
                select(QuoteRevision).where(
                    QuoteRevision.id == q.current_revision_id,
                    QuoteRevision.organization_id == ctx.organization.id,
                )
            )
            if rev:
                rev_num = rev.revision_number
                curr = rev.currency
                totals = rev.calculation_snapshot_json.get("totals", {})
                grand_total = Decimal(totals.get("grand_total", "0.00"))
                pol = rev.calculation_snapshot_json.get("policy_evaluation", {})
                requires_approval = pol.get("requires_manager_approval", False)

        items.append(
            QuoteListItemResponse(
                id=q.id,
                quote_number=q.quote_number,
                rfq_id=q.rfq_id,
                rfq_number=rfq.rfq_number if rfq else None,
                opportunity_id=q.opportunity_id,
                opportunity_name=opp.name if opp else "Unknown Opportunity",
                account_id=q.account_id,
                account_name=acc.name if acc else "Unknown Account",
                status=q.status,
                current_revision_number=rev_num,
                grand_total=grand_total,
                currency=curr,
                requires_manager_approval=requires_approval,
                created_by=q.created_by,
                created_by_name=creator.display_name if creator else "System",
                version=q.version,
                valid_until=q.valid_until,
                created_at=q.created_at,
                updated_at=q.updated_at,
            )
        )

    return PaginatedQuotesResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


def update_quote_draft(
    db: Session,
    ctx: AuthenticatedContext,
    quote_id: uuid.UUID,
    payload: QuoteDraftUpdateRequest,
    request_id: Optional[str] = None,
) -> QuoteDetailResponse:
    """
    Updates the mutable initial draft revision of a quotation.
    Requires expected_version matching quote.version.
    Atomically recomputes line calculations, totals, and policy evaluation.
    """
    quote = get_quote_or_404(db, ctx, quote_id)

    # 1. State and Concurrency validations
    if quote.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "QUOTE_NOT_EDITABLE",
                "message": f"Quote '{quote.quote_number}' is in status '{quote.status}' and cannot be edited.",
            },
        )

    if quote.version != payload.expected_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "STALE_VERSION",
                "message": f"Quote version conflict. Expected {payload.expected_version}, current is {quote.version}.",
                "current_version": quote.version,
            },
        )

    if not quote.current_revision_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "QUOTE_HAS_NO_REVISION",
                "message": f"Quote '{quote.quote_number}' has no current revision to edit.",
            },
        )

    revision = db.scalar(
        select(QuoteRevision).where(
            QuoteRevision.id == quote.current_revision_id,
            QuoteRevision.organization_id == ctx.organization.id,
        )
    )
    if not revision:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Current revision not found."
        )

    if revision.is_committed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "REVISION_COMMITTED",
                "message": f"Revision {revision.revision_number} is committed and immutable.",
            },
        )

    # 2. Build map of existing lines to preserve historical unit_cost
    existing_lines = {existing_ln.id: existing_ln for existing_ln in revision.lines}

    # 3. Fetch Organization Policy Config
    org = db.scalar(select(Organization).where(Organization.id == ctx.organization.id))
    policy_config = QuotePolicyConfig.from_dict(org.settings_json if org else None)

    # 4. Prepare calculator inputs from payload lines
    calculator_inputs: List[QuoteLineInput] = []
    for l_in in sorted(payload.lines, key=lambda x: x.line_order):
        # Preserve unit cost from existing line or catalog
        unit_cost: Optional[Decimal] = None
        if l_in.id and l_in.id in existing_lines:
            unit_cost = existing_lines[l_in.id].unit_cost
        elif l_in.catalog_product_id:
            cat_p = db.scalar(
                select(CatalogProduct).where(
                    CatalogProduct.id == l_in.catalog_product_id,
                    CatalogProduct.organization_id == ctx.organization.id,
                )
            )
            if cat_p:
                unit_cost = cat_p.unit_cost

        calculator_inputs.append(
            QuoteLineInput(
                line_id=str(l_in.id) if l_in.id else str(uuid.uuid4()),
                line_order=l_in.line_order,
                sku=l_in.sku,
                name=l_in.product_name,
                description=l_in.description,
                unit=l_in.unit,
                quantity=l_in.quantity,
                unit_price=l_in.unit_price,
                discount_percent=l_in.discount_percent,
                tax_rate_percent=l_in.tax_rate_percent,
                unit_cost=unit_cost,
                rfq_line_id=str(l_in.rfq_line_id) if l_in.rfq_line_id else None,
                catalog_product_id=str(l_in.catalog_product_id)
                if l_in.catalog_product_id
                else None,
            )
        )

    # 5. Authoritative recalculation
    calc_result = calculate_quote(calculator_inputs, currency=revision.currency)

    # 6. Policy evaluation
    policy_result = evaluate_quote_policies(calc_result, policy_config)

    # 7. Update revision calculation snapshot
    calc_snapshot = calc_result.to_snapshot_json()
    calc_snapshot["policy_evaluation"] = policy_result.to_dict()

    now = datetime.now(timezone.utc)
    revision.calculation_snapshot_json = calc_snapshot
    revision.input_fingerprint = calc_result.input_fingerprint
    revision.version += 1
    revision.updated_at = now

    # 8. Replace line records atomically
    # Delete existing lines
    for old_l in revision.lines:
        db.delete(old_l)
    db.flush()

    # Re-insert lines with updated calculations
    for c_line in calc_result.lines:
        matching_input = next(ci for ci in calculator_inputs if ci.line_order == c_line.line_order)

        rev_line = QuoteRevisionLine(
            id=uuid.UUID(c_line.line_id),
            organization_id=ctx.organization.id,
            revision_id=revision.id,
            line_order=c_line.line_order,
            rfq_line_id=uuid.UUID(matching_input.rfq_line_id)
            if matching_input.rfq_line_id
            else None,
            catalog_product_id=uuid.UUID(matching_input.catalog_product_id)
            if matching_input.catalog_product_id
            else None,
            sku=c_line.sku,
            product_name=c_line.name,
            description=c_line.description,
            unit=c_line.unit,
            quantity=c_line.quantity,
            unit_price=c_line.unit_price,
            discount_percent=c_line.discount_percent,
            tax_rate_percent=c_line.tax_rate_percent,
            unit_cost=c_line.unit_cost,
            gross_amount=c_line.gross_amount,
            discount_amount=c_line.discount_amount,
            taxable_amount=c_line.taxable_amount,
            tax_amount=c_line.tax_amount,
            line_total=c_line.line_total,
            line_cost=c_line.line_cost,
            line_gross_profit=c_line.line_gross_profit,
            margin_percent=c_line.margin_percent,
            created_at=now,
            updated_at=now,
        )
        db.add(rev_line)

    # 9. Update Quote header
    quote.version += 1
    if payload.notes is not None:
        quote.notes = payload.notes
    if payload.payment_terms is not None:
        quote.payment_terms = payload.payment_terms
    if payload.delivery_terms is not None:
        quote.delivery_terms = payload.delivery_terms
    if payload.valid_until is not None:
        quote.valid_until = payload.valid_until
    quote.updated_at = now

    # 10. Record Activity Log
    record_activity(
        db=db,
        organization_id=ctx.organization.id,
        entity_type="quote",
        entity_id=quote.id,
        event_type="quote_updated",
        summary=f"Quotation '{quote.quote_number}' draft updated (Rev {revision.revision_number}, v{quote.version})",
        metadata_json={
            "grand_total": str(calc_result.totals.grand_total),
            "line_count": len(calc_result.lines),
            "requires_approval": policy_result.requires_manager_approval,
        },
        actor_user_id=ctx.user.id,
    )
    db.commit()

    return build_quote_detail_response(db, ctx, quote)


def get_calculation_trace(
    db: Session,
    ctx: AuthenticatedContext,
    quote_id: uuid.UUID,
    revision_id: Optional[uuid.UUID] = None,
) -> CalculationTraceResponse:
    quote = get_quote_or_404(db, ctx, quote_id)
    target_rev_id = revision_id or quote.current_revision_id

    if not target_rev_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quotation has no calculation trace available.",
        )

    revision = db.scalar(
        select(QuoteRevision).where(
            QuoteRevision.id == target_rev_id,
            QuoteRevision.quote_id == quote.id,
            QuoteRevision.organization_id == ctx.organization.id,
        )
    )
    if not revision:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Revision not found.")

    can_view_cost = is_cost_visible(ctx)
    calc_snap = revision.calculation_snapshot_json or {}
    raw_nodes = calc_snap.get("trace", [])

    # Filter out internal-only cost/margin trace nodes for unauthorized roles
    filtered_nodes = [node for node in raw_nodes if not node.get("is_internal") or can_view_cost]

    return CalculationTraceResponse(
        quote_id=quote.id,
        revision_id=revision.id,
        revision_number=revision.revision_number,
        calculator_version=revision.calculator_version,
        input_fingerprint=revision.input_fingerprint,
        nodes=filtered_nodes,
    )
