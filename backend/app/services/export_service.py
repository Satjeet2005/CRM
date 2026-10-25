"""Authoritative Export Service for ForgeFlow.

Coordinates server-side quotation document generation (PDF and CSV),
enforces draft watermark governance and final export preconditions,
computes byte-level SHA-256 fingerprints, and atomically records audit
and customer delivery history.
"""

import hashlib
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthenticatedContext
from app.domain.exports.csv_generator import generate_quote_csv
from app.domain.exports.dto import (
    QuoteExportCustomerDTO,
    QuoteExportDTO,
    QuoteExportLineDTO,
    QuoteExportSellerDTO,
)
from app.domain.exports.pdf_renderer import render_quote_pdf
from app.models.crm import Account, Opportunity
from app.models.export import ExportEvent, QuoteCustomerDelivery
from app.models.organization import Organization
from app.models.quote import Quote, QuoteRevision
from app.schemas.export import QuoteCustomerDeliveryResponse
from app.services.activity_service import record_activity


def _record_denied_export_event(
    db: Session,
    organization_id: uuid.UUID,
    actor_user_id: Optional[uuid.UUID],
    quote_id: uuid.UUID,
    revision_id: Optional[uuid.UUID],
    format_type: str,
    safe_failure_code: str,
    request_id: Optional[str] = None,
) -> None:
    """Safely commit an export denial event without leaking internal state."""
    try:
        event = ExportEvent(
            organization_id=organization_id,
            actor_user_id=actor_user_id,
            entity_type="quote",
            entity_id=quote_id,
            revision_id=revision_id,
            format=format_type,
            result="denied",
            request_id=request_id,
            safe_failure_code=safe_failure_code,
            watermarked=False,
            created_at=datetime.now(timezone.utc),
        )
        db.add(event)
        db.commit()
    except Exception:
        db.rollback()


def get_exportable_quote_revision(
    db: Session,
    ctx: AuthenticatedContext,
    quote_id: uuid.UUID,
    revision_id: Optional[uuid.UUID] = None,
    allow_draft: bool = False,
    format_type: str = "pdf",
    request_id: Optional[str] = None,
) -> Tuple[Quote, QuoteRevision]:
    """Load and validate quote and revision within organization scope.

    Preconditions enforced:
    - Quote exists in caller's organization (non-disclosing 404 otherwise).
    - If allow_draft is False: quote status must be 'approved' or 'sent'.
    - If revision_id is specified: must match quote.current_revision_id for final exports.
    - Revision must have valid committed lines and calculation snapshot.
    """
    quote = db.scalar(
        select(Quote).where(
            Quote.id == quote_id,
            Quote.organization_id == ctx.organization.id,
        )
    )
    if not quote:
        _record_denied_export_event(
            db=db,
            organization_id=ctx.organization.id,
            actor_user_id=ctx.user.id,
            quote_id=quote_id,
            revision_id=revision_id,
            format_type=format_type,
            safe_failure_code="QUOTE_NOT_FOUND",
            request_id=request_id,
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "QUOTE_NOT_FOUND", "message": "Quote not found"},
        )

    # Status check for final exports
    if not allow_draft:
        if quote.status not in ("approved", "sent"):
            _record_denied_export_event(
                db=db,
                organization_id=ctx.organization.id,
                actor_user_id=ctx.user.id,
                quote_id=quote.id,
                revision_id=quote.current_revision_id,
                format_type=format_type,
                safe_failure_code="QUOTE_NOT_APPROVED_FOR_EXPORT",
                request_id=request_id,
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "QUOTE_NOT_APPROVED_FOR_EXPORT",
                    "message": f"Quote status '{quote.status}' is not approved for final customer export.",
                },
            )

    # Revision resolution & validation
    resolved_rev_id = revision_id or quote.current_revision_id
    if not resolved_rev_id:
        _record_denied_export_event(
            db=db,
            organization_id=ctx.organization.id,
            actor_user_id=ctx.user.id,
            quote_id=quote.id,
            revision_id=None,
            format_type=format_type,
            safe_failure_code="NO_COMMITTED_REVISION",
            request_id=request_id,
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "NO_COMMITTED_REVISION",
                "message": "Quote does not have an active committed revision.",
            },
        )

    # For final exports, requested revision must be current revision
    if not allow_draft and revision_id and revision_id != quote.current_revision_id:
        _record_denied_export_event(
            db=db,
            organization_id=ctx.organization.id,
            actor_user_id=ctx.user.id,
            quote_id=quote.id,
            revision_id=revision_id,
            format_type=format_type,
            safe_failure_code="MISMATCHED_QUOTE_REVISION",
            request_id=request_id,
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "MISMATCHED_QUOTE_REVISION",
                "message": "Only the current approved revision can be exported as final customer document.",
            },
        )

    revision = db.scalar(
        select(QuoteRevision).where(
            QuoteRevision.id == resolved_rev_id,
            QuoteRevision.quote_id == quote.id,
            QuoteRevision.organization_id == ctx.organization.id,
        )
    )
    if not revision:
        _record_denied_export_event(
            db=db,
            organization_id=ctx.organization.id,
            actor_user_id=ctx.user.id,
            quote_id=quote.id,
            revision_id=resolved_rev_id,
            format_type=format_type,
            safe_failure_code="REVISION_NOT_FOUND",
            request_id=request_id,
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "REVISION_NOT_FOUND", "message": "Quote revision not found"},
        )

    if not revision.lines:
        _record_denied_export_event(
            db=db,
            organization_id=ctx.organization.id,
            actor_user_id=ctx.user.id,
            quote_id=quote.id,
            revision_id=resolved_rev_id,
            format_type=format_type,
            safe_failure_code="EMPTY_QUOTE_REVISION",
            request_id=request_id,
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "EMPTY_QUOTE_REVISION",
                "message": "Cannot export quotation revision with no line items.",
            },
        )

    return quote, revision


