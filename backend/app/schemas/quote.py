import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class QuoteTotalsSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    subtotal: Decimal
    total_discount: Decimal
    taxable_subtotal: Decimal
    tax_total: Decimal
    grand_total: Decimal
    total_cost: Optional[Decimal] = None
    total_gross_profit: Optional[Decimal] = None
    overall_margin_percent: Optional[Decimal] = None


class QuoteRevisionLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: uuid.UUID
    line_order: int
    rfq_line_id: Optional[uuid.UUID] = None
    catalog_product_id: Optional[uuid.UUID] = None
    sku: str
    product_name: str
    description: str
    unit: str
    quantity: Decimal
    unit_price: Decimal
    discount_percent: Decimal
    tax_rate_percent: Decimal
    gross_amount: Decimal
    discount_amount: Decimal
    taxable_amount: Decimal
    tax_amount: Decimal
    line_total: Decimal
    unit_cost: Optional[Decimal] = None
    line_cost: Optional[Decimal] = None
    line_gross_profit: Optional[Decimal] = None
    margin_percent: Optional[Decimal] = None


class QuoteRevisionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: uuid.UUID
    quote_id: uuid.UUID
    revision_number: int
    parent_revision_id: Optional[uuid.UUID] = None
    currency: str
    calculator_version: str
    input_fingerprint: str
    is_committed: bool
    version: int
    snapshot_json: Dict[str, Any]
    totals: QuoteTotalsSchema
    lines: List[QuoteRevisionLineResponse]
    policy_evaluation: Optional[Dict[str, Any]] = None
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime


class QuoteDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: uuid.UUID
    organization_id: uuid.UUID
    quote_number: str
    rfq_id: Optional[uuid.UUID] = None
    rfq_number: Optional[str] = None
    opportunity_id: uuid.UUID
    opportunity_name: Optional[str] = None
    account_id: uuid.UUID
    account_name: Optional[str] = None
    status: str
    created_by: uuid.UUID
    created_by_name: Optional[str] = None
    version: int
    notes: Optional[str] = None
    current_revision_id: Optional[uuid.UUID] = None
    valid_until: Optional[date] = None
    payment_terms: Optional[str] = None
    delivery_terms: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    current_revision: Optional[QuoteRevisionResponse] = None
    requires_manager_approval: bool = False
    approval_triggers: List[Dict[str, Any]] = []


class QuoteListItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: uuid.UUID
    quote_number: str
    rfq_id: Optional[uuid.UUID] = None
    rfq_number: Optional[str] = None
    opportunity_id: uuid.UUID
    opportunity_name: str
    account_id: uuid.UUID
    account_name: str
    status: str
    current_revision_number: int
    grand_total: Decimal
    currency: str
    requires_manager_approval: bool
    created_by: uuid.UUID
    created_by_name: str
    version: int
    valid_until: Optional[date] = None
    created_at: datetime
    updated_at: datetime


class PaginatedQuotesResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: List[QuoteListItemResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class QuoteDraftLineUpdateInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: Optional[uuid.UUID] = None
    line_order: int
    sku: str = Field(..., min_length=1, max_length=100)
    product_name: str = Field(..., min_length=1, max_length=255)
    description: str = Field(default="", max_length=2000)
    unit: str = Field(..., min_length=1, max_length=50)
    quantity: Decimal = Field(..., gt=0)
    unit_price: Decimal = Field(..., ge=0)
    discount_percent: Decimal = Field(default=Decimal("0.00"), ge=0, le=100)
    tax_rate_percent: Decimal = Field(default=Decimal("18.00"), ge=0, le=100)
    catalog_product_id: Optional[uuid.UUID] = None
    rfq_line_id: Optional[uuid.UUID] = None


class QuoteDraftUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_version: int
    notes: Optional[str] = Field(None, max_length=5000)
    payment_terms: Optional[str] = Field(None, max_length=100)
    delivery_terms: Optional[str] = Field(None, max_length=100)
    valid_until: Optional[date] = None
    lines: List[QuoteDraftLineUpdateInput] = Field(..., min_length=1)


class CalculationTraceResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    quote_id: uuid.UUID
    revision_id: uuid.UUID
    revision_number: int
    calculator_version: str
    input_fingerprint: str
    nodes: List[Dict[str, Any]]
