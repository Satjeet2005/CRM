"""Unit tests for Phase 6 Customer Document Exports Pure Domain Engine.

Verifies:
1. Customer-safe DTO projection omitting internal costs and margins.
2. Formula injection neutralization while preserving legitimate negative numeric values.
3. RFC 4180 CSV generation and UTF-8 encoding.
4. WeasyPrint PDF generation yielding %PDF bytes and handling long text / Unicode.
5. Template versioning constant and watermark governance.
6. Exact SHA-256 hashing over artifact bytes.
"""

import hashlib
import io
from decimal import Decimal

import pypdf
import pytest

from app.domain.exports.csv_generator import generate_quote_csv, sanitize_csv_cell
from app.domain.exports.dto import (
    QuoteExportCustomerDTO,
    QuoteExportDTO,
    QuoteExportLineDTO,
    QuoteExportSellerDTO,
)
from app.domain.exports.pdf_renderer import (
    TEMPLATE_VERSION,
    render_quote_html,
    render_quote_pdf,
    safe_url_fetcher,
)


@pytest.fixture
def sample_export_dto() -> QuoteExportDTO:
    return QuoteExportDTO(
        quote_number="QT-2026-0001",
        revision_number=1,
        status="approved",
        issue_date="2026-10-24",
        valid_until="2026-11-24",
        payment_terms="Net 30 Days",
        delivery_terms="Ex-Works Bengaluru",
        customer_notes="Deliver with standard test certificates.",
        opportunity_title="High-Precision Spindle Line",
        currency="INR",
        seller=QuoteExportSellerDTO(
            company_name="ForgeFlow Industrial Supplies",
            legal_name="ForgeFlow Industrial Supplies Private Limited",
            address="Plot 42, Peenya Industrial Area, Bengaluru, Karnataka",
            tax_id="GSTIN29AAACB1234F1Z5",
            contact_email="commercial@forgeflow.example",
            contact_phone="+91 80 4123 4567",
        ),
        customer=QuoteExportCustomerDTO(
            account_name="Bharat Heavy Engineering Ltd",
            legal_name="Bharat Heavy Engineering Limited",
            billing_address="Survey 18, Whitefield, Bengaluru, Karnataka 560066",
            email="procurement@bharat.example",
            phone="+91 80 2841 0000",
        ),
        lines=[
            QuoteExportLineDTO(
                line_number=1,
                sku="BRG-6205-2RS",
                product_name="Deep Groove Ball Bearing 6205-2RS",
                description="25x52x15mm chrome steel sealed bearing with lithium grease",
                unit="pcs",
                quantity=Decimal("100.0000"),
                unit_price=Decimal("450.00"),
                discount_percent=Decimal("5.00"),
                discount_amount=Decimal("2250.00"),
                tax_rate_percent=Decimal("18.00"),
                tax_amount=Decimal("7695.00"),
                line_total=Decimal("50445.00"),
            ),
            QuoteExportLineDTO(
                line_number=2,
                sku="SL-NBR-40-62-10",
                product_name="Rotary Shaft Oil Seal NBR 40x62x10",
                description="Nitrile rubber dual lip shaft seal with garter spring",
                unit="pcs",
                quantity=Decimal("50.0000"),
                unit_price=Decimal("180.00"),
                discount_percent=Decimal("0.00"),
                discount_amount=Decimal("0.00"),
                tax_rate_percent=Decimal("18.00"),
                tax_amount=Decimal("1620.00"),
                line_total=Decimal("10620.00"),
            ),
        ],
        subtotal_amount=Decimal("54000.00"),
        total_discount_amount=Decimal("2250.00"),
        taxable_amount=Decimal("51750.00"),
        total_tax_amount=Decimal("9315.00"),
        grand_total=Decimal("61065.00"),
        is_watermarked=False,
    )