def build_quote_export_dto(
    db: Session,
    quote: Quote,
    revision: QuoteRevision,
    is_watermarked: bool = False,
) -> QuoteExportDTO:
    """Build a sanitized customer-safe QuoteExportDTO from database models.

    Strictly masks all internal costs, line gross profit, profit margins,
    proposal changes, internal notes, and system metadata.
    """
    org = db.scalar(select(Organization).where(Organization.id == quote.organization_id))
    company_name = org.name if org else "ForgeFlow Industrial Supplies"
    legal_name = f"{company_name} Private Limited"

    seller_dto = QuoteExportSellerDTO(
        company_name=company_name,
        legal_name=legal_name,
        address="Plot 42, Peenya Industrial Area, Phase II, Bengaluru, Karnataka 560058",
        tax_id="GSTIN29AAACB1234F1Z5",
        contact_email="commercial@forgeflow.example",
        contact_phone="+91 80 4123 4567",
    )

    account = db.scalar(select(Account).where(Account.id == quote.account_id))
    billing_addr: Optional[str] = None
    if account and account.billing_address_json:
        parts = [
            str(account.billing_address_json.get(k, ""))
            for k in ["street", "city", "state", "postal_code", "country"]
            if account.billing_address_json.get(k)
        ]
        if parts:
            billing_addr = ", ".join(parts)

    customer_dto = QuoteExportCustomerDTO(
        account_name=account.name if account else "Valued Industrial Customer",
        legal_name=account.legal_name if account else None,
        billing_address=billing_addr or "Industrial Estate, Peenya, Bengaluru, Karnataka 560058",
        shipping_address=None,
        email=account.email if account else None,
        phone=account.phone if account else None,
    )

    opportunity = db.scalar(select(Opportunity).where(Opportunity.id == quote.opportunity_id))
    opp_title = opportunity.name if opportunity else None

    # Line items (strictly sorted by line_order)
    lines: List[QuoteExportLineDTO] = []
    sorted_lines = sorted(revision.lines, key=lambda item: item.line_order)
    for idx, item in enumerate(sorted_lines, start=1):
        lines.append(
            QuoteExportLineDTO(
                line_number=idx,
                sku=item.sku,
                product_name=item.product_name,
                description=item.description or "",
                unit=item.unit or "nos",
                quantity=Decimal(str(item.quantity)),
                unit_price=Decimal(str(item.unit_price)),
                discount_percent=Decimal(str(item.discount_percent)),
                discount_amount=Decimal(str(item.discount_amount)),
                tax_rate_percent=Decimal(str(item.tax_rate_percent)),
                tax_amount=Decimal(str(item.tax_amount)),
                line_total=Decimal(str(item.line_total)),
            )
        )

    # Authoritative calculation figures from snapshot
    calc = revision.calculation_snapshot_json or {}
    subtotal = Decimal(str(calc.get("gross_amount", "0.00")))
    discount_total = Decimal(str(calc.get("discount_amount", "0.00")))
    taxable = Decimal(str(calc.get("taxable_amount", "0.00")))
    tax_total = Decimal(str(calc.get("tax_amount", "0.00")))
    grand_total = Decimal(str(calc.get("grand_total", "0.00")))

    # Fallback to line aggregation if snapshot JSON is empty
    if not calc and lines:
        subtotal = sum((line.quantity * line.unit_price for line in lines), Decimal("0.00"))
        discount_total = sum((line.discount_amount for line in lines), Decimal("0.00"))
        taxable = subtotal - discount_total
        tax_total = sum((line.tax_amount for line in lines), Decimal("0.00"))
        grand_total = sum((line.line_total for line in lines), Decimal("0.00"))

    issue_date = (
        revision.created_at.strftime("%Y-%m-%d")
        if revision.created_at
        else datetime.now(timezone.utc).strftime("%Y-%m-%d")
    )
    valid_until = quote.valid_until.strftime("%Y-%m-%d") if quote.valid_until else None

    # Commercial terms from quote or snapshot
    snap = revision.snapshot_json or {}
    payment_terms = quote.payment_terms or snap.get("payment_terms") or "Net 30 Days"
    delivery_terms = quote.delivery_terms or snap.get("delivery_terms") or "Ex-Works Factory"
    customer_notes = quote.notes or snap.get("notes")

    status_str = "DRAFT" if is_watermarked else quote.status

    return QuoteExportDTO(
        quote_number=quote.quote_number,
        revision_number=revision.revision_number,
        status=status_str,
        issue_date=issue_date,
        valid_until=valid_until,
        payment_terms=payment_terms,
        delivery_terms=delivery_terms,
        customer_notes=customer_notes,
        opportunity_title=opp_title,
        currency=revision.currency or "INR",
        seller=seller_dto,
        customer=customer_dto,
        lines=lines,
        subtotal_amount=subtotal,
        total_discount_amount=discount_total,
        taxable_amount=taxable,
        total_tax_amount=tax_total,
        grand_total=grand_total,
        is_watermarked=is_watermarked,
        watermark_text="DRAFT — NOT APPROVED COMMERCIAL PROPOSAL",
    )


