"""
Authoritative pure-Python Decimal quote calculator for ForgeFlow.
Operates with explicit ROUND_HALF_UP rounding and zero web or database dependencies.
"""

import hashlib
import json
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, Dict, List, Optional, Union

from app.domain.quotes.money import parse_decimal, round_currency, round_percent
from app.domain.quotes.trace import TraceNode

CALCULATOR_VERSION = "forgeflow-quote-calculator/1.0.0"
ROUNDING_MODE_DESCRIPTION = (
    "ROUND_HALF_UP (2 decimal places for currency, 4 for quantity, 2 for percent)"
)


@dataclass
class QuoteLineInput:
    line_id: str
    line_order: int
    sku: str
    name: str
    description: str
    unit: str
    quantity: Decimal
    unit_price: Decimal
    discount_percent: Decimal = field(default_factory=lambda: Decimal("0.00"))
    tax_rate_percent: Decimal = field(default_factory=lambda: Decimal("18.00"))
    unit_cost: Optional[Decimal] = None
    rfq_line_id: Optional[str] = None
    catalog_product_id: Optional[str] = None

    def __post_init__(self) -> None:
        self.quantity = parse_decimal(self.quantity, "quantity")
        self.unit_price = parse_decimal(self.unit_price, "unit_price")
        self.discount_percent = parse_decimal(self.discount_percent, "discount_percent")
        self.tax_rate_percent = parse_decimal(self.tax_rate_percent, "tax_rate_percent")
        if self.unit_cost is not None:
            self.unit_cost = parse_decimal(self.unit_cost, "unit_cost")

        # Validation rules
        if self.quantity <= Decimal("0"):
            raise ValueError(
                f"Line '{self.line_id}': Quantity must be strictly greater than 0, got {self.quantity}"
            )
        if self.unit_price < Decimal("0"):
            raise ValueError(
                f"Line '{self.line_id}': Unit price cannot be negative, got {self.unit_price}"
            )
        if self.discount_percent < Decimal("0") or self.discount_percent > Decimal("100"):
            raise ValueError(
                f"Line '{self.line_id}': Discount percent must be between 0 and 100, got {self.discount_percent}"
            )
        if self.tax_rate_percent < Decimal("0") or self.tax_rate_percent > Decimal("100"):
            raise ValueError(
                f"Line '{self.line_id}': Tax rate percent must be between 0 and 100, got {self.tax_rate_percent}"
            )
        if self.unit_cost is not None and self.unit_cost < Decimal("0"):
            raise ValueError(
                f"Line '{self.line_id}': Unit cost cannot be negative, got {self.unit_cost}"
            )


@dataclass
class QuoteCalculationInput:
    lines: List[QuoteLineInput]
    currency: str = "INR"


@dataclass
class LineCalculationResult:
    line_id: str
    line_order: int
    sku: str
    name: str
    description: str
    unit: str
    quantity: Decimal
    unit_price: Decimal
    discount_percent: Decimal
    tax_rate_percent: Decimal
    gross_amount: Decimal
    discount_amount: Decimal
    taxable_amount: Decimal
    tax_amount: Decimal
    line_total: Decimal
    unit_cost: Optional[Decimal] = None
    line_cost: Optional[Decimal] = None
    line_gross_profit: Optional[Decimal] = None
    margin_percent: Optional[Decimal] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "line_id": self.line_id,
            "line_order": self.line_order,
            "sku": self.sku,
            "name": self.name,
            "description": self.description,
            "unit": self.unit,
            "quantity": str(self.quantity),
            "unit_price": str(self.unit_price),
            "discount_percent": str(self.discount_percent),
            "tax_rate_percent": str(self.tax_rate_percent),
            "gross_amount": str(self.gross_amount),
            "discount_amount": str(self.discount_amount),
            "taxable_amount": str(self.taxable_amount),
            "tax_amount": str(self.tax_amount),
            "line_total": str(self.line_total),
            "unit_cost": str(self.unit_cost) if self.unit_cost is not None else None,
            "line_cost": str(self.line_cost) if self.line_cost is not None else None,
            "line_gross_profit": str(self.line_gross_profit)
            if self.line_gross_profit is not None
            else None,
            "margin_percent": str(self.margin_percent) if self.margin_percent is not None else None,
        }


