"""Quote Revisions and Calculations schema (quote_revisions, quote_revision_lines, quotes current_revision_id)

Revision ID: 0004_quote_revisions_calculations
Revises: 0003_rfq_ingestion_review
Create Date: 2026-10-24 19:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0004_quote_revisions"
down_revision: Union[str, None] = "0003_rfq_ingestion_review"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. quote_revisions
    op.create_table(
        "quote_revisions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "quote_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("quotes.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("revision_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "parent_revision_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("quote_revisions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("currency", sa.String(10), nullable=False, server_default="INR"),
        sa.Column("snapshot_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("calculation_snapshot_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("calculator_version", sa.String(50), nullable=False, server_default="forgeflow-quote-calculator/1.0.0"),
        sa.Column("input_fingerprint", sa.String(64), nullable=False),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("commit_reason", sa.Text(), nullable=True),
        sa.Column("is_committed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("quote_id", "revision_number", name="uq_quote_revision_number"),
    )

    # 2. quote_revision_lines
    op.create_table(
        "quote_revision_lines",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "revision_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("quote_revisions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("line_order", sa.Integer(), nullable=False),
        sa.Column(
            "rfq_line_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("rfq_lines.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "catalog_product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("catalog_products.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("sku", sa.String(100), nullable=False),
        sa.Column("product_name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("unit", sa.String(50), nullable=False, server_default="nos"),
        sa.Column("quantity", sa.Numeric(14, 4), nullable=False),
        sa.Column("unit_price", sa.Numeric(14, 2), nullable=False),
        sa.Column("discount_percent", sa.Numeric(5, 2), nullable=False, server_default="0.00"),
        sa.Column("tax_rate_percent", sa.Numeric(5, 2), nullable=False, server_default="18.00"),
        sa.Column("unit_cost", sa.Numeric(14, 2), nullable=True),
        sa.Column("gross_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("discount_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("taxable_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("tax_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("line_total", sa.Numeric(14, 2), nullable=False),
        sa.Column("line_cost", sa.Numeric(14, 2), nullable=True),
        sa.Column("line_gross_profit", sa.Numeric(14, 2), nullable=True),
        sa.Column("margin_percent", sa.Numeric(5, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("revision_id", "line_order", name="uq_quote_revision_line_order"),
        sa.CheckConstraint("quantity > 0", name="ck_quote_line_quantity_positive"),
        sa.CheckConstraint("unit_price >= 0", name="ck_quote_line_unit_price_non_negative"),
        sa.CheckConstraint("discount_percent >= 0 AND discount_percent <= 100", name="ck_quote_line_discount_range"),
        sa.CheckConstraint("tax_rate_percent >= 0 AND tax_rate_percent <= 100", name="ck_quote_line_tax_range"),
    )

    # 3. Alter quotes table to add current_revision_id, valid_until, payment_terms, delivery_terms
    op.add_column(
        "quotes",
        sa.Column("current_revision_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_quotes_current_revision_id",
        "quotes",
        "quote_revisions",
        ["current_revision_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_quotes_current_revision_id", "quotes", ["current_revision_id"])

    op.add_column("quotes", sa.Column("valid_until", sa.Date(), nullable=True))
    op.add_column("quotes", sa.Column("payment_terms", sa.String(100), nullable=True))
    op.add_column("quotes", sa.Column("delivery_terms", sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_constraint("fk_quotes_current_revision_id", "quotes", type_="foreignkey")
    op.drop_index("ix_quotes_current_revision_id", table_name="quotes")
    op.drop_column("quotes", "delivery_terms")
    op.drop_column("quotes", "payment_terms")
    op.drop_column("quotes", "valid_until")
    op.drop_column("quotes", "current_revision_id")
    op.drop_table("quote_revision_lines")
    op.drop_table("quote_revisions")
