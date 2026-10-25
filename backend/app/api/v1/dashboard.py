from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthenticatedContext, get_current_user
from app.db.session import get_db
from app.schemas.dashboard import AttentionItemResponse, DashboardSummaryResponse
from app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(
    from_date: Optional[date] = Query(None, description="Start date for opportunity filtering"),
    to_date: Optional[date] = Query(None, description="End date for opportunity filtering"),
    ctx: AuthenticatedContext = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DashboardSummaryResponse:
    return dashboard_service.get_dashboard_summary(
        db=db, ctx=ctx, from_date=from_date, to_date=to_date
    )


@router.get("/attention", response_model=list[AttentionItemResponse])
def get_dashboard_attention(
    ctx: AuthenticatedContext = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AttentionItemResponse]:
    return dashboard_service.get_dashboard_attention(db=db, ctx=ctx)
