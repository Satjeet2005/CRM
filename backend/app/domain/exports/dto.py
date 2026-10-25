"""Customer-safe export projection Data Transfer Objects.

Strict commercial confidentiality: Internal unit costs, line costs, gross profit,
margin percentages, matcher candidates, internal notes, and auth tokens are
strictly excluded from all customer-facing export DTOs.
"""

from dataclasses import dataclass, field
from decimal import Decimal
from typing import List, Optional


@dataclass(frozen=True)
class QuoteExportLineDTO:
    line_number: int
    sku: str
    product_name: str
    description: str
    unit: str
    quantity: Decimal
    unit_price: Decimal
    discount_percent: Decimal
    discount_amount: Decimal
    tax_rate_percent: Decimal
    tax_amount: Decimal
    line_total: Decimal


@dataclass(frozen=True)
class QuoteExportSellerDTO:
    company_name: str
    legal_name: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None  # e.g. GSTIN
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None


@dataclass(frozen=True)
class QuoteExportCustomerDTO:
    account_name: str
    legal_name: Optional[str] = None
    billing_address: Optional[str] = None
    shipping_address: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


@dataclass(frozen=True)
class QuoteExportDTO:
    quote_number: str
    revision_number: int
    status: str
    issue_date: str
    valid_until: Optional[str]
    payment_terms: Optional[str]
    delivery_terms: Optional[str]
    customer_notes: Optional[str]
    opportunity_title: Optional[str]
    currency: str
    seller: QuoteExportSellerDTO
    customer: QuoteExportCustomerDTO
    lines: List[QuoteExportLineDTO] = field(default_factory=list)
    subtotal_amount: Decimal = Decimal("0.00")
    total_discount_amount: Decimal = Decimal("0.00")
    taxable_amount: Decimal = Decimal("0.00")
    total_tax_amount: Decimal = Decimal("0.00")
    grand_total: Decimal = Decimal("0.00")
    is_watermarked: bool = False
    watermark_text: str = "DRAFT — NOT APPROVED COMMERCIAL PROPOSAL"