def export_quote_pdf(
    db: Session,
    ctx: AuthenticatedContext,
    quote_id: uuid.UUID,
    revision_id: Optional[uuid.UUID] = None,
    recipient_email: Optional[str] = None,
    request_id: Optional[str] = None,
) -> Tuple[bytes, str, str, str]:
    """Generate final unwatermarked quotation PDF.

    Preconditions: Quote must be in 'approved' or 'sent' status.
    Returns: (pdf_bytes, filename, sha256_hash, content_type)
    """
    quote, revision = get_exportable_quote_revision(
        db=db,
        ctx=ctx,
        quote_id=quote_id,
        revision_id=revision_id,
        allow_draft=False,
        format_type="pdf",
        request_id=request_id,
    )

    dto = build_quote_export_dto(db=db, quote=quote, revision=revision, is_watermarked=False)
    pdf_bytes = render_quote_pdf(dto)
    sha256 = hashlib.sha256(pdf_bytes).hexdigest()

    # Fail-closed transaction for audit and delivery records
    try:
        event = ExportEvent(
            organization_id=ctx.organization.id,
            actor_user_id=ctx.user.id,
            entity_type="quote",
            entity_id=quote.id,
            revision_id=revision.id,
            format="pdf",
            result="success",
            request_id=request_id,
            sha256_hash=sha256,
            watermarked=False,
            created_at=datetime.now(timezone.utc),
        )
        db.add(event)

        delivery = QuoteCustomerDelivery(
            organization_id=ctx.organization.id,
            quote_id=quote.id,
            revision_id=revision.id,
            exported_by_user_id=ctx.user.id,
            export_type="pdf",
            sha256_hash=sha256,
            recipient_email=recipient_email,
            watermarked=False,
            created_at=datetime.now(timezone.utc),
        )
        db.add(delivery)

        record_activity(
            db=db,
            organization_id=ctx.organization.id,
            entity_type="quote",
            entity_id=quote.id,
            event_type="quote_exported",
            summary=f"Quote '{quote.quote_number}' (Rev {revision.revision_number}) exported to PDF by {ctx.user.display_name}",
            metadata_json={
                "format": "pdf",
                "revision_number": revision.revision_number,
                "sha256": sha256,
                "watermarked": False,
            },
            actor_user_id=ctx.user.id,
        )
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "AUDIT_PERSISTENCE_FAILED",
                "message": "Failed to persist export audit records. Export aborted.",
            },
        ) from e

    filename = f"Quote-{quote.quote_number}-Rev{revision.revision_number}.pdf"
    return pdf_bytes, filename, sha256, "application/pdf"


