import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthenticatedContext, require_permission
from app.db.session import get_db
from app.models.crm import Activity
from app.schemas.crm import (
    ActivityResponse,
    OpportunityCreate,
    OpportunityReopenRequest,
    OpportunityResponse,
    OpportunityStageUpdate,
    OpportunityUpdate,
    PaginatedResponse,
)
from app.services import crm_service

router = APIRouter(prefix="/opportunities", tags=["Opportunities"])


@router.get("", response_model=PaginatedResponse[OpportunityResponse])
def get_opportunities(
    account_id: Optional[uuid.UUID] = Query(None, description="Filter by account ID"),
    stage: Optional[str] = Query(None, description="Filter by stage"),
    owner_id: Optional[uuid.UUID] = Query(None, description="Filter by owner user ID"),
    search: Optional[str] = Query(None, description="Search opportunity name"),
    from_date: Optional[date] = Query(None, description="Filter close date >= from_date"),
    to_date: Optional[date] = Query(None, description="Filter close date <= to_date"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    ctx: AuthenticatedContext = Depends(require_permission("crm:read")),
    db: Session = Depends(get_db),
) -> PaginatedResponse[OpportunityResponse]:
    return crm_service.list_opportunities(
        db=db,
        ctx=ctx,
        account_id=account_id,
        stage=stage,
        owner_id=owner_id,
        search=search,
        from_date=from_date,
        to_date=to_date,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=OpportunityResponse, status_code=status.HTTP_201_CREATED)
def create_opportunity(
    payload: OpportunityCreate,
    ctx: AuthenticatedContext = Depends(require_permission("crm:write")),
    db: Session = Depends(get_db),
) -> OpportunityResponse:
    return crm_service.create_opportunity(db=db, ctx=ctx, payload=payload)


@router.get("/{opportunity_id}", response_model=OpportunityResponse)
def get_opportunity(
    opportunity_id: uuid.UUID,
    ctx: AuthenticatedContext = Depends(require_permission("crm:read")),
    db: Session = Depends(get_db),
) -> OpportunityResponse:
    opp = crm_service.get_opportunity_or_404(db=db, ctx=ctx, opp_id=opportunity_id)
    resp = OpportunityResponse.model_validate(opp)
    resp.account_name = opp.account.name if opp.account else None
    if opp.primary_contact:
        resp.primary_contact_name = (
            f"{opp.primary_contact.first_name} {opp.primary_contact.last_name}"
        )
    resp.owner_name = opp.owner.display_name if opp.owner else None
    return resp


@router.patch("/{opportunity_id}", response_model=OpportunityResponse)
def update_opportunity(
    opportunity_id: uuid.UUID,
    payload: OpportunityUpdate,
    ctx: AuthenticatedContext = Depends(require_permission("crm:write")),
    db: Session = Depends(get_db),
) -> OpportunityResponse:
    return crm_service.update_opportunity(db=db, ctx=ctx, opp_id=opportunity_id, payload=payload)


@router.post("/{opportunity_id}/stage", response_model=OpportunityResponse)
def update_opportunity_stage(
    opportunity_id: uuid.UUID,
    payload: OpportunityStageUpdate,
    ctx: AuthenticatedContext = Depends(require_permission("crm:write")),
    db: Session = Depends(get_db),
) -> OpportunityResponse:
    return crm_service.update_opportunity_stage(
        db=db, ctx=ctx, opp_id=opportunity_id, payload=payload
    )


@router.post("/{opportunity_id}/reopen", response_model=OpportunityResponse)
def reopen_opportunity(
    opportunity_id: uuid.UUID,
    payload: OpportunityReopenRequest,
    ctx: AuthenticatedContext = Depends(require_permission("crm:write")),
    db: Session = Depends(get_db),
) -> OpportunityResponse:
    return crm_service.reopen_opportunity(db=db, ctx=ctx, opp_id=opportunity_id, payload=payload)


@router.get("/{opportunity_id}/timeline", response_model=list[ActivityResponse])
def get_opportunity_timeline(
    opportunity_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=100),
    ctx: AuthenticatedContext = Depends(require_permission("crm:read")),
    db: Session = Depends(get_db),
) -> list[ActivityResponse]:
    crm_service.get_opportunity_or_404(db=db, ctx=ctx, opp_id=opportunity_id)
    stmt = (
        select(Activity)
        .where(
            Activity.organization_id == ctx.organization.id,
            Activity.entity_type == "opportunity",
            Activity.entity_id == opportunity_id,
        )
        .order_by(Activity.occurred_at.desc())
        .limit(limit)
    )
    activities = db.execute(stmt).scalars().all()
    return [ActivityResponse.model_validate(act) for act in activities]
