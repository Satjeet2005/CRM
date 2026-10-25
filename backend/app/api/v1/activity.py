import math
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.auth.dependencies import AuthenticatedContext, require_permission
from app.db.session import get_db
from app.models.crm import Activity
from app.schemas.crm import ActivityResponse, PaginatedResponse

router = APIRouter(prefix="/activity", tags=["Activity"])


@router.get("", response_model=PaginatedResponse[ActivityResponse])
def get_activity_feed(
    entity_type: Optional[str] = Query(
        None, description="Filter by entity type (account, opportunity, task, etc.)"
    ),
    entity_id: Optional[uuid.UUID] = Query(None, description="Filter by entity UUID"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    actor_id: Optional[uuid.UUID] = Query(None, description="Filter by actor user ID"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    ctx: AuthenticatedContext = Depends(require_permission("crm:read")),
    db: Session = Depends(get_db),
) -> PaginatedResponse[ActivityResponse]:
    page = max(1, page)
    page_size = min(max(1, page_size), 100)

    query = select(Activity).where(Activity.organization_id == ctx.organization.id)
    if entity_type:
        query = query.where(Activity.entity_type == entity_type)
    if entity_id:
        query = query.where(Activity.entity_id == entity_id)
    if event_type:
        query = query.where(Activity.event_type == event_type)
    if actor_id:
        query = query.where(Activity.actor_user_id == actor_id)

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    pages = math.ceil(total / page_size) if total > 0 else 1

    query = (
        query.options(selectinload(Activity.actor))
        .order_by(Activity.occurred_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    activities = db.execute(query).scalars().all()

    items = []
    for a in activities:
        resp = ActivityResponse.model_validate(a)
        resp.actor_name = a.actor.display_name if a.actor else "System"
        items.append(resp)

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )
