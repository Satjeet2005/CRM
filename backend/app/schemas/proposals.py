import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class ProposalOperationSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: str = Field(..., description="Allowlisted operation type")
    target_line_id: Optional[uuid.UUID] = Field(
        default=None, description="UUID of target line for modification/removal"
    )
    field: Optional[str] = Field(default=None, description="Field name for target line")
    value: Optional[Any] = Field(default=None, description="New value for scalar modification")
    payload: Optional[Dict[str, Any]] = Field(default=None, description="Line payload for add_line")


class CreateProposalRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    quote_id: uuid.UUID
    base_revision_id: uuid.UUID
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    justification: str = Field(
        ..., min_length=1, description="Commercial justification is mandatory"
    )
    operations: List[ProposalOperationSchema] = Field(..., min_length=1)
    idempotency_key: Optional[str] = Field(default=None, max_length=128)


class UpdateProposalDraftRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    justification: Optional[str] = Field(default=None, min_length=1)
    operations: Optional[List[ProposalOperationSchema]] = None


class CommitProposalRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    idempotency_key: Optional[str] = Field(default=None, max_length=128)


class ApprovalDecisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: str = Field(..., pattern="^(approved|rejected)$")
    rejection_reason: Optional[str] = Field(
        default=None, description="Mandatory when decision is rejected"
    )
    notes: Optional[str] = None
    idempotency_key: Optional[str] = Field(default=None, max_length=128)


class InitialQuoteSubmitRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    notes: Optional[str] = None
    idempotency_key: Optional[str] = Field(None, max_length=128)


class InitialQuoteDecisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: str = Field(..., pattern="^(approved|rejected)$")
    rejection_reason: Optional[str] = Field(None, description="Mandatory when decision is rejected")
    notes: Optional[str] = None
    idempotency_key: Optional[str] = Field(None, max_length=128)


class ApprovalDecisionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: uuid.UUID
    proposal_id: Optional[uuid.UUID] = None
    quote_id: Optional[uuid.UUID] = None
    reviewer_user_id: uuid.UUID
    reviewer_name: Optional[str] = None
    decision: str
    rejection_reason: Optional[str] = None
    notes: Optional[str] = None
    policy_snapshot_at_decision: Optional[Dict[str, Any]] = None
    created_at: datetime


class ProposalListItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: uuid.UUID
    quote_id: uuid.UUID
    quote_number: Optional[str] = None
    base_revision_id: uuid.UUID
    base_revision_number: Optional[int] = None
    target_revision_number: Optional[int] = None
    title: str
    status: str
    proposer_user_id: uuid.UUID
    proposer_name: Optional[str] = None
    operations_count: int
    created_at: datetime
    updated_at: datetime


class ProposalDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: uuid.UUID
    quote_id: uuid.UUID
    quote_number: Optional[str] = None
    base_revision_id: uuid.UUID
    base_revision_number: Optional[int] = None
    target_revision_number: Optional[int] = None
    title: str
    description: Optional[str] = None
    justification: Optional[str] = None
    status: str
    proposer_user_id: uuid.UUID
    proposer_name: Optional[str] = None
    operations: List[Dict[str, Any]]
    policy_snapshots: Optional[Dict[str, Any]] = None
    decisions: List[ApprovalDecisionResponse] = []
    created_at: datetime
    updated_at: datetime


class ProposalDiffResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    terms_diff: Dict[str, Any]
    modified_lines: List[Dict[str, Any]]
    added_lines: List[Dict[str, Any]]
    removed_lines: List[Dict[str, Any]]
    unchanged_lines: List[Dict[str, Any]]
    financial_impact: Dict[str, Any]
    policy_snapshot: Optional[Dict[str, Any]] = None


class ApprovalQueueItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    item_type: str = Field(..., description="'initial_quote' or 'proposal'")
    id: uuid.UUID
    quote_id: uuid.UUID
    quote_number: str
    proposal_id: Optional[uuid.UUID] = None
    title: str
    proposer_user_id: uuid.UUID
    proposer_name: Optional[str] = None
    status: str
    total_value: Decimal
    discount_percent: Optional[Decimal] = None
    margin_percent: Optional[Decimal] = None
    pending_since: datetime
    requires_manager_approval: bool
    triggered_rules: List[str] = []


class PaginatedProposalsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: List[ProposalListItemResponse]
    total: int
    page: int
    page_size: int
    pages: int


class PaginatedApprovalsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: List[ApprovalQueueItemResponse]
    total: int
    page: int
    page_size: int
    pages: int
