"""
Unit tests for the pure-Python Decimal quote calculator, trace, and policy evaluator.
Zero database or FastAPI dependencies.
"""

from decimal import Decimal

import pytest

from app.domain.quotes.calculator import (
    QuoteLineInput,
    calculate_quote,
    compute_input_fingerprint,
)
from app.domain.quotes.money import parse_decimal, round_currency
from app.domain.quotes.policies import (
    evaluate_quote_policies,
)


def test_money_rounding_half_up():
    # 0.005 rounds up to 0.01
    assert round_currency(Decimal("0.005")) == Decimal("0.01")
    # 0.0049 rounds down to 0.00
    assert round_currency(Decimal("0.0049")) == Decimal("0.00")
    # 0.0051 rounds up to 0.01
    assert round_currency(Decimal("0.0051")) == Decimal("0.01")
    # 12.345 rounds to 12.35
    assert round_currency(Decimal("12.345")) == Decimal("12.35")
    # 12.344 rounds to 12.34
    assert round_currency(Decimal("12.344")) == Decimal("12.34")


def test_parse_decimal_prohibits_floats():
    with pytest.raises(TypeError, match="Floating point values are prohibited"):
        parse_decimal(12.34, "test_field")


def test_parse_decimal_valid():
    assert parse_decimal("1250.75", "price") == Decimal("1250.75")
    assert parse_decimal(100, "qty") == Decimal("100")
    assert parse_decimal(Decimal("55.20"), "val") == Decimal("55.20")


def test_quote_line_input_validation():
    # Zero quantity rejected
    with pytest.raises(ValueError, match="Quantity must be strictly greater than 0"):
        QuoteLineInput(
            line_id="l1",
            line_order=1,
            sku="VALV-001",
            name="Ball Valve",
            description="desc",
            unit="nos",
            quantity=Decimal("0"),
            unit_price=Decimal("100.00"),
        )

    # Negative price rejected
    with pytest.raises(ValueError, match="Unit price cannot be negative"):
        QuoteLineInput(
            line_id="l1",
            line_order=1,
            sku="VALV-001",
            name="Ball Valve",
            description="desc",
            unit="nos",
            quantity=Decimal("5"),
            unit_price=Decimal("-10.00"),
        )

    # Discount > 100 rejected
    with pytest.raises(ValueError, match="Discount percent must be between 0 and 100"):
        QuoteLineInput(
            line_id="l1",
            line_order=1,
            sku="VALV-001",
            name="Ball Valve",
            description="desc",
            unit="nos",
            quantity=Decimal("5"),
            unit_price=Decimal("100.00"),
            discount_percent=Decimal("105.00"),
        )


def test_single_line_calculation_hand_verified():
    # Qty = 10, Unit Price = 250.00
    # Gross = 2500.00
    # Discount = 10% -> 250.00
    # Taxable = 2500.00 - 250.00 = 2250.00
    # Tax = 18% -> 2250.00 * 0.18 = 405.00
    # Line Total = 2250.00 + 405.00 = 2655.00
    # Unit Cost = 150.00 -> Line Cost = 1500.00
    # Gross Profit = 2250.00 - 1500.00 = 750.00
    # Margin % = (750.00 / 2250.00) * 100 = 33.33%

    line = QuoteLineInput(
        line_id="line-1",
        line_order=1,
        sku="PIPE-001",
        name="GI Pipe 15mm",
        description="Class A GI Pipe",
        unit="mtr",
        quantity=Decimal("10.0000"),
        unit_price=Decimal("250.00"),
        discount_percent=Decimal("10.00"),
        tax_rate_percent=Decimal("18.00"),
        unit_cost=Decimal("150.00"),
    )

    result = calculate_quote([line])

    assert len(result.lines) == 1
    l_res = result.lines[0]

    assert l_res.gross_amount == Decimal("2500.00")
    assert l_res.discount_amount == Decimal("250.00")
    assert l_res.taxable_amount == Decimal("2250.00")
    assert l_res.tax_amount == Decimal("405.00")
    assert l_res.line_total == Decimal("2655.00")
    assert l_res.line_cost == Decimal("1500.00")
    assert l_res.line_gross_profit == Decimal("750.00")
    assert l_res.margin_percent == Decimal("33.33")

    # Totals
    assert result.totals.subtotal == Decimal("2500.00")
    assert result.totals.total_discount == Decimal("250.00")
    assert result.totals.taxable_subtotal == Decimal("2250.00")
    assert result.totals.tax_total == Decimal("405.00")
    assert result.totals.grand_total == Decimal("2655.00")
    assert result.totals.total_cost == Decimal("1500.00")
    assert result.totals.total_gross_profit == Decimal("750.00")
    assert result.totals.overall_margin_percent == Decimal("33.33")


