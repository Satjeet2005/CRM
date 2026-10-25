import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Quote(Base):
    __tablename__ = "quotes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    quote_number: Mapped[str] = mapped_column(String(50), nullable=False)
    rfq_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rfqs.id", ondelete="SET NULL"), nullable=True, index=True
    )
    opportunity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("opportunities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    # draft | pending_approval | approved | issued | rejected | expired
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="draft", index=True)

    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Added Phase 4 revision pointer and terms
    current_revision_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "quote_revisions.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_quotes_current_revision_id",
        ),
        nullable=True,
        index=True,
    )
    valid_until: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    payment_terms: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    delivery_terms: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

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
    rfq = relationship("RFQ")
    opportunity = relationship("Opportunity")
    account = relationship("Account")
    creator = relationship("User")
    revisions: Mapped[List["QuoteRevision"]] = relationship(
        "QuoteRevision",
        back_populates="quote",
        foreign_keys="QuoteRevision.quote_id",
        cascade="all, delete-orphan",
        order_by="QuoteRevision.revision_number.desc()",
    )
    current_revision: Mapped[Optional["QuoteRevision"]] = relationship(
        "QuoteRevision",
        foreign_keys=[current_revision_id],
        post_update=True,
    )

    __table_args__ = (
        UniqueConstraint("organization_id", "quote_number", name="uq_quote_org_number"),
    )


class QuoteRevision(Base):
    __tablename__ = "quote_revisions"

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
    revision_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    parent_revision_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("quote_revisions.id", ondelete="SET NULL"),
        nullable=True,
    )
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="INR")

    # Commercial metadata (payment terms, notes, validity)
    snapshot_json: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)

    # Immutable reproducible calculation snapshot
    calculation_snapshot_json: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )

    calculator_version: Mapped[str] = mapped_column(
        String(50), nullable=False, default="forgeflow-quote-calculator/1.0.0"
    )
    input_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)

    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    commit_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_committed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
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
    quote: Mapped["Quote"] = relationship(
        "Quote",
        back_populates="revisions",
        foreign_keys=[quote_id],
    )
    lines: Mapped[List["QuoteRevisionLine"]] = relationship(
        "QuoteRevisionLine",
        back_populates="revision",
        cascade="all, delete-orphan",
        order_by="QuoteRevisionLine.line_order.asc()",
    )
    creator = relationship("User")

    __table_args__ = (
        UniqueConstraint("quote_id", "revision_number", name="uq_quote_revision_number"),
    )


class QuoteRevisionLine(Base):
    __tablename__ = "quote_revision_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    revision_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("quote_revisions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    line_order: Mapped[int] = mapped_column(Integer, nullable=False)

    # Traceability links back to RFQ and Catalog
    rfq_line_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rfq_lines.id", ondelete="SET NULL"), nullable=True
    )
    catalog_product_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("catalog_products.id", ondelete="SET NULL"), nullable=True
    )

    # Historical product snapshot
    sku: Mapped[str] = mapped_column(String(100), nullable=False)
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    unit: Mapped[str] = mapped_column(String(50), nullable=False, default="nos")

    # Commercial line inputs (Decimal)
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    discount_percent: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("0.00")
    )
    tax_rate_percent: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("18.00")
    )
    unit_cost: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)

    # Authoritative line calculations
    gross_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    taxable_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    line_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)

    # Confidential cost and margin fields
    line_cost: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    line_gross_profit: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    margin_percent: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)

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
    revision: Mapped["QuoteRevision"] = relationship("QuoteRevision", back_populates="lines")
    catalog_product = relationship("CatalogProduct")
    rfq_line = relationship("RFQLine")

    __table_args__ = (
        UniqueConstraint("revision_id", "line_order", name="uq_quote_revision_line_order"),
        CheckConstraint("quantity > 0", name="ck_quote_line_quantity_positive"),
        CheckConstraint("unit_price >= 0", name="ck_quote_line_unit_price_non_negative"),
        CheckConstraint(
            "discount_percent >= 0 AND discount_percent <= 100", name="ck_quote_line_discount_range"
        ),
        CheckConstraint(
            "tax_rate_percent >= 0 AND tax_rate_percent <= 100", name="ck_quote_line_tax_range"
        ),
    )