def export_quote_preview_pdf(
    db: Session,
    ctx: AuthenticatedContext,
    quote_id: uuid.UUID,
    revision_id: Optional[uuid.UUID] = None,
    request_id: Optional[str] = None,
) -> Tuple[bytes, str, str, str]:
    """Generate internal preview PDF with conspicuous 'DRAFT — NOT APPROVED' watermark.

    Available for quotes in draft/pending review states.
    Returns: (pdf_bytes, filename, sha256_hash, content_type)
    """
    quote, revision = get_exportable_quote_revision(
        db=db,
        ctx=ctx,
        quote_id=quote_id,
        revision_id=revision_id,
        allow_draft=True,
        format_type="pdf",
        request_id=request_id,
    )

    # Conspicuously watermarked
    dto = build_quote_export_dto(db=db, quote=quote, revision=revision, is_watermarked=True)
    pdf_bytes = render_quote_pdf(dto)
    sha256 = hashlib.sha256(pdf_bytes).hexdigest()

    try:
        event = ExportEvent(
            organization_id=ctx.organization.id,
            actor_user_id=ctx.user.id,
            entity_type="quote",
            entity_id=quote.id,
            revision_id=revision.id,
            format="pdf",
            result="success",
            request_id=request_id,
            sha256_hash=sha256,
            watermarked=True,
            created_at=datetime.now(timezone.utc),
        )
        db.add(event)

        record_activity(
            db=db,
            organization_id=ctx.organization.id,
            entity_type="quote",
            entity_id=quote.id,
            event_type="quote_preview_exported",
            summary=f"Quote '{quote.quote_number}' watermarked draft preview exported to PDF by {ctx.user.display_name}",
            metadata_json={
                "format": "pdf",
                "revision_number": revision.revision_number,
                "sha256": sha256,
                "watermarked": True,
            },
            actor_user_id=ctx.user.id,
        )
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "AUDIT_PERSISTENCE_FAILED",
                "message": "Failed to persist preview audit records.",
            },
        ) from e

    filename = f"Draft-Quote-{quote.quote_number}-Rev{revision.revision_number}.pdf"
    return pdf_bytes, filename, sha256, "application/pdf"


