"""RFC 4180 CSV export generator with spreadsheet formula injection protection.

Formula Injection Defense (CSV Injection / CWE-1236):
Untrusted textual values that begin with dangerous formula trigger characters
(=, +, -, @, tab, newline, carriage return) are prefixed with a single quote (').
Legitimate numeric types (Decimal, int, float) are strictly distinguished from text
so that negative or positive numeric figures are never corrupted.
"""

import csv
import io
from decimal import Decimal
from typing import Any

from app.domain.exports.dto import QuoteExportDTO

DANGEROUS_PREFIXES = ("=", "+", "-", "@", "\t", "\r", "\n")


def sanitize_csv_cell(value: Any) -> Any:
    """Sanitize cell value to prevent CSV / Spreadsheet formula injection.

    Only string inputs are checked and prefixed if their leading character could be
    interpreted as a formula trigger by spreadsheet processors (Excel, LibreOffice, Google Sheets).
    Numeric instances (Decimal, int, float) are preserved verbatim.
    """
    if value is None:
        return ""

    # Typed numerics are safe and must never be corrupted with apostrophes
    if isinstance(value, (int, float, Decimal)):
        return str(value)

    if isinstance(value, str):
        # Strip spaces only so tabs/newlines/returns are preserved as potential trigger characters
        stripped_spaces = value.lstrip(" ")
        if stripped_spaces and stripped_spaces[0] in DANGEROUS_PREFIXES:
            return f"'{value}"
        return value

    return str(value)


def generate_quote_csv(dto: QuoteExportDTO) -> str:
    """Generate an RFC 4180 compliant CSV string from a customer-safe QuoteExportDTO."""
    out = io.StringIO()
    writer = csv.writer(out, dialect="excel", quoting=csv.QUOTE_MINIMAL, lineterminator="\r\n")

    # Header Metadata Block
    writer.writerow([sanitize_csv_cell("Quotation Number"), sanitize_csv_cell(dto.quote_number)])
    writer.writerow(
        [sanitize_csv_cell("Revision Number"), sanitize_csv_cell(str(dto.revision_number))]
    )
    writer.writerow([sanitize_csv_cell("Status"), sanitize_csv_cell(dto.status.upper())])
    writer.writerow([sanitize_csv_cell("Issue Date"), sanitize_csv_cell(dto.issue_date)])
    writer.writerow(
        [
            sanitize_csv_cell("Valid Until"),
            sanitize_csv_cell(dto.valid_until or "No valid expiry date"),
        ]
    )
    writer.writerow([sanitize_csv_cell("Currency"), sanitize_csv_cell(dto.currency)])
    writer.writerow(
        [
            sanitize_csv_cell("Seller Organization"),
            sanitize_csv_cell(dto.seller.company_name),
        ]
    )
    writer.writerow(
        [
            sanitize_csv_cell("Customer Account"),
            sanitize_csv_cell(dto.customer.account_name),
        ]
    )
    if dto.opportunity_title:
        writer.writerow(
            [
                sanitize_csv_cell("Opportunity"),
                sanitize_csv_cell(dto.opportunity_title),
            ]
        )
    if dto.payment_terms:
        writer.writerow(
            [
                sanitize_csv_cell("Payment Terms"),
                sanitize_csv_cell(dto.payment_terms),
            ]
        )
    if dto.delivery_terms:
        writer.writerow(
            [
                sanitize_csv_cell("Delivery Terms"),
                sanitize_csv_cell(dto.delivery_terms),
            ]
        )

    # Empty separator row
    writer.writerow([])

    # Table Column Headers
    headers = [
        "Line #",
        "SKU",
        "Product Name",
        "Description",
        "Unit",
        "Quantity",
        "Unit Price",
        "Discount %",
        "Tax Rate %",
        "Line Total",
    ]
    writer.writerow([sanitize_csv_cell(h) for h in headers])

    # Line Items
    for line in dto.lines:
        row = [
            sanitize_csv_cell(line.line_number),
            sanitize_csv_cell(line.sku),
            sanitize_csv_cell(line.product_name),
            sanitize_csv_cell(line.description),
            sanitize_csv_cell(line.unit),
            sanitize_csv_cell(line.quantity),
            sanitize_csv_cell(line.unit_price),
            sanitize_csv_cell(line.discount_percent),
            sanitize_csv_cell(line.tax_rate_percent),
            sanitize_csv_cell(line.line_total),
        ]
        writer.writerow(row)

    # Empty separator row
    writer.writerow([])

    # Financial Summary Block
    writer.writerow(
        ["", "", "", "", "", "", "", "", "Subtotal", sanitize_csv_cell(dto.subtotal_amount)]
    )
    writer.writerow(
        [
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "Discount Total",
            sanitize_csv_cell(dto.total_discount_amount),
        ]
    )
    writer.writerow(
        ["", "", "", "", "", "", "", "", "Taxable Amount", sanitize_csv_cell(dto.taxable_amount)]
    )
    writer.writerow(
        ["", "", "", "", "", "", "", "", "Tax Total", sanitize_csv_cell(dto.total_tax_amount)]
    )
    writer.writerow(
        ["", "", "", "", "", "", "", "", "Grand Total", sanitize_csv_cell(dto.grand_total)]
    )

    # Notes if present
    if dto.customer_notes:
        writer.writerow([])
        writer.writerow(
            [sanitize_csv_cell("Customer Notes"), sanitize_csv_cell(dto.customer_notes)]
        )

    return out.getvalue()
