import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class RFQ(Base):
    __tablename__ = "rfqs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rfq_number: Mapped[str] = mapped_column(String(50), nullable=False)
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    opportunity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("opportunities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    source_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    source_file_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    source_file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    total_lines: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    header_mapping_json: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    import_diagnostics_json: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )

    # State: needs_review | ready_to_quote | quoted | cancelled
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="needs_review", index=True
    )

    assigned_rep_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    candidate_set_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    imported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    account = relationship("Account")
    opportunity = relationship("Opportunity")
    assigned_rep = relationship("User", foreign_keys=[assigned_rep_user_id])
    creator = relationship("User", foreign_keys=[created_by])
    lines = relationship(
        "RFQLine",
        back_populates="rfq",
        cascade="all, delete-orphan",
        order_by="RFQLine.source_row_number",
    )
    import_jobs = relationship("RFQImportJob", back_populates="rfq")

    __table_args__ = (
        UniqueConstraint("organization_id", "rfq_number", name="uq_rfq_org_number"),
        Index("ix_rfqs_org_hash", "organization_id", "source_file_hash"),
        Index("ix_rfqs_org_status", "organization_id", "status"),
    )


class RFQImportJob(Base):
    __tablename__ = "rfq_import_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rfq_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rfqs.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # preview | completed | failed
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="completed")
    source_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    source_file_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    source_file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    row_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    validation_report_json: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )
    request_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    rfq = relationship("RFQ", back_populates="import_jobs")


class RFQLine(Base):
    __tablename__ = "rfq_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rfq_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rfqs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_row_number: Mapped[int] = mapped_column(Integer, nullable=False)

    # Raw extracted fields
    raw_sku: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    raw_description: Mapped[str] = mapped_column(Text, nullable=False)
    raw_quantity: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    raw_unit: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    raw_specifications: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    raw_manufacturer: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    raw_part_number: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    raw_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    raw_fields_json: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)

    # Normalized fields
    normalized_description: Mapped[str] = mapped_column(Text, nullable=False)
    parsed_quantity: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 4), nullable=True)
    canonical_unit: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    specifications_json: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    diagnostics_json: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)

    # Statuses
    # valid | warning | invalid
    normalization_status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="valid", index=True
    )
    # exact_match | suggested | needs_review | matched | unmatched
    match_status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="needs_review", index=True
    )

    # Resolution
    selected_product_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("catalog_products.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    resolution_reason_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    resolution_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resolved_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    rfq = relationship("RFQ", back_populates="lines")
    selected_product = relationship("CatalogProduct")
    candidates = relationship(
        "RFQMatchCandidate",
        back_populates="rfq_line",
        cascade="all, delete-orphan",
        order_by="RFQMatchCandidate.rank",
    )
    decisions = relationship(
        "RFQLineDecision",
        back_populates="rfq_line",
        cascade="all, delete-orphan",
        order_by="RFQLineDecision.created_at.desc()",
    )

    __table_args__ = (
        UniqueConstraint("rfq_id", "source_row_number", name="uq_rfq_line_source_row"),
        Index("ix_rfq_lines_org_match_status", "organization_id", "match_status"),
    )


class RFQMatchCandidate(Base):
    __tablename__ = "rfq_match_candidates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rfq_line_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("rfq_lines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("catalog_products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rank: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # exact_sku | exact_mpn | alias | similarity | attribute_compatible
    match_method: Mapped[str] = mapped_column(String(50), nullable=False, default="similarity")
    similarity_score: Mapped[Decimal] = mapped_column(
        Numeric(6, 4), nullable=False, default=Decimal("0.0000")
    )
    is_disqualified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    flags_json: Mapped[List[str]] = mapped_column(JSONB, nullable=False, default=list)
    reasons_json: Mapped[List[str]] = mapped_column(JSONB, nullable=False, default=list)
    explanation_json: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    matcher_version: Mapped[str] = mapped_column(String(50), nullable=False, default="1.0.0-final")
    candidate_set_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    rfq_line = relationship("RFQLine", back_populates="candidates")
    product = relationship("CatalogProduct")

    __table_args__ = (
        Index("ix_rfq_candidates_line_rank", "rfq_line_id", "candidate_set_version", "rank"),
    )


class RFQLineDecision(Base):
    __tablename__ = "rfq_line_decisions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rfq_line_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("rfq_lines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    actor_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    # accept_suggestion | choose_product | mark_unmatched | revert
    decision_type: Mapped[str] = mapped_column(String(50), nullable=False)
    previous_match_status: Mapped[str] = mapped_column(String(50), nullable=False)
    new_match_status: Mapped[str] = mapped_column(String(50), nullable=False)

    previous_product_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("catalog_products.id", ondelete="SET NULL"), nullable=True
    )
    selected_product_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("catalog_products.id", ondelete="SET NULL"), nullable=True
    )
    reason_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    reason_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    line_version_before: Mapped[int] = mapped_column(Integer, nullable=False)
    line_version_after: Mapped[int] = mapped_column(Integer, nullable=False)
    candidate_set_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    request_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    rfq_line = relationship("RFQLine", back_populates="decisions")
    actor = relationship("User")
    selected_product = relationship("CatalogProduct", foreign_keys=[selected_product_id])
