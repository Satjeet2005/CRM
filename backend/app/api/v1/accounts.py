import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthenticatedContext, require_permission
from app.db.session import get_db
from app.models.crm import Activity
from app.schemas.crm import (
    AccountCreate,
    AccountResponse,
    AccountUpdate,
    ActivityResponse,
    ContactCreate,
    ContactResponse,
    PaginatedResponse,
)
from app.services import crm_service

router = APIRouter(prefix="/accounts", tags=["Accounts"])


class ArchiveRequest(BaseModel):
    expected_version: int = Field(..., ge=1)


@router.get("", response_model=PaginatedResponse[AccountResponse])
def get_accounts(
    search: Optional[str] = Query(None, description="Search name, legal name, email, phone"),
    account_type: Optional[str] = Query(None, description="Filter by account type"),
    status: Optional[str] = Query("active", description="Filter by status (active/archived)"),
    owner_id: Optional[uuid.UUID] = Query(None, description="Filter by owner user ID"),
    industry: Optional[str] = Query(None, description="Filter by industry"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    ctx: AuthenticatedContext = Depends(require_permission("crm:read")),
    db: Session = Depends(get_db),
) -> PaginatedResponse[AccountResponse]:
    return crm_service.list_accounts(
        db=db,
        ctx=ctx,
        search=search,
        account_type=account_type,
        status_filter=status,
        owner_id=owner_id,
        industry=industry,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
def create_account(
    payload: AccountCreate,
    ctx: AuthenticatedContext = Depends(require_permission("crm:write")),
    db: Session = Depends(get_db),
) -> AccountResponse:
    return crm_service.create_account(db=db, ctx=ctx, payload=payload)


@router.get("/{account_id}", response_model=AccountResponse)
def get_account(
    account_id: uuid.UUID,
    ctx: AuthenticatedContext = Depends(require_permission("crm:read")),
    db: Session = Depends(get_db),
) -> AccountResponse:
    account = crm_service.get_account_or_404(db=db, ctx=ctx, account_id=account_id)
    resp = AccountResponse.model_validate(account)
    if account.owner:
        resp.owner_name = account.owner.display_name
    return resp


@router.patch("/{account_id}", response_model=AccountResponse)
def update_account(
    account_id: uuid.UUID,
    payload: AccountUpdate,
    ctx: AuthenticatedContext = Depends(require_permission("crm:write")),
    db: Session = Depends(get_db),
) -> AccountResponse:
    return crm_service.update_account(db=db, ctx=ctx, account_id=account_id, payload=payload)


@router.post("/{account_id}/archive", response_model=AccountResponse)
def archive_account(
    account_id: uuid.UUID,
    payload: ArchiveRequest,
    ctx: AuthenticatedContext = Depends(require_permission("crm:write")),
    db: Session = Depends(get_db),
) -> AccountResponse:
    return crm_service.archive_account(
        db=db, ctx=ctx, account_id=account_id, expected_version=payload.expected_version
    )


@router.get("/{account_id}/contacts", response_model=PaginatedResponse[ContactResponse])
def get_account_contacts(
    account_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    ctx: AuthenticatedContext = Depends(require_permission("crm:read")),
    db: Session = Depends(get_db),
) -> PaginatedResponse[ContactResponse]:
    crm_service.get_account_or_404(db=db, ctx=ctx, account_id=account_id)
    return crm_service.list_contacts(
        db=db, ctx=ctx, account_id=account_id, page=page, page_size=page_size
    )


@router.post(
    "/{account_id}/contacts", response_model=ContactResponse, status_code=status.HTTP_201_CREATED
)
def create_account_contact(
    account_id: uuid.UUID,
    payload: ContactCreate,
    ctx: AuthenticatedContext = Depends(require_permission("crm:write")),
    db: Session = Depends(get_db),
) -> ContactResponse:
    return crm_service.create_contact(db=db, ctx=ctx, account_id=account_id, payload=payload)


@router.get("/{account_id}/timeline", response_model=list[ActivityResponse])
def get_account_timeline(
    account_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=100),
    ctx: AuthenticatedContext = Depends(require_permission("crm:read")),
    db: Session = Depends(get_db),
) -> list[ActivityResponse]:
    crm_service.get_account_or_404(db=db, ctx=ctx, account_id=account_id)
    stmt = (
        select(Activity)
        .where(
            Activity.organization_id == ctx.organization.id,
            Activity.entity_type == "account",
            Activity.entity_id == account_id,
        )
        .order_by(Activity.occurred_at.desc())
        .limit(limit)
    )
    activities = db.execute(stmt).scalars().all()
    return [ActivityResponse.model_validate(act) for act in activities]
