import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthenticatedContext, require_permission
from app.db.session import get_db
from app.schemas.crm import PaginatedResponse, TaskCreate, TaskResponse, TaskUpdate
from app.services import crm_service

router = APIRouter(prefix="/tasks", tags=["Tasks"])


class TaskActionRequest(BaseModel):
    expected_version: int = Field(..., ge=1)


@router.get("", response_model=PaginatedResponse[TaskResponse])
def get_tasks(
    assignee_id: Optional[uuid.UUID] = Query(None, description="Filter by assignee user ID"),
    status: Optional[str] = Query(None, description="Filter by status (open/completed/cancelled)"),
    priority: Optional[str] = Query(None, description="Filter by priority (low/normal/high)"),
    is_overdue: Optional[bool] = Query(None, description="Filter by overdue status"),
    account_id: Optional[uuid.UUID] = Query(None, description="Filter by related account ID"),
    opportunity_id: Optional[uuid.UUID] = Query(
        None, description="Filter by related opportunity ID"
    ),
    search: Optional[str] = Query(None, description="Search task title"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    ctx: AuthenticatedContext = Depends(require_permission("crm:read")),
    db: Session = Depends(get_db),
) -> PaginatedResponse[TaskResponse]:
    return crm_service.list_tasks(
        db=db,
        ctx=ctx,
        assignee_id=assignee_id,
        status_filter=status,
        priority=priority,
        is_overdue=is_overdue,
        account_id=account_id,
        opportunity_id=opportunity_id,
        search=search,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreate,
    ctx: AuthenticatedContext = Depends(require_permission("crm:write")),
    db: Session = Depends(get_db),
) -> TaskResponse:
    return crm_service.create_task(db=db, ctx=ctx, payload=payload)


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(
    task_id: uuid.UUID,
    ctx: AuthenticatedContext = Depends(require_permission("crm:read")),
    db: Session = Depends(get_db),
) -> TaskResponse:
    task = crm_service.get_task_or_404(db=db, ctx=ctx, task_id=task_id)
    return crm_service.format_task_response(task)


@router.patch("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: uuid.UUID,
    payload: TaskUpdate,
    ctx: AuthenticatedContext = Depends(require_permission("crm:write")),
    db: Session = Depends(get_db),
) -> TaskResponse:
    return crm_service.update_task(db=db, ctx=ctx, task_id=task_id, payload=payload)


@router.post("/{task_id}/complete", response_model=TaskResponse)
def complete_task(
    task_id: uuid.UUID,
    payload: TaskActionRequest,
    ctx: AuthenticatedContext = Depends(require_permission("crm:write")),
    db: Session = Depends(get_db),
) -> TaskResponse:
    return crm_service.complete_task(
        db=db, ctx=ctx, task_id=task_id, expected_version=payload.expected_version
    )


@router.post("/{task_id}/reopen", response_model=TaskResponse)
def reopen_task(
    task_id: uuid.UUID,
    payload: TaskActionRequest,
    ctx: AuthenticatedContext = Depends(require_permission("crm:write")),
    db: Session = Depends(get_db),
) -> TaskResponse:
    return crm_service.reopen_task(
        db=db, ctx=ctx, task_id=task_id, expected_version=payload.expected_version
    )
