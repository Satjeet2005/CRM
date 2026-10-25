import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthenticatedContext, require_permission
from app.db.session import get_db
from app.schemas.crm import ContactResponse, ContactUpdate, PaginatedResponse
from app.services import crm_service

router = APIRouter(prefix="/contacts", tags=["Contacts"])


class ArchiveRequest(BaseModel):
    expected_version: int = Field(..., ge=1)


@router.get("", response_model=PaginatedResponse[ContactResponse])
def get_contacts(
    search: Optional[str] = Query(
        None, description="Search first/last name, email, phone, job title"
    ),
    account_id: Optional[uuid.UUID] = Query(None, description="Filter by account ID"),
    status: Optional[str] = Query("active", description="Filter by status (active/archived)"),
    is_primary: Optional[bool] = Query(None, description="Filter by primary contact flag"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    ctx: AuthenticatedContext = Depends(require_permission("crm:read")),
    db: Session = Depends(get_db),
) -> PaginatedResponse[ContactResponse]:
    return crm_service.list_contacts(
        db=db,
        ctx=ctx,
        account_id=account_id,
        search=search,
        status_filter=status,
        is_primary=is_primary,
        page=page,
        page_size=page_size,
    )


@router.patch("/{contact_id}", response_model=ContactResponse)
def update_contact(
    contact_id: uuid.UUID,
    payload: ContactUpdate,
    ctx: AuthenticatedContext = Depends(require_permission("crm:write")),
    db: Session = Depends(get_db),
) -> ContactResponse:
    return crm_service.update_contact(db=db, ctx=ctx, contact_id=contact_id, payload=payload)


@router.post("/{contact_id}/archive", response_model=ContactResponse)
def archive_contact(
    contact_id: uuid.UUID,
    payload: ArchiveRequest,
    ctx: AuthenticatedContext = Depends(require_permission("crm:write")),
    db: Session = Depends(get_db),
) -> ContactResponse:
    return crm_service.archive_contact(
        db=db, ctx=ctx, contact_id=contact_id, expected_version=payload.expected_version
    )
