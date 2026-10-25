"""Customer document exports and delivery audit schema

Revision ID: 0006_customer_exports
Revises: 0005_proposals_approvals
Create Date: 2026-10-24 23:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0006_customer_exports"
down_revision: Union[str, None] = "0005_proposals_approvals"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. export_events table (tracks all export attempts: success, denied, failed)
    op.create_table(
        "export_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "actor_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column(
            "revision_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("quote_revisions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("format", sa.String(20), nullable=False),
        sa.Column("result", sa.String(20), nullable=False),
        sa.Column("request_id", sa.String(64), nullable=True),
        sa.Column("safe_failure_code", sa.String(100), nullable=True),
        sa.Column("sha256_hash", sa.String(64), nullable=True),
        sa.Column("watermarked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_export_events_org_created",
        "export_events",
        ["organization_id", "created_at"],
    )
    op.create_index(
        "ix_export_events_entity",
        "export_events",
        ["organization_id", "entity_type", "entity_id"],
    )

    # 2. quote_customer_deliveries table (tracks successful customer-facing deliverables)
    op.create_table(
        "quote_customer_deliveries",
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
        sa.Column(
            "revision_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("quote_revisions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "exported_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column("export_type", sa.String(20), nullable=False),
        sa.Column("sha256_hash", sa.String(64), nullable=False),
        sa.Column("recipient_email", sa.String(255), nullable=True),
        sa.Column("watermarked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_quote_customer_deliveries_org_quote",
        "quote_customer_deliveries",
        ["organization_id", "quote_id"],
    )
    op.create_index(
        "ix_quote_customer_deliveries_hash",
        "quote_customer_deliveries",
        ["organization_id", "sha256_hash"],
    )


def downgrade() -> None:
    op.drop_table("quote_customer_deliveries")
    op.drop_table("export_events")
