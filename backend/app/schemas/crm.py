import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Generic, Literal, Optional, TypeVar

from pydantic import BaseModel, ConfigDict, Field, field_validator

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    model_config = ConfigDict(extra="forbid")

    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int


# ==================== Account Schemas ====================

AccountType = Literal["customer", "prospect", "partner", "supplier"]
AccountStatus = Literal["active", "archived"]


class AccountCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., min_length=2, max_length=120)
    legal_name: Optional[str] = Field(None, max_length=160)
    account_type: AccountType = "customer"
    industry: Optional[str] = Field(None, max_length=80)
    website: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=32)
    email: Optional[str] = Field(None, max_length=255)
    billing_address_json: Optional[dict[str, Any]] = None
    shipping_address_json: Optional[dict[str, Any]] = None
    notes: Optional[str] = Field(None, max_length=2000)
    owner_user_id: Optional[uuid.UUID] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        trimmed = v.strip()
        if len(trimmed) < 2:
            raise ValueError("Account name must be at least 2 characters")
        return trimmed


class AccountUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = Field(None, min_length=2, max_length=120)
    legal_name: Optional[str] = Field(None, max_length=160)
    account_type: Optional[AccountType] = None
    industry: Optional[str] = Field(None, max_length=80)
    website: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=32)
    email: Optional[str] = Field(None, max_length=255)
    billing_address_json: Optional[dict[str, Any]] = None
    shipping_address_json: Optional[dict[str, Any]] = None
    notes: Optional[str] = Field(None, max_length=2000)
    owner_user_id: Optional[uuid.UUID] = None
    status: Optional[AccountStatus] = None
    expected_version: int = Field(..., ge=1)


class AccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    legal_name: Optional[str]
    account_type: str
    industry: Optional[str]
    website: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    billing_address_json: Optional[dict[str, Any]]
    shipping_address_json: Optional[dict[str, Any]]
    notes: Optional[str]
    owner_user_id: Optional[uuid.UUID]
    owner_name: Optional[str] = None
    status: str
    version: int
    created_at: datetime
    updated_at: datetime
    contacts_count: int = 0
    opportunities_count: int = 0


# ==================== Contact Schemas ====================

ContactStatus = Literal["active", "archived"]


class ContactCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    first_name: str = Field(..., min_length=1, max_length=80)
    last_name: str = Field(..., min_length=1, max_length=80)
    job_title: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=32)
    is_primary: bool = False
    notes: Optional[str] = Field(None, max_length=1000)

    @field_validator("first_name", "last_name")
    @classmethod
    def validate_names(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Name cannot be empty")
        return trimmed


class ContactUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    first_name: Optional[str] = Field(None, min_length=1, max_length=80)
    last_name: Optional[str] = Field(None, min_length=1, max_length=80)
    job_title: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=32)
    is_primary: Optional[bool] = None
    notes: Optional[str] = Field(None, max_length=1000)
    status: Optional[ContactStatus] = None
    expected_version: int = Field(..., ge=1)


class ContactResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    account_id: uuid.UUID
    first_name: str
    last_name: str
    job_title: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    is_primary: bool
    notes: Optional[str]
    status: str
    version: int
    created_at: datetime
    updated_at: datetime
    account_name: Optional[str] = None


# ==================== Opportunity Schemas ====================

OpportunityStage = Literal[
    "lead",
    "qualified",
    "solutioning",
    "proposal",
    "negotiation",
    "won",
    "lost",
]
LossReason = Literal["price", "timing", "competitor", "no_response", "other"]


class OpportunityCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    account_id: uuid.UUID
    primary_contact_id: Optional[uuid.UUID] = None
    name: str = Field(..., min_length=3, max_length=140)
    description: Optional[str] = Field(None, max_length=2000)
    stage: OpportunityStage = "lead"
    estimated_value: Decimal = Field(default=Decimal("0.00"), ge=0)
    currency_code: str = Field(default="INR", max_length=10)
    probability_percent: Optional[Decimal] = Field(None, ge=0, le=100)
    expected_close_date: Optional[date] = None
    owner_user_id: Optional[uuid.UUID] = None
    source: Optional[str] = Field(None, max_length=80)


class OpportunityUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    primary_contact_id: Optional[uuid.UUID] = None
    name: Optional[str] = Field(None, min_length=3, max_length=140)
    description: Optional[str] = Field(None, max_length=2000)
    estimated_value: Optional[Decimal] = Field(None, ge=0)
    probability_percent: Optional[Decimal] = Field(None, ge=0, le=100)
    expected_close_date: Optional[date] = None
    owner_user_id: Optional[uuid.UUID] = None
    source: Optional[str] = Field(None, max_length=80)
    expected_version: int = Field(..., ge=1)


class OpportunityStageUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    stage: OpportunityStage
    expected_version: int = Field(..., ge=1)
    loss_reason: Optional[LossReason] = None
    loss_detail: Optional[str] = Field(None, max_length=500)
    won_override_reason: Optional[str] = Field(None, max_length=500)


class OpportunityReopenRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str = Field(..., min_length=3, max_length=500)
    expected_version: int = Field(..., ge=1)


class OpportunityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    account_id: uuid.UUID
    primary_contact_id: Optional[uuid.UUID]
    name: str
    description: Optional[str]
    stage: str
    estimated_value: Decimal
    currency_code: str
    probability_percent: Optional[Decimal]
    expected_close_date: Optional[date]
    owner_user_id: Optional[uuid.UUID]
    source: Optional[str]
    loss_reason: Optional[str]
    loss_detail: Optional[str]
    won_at: Optional[datetime]
    lost_at: Optional[datetime]
    version: int
    created_at: datetime
    updated_at: datetime
    account_name: Optional[str] = None
    primary_contact_name: Optional[str] = None
    owner_name: Optional[str] = None


# ==================== Task Schemas ====================

TaskPriority = Literal["low", "normal", "high"]
TaskStatus = Literal["open", "completed", "cancelled"]


class TaskCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(..., min_length=1, max_length=160)
    description: Optional[str] = Field(None, max_length=1000)
    account_id: Optional[uuid.UUID] = None
    opportunity_id: Optional[uuid.UUID] = None
    assignee_user_id: Optional[uuid.UUID] = None
    due_date: Optional[date] = None
    priority: TaskPriority = "normal"


class TaskUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Optional[str] = Field(None, min_length=1, max_length=160)
    description: Optional[str] = Field(None, max_length=1000)
    account_id: Optional[uuid.UUID] = None
    opportunity_id: Optional[uuid.UUID] = None
    assignee_user_id: Optional[uuid.UUID] = None
    due_date: Optional[date] = None
    priority: Optional[TaskPriority] = None
    expected_version: int = Field(..., ge=1)


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    title: str
    description: Optional[str]
    account_id: Optional[uuid.UUID]
    opportunity_id: Optional[uuid.UUID]
    assignee_user_id: Optional[uuid.UUID]
    due_date: Optional[date]
    priority: str
    status: str
    completed_at: Optional[datetime]
    version: int
    created_at: datetime
    updated_at: datetime
    is_overdue: bool = False
    account_name: Optional[str] = None
    opportunity_name: Optional[str] = None
    assignee_name: Optional[str] = None


# ==================== Activity Schemas ====================


class ActivityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    actor_user_id: Optional[uuid.UUID]
    entity_type: str
    entity_id: uuid.UUID
    event_type: str
    summary: str
    metadata_json: Optional[dict[str, Any]]
    occurred_at: datetime
    actor_name: Optional[str] = None