def test_multi_line_exact_sums_and_rounding():
    # Line 1: Qty 3, Price 33.33, Disc 0%, Tax 18%
    # Gross = 99.99, Disc = 0, Taxable = 99.99, Tax = round(99.99 * 0.18) = round(17.9982) = 18.00
    # Line Total = 99.99 + 18.00 = 117.99

    # Line 2: Qty 7, Price 14.28, Disc 5%, Tax 18%
    # Gross = round(7 * 14.28) = 99.96
    # Disc = round(99.96 * 0.05) = round(4.998) = 5.00
    # Taxable = 99.96 - 5.00 = 94.96
    # Tax = round(94.96 * 0.18) = round(17.0928) = 17.09
    # Line Total = 94.96 + 17.09 = 112.05

    line1 = QuoteLineInput(
        line_id="l1",
        line_order=1,
        sku="SKU-1",
        name="Item 1",
        description="",
        unit="nos",
        quantity=Decimal("3.0000"),
        unit_price=Decimal("33.33"),
        discount_percent=Decimal("0.00"),
        tax_rate_percent=Decimal("18.00"),
    )
    line2 = QuoteLineInput(
        line_id="l2",
        line_order=2,
        sku="SKU-2",
        name="Item 2",
        description="",
        unit="nos",
        quantity=Decimal("7.0000"),
        unit_price=Decimal("14.28"),
        discount_percent=Decimal("5.00"),
        tax_rate_percent=Decimal("18.00"),
    )

    res = calculate_quote([line1, line2])

    assert res.lines[0].gross_amount == Decimal("99.99")
    assert res.lines[0].tax_amount == Decimal("18.00")
    assert res.lines[0].line_total == Decimal("117.99")

    assert res.lines[1].gross_amount == Decimal("99.96")
    assert res.lines[1].discount_amount == Decimal("5.00")
    assert res.lines[1].taxable_amount == Decimal("94.96")
    assert res.lines[1].tax_amount == Decimal("17.09")
    assert res.lines[1].line_total == Decimal("112.05")

    # Totals are exact sums of rounded line items:
    # Subtotal = 99.99 + 99.96 = 199.95
    # Total Discount = 0 + 5.00 = 5.00
    # Taxable Subtotal = 99.99 + 94.96 = 194.95
    # Tax Total = 18.00 + 17.09 = 35.09
    # Grand Total = 117.99 + 112.05 = 230.04
    assert res.totals.subtotal == Decimal("199.95")
    assert res.totals.total_discount == Decimal("5.00")
    assert res.totals.taxable_subtotal == Decimal("194.95")
    assert res.totals.tax_total == Decimal("35.09")
    assert res.totals.grand_total == Decimal("230.04")

    # No unit cost supplied -> total cost and margin are None
    assert res.totals.total_cost is None
    assert res.totals.overall_margin_percent is None


def test_empty_quote_rejected():
    with pytest.raises(ValueError, match="zero line items"):
        calculate_quote([])


def test_trace_contains_all_steps_and_matches_results():
    line = QuoteLineInput(
        line_id="l1",
        line_order=1,
        sku="BOLT-001",
        name="Hex Bolt",
        description="M12x50",
        unit="nos",
        quantity=Decimal("100"),
        unit_price=Decimal("15.50"),
        discount_percent=Decimal("5.00"),
        tax_rate_percent=Decimal("18.00"),
    )

    res = calculate_quote([line])

    trace_keys = [t.output_key for t in res.trace]
    assert "line:1:gross_amount" in trace_keys
    assert "line:1:discount_amount" in trace_keys
    assert "line:1:taxable_amount" in trace_keys
    assert "line:1:tax_amount" in trace_keys
    assert "line:1:line_total" in trace_keys
    assert "quote:subtotal" in trace_keys
    assert "quote:grand_total" in trace_keys

    # Verify results in trace match outputs exactly
    grand_total_trace = next(t for t in res.trace if t.output_key == "quote:grand_total")
    assert grand_total_trace.result == str(res.totals.grand_total)


