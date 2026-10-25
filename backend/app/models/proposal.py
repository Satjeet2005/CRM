import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class QuoteChangeProposal(Base):
    __tablename__ = "quote_change_proposals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    quote_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("quotes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    proposal_number: Mapped[str] = mapped_column(String(64), nullable=False)
    base_revision_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("quote_revisions.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    base_version: Mapped[int] = mapped_column(Integer, nullable=False)

    # Lifecycle: draft | pending_review | approved | rejected | cancelled | stale | committed
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="draft", index=True)

    proposer_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    reviewer_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    proposer_reason: Mapped[str] = mapped_column(Text, nullable=False)
    reviewer_comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Versioned allowlisted operations payload
    proposed_changes_json: Mapped[List[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=list
    )

    # Authoritative calculation snapshots
    base_snapshot_json: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    proposed_snapshot_json: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )
    diff_summary_json: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    policy_snapshot_json: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )

    calculator_version: Mapped[str] = mapped_column(
        String(64), nullable=False, default="forgeflow-quote-calculator/1.0.0"
    )
    input_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)

    idempotency_key: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    resulting_revision_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("quote_revisions.id", ondelete="SET NULL"),
        nullable=True,
    )

    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    decided_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    committed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

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
    quote = relationship("Quote", backref="proposals")
    base_revision = relationship("QuoteRevision", foreign_keys=[base_revision_id])
    resulting_revision = relationship("QuoteRevision", foreign_keys=[resulting_revision_id])
    proposer = relationship("User", foreign_keys=[proposer_user_id])
    reviewer = relationship("User", foreign_keys=[reviewer_user_id])
    decisions: Mapped[List["QuoteApprovalDecision"]] = relationship(
        "QuoteApprovalDecision", back_populates="proposal", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("organization_id", "proposal_number", name="uq_quote_proposal_org_number"),
        CheckConstraint(
            "status IN ('draft', 'pending_review', 'approved', 'rejected', 'cancelled', 'stale', 'committed')",
            name="ck_quote_proposal_status",
        ),
    )


class QuoteApprovalDecision(Base):
    __tablename__ = "quote_approval_decisions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    quote_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("quotes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    proposal_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("quote_change_proposals.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    base_revision_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("quote_revisions.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    base_version: Mapped[int] = mapped_column(Integer, nullable=False)

    reviewer_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    decision: Mapped[str] = mapped_column(String(50), nullable=False)  # approved | rejected
    decision_comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    policy_snapshot_json: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )

    decided_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    created_revision_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("quote_revisions.id", ondelete="SET NULL"),
        nullable=True,
    )
    idempotency_key: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    quote = relationship("Quote")
    proposal: Mapped[Optional["QuoteChangeProposal"]] = relationship(
        "QuoteChangeProposal", back_populates="decisions"
    )
    base_revision = relationship("QuoteRevision", foreign_keys=[base_revision_id])
    reviewer = relationship("User", foreign_keys=[reviewer_user_id])

    __table_args__ = (
        CheckConstraint("decision IN ('approved', 'rejected')", name="ck_quote_decision_type"),
    )
