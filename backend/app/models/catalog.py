import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
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

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.user import User


class CatalogProduct(Base):
    __tablename__ = "catalog_products"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    sku: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(80), nullable=False)
    manufacturer: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    manufacturer_part_number: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    base_unit: Mapped[str] = mapped_column(String(20), default="ea", nullable=False)
    sell_price: Mapped[Decimal] = mapped_column(
        Numeric(14, 4),
        default=Decimal("0.0000"),
        nullable=False,
    )
    unit_cost: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(14, 4),
        nullable=True,
    )
    tax_rate_percent: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        default=Decimal("18.00"),
        nullable=False,
    )
    stock_status: Mapped[str] = mapped_column(String(30), default="in_stock", nullable=False)
    attributes_json: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    organization: Mapped["Organization"] = relationship("Organization")  # noqa: F821
    creator: Mapped[Optional["User"]] = relationship("User", foreign_keys=[created_by])  # noqa: F821
    aliases: Mapped[list["CatalogAlias"]] = relationship(
        "CatalogAlias", back_populates="product", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("organization_id", "sku", name="uq_catalog_org_sku"),
        CheckConstraint("sell_price >= 0", name="ck_catalog_sell_price_positive"),
        CheckConstraint(
            "unit_cost IS NULL OR unit_cost >= 0", name="ck_catalog_unit_cost_positive"
        ),
        CheckConstraint(
            "tax_rate_percent >= 0 AND tax_rate_percent <= 100", name="ck_catalog_tax_rate_range"
        ),
        Index("ix_catalog_products_org_active", "organization_id", "is_active"),
        Index("ix_catalog_products_org_category", "organization_id", "category"),
        Index("ix_catalog_products_org_sku", "organization_id", "sku"),
    )


class CatalogAlias(Base):
    __tablename__ = "catalog_aliases"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("catalog_products.id", ondelete="CASCADE"),
        nullable=False,
    )
    alias_text: Mapped[str] = mapped_column(String(180), nullable=False)
    normalized_alias: Mapped[str] = mapped_column(String(180), nullable=False)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    product: Mapped["CatalogProduct"] = relationship("CatalogProduct", back_populates="aliases")
    creator: Mapped[Optional["User"]] = relationship("User", foreign_keys=[created_by])  # noqa: F821

    __table_args__ = (
        Index("ix_catalog_aliases_org_normalized", "organization_id", "normalized_alias"),
    )
