from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional
from zoneinfo import ZoneInfo

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthenticatedContext
from app.auth.rbac import Role
from app.models.catalog import CatalogProduct
from app.models.crm import Account, Opportunity, Task
from app.models.proposal import QuoteChangeProposal
from app.models.quote import Quote
from app.models.rfq import RFQ, RFQLine
from app.schemas.dashboard import (
    AttentionItemResponse,
    DashboardSummaryResponse,
    QuoteLifecycleItem,
    QuoteLifecycleSummary,
    RFQMatchHealthItem,
    RFQMatchHealthSummary,
    StageDistributionItem,
    TaskDueLoadItem,
    TaskDueLoadSummary,
)


def get_dashboard_summary(
    db: Session,
    ctx: AuthenticatedContext,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
) -> DashboardSummaryResponse:
    org_id = ctx.organization.id
    today_kolkata = datetime.now(timezone.utc).astimezone().date()

    # Base opportunity query
    opp_query = select(Opportunity).where(Opportunity.organization_id == org_id)
    if from_date:
        opp_query = opp_query.where(Opportunity.created_at >= from_date)
    if to_date:
        opp_query = opp_query.where(Opportunity.created_at <= to_date)

    # If role is sales_rep, limit to own opportunities or team if manager
    if ctx.membership.role == Role.SALES_REP:
        opp_query = opp_query.where(Opportunity.owner_user_id == ctx.user.id)

    # 1. Open opportunities count & pipeline value
    open_opps_stmt = select(
        func.count(Opportunity.id),
        func.coalesce(func.sum(Opportunity.estimated_value), Decimal("0.00")),
    ).where(
        Opportunity.organization_id == org_id,
        Opportunity.stage.notin_(["won", "lost"]),
    )
    if ctx.membership.role == Role.SALES_REP:
        open_opps_stmt = open_opps_stmt.where(Opportunity.owner_user_id == ctx.user.id)

    open_count, open_value = db.execute(open_opps_stmt).one()

    # 2. Overdue tasks count
    task_stmt = select(func.count(Task.id)).where(
        Task.organization_id == org_id,
        Task.status == "open",
        Task.due_date < today_kolkata,
    )
    if ctx.membership.role == Role.SALES_REP:
        task_stmt = task_stmt.where(Task.assignee_user_id == ctx.user.id)

    overdue_count = db.scalar(task_stmt) or 0

    # 3. Stage distribution
    all_stages = ["lead", "qualified", "solutioning", "proposal", "negotiation", "won", "lost"]
    stage_stmt = (
        select(
            Opportunity.stage,
            func.count(Opportunity.id),
            func.coalesce(func.sum(Opportunity.estimated_value), Decimal("0.00")),
        )
        .where(Opportunity.organization_id == org_id)
        .group_by(Opportunity.stage)
    )
    if ctx.membership.role == Role.SALES_REP:
        stage_stmt = stage_stmt.where(Opportunity.owner_user_id == ctx.user.id)

    stage_rows = {row[0]: (row[1], row[2]) for row in db.execute(stage_stmt).all()}

    distribution = [
        StageDistributionItem(
            stage=stg,
            count=stage_rows.get(stg, (0, Decimal("0.00")))[0],
            total_value=stage_rows.get(stg, (0, Decimal("0.00")))[1],
        )
        for stg in all_stages
    ]

    # 4. Active accounts count
    acc_count = (
        db.scalar(
            select(func.count(Account.id)).where(
                Account.organization_id == org_id,
                Account.status == "active",
            )
        )
        or 0
    )

    # 5. Active catalog products count
    cat_count = (
        db.scalar(
            select(func.count(CatalogProduct.id)).where(
                CatalogProduct.organization_id == org_id,
                CatalogProduct.is_active.is_(True),
            )
        )
        or 0
    )

    # 6. Real RFQ review lines count
    rfq_lines_count = (
        db.scalar(
            select(func.count(RFQLine.id)).where(
                RFQLine.organization_id == org_id,
                RFQLine.match_status.in_(["needs_review", "exact_match", "suggested", "unmatched"]),
            )
        )
        or 0
    )

    # 7. Real Draft quotes count
    quotes_count = (
        db.scalar(
            select(func.count(Quote.id)).where(
                Quote.organization_id == org_id,
                Quote.status == "draft",
            )
        )
        or 0
    )

    # Pending approvals count (Phase 5 proposals pending review + quotes pending approval)
    pending_props = (
        db.scalar(
            select(func.count(QuoteChangeProposal.id)).where(
                QuoteChangeProposal.organization_id == org_id,
                QuoteChangeProposal.status == "pending_review",
            )
        )
        or 0
    )
    pending_quotes = (
        db.scalar(
            select(func.count(Quote.id)).where(
                Quote.organization_id == org_id,
                Quote.status == "pending_approval",
            )
        )
        or 0
    )
    total_awaiting_approval = pending_props + pending_quotes

    # 8. Operational Analytics: RFQ Match Health
    rfq_match_stmt = (
        select(RFQLine.match_status, func.count(RFQLine.id))
        .where(RFQLine.organization_id == org_id)
        .group_by(RFQLine.match_status)
    )
    rfq_match_map = dict(db.execute(rfq_match_stmt).all())
    exact_count = rfq_match_map.get("exact_match", 0)
    matched_count = rfq_match_map.get("matched", 0)
    needs_review_count = rfq_match_map.get("needs_review", 0) + rfq_match_map.get("suggested", 0)
    unmatched_count = rfq_match_map.get("unmatched", 0)
    total_rfq_lines = exact_count + matched_count + needs_review_count + unmatched_count
    reviewed_rfq_lines = matched_count

    def _pct(c: int) -> float:
        return round((c / total_rfq_lines) * 100, 1) if total_rfq_lines > 0 else 0.0

    rfq_match_health = RFQMatchHealthSummary(
        total_lines=total_rfq_lines,
        reviewed_lines=reviewed_rfq_lines,
        categories=[
            RFQMatchHealthItem(
                status="exact_match",
                label="Exact Match",
                count=exact_count,
                percentage=_pct(exact_count),
            ),
            RFQMatchHealthItem(
                status="matched",
                label="Accepted Match",
                count=matched_count,
                percentage=_pct(matched_count),
            ),
            RFQMatchHealthItem(
                status="needs_review",
                label="Needs Review",
                count=needs_review_count,
                percentage=_pct(needs_review_count),
            ),
            RFQMatchHealthItem(
                status="unmatched",
                label="Unmatched",
                count=unmatched_count,
                percentage=_pct(unmatched_count),
            ),
        ],
    )

    # 9. Operational Analytics: Quotation Lifecycle
    quote_status_stmt = (
        select(Quote.status, func.count(Quote.id))
        .where(Quote.organization_id == org_id)
        .group_by(Quote.status)
    )
    quote_status_map = dict(db.execute(quote_status_stmt).all())
    canonical_quote_statuses = [
        ("draft", "Draft"),
        ("pending_approval", "In Review / Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
        ("expired", "Expired"),
    ]
    quote_categories = [
        QuoteLifecycleItem(
            status=st,
            label=lbl,
            count=quote_status_map.get(st, 0),
        )
        for st, lbl in canonical_quote_statuses
    ]
    quote_lifecycle = QuoteLifecycleSummary(
        total_quotes=sum(c.count for c in quote_categories),
        categories=quote_categories,
    )

    # 10. Operational Analytics: Task Due-Date Load
    try:
        tz = ZoneInfo(ctx.organization.timezone or "Asia/Kolkata")
    except Exception:
        tz = ZoneInfo("Asia/Kolkata")
    today_org = datetime.now(tz).date()
    seven_days_later = today_org + timedelta(days=7)

    task_due_stmt = select(
        func.count().filter(Task.due_date < today_org).label("overdue"),
        func.count().filter(Task.due_date == today_org).label("due_today"),
        func.count()
        .filter((Task.due_date > today_org) & (Task.due_date <= seven_days_later))
        .label("due_this_week"),
        func.count()
        .filter((Task.due_date > seven_days_later) | Task.due_date.is_(None))
        .label("due_later"),
    ).where(
        Task.organization_id == org_id,
        Task.status == "open",
    )
    if ctx.membership.role == Role.SALES_REP:
        task_due_stmt = task_due_stmt.where(Task.assignee_user_id == ctx.user.id)

    overdue_t, today_t, week_t, later_t = db.execute(task_due_stmt).one()
    overdue_t = overdue_t or 0
    today_t = today_t or 0
    week_t = week_t or 0
    later_t = later_t or 0
    total_open_tasks = overdue_t + today_t + week_t + later_t

    task_due_load = TaskDueLoadSummary(
        total_open_tasks=total_open_tasks,
        categories=[
            TaskDueLoadItem(bucket="overdue", label="Overdue", count=overdue_t, is_urgent=True),
            TaskDueLoadItem(bucket="due_today", label="Due Today", count=today_t, is_urgent=True),
            TaskDueLoadItem(
                bucket="due_this_week", label="Next 7 Days", count=week_t, is_urgent=False
            ),
            TaskDueLoadItem(bucket="due_later", label="Later", count=later_t, is_urgent=False),
        ],
    )

    return DashboardSummaryResponse(
        open_opportunities_count=open_count,
        open_pipeline_value=open_value,
        overdue_tasks_count=overdue_count,
        stage_distribution=distribution,
        active_accounts_count=acc_count,
        active_catalog_products_count=cat_count,
        quotes_awaiting_approval=total_awaiting_approval,
        open_rfq_review_lines=rfq_lines_count,
        quotes_availability="available",
        rfq_availability="available",
        draft_quotes_count=quotes_count,
        total_quote_value=None,
        date_from=from_date,
        date_to=to_date,
        rfq_match_health=rfq_match_health,
        quote_lifecycle=quote_lifecycle,
        task_due_load=task_due_load,
    )


def get_dashboard_attention(
    db: Session,
    ctx: AuthenticatedContext,
) -> list[AttentionItemResponse]:
    org_id = ctx.organization.id
    today_kolkata = datetime.now(timezone.utc).astimezone().date()
    soon_boundary = today_kolkata + timedelta(days=7)

    items: list[AttentionItemResponse] = []

    # 1. Overdue open tasks (Critical)
    overdue_query = select(Task).where(
        Task.organization_id == org_id,
        Task.status == "open",
        Task.due_date < today_kolkata,
    )
    if ctx.membership.role == Role.SALES_REP:
        overdue_query = overdue_query.where(Task.assignee_user_id == ctx.user.id)
    overdue_query = overdue_query.order_by(Task.due_date.asc()).limit(10)
    for t in db.execute(overdue_query).scalars().all():
        days_past = (today_kolkata - t.due_date).days if t.due_date else 1
        items.append(
            AttentionItemResponse(
                id=f"overdue-task-{t.id}",
                item_type="overdue_task",
                severity="critical",
                title=f"Overdue Task: {t.title}",
                description=f"Task was due {days_past} day(s) ago ({t.due_date}).",
                entity_type="task",
                entity_id=t.id,
                due_date=t.due_date,
            )
        )

    # 2. High priority open tasks due soon or today (Warning)
    urgent_query = select(Task).where(
        Task.organization_id == org_id,
        Task.status == "open",
        Task.priority == "high",
        Task.due_date >= today_kolkata,
        Task.due_date <= soon_boundary,
    )
    if ctx.membership.role == Role.SALES_REP:
        urgent_query = urgent_query.where(Task.assignee_user_id == ctx.user.id)
    urgent_query = urgent_query.order_by(Task.due_date.asc()).limit(10)
    for t in db.execute(urgent_query).scalars().all():
        items.append(
            AttentionItemResponse(
                id=f"urgent-task-{t.id}",
                item_type="urgent_task",
                severity="warning",
                title=f"High Priority Task: {t.title}",
                description=f"Due on {t.due_date}.",
                entity_type="task",
                entity_id=t.id,
                due_date=t.due_date,
            )
        )

    # 3. Open high-value opportunities closing within 7 days (Info)
    closing_query = select(Opportunity).where(
        Opportunity.organization_id == org_id,
        Opportunity.stage.notin_(["won", "lost"]),
        Opportunity.expected_close_date >= today_kolkata,
        Opportunity.expected_close_date <= soon_boundary,
    )
    if ctx.membership.role == Role.SALES_REP:
        closing_query = closing_query.where(Opportunity.owner_user_id == ctx.user.id)
    closing_query = closing_query.order_by(Opportunity.expected_close_date.asc()).limit(10)
    for opp in db.execute(closing_query).scalars().all():
        items.append(
            AttentionItemResponse(
                id=f"closing-opp-{opp.id}",
                item_type="closing_soon_opportunity",
                severity="info",
                title=f"Opportunity Target: {opp.name}",
                description=f"Target close date {opp.expected_close_date} (Value: ₹{opp.estimated_value:,.2f}).",
                entity_type="opportunity",
                entity_id=opp.id,
                due_date=opp.expected_close_date,
            )
        )

    # 4. RFQs with unresolved or invalid lines needing review
    rfq_query = select(RFQ).where(
        RFQ.organization_id == org_id,
        RFQ.status == "needs_review",
    )
    if ctx.membership.role == Role.SALES_REP:
        rfq_query = rfq_query.where(
            or_(RFQ.assigned_rep_user_id == ctx.user.id, RFQ.created_by == ctx.user.id)
        )
    rfq_query = rfq_query.order_by(RFQ.imported_at.desc()).limit(5)
    for rfq in db.execute(rfq_query).scalars().all():
        items.append(
            AttentionItemResponse(
                id=f"rfq-review-{rfq.id}",
                item_type="rfq_needs_review",
                severity="warning",
                title=f"RFQ {rfq.rfq_number} requires review",
                description=f"'{rfq.title}' has {rfq.total_lines} lines requiring verification before quote creation.",
                entity_type="rfq",
                entity_id=rfq.id,
                due_date=rfq.imported_at.date() if rfq.imported_at else None,
            )
        )

    return items
