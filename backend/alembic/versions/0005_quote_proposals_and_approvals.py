"""Quote change proposals and approval decisions schema

Revision ID: 0005_quote_proposals_and_approvals
Revises: 0004_quote_revisions
Create Date: 2026-10-24 22:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0005_proposals_approvals"
down_revision: Union[str, None] = "0004_quote_revisions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. quote_change_proposals
    op.create_table(
        "quote_change_proposals",
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
        sa.Column("proposal_number", sa.String(64), nullable=False),
        sa.Column(
            "base_revision_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("quote_revisions.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column("base_version", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="draft", index=True),
        sa.Column(
            "proposer_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "reviewer_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=True,
            index=True,
        ),
        sa.Column("proposer_reason", sa.Text(), nullable=False),
        sa.Column("reviewer_comment", sa.Text(), nullable=True),
        sa.Column(
            "proposed_changes_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
        sa.Column(
            "base_snapshot_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "proposed_snapshot_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "diff_summary_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "policy_snapshot_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "calculator_version",
            sa.String(64),
            nullable=False,
            server_default="forgeflow-quote-calculator/1.0.0",
        ),
        sa.Column("input_fingerprint", sa.String(64), nullable=False),
        sa.Column("idempotency_key", sa.String(128), nullable=True, index=True),
        sa.Column(
            "resulting_revision_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("quote_revisions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("committed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("organization_id", "proposal_number", name="uq_quote_proposal_org_number"),
        sa.CheckConstraint(
            "status IN ('draft', 'pending_review', 'approved', 'rejected', 'cancelled', 'stale', 'committed')",
            name="ck_quote_proposal_status",
        ),
    )

    # 2. quote_approval_decisions
    op.create_table(
        "quote_approval_decisions",
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
            "proposal_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("quote_change_proposals.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "base_revision_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("quote_revisions.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column("base_version", sa.Integer(), nullable=False),
        sa.Column(
            "reviewer_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column("decision", sa.String(50), nullable=False),
        sa.Column("decision_comment", sa.Text(), nullable=True),
        sa.Column(
            "policy_snapshot_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "decided_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "created_revision_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("quote_revisions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("idempotency_key", sa.String(128), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint("decision IN ('approved', 'rejected')", name="ck_quote_decision_type"),
    )


def downgrade() -> None:
    op.drop_table("quote_approval_decisions")
    op.drop_table("quote_change_proposals")
