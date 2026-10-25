import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict


class StageDistributionItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    stage: str
    count: int
    total_value: Decimal


class RFQMatchHealthItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    status: str
    label: str
    count: int
    percentage: float


class RFQMatchHealthSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_lines: int
    reviewed_lines: int
    categories: list[RFQMatchHealthItem]


class QuoteLifecycleItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    status: str
    label: str
    count: int


class QuoteLifecycleSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_quotes: int
    categories: list[QuoteLifecycleItem]


class TaskDueLoadItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    bucket: str
    label: str
    count: int
    is_urgent: bool


class TaskDueLoadSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_open_tasks: int
    categories: list[TaskDueLoadItem]


class DashboardSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    open_opportunities_count: int
    open_pipeline_value: Decimal
    overdue_tasks_count: int
    stage_distribution: list[StageDistributionItem]
    active_accounts_count: int
    active_catalog_products_count: int
    quotes_awaiting_approval: Optional[int] = None
    open_rfq_review_lines: Optional[int] = None
    quotes_availability: str = "available_phase_4"
    rfq_availability: str = "available"
    draft_quotes_count: Optional[int] = None
    total_quote_value: Optional[Decimal] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None

    # Operational Analytics Aggregates
    rfq_match_health: Optional[RFQMatchHealthSummary] = None
    quote_lifecycle: Optional[QuoteLifecycleSummary] = None
    task_due_load: Optional[TaskDueLoadSummary] = None


class AttentionItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    item_type: str  # "overdue_task", "urgent_task", "closing_soon_opportunity"
    severity: str  # "critical", "warning", "info"
    title: str
    description: str
    entity_type: str
    entity_id: uuid.UUID
    due_date: Optional[date] = None
