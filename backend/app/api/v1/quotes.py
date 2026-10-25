import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, Query, Request, Response
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthenticatedContext, require_permission
from app.db.session import get_db
from app.schemas.export import QuoteCustomerDeliveryResponse
from app.schemas.proposals import (
    ApprovalDecisionResponse,
    CreateProposalRequest,
    InitialQuoteDecisionRequest,
    InitialQuoteSubmitRequest,
    PaginatedProposalsResponse,
    ProposalDetailResponse,
)
from app.schemas.quote import (
    CalculationTraceResponse,
    PaginatedQuotesResponse,
    QuoteDetailResponse,
    QuoteDraftUpdateRequest,
    QuoteRevisionResponse,
)
from app.services import approval_service, export_service, proposal_service, quote_service

router = APIRouter(prefix="/quotes", tags=["Quotes"])


@router.get("", response_model=PaginatedQuotesResponse)
def get_quotes(
    status: Optional[str] = Query(
        None, description="Filter by status (draft, in_review, approved, rejected, converted)"
    ),
    account_id: Optional[uuid.UUID] = Query(None, description="Filter by account ID"),
    opportunity_id: Optional[uuid.UUID] = Query(None, description="Filter by opportunity ID"),
    search: Optional[str] = Query(None, description="Search quote number or account name"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    ctx: AuthenticatedContext = Depends(require_permission("quotes:read")),
    db: Session = Depends(get_db),
) -> PaginatedQuotesResponse:
    return quote_service.list_quotes(
        db=db,
        ctx=ctx,
        status_filter=status,
        account_id=account_id,
        opportunity_id=opportunity_id,
        search=search,
        page=page,
        page_size=page_size,
    )


@router.get("/{quote_id}", response_model=QuoteDetailResponse)
def get_quote(
    quote_id: uuid.UUID,
    ctx: AuthenticatedContext = Depends(require_permission("quotes:read")),
    db: Session = Depends(get_db),
) -> QuoteDetailResponse:
    return quote_service.get_quote_detail(db=db, ctx=ctx, quote_id=quote_id)


@router.get("/{quote_id}/revisions", response_model=List[QuoteRevisionResponse])
def get_quote_revisions(
    quote_id: uuid.UUID,
    ctx: AuthenticatedContext = Depends(require_permission("quotes:read")),
    db: Session = Depends(get_db),
) -> List[QuoteRevisionResponse]:
    return quote_service.list_quote_revisions(db=db, ctx=ctx, quote_id=quote_id)


@router.get("/{quote_id}/revisions/{revision_id}", response_model=QuoteRevisionResponse)
def get_quote_revision(
    quote_id: uuid.UUID,
    revision_id: uuid.UUID,
    ctx: AuthenticatedContext = Depends(require_permission("quotes:read")),
    db: Session = Depends(get_db),
) -> QuoteRevisionResponse:
    return quote_service.get_quote_revision_detail(
        db=db, ctx=ctx, quote_id=quote_id, revision_id=revision_id
    )


@router.patch("/{quote_id}/draft", response_model=QuoteDetailResponse)
def update_quote_draft(
    quote_id: uuid.UUID,
    payload: QuoteDraftUpdateRequest,
    x_request_id: Optional[str] = Header(None, alias="X-Request-ID"),
    ctx: AuthenticatedContext = Depends(require_permission("quotes:draft")),
    db: Session = Depends(get_db),
) -> QuoteDetailResponse:
    return quote_service.update_quote_draft(
        db=db,
        ctx=ctx,
        quote_id=quote_id,
        payload=payload,
        request_id=x_request_id,
    )


@router.get("/{quote_id}/calculation-trace", response_model=CalculationTraceResponse)
def get_calculation_trace(
    quote_id: uuid.UUID,
    revision_id: Optional[uuid.UUID] = Query(
        None, description="Optional revision ID (defaults to current revision)"
    ),
    ctx: AuthenticatedContext = Depends(require_permission("quotes:read")),
    db: Session = Depends(get_db),
) -> CalculationTraceResponse:
    return quote_service.get_calculation_trace(
        db=db,
        ctx=ctx,
        quote_id=quote_id,
        revision_id=revision_id,
    )


@router.post("/{quote_id}/proposals", response_model=ProposalDetailResponse)
def create_quote_proposal(
    quote_id: uuid.UUID,
    payload: CreateProposalRequest,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    ctx: AuthenticatedContext = Depends(require_permission("proposals:create")),
    db: Session = Depends(get_db),
) -> ProposalDetailResponse:
    if idempotency_key and not payload.idempotency_key:
        payload.idempotency_key = idempotency_key
    prop = proposal_service.create_proposal(db=db, ctx=ctx, quote_id=quote_id, payload=payload)
    return proposal_service.get_proposal_detail(db=db, ctx=ctx, proposal_id=prop.id)


@router.get("/{quote_id}/proposals", response_model=PaginatedProposalsResponse)
def list_quote_proposals(
    quote_id: uuid.UUID,
    status: Optional[str] = Query(None, description="Filter proposals by status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    ctx: AuthenticatedContext = Depends(require_permission("quotes:read")),
    db: Session = Depends(get_db),
) -> PaginatedProposalsResponse:
    return proposal_service.list_proposals(
        db=db,
        ctx=ctx,
        quote_id=quote_id,
        page=page,
        page_size=page_size,
        status_filter=status,
    )


@router.post("/{quote_id}/submit-for-approval", response_model=QuoteDetailResponse)
def submit_quote_for_approval(
    quote_id: uuid.UUID,
    payload: Optional[InitialQuoteSubmitRequest] = None,
    ctx: AuthenticatedContext = Depends(require_permission("quotes:draft")),
    db: Session = Depends(get_db),
) -> QuoteDetailResponse:
    req = (
        payload
        if payload is not None
        else InitialQuoteSubmitRequest(notes=None, idempotency_key=None)
    )
    approval_service.submit_initial_quote_for_approval(
        db=db, ctx=ctx, quote_id=quote_id, request=req
    )
    return quote_service.get_quote_detail(db=db, ctx=ctx, quote_id=quote_id)


@router.post("/{quote_id}/approve-initial", response_model=ApprovalDecisionResponse)
def approve_initial_quote(
    quote_id: uuid.UUID,
    payload: InitialQuoteDecisionRequest,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    ctx: AuthenticatedContext = Depends(require_permission("proposals:approve")),
    db: Session = Depends(get_db),
) -> ApprovalDecisionResponse:
    if idempotency_key and not payload.idempotency_key:
        payload.idempotency_key = idempotency_key
    return approval_service.approve_initial_quote(
        db=db, ctx=ctx, quote_id=quote_id, request=payload
    )


@router.get("/{quote_id}/export/pdf")
def export_quote_pdf(
    quote_id: uuid.UUID,
    request: Request,
    revision_id: Optional[uuid.UUID] = Query(None, description="Optional revision ID"),
    recipient_email: Optional[str] = Query(None, description="Optional intended recipient"),
    ctx: AuthenticatedContext = Depends(require_permission("quotes:export")),
    db: Session = Depends(get_db),
) -> Response:
    """Generate final unwatermarked quotation PDF.

    Preconditions: Quote must be in 'approved' or 'sent' status.
    """
    request_id = getattr(request.state, "request_id", None)
    pdf_bytes, filename, sha256, content_type = export_service.export_quote_pdf(
        db=db,
        ctx=ctx,
        quote_id=quote_id,
        revision_id=revision_id,
        recipient_email=recipient_email,
        request_id=request_id,
    )
    return Response(
        content=pdf_bytes,
        media_type=content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Content-SHA256": sha256,
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/{quote_id}/export/preview-pdf")
def export_quote_preview_pdf(
    quote_id: uuid.UUID,
    request: Request,
    revision_id: Optional[uuid.UUID] = Query(None, description="Optional revision ID"),
    ctx: AuthenticatedContext = Depends(require_permission("quotes:export")),
    db: Session = Depends(get_db),
) -> Response:
    """Generate internal preview PDF with conspicuous 'DRAFT — NOT APPROVED' watermark."""
    request_id = getattr(request.state, "request_id", None)
    pdf_bytes, filename, sha256, content_type = export_service.export_quote_preview_pdf(
        db=db,
        ctx=ctx,
        quote_id=quote_id,
        revision_id=revision_id,
        request_id=request_id,
    )
    return Response(
        content=pdf_bytes,
        media_type=content_type,
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "X-Content-SHA256": sha256,
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/{quote_id}/export/csv")
def export_quote_csv(
    quote_id: uuid.UUID,
    request: Request,
    revision_id: Optional[uuid.UUID] = Query(None, description="Optional revision ID"),
    recipient_email: Optional[str] = Query(None, description="Optional intended recipient"),
    ctx: AuthenticatedContext = Depends(require_permission("quotes:export")),
    db: Session = Depends(get_db),
) -> Response:
    """Generate customer-safe CSV export with formula injection protection.

    Preconditions: Quote must be in 'approved' or 'sent' status.
    """
    request_id = getattr(request.state, "request_id", None)
    csv_bytes, filename, sha256, content_type = export_service.export_quote_csv(
        db=db,
        ctx=ctx,
        quote_id=quote_id,
        revision_id=revision_id,
        recipient_email=recipient_email,
        request_id=request_id,
    )
    return Response(
        content=csv_bytes,
        media_type=content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Content-SHA256": sha256,
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/{quote_id}/deliveries", response_model=List[QuoteCustomerDeliveryResponse])
def list_quote_deliveries(
    quote_id: uuid.UUID,
    ctx: AuthenticatedContext = Depends(require_permission("quotes:read")),
    db: Session = Depends(get_db),
) -> List[QuoteCustomerDeliveryResponse]:
    """Retrieve customer export and delivery history for a quotation."""
    return export_service.list_quote_deliveries(db=db, ctx=ctx, quote_id=quote_id)