@dataclass
class QuoteTotals:
    subtotal: Decimal
    total_discount: Decimal
    taxable_subtotal: Decimal
    tax_total: Decimal
    grand_total: Decimal
    total_cost: Optional[Decimal] = None
    total_gross_profit: Optional[Decimal] = None
    overall_margin_percent: Optional[Decimal] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "subtotal": str(self.subtotal),
            "total_discount": str(self.total_discount),
            "taxable_subtotal": str(self.taxable_subtotal),
            "tax_total": str(self.tax_total),
            "grand_total": str(self.grand_total),
            "total_cost": str(self.total_cost) if self.total_cost is not None else None,
            "total_gross_profit": str(self.total_gross_profit)
            if self.total_gross_profit is not None
            else None,
            "overall_margin_percent": str(self.overall_margin_percent)
            if self.overall_margin_percent is not None
            else None,
        }


@dataclass
class QuoteCalculationResult:
    totals: QuoteTotals
    lines: List[LineCalculationResult]
    currency: str
    calculator_version: str
    input_fingerprint: str
    trace: List[TraceNode]

    def to_snapshot_json(self) -> Dict[str, Any]:
        return {
            "calculator_version": self.calculator_version,
            "currency": self.currency,
            "input_fingerprint": self.input_fingerprint,
            "rounding_mode": ROUNDING_MODE_DESCRIPTION,
            "totals": self.totals.to_dict(),
            "lines": [line.to_dict() for line in self.lines],
            "trace": [node.to_dict() for node in self.trace],
        }


def compute_input_fingerprint(currency: str, lines: List[QuoteLineInput]) -> str:
    """
    Compute a deterministic SHA-256 digest of canonical ordered JSON inputs.
    """
    canonical_payload = {
        "calculator_version": CALCULATOR_VERSION,
        "currency": currency,
        "lines": [
            {
                "line_id": str(line.line_id),
                "line_order": line.line_order,
                "sku": line.sku,
                "name": line.name,
                "unit": line.unit,
                "quantity": f"{line.quantity:.4f}",
                "unit_price": f"{line.unit_price:.2f}",
                "discount_percent": f"{line.discount_percent:.2f}",
                "tax_rate_percent": f"{line.tax_rate_percent:.2f}",
                "unit_cost": f"{line.unit_cost:.2f}" if line.unit_cost is not None else None,
            }
            for line in sorted(lines, key=lambda ln: (ln.line_order, ln.line_id))
        ],
    }
    raw_json = json.dumps(canonical_payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw_json.encode("utf-8")).hexdigest()


