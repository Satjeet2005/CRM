import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.quote import Quote, QuoteRevision
    from app.models.user import User


class ExportEvent(Base):
    __tablename__ = "export_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    actor_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    revision_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("quote_revisions.id", ondelete="SET NULL"),
        nullable=True,
    )
    format: Mapped[str] = mapped_column(String(20), nullable=False)  # pdf, csv
    result: Mapped[str] = mapped_column(String(20), nullable=False)  # success, denied, failed
    request_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    safe_failure_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    sha256_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    watermarked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    organization: Mapped["Organization"] = relationship("Organization")
    actor: Mapped[Optional["User"]] = relationship("User", foreign_keys=[actor_user_id])
    revision: Mapped[Optional["QuoteRevision"]] = relationship(
        "QuoteRevision", foreign_keys=[revision_id]
    )

    __table_args__ = (
        Index("ix_export_events_org_created", "organization_id", "created_at"),
        Index("ix_export_events_entity", "organization_id", "entity_type", "entity_id"),
    )


class QuoteCustomerDelivery(Base):
    __tablename__ = "quote_customer_deliveries"

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
    revision_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("quote_revisions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    exported_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    export_type: Mapped[str] = mapped_column(String(20), nullable=False)  # pdf, csv
    sha256_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    recipient_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    watermarked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    organization: Mapped["Organization"] = relationship("Organization")
    quote: Mapped["Quote"] = relationship("Quote", foreign_keys=[quote_id])
    revision: Mapped["QuoteRevision"] = relationship("QuoteRevision", foreign_keys=[revision_id])
    exporter: Mapped["User"] = relationship("User", foreign_keys=[exported_by_user_id])

    __table_args__ = (
        Index("ix_quote_customer_deliveries_org_quote", "organization_id", "quote_id"),
        Index("ix_quote_customer_deliveries_hash", "organization_id", "sha256_hash"),
    )
