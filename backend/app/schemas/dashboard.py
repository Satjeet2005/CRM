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