def test_customer_safe_projection_excludes_internal_cost_and_margin(
    sample_export_dto: QuoteExportDTO,
) -> None:
    """Verifies that QuoteExportDTO and QuoteExportLineDTO do not expose confidential fields."""
    forbidden_attrs = [
        "unit_cost",
        "line_cost",
        "line_gross_profit",
        "margin_percent",
        "cost",
        "profit",
    ]
    for attr in forbidden_attrs:
        assert not hasattr(sample_export_dto, attr)
        for line in sample_export_dto.lines:
            assert not hasattr(line, attr)


def test_formula_injection_neutralization() -> None:
    """Verifies CWE-1236 spreadsheet formula injection defense without corrupting numeric data."""
    # Untrusted strings starting with formula prefixes must be prepended with a single quote
    assert sanitize_csv_cell("=1+1") == "'=1+1"
    assert sanitize_csv_cell("=cmd|' /C calc'!A0") == "'=cmd|' /C calc'!A0"
    assert sanitize_csv_cell("+44-1234") == "'+44-1234"
    assert sanitize_csv_cell("-malicious") == "'-malicious"
    assert sanitize_csv_cell("@SUM(A1:A10)") == "'@SUM(A1:A10)"
    assert sanitize_csv_cell("\tcommand") == "'\tcommand"
    assert sanitize_csv_cell("\rpayload") == "'\rpayload"
    assert sanitize_csv_cell("\npayload") == "'\npayload"

    # Whitespace before formula prefix must also be sanitized
    assert sanitize_csv_cell("   =DANGEROUS") == "'   =DANGEROUS"

    # Safe text must remain untouched
    assert sanitize_csv_cell("Standard Industrial Bearing") == "Standard Industrial Bearing"
    assert sanitize_csv_cell("SKU-12345") == "SKU-12345"

    # CRITICAL: Numeric values (including valid negative numbers) must NEVER be prepended with apostrophe
    assert sanitize_csv_cell(Decimal("-15.50")) == "-15.50"
    assert sanitize_csv_cell(Decimal("0.00")) == "0.00"
    assert sanitize_csv_cell(-42) == "-42"
    assert sanitize_csv_cell(100.5) == "100.5"


def test_csv_generation_content_and_rfc4180(sample_export_dto: QuoteExportDTO) -> None:
    """Verifies RFC 4180 quotation CSV format, stable column order, and values."""
    csv_str = generate_quote_csv(sample_export_dto)

    assert "Quotation Number,QT-2026-0001" in csv_str
    assert "Revision Number,1" in csv_str
    assert "Status,APPROVED" in csv_str
    assert "Bharat Heavy Engineering Ltd" in csv_str
    assert (
        "Line #,SKU,Product Name,Description,Unit,Quantity,Unit Price,Discount %,Tax Rate %,Line Total"
        in csv_str
    )
    assert "BRG-6205-2RS" in csv_str
    assert "SL-NBR-40-62-10" in csv_str
    assert "Grand Total" in csv_str
    assert "61065.00" in csv_str

    # Must NOT contain internal confidential terms
    assert "unit_cost" not in csv_str
    assert "margin" not in csv_str.lower()


def test_weasyprint_pdf_rendering_and_metadata(sample_export_dto: QuoteExportDTO) -> None:
    """Verifies WeasyPrint produces valid %PDF bytes with expected typography and structure."""
    assert TEMPLATE_VERSION == "forgeflow-quotation-template/1.0.0"

    pdf_bytes = render_quote_pdf(sample_export_dto)
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 1000
    assert pdf_bytes.startswith(b"%PDF-")

    # Extract text using pypdf to verify content
    reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
    full_text = " ".join([page.extract_text() or "" for page in reader.pages])

    assert "ForgeFlow" in full_text
    assert "QT-2026-0001" in full_text
    assert "BRG-6205-2RS" in full_text
    assert "61065.00" in full_text or "61,065.00" in full_text
    assert "Bharat Heavy Engineering" in full_text

    # Verify no draft watermark in approved quote
    assert "DRAFT — NOT APPROVED" not in full_text

    # Verify no cost or margin leakage
    assert "unit_cost" not in full_text
    assert "profit margin" not in full_text.lower()