def test_fingerprint_reproducibility():
    line1 = QuoteLineInput(
        line_id="l1",
        line_order=1,
        sku="SKU-A",
        name="A",
        description="A",
        unit="nos",
        quantity=Decimal("10"),
        unit_price=Decimal("100.00"),
    )
    line2 = QuoteLineInput(
        line_id="l2",
        line_order=2,
        sku="SKU-B",
        name="B",
        description="B",
        unit="nos",
        quantity=Decimal("20"),
        unit_price=Decimal("50.00"),
    )

    fp1 = compute_input_fingerprint("INR", [line1, line2])
    fp2 = compute_input_fingerprint("INR", [line2, line1])  # different input order
    assert fp1 == fp2  # deterministic sorting ensures matching fingerprint


def test_policy_evaluation_triggers():
    # 1. Discount <= 5% -> No trigger
    line_ok = QuoteLineInput(
        line_id="l1",
        line_order=1,
        sku="SKU-OK",
        name="OK",
        description="",
        unit="nos",
        quantity=Decimal("10"),
        unit_price=Decimal("1000.00"),
        discount_percent=Decimal("5.00"),  # Exactly 5%
    )
    res_ok = calculate_quote([line_ok])
    pol_ok = evaluate_quote_policies(res_ok)
    assert not pol_ok.requires_manager_approval
    assert len(pol_ok.triggers) == 0

    # 2. Discount > 5% -> Triggers discount rule
    line_disc = QuoteLineInput(
        line_id="l1",
        line_order=1,
        sku="SKU-DISC",
        name="Disc",
        description="",
        unit="nos",
        quantity=Decimal("10"),
        unit_price=Decimal("1000.00"),
        discount_percent=Decimal("5.50"),  # > 5%
    )
    res_disc = calculate_quote([line_disc])
    pol_disc = evaluate_quote_policies(res_disc)
    assert pol_disc.requires_manager_approval
    assert len(pol_disc.triggers) == 1
    assert pol_disc.triggers[0].rule_id == "rule_line_discount_threshold"

    # 3. Grand Total > ₹500,000 -> Triggers high-value rule
    line_high_val = QuoteLineInput(
        line_id="l1",
        line_order=1,
        sku="SKU-VALVE-LARGE",
        name="Large Valve Package",
        description="",
        unit="set",
        quantity=Decimal("2"),
        unit_price=Decimal("250000.00"),  # 500k + 18% tax = 590,000
    )
    res_high = calculate_quote([line_high_val])
    pol_high = evaluate_quote_policies(res_high)
    assert pol_high.requires_manager_approval
    assert any(t.rule_id == "rule_quote_grand_total_threshold" for t in pol_high.triggers)

    # 4. Margin < 15% -> Triggers margin rule
    line_low_margin = QuoteLineInput(
        line_id="l1",
        line_order=1,
        sku="SKU-LOW-MARGIN",
        name="Low Margin Item",
        description="",
        unit="nos",
        quantity=Decimal("10"),
        unit_price=Decimal("100.00"),
        unit_cost=Decimal("90.00"),  # Gross profit = 10, margin = 10% (< 15%)
    )
    res_margin = calculate_quote([line_low_margin])
    pol_margin = evaluate_quote_policies(res_margin)
    assert pol_margin.requires_manager_approval
    assert any(t.rule_id == "rule_minimum_gross_margin_threshold" for t in pol_margin.triggers)

    # 5. Multiple triggers simultaneously
    line_multi = QuoteLineInput(
        line_id="l1",
        line_order=1,
        sku="SKU-MULTI",
        name="Multi Trigger Item",
        description="",
        unit="nos",
        quantity=Decimal("100"),
        unit_price=Decimal("10000.00"),  # 1M gross
        discount_percent=Decimal("12.00"),  # > 5%
        unit_cost=Decimal("9500.00"),  # margin < 15%
    )
    res_multi = calculate_quote([line_multi])
    pol_multi = evaluate_quote_policies(res_multi)
    assert pol_multi.requires_manager_approval
    # Must trigger all 3 rules!
    trigger_ids = {t.rule_id for t in pol_multi.triggers}
    assert "rule_line_discount_threshold" in trigger_ids
    assert "rule_quote_grand_total_threshold" in trigger_ids
    assert "rule_minimum_gross_margin_threshold" in trigger_ids