def calculate_quote(
    lines_or_input: Union[List[QuoteLineInput], QuoteCalculationInput],
    currency: str = "INR",
) -> QuoteCalculationResult:
    """
    Authoritative pure Decimal calculation for an RFQ or Quote.
    Follows strictly defined PRD Section 6.8 line-by-line formulas:
      gross_amount    = round_currency(quantity * unit_price)
      discount_amount = round_currency(gross_amount * discount_percent / 100)
      taxable_amount  = gross_amount - discount_amount
      tax_amount      = round_currency(taxable_amount * tax_rate_percent / 100)
      line_total      = taxable_amount + tax_amount

    Totals are the exact sum of line-level rounded values.
    """
    if isinstance(lines_or_input, QuoteCalculationInput):
        lines = lines_or_input.lines
        curr = lines_or_input.currency
    else:
        lines = lines_or_input
        curr = currency

    if not lines:
        raise ValueError("Cannot calculate quote with zero line items.")

    sorted_lines = sorted(lines, key=lambda ln: ln.line_order)
    computed_lines: List[LineCalculationResult] = []
    traces: List[TraceNode] = []

    subtotal = Decimal("0.00")
    total_discount = Decimal("0.00")
    taxable_subtotal = Decimal("0.00")
    tax_total = Decimal("0.00")
    grand_total = Decimal("0.00")

    total_cost_acc = Decimal("0.00")
    all_lines_have_cost = True

    one_hundred = Decimal("100.00")

    for line in sorted_lines:
        prefix = f"line:{line.line_order}"

        # 1. Gross Amount: round_currency(quantity * unit_price)
        raw_gross = line.quantity * line.unit_price
        gross_amount = round_currency(raw_gross)
        traces.append(
            TraceNode(
                output_key=f"{prefix}:gross_amount",
                label=f"Line #{line.line_order} ({line.sku}) Gross Amount",
                inputs={"quantity": str(line.quantity), "unit_price": str(line.unit_price)},
                operation="multiply",
                formula_text=f"{line.quantity} × {line.unit_price} = {gross_amount}",
                rounding="round_currency(ROUND_HALF_UP, 2 decimals)",
                result=str(gross_amount),
                is_internal=False,
            )
        )

        # 2. Discount Amount: round_currency(gross_amount * discount_percent / 100)
        raw_discount = (gross_amount * line.discount_percent) / one_hundred
        discount_amount = round_currency(raw_discount)
        traces.append(
            TraceNode(
                output_key=f"{prefix}:discount_amount",
                label=f"Line #{line.line_order} ({line.sku}) Discount ({line.discount_percent}%)",
                inputs={
                    "gross_amount": str(gross_amount),
                    "discount_percent": str(line.discount_percent),
                },
                operation="percentage",
                formula_text=f"{gross_amount} × {line.discount_percent}% = {discount_amount}",
                rounding="round_currency(ROUND_HALF_UP, 2 decimals)",
                result=str(discount_amount),
                is_internal=False,
            )
        )

        # 3. Taxable Amount: gross_amount - discount_amount
        taxable_amount = gross_amount - discount_amount
        traces.append(
            TraceNode(
                output_key=f"{prefix}:taxable_amount",
                label=f"Line #{line.line_order} ({line.sku}) Taxable Amount",
                inputs={"gross_amount": str(gross_amount), "discount_amount": str(discount_amount)},
                operation="subtract",
                formula_text=f"{gross_amount} - {discount_amount} = {taxable_amount}",
                rounding="exact (subtraction of rounded values)",
                result=str(taxable_amount),
                is_internal=False,
            )
        )

        # 4. Tax Amount: round_currency(taxable_amount * tax_rate_percent / 100)
        raw_tax = (taxable_amount * line.tax_rate_percent) / one_hundred
        tax_amount = round_currency(raw_tax)
        traces.append(
            TraceNode(
                output_key=f"{prefix}:tax_amount",
                label=f"Line #{line.line_order} ({line.sku}) Tax ({line.tax_rate_percent}%)",
                inputs={
                    "taxable_amount": str(taxable_amount),
                    "tax_rate_percent": str(line.tax_rate_percent),
                },
                operation="percentage",
                formula_text=f"{taxable_amount} × {line.tax_rate_percent}% = {tax_amount}",
                rounding="round_currency(ROUND_HALF_UP, 2 decimals)",
                result=str(tax_amount),
                is_internal=False,
            )
        )

        # 5. Line Total: taxable_amount + tax_amount
        line_total = taxable_amount + tax_amount
        traces.append(
            TraceNode(
                output_key=f"{prefix}:line_total",
                label=f"Line #{line.line_order} ({line.sku}) Line Total",
                inputs={"taxable_amount": str(taxable_amount), "tax_amount": str(tax_amount)},
                operation="add",
                formula_text=f"{taxable_amount} + {tax_amount} = {line_total}",
                rounding="exact (addition of rounded values)",
                result=str(line_total),
                is_internal=False,
            )
        )

        # Optional Internal Cost & Margin Calculation
        line_cost: Optional[Decimal] = None
        line_gross_profit: Optional[Decimal] = None
        margin_percent: Optional[Decimal] = None

        if line.unit_cost is not None:
            raw_line_cost = line.quantity * line.unit_cost
            line_cost = round_currency(raw_line_cost)
            line_gross_profit = round_currency(taxable_amount - line_cost)

            if taxable_amount > Decimal("0.00"):
                raw_margin = (line_gross_profit / taxable_amount) * one_hundred
                margin_percent = round_percent(raw_margin)
            else:
                margin_percent = None

            total_cost_acc += line_cost

            traces.append(
                TraceNode(
                    output_key=f"{prefix}:line_cost",
                    label=f"Line #{line.line_order} Internal Line Cost",
                    inputs={"quantity": str(line.quantity), "unit_cost": str(line.unit_cost)},
                    operation="multiply",
                    formula_text=f"{line.quantity} × {line.unit_cost} = {line_cost}",
                    rounding="round_currency(ROUND_HALF_UP, 2 decimals)",
                    result=str(line_cost),
                    is_internal=True,
                )
            )
            traces.append(
                TraceNode(
                    output_key=f"{prefix}:gross_profit",
                    label=f"Line #{line.line_order} Internal Gross Profit",
                    inputs={"taxable_amount": str(taxable_amount), "line_cost": str(line_cost)},
                    operation="subtract",
                    formula_text=f"{taxable_amount} - {line_cost} = {line_gross_profit}",
                    rounding="round_currency(ROUND_HALF_UP, 2 decimals)",
                    result=str(line_gross_profit),
                    is_internal=True,
                )
            )
            if margin_percent is not None:
                traces.append(
                    TraceNode(
                        output_key=f"{prefix}:margin_percent",
                        label=f"Line #{line.line_order} Internal Margin %",
                        inputs={
                            "line_gross_profit": str(line_gross_profit),
                            "taxable_amount": str(taxable_amount),
                        },
                        operation="percentage",
                        formula_text=f"({line_gross_profit} / {taxable_amount}) × 100 = {margin_percent}%",
                        rounding="round_percent(ROUND_HALF_UP, 2 decimals)",
                        result=f"{margin_percent}%",
                        is_internal=True,
                    )
                )
        else:
            all_lines_have_cost = False

        computed_lines.append(
            LineCalculationResult(
                line_id=line.line_id,
                line_order=line.line_order,
                sku=line.sku,
                name=line.name,
                description=line.description,
                unit=line.unit,
                quantity=line.quantity,
                unit_price=line.unit_price,
                discount_percent=line.discount_percent,
                tax_rate_percent=line.tax_rate_percent,
                gross_amount=gross_amount,
                discount_amount=discount_amount,
                taxable_amount=taxable_amount,
                tax_amount=tax_amount,
                line_total=line_total,
                unit_cost=line.unit_cost,
                line_cost=line_cost,
                line_gross_profit=line_gross_profit,
                margin_percent=margin_percent,
            )
        )

        subtotal += gross_amount
        total_discount += discount_amount
        taxable_subtotal += taxable_amount
        tax_total += tax_amount
        grand_total += line_total

    # Add Quote Total Traces
    traces.append(
        TraceNode(
            output_key="quote:subtotal",
            label="Quote Subtotal (Sum of line gross amounts)",
            inputs={f"line_{ln.line_order}": str(ln.gross_amount) for ln in computed_lines},
            operation="sum",
            formula_text=" + ".join(str(ln.gross_amount) for ln in computed_lines)
            + f" = {subtotal}",
            rounding="exact (sum of line gross amounts)",
            result=str(subtotal),
            is_internal=False,
        )
    )
    traces.append(
        TraceNode(
            output_key="quote:total_discount",
            label="Quote Total Discount (Sum of line discounts)",
            inputs={f"line_{ln.line_order}": str(ln.discount_amount) for ln in computed_lines},
            operation="sum",
            formula_text=" + ".join(str(ln.discount_amount) for ln in computed_lines)
            + f" = {total_discount}",
            rounding="exact (sum of line discount amounts)",
            result=str(total_discount),
            is_internal=False,
        )
    )
    traces.append(
        TraceNode(
            output_key="quote:taxable_subtotal",
            label="Quote Taxable Subtotal",
            inputs={f"line_{ln.line_order}": str(ln.taxable_amount) for ln in computed_lines},
            operation="sum",
            formula_text=" + ".join(str(ln.taxable_amount) for ln in computed_lines)
            + f" = {taxable_subtotal}",
            rounding="exact (sum of line taxable amounts)",
            result=str(taxable_subtotal),
            is_internal=False,
        )
    )
    traces.append(
        TraceNode(
            output_key="quote:tax_total",
            label="Quote Total Tax",
            inputs={f"line_{ln.line_order}": str(ln.tax_amount) for ln in computed_lines},
            operation="sum",
            formula_text=" + ".join(str(ln.tax_amount) for ln in computed_lines)
            + f" = {tax_total}",
            rounding="exact (sum of line tax amounts)",
            result=str(tax_total),
            is_internal=False,
        )
    )
    traces.append(
        TraceNode(
            output_key="quote:grand_total",
            label="Quote Grand Total",
            inputs={f"line_{ln.line_order}": str(ln.line_total) for ln in computed_lines},
            operation="sum",
            formula_text=" + ".join(str(ln.line_total) for ln in computed_lines)
            + f" = {grand_total}",
            rounding="exact (sum of line totals)",
            result=str(grand_total),
            is_internal=False,
        )
    )

    # Quote-level Cost & Margin
    total_cost: Optional[Decimal] = None
    total_gross_profit: Optional[Decimal] = None
    overall_margin_percent: Optional[Decimal] = None

    if all_lines_have_cost:
        total_cost = total_cost_acc
        total_gross_profit = taxable_subtotal - total_cost
        if taxable_subtotal > Decimal("0.00"):
            raw_overall_margin = (total_gross_profit / taxable_subtotal) * one_hundred
            overall_margin_percent = round_percent(raw_overall_margin)

        traces.append(
            TraceNode(
                output_key="quote:total_cost",
                label="Quote Total Cost",
                inputs={f"line_{ln.line_order}": str(ln.line_cost) for ln in computed_lines},
                operation="sum",
                formula_text=" + ".join(str(ln.line_cost) for ln in computed_lines)
                + f" = {total_cost}",
                rounding="exact (sum of line costs)",
                result=str(total_cost),
                is_internal=True,
            )
        )
        traces.append(
            TraceNode(
                output_key="quote:overall_margin_percent",
                label="Quote Overall Margin %",
                inputs={
                    "total_gross_profit": str(total_gross_profit),
                    "taxable_subtotal": str(taxable_subtotal),
                },
                operation="percentage",
                formula_text=f"({total_gross_profit} / {taxable_subtotal}) × 100 = {overall_margin_percent}%",
                rounding="round_percent(ROUND_HALF_UP, 2 decimals)",
                result=f"{overall_margin_percent}%",
                is_internal=True,
            )
        )

    totals = QuoteTotals(
        subtotal=subtotal,
        total_discount=total_discount,
        taxable_subtotal=taxable_subtotal,
        tax_total=tax_total,
        grand_total=grand_total,
        total_cost=total_cost,
        total_gross_profit=total_gross_profit,
        overall_margin_percent=overall_margin_percent,
    )

    fingerprint = compute_input_fingerprint(curr, sorted_lines)

    return QuoteCalculationResult(
        totals=totals,
        lines=computed_lines,
        currency=curr,
        calculator_version=CALCULATOR_VERSION,
        input_fingerprint=fingerprint,
        trace=traces,
    )