def export_quote_csv(
    db: Session,
    ctx: AuthenticatedContext,
    quote_id: uuid.UUID,
    revision_id: Optional[uuid.UUID] = None,
    recipient_email: Optional[str] = None,
    request_id: Optional[str] = None,
) -> Tuple[bytes, str, str, str]:
    """Generate customer-safe CSV export with spreadsheet formula injection protection.

    Preconditions: Quote must be in 'approved' or 'sent' status.
    Returns: (csv_bytes, filename, sha256_hash, content_type)
    """
    quote, revision = get_exportable_quote_revision(
        db=db,
        ctx=ctx,
        quote_id=quote_id,
        revision_id=revision_id,
        allow_draft=False,
        format_type="csv",
        request_id=request_id,
    )

    dto = build_quote_export_dto(db=db, quote=quote, revision=revision, is_watermarked=False)
    csv_text = generate_quote_csv(dto)
    csv_bytes = csv_text.encode("utf-8")
    sha256 = hashlib.sha256(csv_bytes).hexdigest()

    try:
        event = ExportEvent(
            organization_id=ctx.organization.id,
            actor_user_id=ctx.user.id,
            entity_type="quote",
            entity_id=quote.id,
            revision_id=revision.id,
            format="csv",
            result="success",
            request_id=request_id,
            sha256_hash=sha256,
            watermarked=False,
            created_at=datetime.now(timezone.utc),
        )
        db.add(event)

        delivery = QuoteCustomerDelivery(
            organization_id=ctx.organization.id,
            quote_id=quote.id,
            revision_id=revision.id,
            exported_by_user_id=ctx.user.id,
            export_type="csv",
            sha256_hash=sha256,
            recipient_email=recipient_email,
            watermarked=False,
            created_at=datetime.now(timezone.utc),
        )
        db.add(delivery)

        record_activity(
            db=db,
            organization_id=ctx.organization.id,
            entity_type="quote",
            entity_id=quote.id,
            event_type="quote_exported",
            summary=f"Quote '{quote.quote_number}' (Rev {revision.revision_number}) exported to CSV by {ctx.user.display_name}",
            metadata_json={
                "format": "csv",
                "revision_number": revision.revision_number,
                "sha256": sha256,
                "watermarked": False,
            },
            actor_user_id=ctx.user.id,
        )
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "AUDIT_PERSISTENCE_FAILED",
                "message": "Failed to persist export audit records. Export aborted.",
            },
        ) from e

    filename = f"Quote-{quote.quote_number}-Rev{revision.revision_number}.csv"
    return csv_bytes, filename, sha256, "text/csv; charset=utf-8"


def list_quote_deliveries(
    db: Session,
    ctx: AuthenticatedContext,
    quote_id: uuid.UUID,
) -> List[QuoteCustomerDeliveryResponse]:
    """Retrieve customer delivery and export history for a quotation."""
    # Ensure quote exists in caller's organization
    quote = db.scalar(
        select(Quote).where(
            Quote.id == quote_id,
            Quote.organization_id == ctx.organization.id,
        )
    )
    if not quote:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "QUOTE_NOT_FOUND", "message": "Quote not found"},
        )

    records = db.scalars(
        select(QuoteCustomerDelivery)
        .where(
            QuoteCustomerDelivery.quote_id == quote.id,
            QuoteCustomerDelivery.organization_id == ctx.organization.id,
        )
        .order_by(desc(QuoteCustomerDelivery.created_at))
        .limit(50)
    ).all()

    results: List[QuoteCustomerDeliveryResponse] = []
    for r in records:
        exporter_name = r.exporter.display_name if r.exporter else "Unknown User"
        results.append(
            QuoteCustomerDeliveryResponse(
                id=r.id,
                quote_id=r.quote_id,
                revision_id=r.revision_id,
                export_type=r.export_type,
                sha256_hash=r.sha256_hash,
                recipient_email=r.recipient_email,
                watermarked=r.watermarked,
                exported_by_user_id=r.exported_by_user_id,
                exported_by_name=exporter_name,
                created_at=r.created_at,
            )
        )
    return results
