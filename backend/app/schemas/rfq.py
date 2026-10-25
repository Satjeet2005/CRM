import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class RFQImportPreviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    filename: str = Field(..., min_length=1, max_length=255)
    csv_content: str = Field(..., min_length=1)


class RFQImportPreviewResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    filename: str
    detected_headers: List[str]
    recommended_mapping: Dict[str, str]
    sample_rows: List[Dict[str, str]]
    total_data_rows: int
    valid_rows_count: int
    warning_rows_count: int
    error_rows_count: int
    blank_rows_count: int
    duplicate_rows_count: int
    unknown_columns: List[str]
    diagnostics: List[str]
    is_importable: bool


class RFQImportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    account_id: uuid.UUID
    opportunity_id: uuid.UUID
    title: str = Field(..., min_length=2, max_length=255)
    customer_reference: Optional[str] = Field(None, max_length=100)
    filename: str = Field(..., min_length=1, max_length=255)
    csv_content: str = Field(..., min_length=1)
    header_mapping: Dict[str, str]
    duplicate_override: bool = False


class CandidateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: uuid.UUID
    product_id: uuid.UUID
    product_sku: str
    product_name: str
    product_category: str
    product_base_unit: str
    sell_price: Decimal
    unit_cost: Optional[Decimal] = None
    rank: int
    match_method: str
    similarity_score: float
    is_disqualified: bool
    flags: List[str]
    reasons: List[str]
    attributes: Dict[str, str]


class RFQLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: uuid.UUID
    rfq_id: uuid.UUID
    source_row_number: int
    raw_sku: Optional[str] = None
    raw_description: str
    raw_quantity: Optional[str] = None
    raw_unit: Optional[str] = None
    raw_specifications: Optional[str] = None
    raw_manufacturer: Optional[str] = None
    raw_part_number: Optional[str] = None
    raw_notes: Optional[str] = None
    normalized_description: str
    parsed_quantity: Optional[Decimal] = None
    canonical_unit: Optional[str] = None
    specifications: Dict[str, str] = Field(default_factory=dict)
    diagnostics: Dict[str, Any] = Field(default_factory=dict)
    normalization_status: str
    match_status: str
    selected_product_id: Optional[uuid.UUID] = None
    selected_product: Optional[CandidateResponse] = None
    top_candidate: Optional[CandidateResponse] = None
    candidate_count: int = 0
    resolution_reason_code: Optional[str] = None
    resolution_notes: Optional[str] = None
    version: int
    updated_at: datetime


class DecisionHistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: uuid.UUID
    actor_user_id: uuid.UUID
    actor_name: str
    decision_type: str
    previous_match_status: str
    new_match_status: str
    previous_product_name: Optional[str] = None
    selected_product_name: Optional[str] = None
    reason_code: Optional[str] = None
    reason_notes: Optional[str] = None
    line_version_before: int
    line_version_after: int
    created_at: datetime


class RFQLineDetailResponse(RFQLineResponse):
    candidates: List[CandidateResponse] = Field(default_factory=list)
    decision_history: List[DecisionHistoryItem] = Field(default_factory=list)


class RFQResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: uuid.UUID
    organization_id: uuid.UUID
    rfq_number: str
    account_id: uuid.UUID
    account_name: Optional[str] = None
    opportunity_id: uuid.UUID
    opportunity_name: Optional[str] = None
    title: str
    customer_reference: Optional[str] = None
    source_filename: str
    source_file_size: int
    source_file_hash: str
    total_lines: int
    status: str
    assigned_rep_user_id: Optional[uuid.UUID] = None
    assigned_rep_name: Optional[str] = None
    candidate_set_version: int
    version: int
    imported_at: datetime
    created_at: datetime
    updated_at: datetime

    resolved_lines_count: int = 0
    needs_review_lines_count: int = 0
    invalid_lines_count: int = 0
    exact_matches_count: int = 0
    is_ready_to_quote: bool = False
    blocking_reasons: List[str] = Field(default_factory=list)


DecisionAction = Literal["accept_suggestion", "choose_product", "mark_unmatched", "revert"]


class RFQLineDecisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: DecisionAction
    candidate_id: Optional[uuid.UUID] = None
    product_id: Optional[uuid.UUID] = None
    reason_code: Optional[str] = None
    notes: Optional[str] = None
    expected_version: int


class RFQBulkDecisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    line_ids: List[uuid.UUID]
    expected_versions: Dict[str, int]


class RFQBulkDecisionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    accepted_count: int
    line_ids: List[uuid.UUID]


class RFQRematchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    clear_manual_decisions: bool = False


class RFQCreateQuoteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_rfq_version: int
    notes: Optional[str] = None


class RFQCreateQuoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    quote_id: uuid.UUID
    quote_number: str
    status: str
    rfq_id: uuid.UUID
    opportunity_id: uuid.UUID
    account_id: uuid.UUID
    current_revision_id: Optional[uuid.UUID] = None
