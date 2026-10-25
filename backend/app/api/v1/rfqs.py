import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Header, Query, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthenticatedContext, require_permission
from app.db.session import get_db
from app.schemas.crm import PaginatedResponse
from app.schemas.rfq import (
    RFQBulkDecisionRequest,
    RFQBulkDecisionResponse,
    RFQCreateQuoteRequest,
    RFQCreateQuoteResponse,
    RFQImportPreviewRequest,
    RFQImportPreviewResponse,
    RFQImportRequest,
    RFQLineDecisionRequest,
    RFQLineDetailResponse,
    RFQLineResponse,
    RFQRematchRequest,
    RFQResponse,
)
from app.services import rfq_ingest_service, rfq_service

router = APIRouter(prefix="/rfqs", tags=["RFQs"])


@router.get("", response_model=PaginatedResponse[RFQResponse])
def get_rfqs(
    status: Optional[str] = Query(
        None, description="Filter by status (needs_review, ready_to_quote, quoted, cancelled)"
    ),
    account_id: Optional[uuid.UUID] = Query(None, description="Filter by account ID"),
    opportunity_id: Optional[uuid.UUID] = Query(None, description="Filter by opportunity ID"),
    search: Optional[str] = Query(
        None, description="Search RFQ number, title, customer reference, or filename"
    ),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    ctx: AuthenticatedContext = Depends(require_permission("rfq:read")),
    db: Session = Depends(get_db),
) -> PaginatedResponse[RFQResponse]:
    return rfq_service.list_rfqs(
        db=db,
        ctx=ctx,
        status_filter=status,
        account_id=account_id,
        opportunity_id=opportunity_id,
        search=search,
        page=page,
        page_size=page_size,
    )


@router.post("/import/preview", response_model=RFQImportPreviewResponse)
def preview_rfq(
    payload: RFQImportPreviewRequest,
    ctx: AuthenticatedContext = Depends(require_permission("rfq:import")),
) -> RFQImportPreviewResponse:
    return rfq_ingest_service.preview_rfq_csv(
        filename=payload.filename,
        csv_content=payload.csv_content,
    )


@router.post("/import", response_model=RFQResponse, status_code=status.HTTP_201_CREATED)
def import_rfq(
    payload: RFQImportRequest,
    x_request_id: Optional[str] = Header(None),
    ctx: AuthenticatedContext = Depends(require_permission("rfq:import")),
    db: Session = Depends(get_db),
) -> RFQResponse:
    return rfq_ingest_service.import_rfq_csv(
        db=db,
        ctx=ctx,
        payload=payload,
        request_id=x_request_id,
    )


@router.get("/{rfq_id}", response_model=RFQResponse)
def get_rfq(
    rfq_id: uuid.UUID,
    ctx: AuthenticatedContext = Depends(require_permission("rfq:read")),
    db: Session = Depends(get_db),
) -> RFQResponse:
    return rfq_service.get_rfq_response(
        db=db,
        ctx=ctx,
        rfq_id=rfq_id,
    )


@router.get("/{rfq_id}/lines", response_model=PaginatedResponse[RFQLineResponse])
def get_rfq_lines(
    rfq_id: uuid.UUID,
    match_status: Optional[str] = Query(None, description="Filter by match status"),
    needs_review_only: bool = Query(False, description="Filter to lines requiring review"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    ctx: AuthenticatedContext = Depends(require_permission("rfq:read")),
    db: Session = Depends(get_db),
) -> PaginatedResponse[RFQLineResponse]:
    return rfq_service.list_rfq_lines(
        db=db,
        ctx=ctx,
        rfq_id=rfq_id,
        match_status=match_status,
        needs_review_only=needs_review_only,
        page=page,
        page_size=page_size,
    )


@router.get("/{rfq_id}/lines/{line_id}", response_model=RFQLineDetailResponse)
def get_rfq_line_detail(
    rfq_id: uuid.UUID,
    line_id: uuid.UUID,
    ctx: AuthenticatedContext = Depends(require_permission("rfq:read")),
    db: Session = Depends(get_db),
) -> RFQLineDetailResponse:
    return rfq_service.get_rfq_line_detail(
        db=db,
        ctx=ctx,
        rfq_id=rfq_id,
        line_id=line_id,
    )


@router.post("/{rfq_id}/lines/{line_id}/decision", response_model=RFQLineDetailResponse)
def record_decision(
    rfq_id: uuid.UUID,
    line_id: uuid.UUID,
    payload: RFQLineDecisionRequest,
    x_request_id: Optional[str] = Header(None),
    ctx: AuthenticatedContext = Depends(require_permission("rfq:resolve")),
    db: Session = Depends(get_db),
) -> RFQLineDetailResponse:
    return rfq_service.record_line_decision(
        db=db,
        ctx=ctx,
        rfq_id=rfq_id,
        line_id=line_id,
        payload=payload,
        request_id=x_request_id,
    )


@router.post("/{rfq_id}/lines/bulk-decision", response_model=RFQBulkDecisionResponse)
def bulk_decision(
    rfq_id: uuid.UUID,
    payload: RFQBulkDecisionRequest,
    x_request_id: Optional[str] = Header(None),
    ctx: AuthenticatedContext = Depends(require_permission("rfq:resolve")),
    db: Session = Depends(get_db),
) -> RFQBulkDecisionResponse:
    return rfq_service.bulk_accept_exact_matches(
        db=db,
        ctx=ctx,
        rfq_id=rfq_id,
        payload=payload,
        request_id=x_request_id,
    )


@router.post("/{rfq_id}/rematch", response_model=RFQResponse)
def rematch_rfq(
    rfq_id: uuid.UUID,
    payload: RFQRematchRequest,
    x_request_id: Optional[str] = Header(None),
    ctx: AuthenticatedContext = Depends(require_permission("catalog:manage")),
    db: Session = Depends(get_db),
) -> RFQResponse:
    return rfq_service.rematch_rfq(
        db=db,
        ctx=ctx,
        rfq_id=rfq_id,
        payload=payload,
        request_id=x_request_id,
    )


@router.get("/{rfq_id}/export.csv")
def export_rfq_csv(
    rfq_id: uuid.UUID,
    ctx: AuthenticatedContext = Depends(require_permission("rfq:read")),
    db: Session = Depends(get_db),
) -> Response:
    csv_str = rfq_service.export_rfq_csv(
        db=db,
        ctx=ctx,
        rfq_id=rfq_id,
    )
    return Response(
        content=csv_str,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="rfq-{rfq_id}.csv"'},
    )


@router.post(
    "/{rfq_id}/create-quote",
    response_model=RFQCreateQuoteResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_quote(
    rfq_id: uuid.UUID,
    payload: RFQCreateQuoteRequest,
    x_request_id: Optional[str] = Header(None),
    ctx: AuthenticatedContext = Depends(require_permission("quotes:draft")),
    db: Session = Depends(get_db),
) -> RFQCreateQuoteResponse:
    return rfq_service.create_quote_from_rfq(
        db=db,
        ctx=ctx,
        rfq_id=rfq_id,
        payload=payload,
        request_id=x_request_id,
    )
