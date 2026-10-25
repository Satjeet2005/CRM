"""CRM and Catalog schema (accounts, contacts, opportunities, tasks, activities, catalog_products, catalog_aliases)

Revision ID: 0002_crm_and_catalog
Revises: 0001_initial_foundation
Create Date: 2026-10-24 14:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0002_crm_and_catalog"
down_revision: Union[str, None] = "0001_initial_foundation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. accounts table
    op.create_table(
        "accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("legal_name", sa.String(length=160), nullable=True),
        sa.Column("account_type", sa.String(length=50), server_default="customer", nullable=False),
        sa.Column("industry", sa.String(length=80), nullable=True),
        sa.Column("website", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=32), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("billing_address_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("shipping_address_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "owner_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("status", sa.String(length=50), server_default="active", nullable=False),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("version", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_accounts_org_updated", "accounts", ["organization_id", "updated_at"])
    op.create_index("ix_accounts_org_status", "accounts", ["organization_id", "status"])
    op.create_index("ix_accounts_org_name", "accounts", ["organization_id", "name"])

    # 2. contacts table
    op.create_table(
        "contacts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("first_name", sa.String(length=80), nullable=False),
        sa.Column("last_name", sa.String(length=80), nullable=False),
        sa.Column("job_title", sa.String(length=100), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=32), nullable=True),
        sa.Column("is_primary", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=50), server_default="active", nullable=False),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("version", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_contacts_org_account", "contacts", ["organization_id", "account_id"])
    op.create_index("ix_contacts_org_email", "contacts", ["organization_id", "email"])
    op.create_index(
        "uq_contacts_account_primary",
        "contacts",
        ["account_id"],
        unique=True,
        postgresql_where=sa.text("is_primary = true AND status = 'active'"),
    )

    # 3. opportunities table
    op.create_table(
        "opportunities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "primary_contact_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("contacts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("name", sa.String(length=140), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("stage", sa.String(length=50), server_default="lead", nullable=False),
        sa.Column("estimated_value", sa.Numeric(precision=14, scale=2), server_default=sa.text("0.00"), nullable=False),
        sa.Column("currency_code", sa.String(length=10), server_default="INR", nullable=False),
        sa.Column("probability_percent", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("expected_close_date", sa.Date(), nullable=True),
        sa.Column(
            "owner_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("source", sa.String(length=80), nullable=True),
        sa.Column("loss_reason", sa.String(length=80), nullable=True),
        sa.Column("loss_detail", sa.Text(), nullable=True),
        sa.Column("won_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("lost_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("version", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("estimated_value >= 0", name="ck_opp_estimated_value_positive"),
    )
    op.create_index("ix_opportunities_org_stage", "opportunities", ["organization_id", "stage"])
    op.create_index("ix_opportunities_org_account", "opportunities", ["organization_id", "account_id"])
    op.create_index("ix_opportunities_org_close_date", "opportunities", ["organization_id", "expected_close_date"])

    # 4. tasks table
    op.create_table(
        "tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("accounts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "opportunity_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("opportunities.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "assignee_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("priority", sa.String(length=20), server_default="normal", nullable=False),
        sa.Column("status", sa.String(length=20), server_default="open", nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("version", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_tasks_org_assignee_status", "tasks", ["organization_id", "assignee_user_id", "status"])
    op.create_index("ix_tasks_org_due_date", "tasks", ["organization_id", "due_date"])

    # 5. activities table
    op.create_table(
        "activities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "actor_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("entity_type", sa.String(length=50), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_type", sa.String(length=60), nullable=False),
        sa.Column("summary", sa.String(length=255), nullable=False),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_activities_org_entity", "activities", ["organization_id", "entity_type", "entity_id"])
    op.create_index("ix_activities_org_occurred", "activities", ["organization_id", "occurred_at"])

    # 6. catalog_products table
    op.create_table(
        "catalog_products",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("sku", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=180), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(length=80), nullable=False),
        sa.Column("manufacturer", sa.String(length=120), nullable=True),
        sa.Column("manufacturer_part_number", sa.String(length=120), nullable=True),
        sa.Column("base_unit", sa.String(length=20), server_default="ea", nullable=False),
        sa.Column("sell_price", sa.Numeric(precision=14, scale=4), server_default=sa.text("0.0000"), nullable=False),
        sa.Column("unit_cost", sa.Numeric(precision=14, scale=4), nullable=True),
        sa.Column("tax_rate_percent", sa.Numeric(precision=5, scale=2), server_default=sa.text("18.00"), nullable=False),
        sa.Column("stock_status", sa.String(length=30), server_default="in_stock", nullable=False),
        sa.Column("attributes_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("version", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("organization_id", "sku", name="uq_catalog_org_sku"),
        sa.CheckConstraint("sell_price >= 0", name="ck_catalog_sell_price_positive"),
        sa.CheckConstraint("unit_cost IS NULL OR unit_cost >= 0", name="ck_catalog_unit_cost_positive"),
        sa.CheckConstraint("tax_rate_percent >= 0 AND tax_rate_percent <= 100", name="ck_catalog_tax_rate_range"),
    )
    op.create_index("ix_catalog_products_org_active", "catalog_products", ["organization_id", "is_active"])
    op.create_index("ix_catalog_products_org_category", "catalog_products", ["organization_id", "category"])
    op.create_index("ix_catalog_products_org_sku", "catalog_products", ["organization_id", "sku"])

    # 7. catalog_aliases table
    op.create_table(
        "catalog_aliases",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("catalog_products.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("alias_text", sa.String(length=180), nullable=False),
        sa.Column("normalized_alias", sa.String(length=180), nullable=False),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_catalog_aliases_org_normalized", "catalog_aliases", ["organization_id", "normalized_alias"])


def downgrade() -> None:
    op.drop_table("catalog_aliases")
    op.drop_table("catalog_products")
    op.drop_table("activities")
    op.drop_table("tasks")
    op.drop_table("opportunities")
    op.drop_table("contacts")
    op.drop_table("accounts")