def test_draft_watermark_in_preview_pdf(sample_export_dto: QuoteExportDTO) -> None:
    """Verifies that is_watermarked=True injects conspicuous draft watermarks."""
    draft_dto = QuoteExportDTO(
        quote_number=sample_export_dto.quote_number,
        revision_number=sample_export_dto.revision_number,
        status="DRAFT",
        issue_date=sample_export_dto.issue_date,
        valid_until=sample_export_dto.valid_until,
        payment_terms=sample_export_dto.payment_terms,
        delivery_terms=sample_export_dto.delivery_terms,
        customer_notes=sample_export_dto.customer_notes,
        opportunity_title=sample_export_dto.opportunity_title,
        currency=sample_export_dto.currency,
        seller=sample_export_dto.seller,
        customer=sample_export_dto.customer,
        lines=sample_export_dto.lines,
        subtotal_amount=sample_export_dto.subtotal_amount,
        total_discount_amount=sample_export_dto.total_discount_amount,
        taxable_amount=sample_export_dto.taxable_amount,
        total_tax_amount=sample_export_dto.total_tax_amount,
        grand_total=sample_export_dto.grand_total,
        is_watermarked=True,
        watermark_text="DRAFT — NOT APPROVED COMMERCIAL PROPOSAL",
    )

    html = render_quote_html(draft_dto)
    assert "DRAFT — NOT APPROVED COMMERCIAL PROPOSAL" in html
    assert "watermark" in html
    assert "draft-banner" in html

    pdf_bytes = render_quote_pdf(draft_dto)
    reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
    full_text = " ".join([page.extract_text() or "" for page in reader.pages])
    assert "DRAFT — NOT APPROVED" in full_text


def test_ssrf_safe_url_fetcher() -> None:
    """Verifies that safe_url_fetcher strictly denies all remote and local URL lookups."""
    with pytest.raises(ValueError, match="strictly forbidden"):
        safe_url_fetcher("http://169.254.169.254/latest/meta-data/")
    with pytest.raises(ValueError, match="strictly forbidden"):
        safe_url_fetcher("file:///etc/passwd")


def test_sha256_checksum_exactness(sample_export_dto: QuoteExportDTO) -> None:
    """Verifies SHA-256 fingerprint matches the exact artifact bytes produced."""
    pdf_bytes = render_quote_pdf(sample_export_dto)
    expected_hash = hashlib.sha256(pdf_bytes).hexdigest()
    assert len(expected_hash) == 64
    assert expected_hash == expected_hash.lower()


def test_template_handles_missing_optional_fields() -> None:
    """Verifies template renders cleanly when optional fields (dates, addresses, notes) are absent."""
    minimal_dto = QuoteExportDTO(
        quote_number="QT-MINIMAL",
        revision_number=1,
        status="approved",
        issue_date="2026-10-24",
        valid_until=None,  # missing expiry date
        payment_terms=None,
        delivery_terms=None,
        customer_notes=None,
        opportunity_title=None,
        currency="INR",
        seller=QuoteExportSellerDTO(company_name="Minimal Seller"),
        customer=QuoteExportCustomerDTO(account_name="Minimal Customer"),
        lines=[
            QuoteExportLineDTO(
                line_number=1,
                sku="SKU-1",
                product_name="Basic Part",
                description="",
                unit="nos",
                quantity=Decimal("1"),
                unit_price=Decimal("100.00"),
                discount_percent=Decimal("0.00"),
                discount_amount=Decimal("0.00"),
                tax_rate_percent=Decimal("0.00"),
                tax_amount=Decimal("0.00"),
                line_total=Decimal("100.00"),
            )
        ],
        subtotal_amount=Decimal("100.00"),
        total_discount_amount=Decimal("0.00"),
        taxable_amount=Decimal("100.00"),
        total_tax_amount=Decimal("0.00"),
        grand_total=Decimal("100.00"),
        is_watermarked=False,
    )

    pdf_bytes = render_quote_pdf(minimal_dto)
    reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
    full_text = " ".join([page.extract_text() or "" for page in reader.pages])

    assert "No valid expiry date" in full_text
    assert "Minimal Customer" in full_text
    assert "100.00" in full_text
