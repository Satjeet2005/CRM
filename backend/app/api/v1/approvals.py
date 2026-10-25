from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthenticatedContext, require_permission
from app.db.session import get_db
from app.schemas.proposals import PaginatedApprovalsResponse
from app.services import approval_service

router = APIRouter(prefix="/approvals", tags=["Approvals"])


@router.get("", response_model=PaginatedApprovalsResponse)
def get_approval_queue(
    status: Optional[str] = Query(
        "pending", description="Filter by status (pending, approved, rejected, all)"
    ),
    search: Optional[str] = Query(
        None, description="Search quote number, proposal number, or proposer"
    ),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    ctx: AuthenticatedContext = Depends(require_permission("proposals:approve")),
    db: Session = Depends(get_db),
) -> PaginatedApprovalsResponse:
    return approval_service.list_approval_queue(
        db=db,
        ctx=ctx,
        status_filter=status,
        page=page,
        page_size=page_size,
        search=search,
    )
