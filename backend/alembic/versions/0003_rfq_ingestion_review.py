"""RFQ Ingestion and Review Studio schema (rfqs, rfq_import_jobs, rfq_lines, rfq_match_candidates, rfq_line_decisions, quotes)

Revision ID: 0003_rfq_ingestion_review
Revises: 0002_crm_and_catalog
Create Date: 2026-10-24 16:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0003_rfq_ingestion_review"
down_revision: Union[str, None] = "0002_crm_and_catalog"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. rfqs
    op.create_table(
        "rfqs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("rfq_number", sa.String(50), nullable=False),
        sa.Column(
            "account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("accounts.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "opportunity_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("opportunities.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("customer_reference", sa.String(100), nullable=True),
        sa.Column("source_filename", sa.String(255), nullable=False),
        sa.Column("source_file_hash", sa.String(64), nullable=False),
        sa.Column("source_file_size", sa.Integer(), nullable=False),
        sa.Column("total_lines", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("header_mapping_json", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("import_diagnostics_json", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("status", sa.String(50), nullable=False, server_default="needs_review", index=True),
        sa.Column(
            "assigned_rep_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("candidate_set_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("imported_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("organization_id", "rfq_number", name="uq_rfq_org_number"),
    )
    op.create_index("ix_rfqs_org_hash", "rfqs", ["organization_id", "source_file_hash"])
    op.create_index("ix_rfqs_org_status", "rfqs", ["organization_id", "status"])

    # 2. rfq_import_jobs
    op.create_table(
        "rfq_import_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "rfq_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("rfqs.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("status", sa.String(50), nullable=False, server_default="completed"),
        sa.Column("source_filename", sa.String(255), nullable=False),
        sa.Column("source_file_hash", sa.String(64), nullable=False),
        sa.Column("source_file_size", sa.Integer(), nullable=False),
        sa.Column("row_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("validation_report_json", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("request_id", sa.String(100), nullable=True),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )

    # 3. rfq_lines
    op.create_table(
        "rfq_lines",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "rfq_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("rfqs.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("source_row_number", sa.Integer(), nullable=False),
        sa.Column("raw_sku", sa.String(100), nullable=True),
        sa.Column("raw_description", sa.Text(), nullable=False),
        sa.Column("raw_quantity", sa.String(50), nullable=True),
        sa.Column("raw_unit", sa.String(50), nullable=True),
        sa.Column("raw_specifications", sa.Text(), nullable=True),
        sa.Column("raw_manufacturer", sa.String(150), nullable=True),
        sa.Column("raw_part_number", sa.String(150), nullable=True),
        sa.Column("raw_notes", sa.Text(), nullable=True),
        sa.Column("raw_fields_json", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("normalized_description", sa.Text(), nullable=False),
        sa.Column("parsed_quantity", sa.Numeric(14, 4), nullable=True),
        sa.Column("canonical_unit", sa.String(50), nullable=True),
        sa.Column("specifications_json", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("diagnostics_json", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("normalization_status", sa.String(50), nullable=False, server_default="valid", index=True),
        sa.Column("match_status", sa.String(50), nullable=False, server_default="needs_review", index=True),
        sa.Column(
            "selected_product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("catalog_products.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("resolution_reason_code", sa.String(100), nullable=True),
        sa.Column("resolution_notes", sa.Text(), nullable=True),
        sa.Column(
            "resolved_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("rfq_id", "source_row_number", name="uq_rfq_line_source_row"),
    )
    op.create_index("ix_rfq_lines_org_match_status", "rfq_lines", ["organization_id", "match_status"])

    # 4. rfq_match_candidates
    op.create_table(
        "rfq_match_candidates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "rfq_line_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("rfq_lines.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("catalog_products.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("rank", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("match_method", sa.String(50), nullable=False, server_default="similarity"),
        sa.Column("similarity_score", sa.Numeric(6, 4), nullable=False, server_default="0.0000"),
        sa.Column("is_disqualified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("flags_json", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("reasons_json", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("explanation_json", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("matcher_version", sa.String(50), nullable=False, server_default="1.0.0-final"),
        sa.Column("candidate_set_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_rfq_candidates_line_rank",
        "rfq_match_candidates",
        ["rfq_line_id", "candidate_set_version", "rank"],
    )

    # 5. rfq_line_decisions
    op.create_table(
        "rfq_line_decisions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "rfq_line_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("rfq_lines.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "actor_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column("decision_type", sa.String(50), nullable=False),
        sa.Column("previous_match_status", sa.String(50), nullable=False),
        sa.Column("new_match_status", sa.String(50), nullable=False),
        sa.Column(
            "previous_product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("catalog_products.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "selected_product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("catalog_products.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("reason_code", sa.String(100), nullable=True),
        sa.Column("reason_notes", sa.Text(), nullable=True),
        sa.Column("line_version_before", sa.Integer(), nullable=False),
        sa.Column("line_version_after", sa.Integer(), nullable=False),
        sa.Column("candidate_set_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("request_id", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, index=True),
    )

    # 6. quotes (minimal draft header for Phase 3 readiness handoff)
    op.create_table(
        "quotes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("quote_number", sa.String(50), nullable=False),
        sa.Column(
            "rfq_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("rfqs.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "opportunity_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("opportunities.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("accounts.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column("status", sa.String(50), nullable=False, server_default="draft", index=True),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("organization_id", "quote_number", name="uq_quote_org_number"),
    )


def downgrade() -> None:
    op.drop_table("quotes")
    op.drop_table("rfq_line_decisions")
    op.drop_table("rfq_match_candidates")
    op.drop_table("rfq_lines")
    op.drop_table("rfq_import_jobs")
    op.drop_table("rfqs")
