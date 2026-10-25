import uuid
from decimal import Decimal

import pytest

from app.domain.proposals.diff import compute_proposal_diff
from app.domain.proposals.lifecycle import (
    assert_can_transition,
    assert_maker_checker,
    can_transition,
)
from app.domain.proposals.operations import (
    ProposalOperation,
    apply_operations_to_quote,
    validate_operation_set,
)
from app.domain.quotes.calculator import QuoteLineInput, calculate_quote


def make_test_lines() -> list[QuoteLineInput]:
    return [
        QuoteLineInput(
            line_id="line-1",
            line_order=1,
            sku="VALV-50",
            name="Ball Valve 50mm",
            description="Brass Ball Valve",
            unit="nos",
            quantity=Decimal("10.0000"),
            unit_price=Decimal("1000.00"),
            discount_percent=Decimal("0.00"),
            tax_rate_percent=Decimal("18.00"),
            unit_cost=Decimal("700.00"),
        ),
        QuoteLineInput(
            line_id="line-2",
            line_order=2,
            sku="PIPE-20",
            name="GI Pipe 20mm",
            description="GI Pipe Class A",
            unit="mtr",
            quantity=Decimal("50.0000"),
            unit_price=Decimal("200.00"),
            discount_percent=Decimal("5.00"),
            tax_rate_percent=Decimal("18.00"),
            unit_cost=Decimal("150.00"),
        ),
    ]


def test_proposal_operation_validation():
    # Unknown operation rejected
    with pytest.raises(ValueError, match="Unsupported proposal operation type"):
        ProposalOperation(
            operation_id="op-1",
            op_type="destroy_quote",
            reason="Illegal op",
        )

    # Empty reason rejected
    with pytest.raises(ValueError, match="requires a non-empty reason"):
        ProposalOperation(
            operation_id="op-1",
            op_type="set_line_quantity",
            reason="   ",
            line_order=1,
            proposed_value="20",
        )

    # Negative quantity rejected
    with pytest.raises(ValueError, match="Quantity must be strictly greater than 0"):
        ProposalOperation(
            operation_id="op-1",
            op_type="set_line_quantity",
            reason="Double order",
            line_order=1,
            proposed_value="-5",
        )

    # Negative price rejected
    with pytest.raises(ValueError, match="Unit price cannot be negative"):
        ProposalOperation(
            operation_id="op-1",
            op_type="set_line_unit_price",
            reason="Discounted",
            line_order=1,
            proposed_value="-100",
        )

    # Discount > 100 rejected
    with pytest.raises(ValueError, match="Percentage must be between 0 and 100"):
        ProposalOperation(
            operation_id="op-1",
            op_type="set_line_discount_percent",
            reason="Mega sale",
            line_order=1,
            proposed_value="120",
        )


def test_proposal_conflicting_operations():
    ops = [
        ProposalOperation(
            operation_id="op-1",
            op_type="set_line_quantity",
            reason="Change 1",
            line_order=1,
            proposed_value="20",
        ),
        ProposalOperation(
            operation_id="op-2",
            op_type="set_line_quantity",
            reason="Change 2",
            line_order=1,
            proposed_value="30",
        ),
    ]
    with pytest.raises(ValueError, match="Conflicting duplicate operation"):
        validate_operation_set(ops)


def test_apply_operations_quantity_and_discount():
    base_lines = make_test_lines()
    base_terms = {"payment_terms": "Net 30", "delivery_terms": "Ex-Works"}

    ops = [
        ProposalOperation(
            operation_id="op-1",
            op_type="set_line_quantity",
            reason="Customer increased valve requirement",
            line_order=1,
            proposed_value="15.0000",
        ),
        ProposalOperation(
            operation_id="op-2",
            op_type="set_line_discount_percent",
            reason="Volume discount for piping",
            line_order=2,
            proposed_value="8.00",
        ),
        ProposalOperation(
            operation_id="op-3",
            op_type="set_payment_terms",
            reason="Customer requested extended terms",
            proposed_value="Net 45 days",
        ),
    ]

    proposed_lines, proposed_terms = apply_operations_to_quote(base_lines, base_terms, ops)

    # Base lines untouched (immutability check)
    assert base_lines[0].quantity == Decimal("10.0000")
    assert base_lines[1].discount_percent == Decimal("5.00")

    # Proposed lines updated
    assert proposed_lines[0].quantity == Decimal("15.0000")
    assert proposed_lines[1].discount_percent == Decimal("8.00")
    assert proposed_terms["payment_terms"] == "Net 45 days"


def test_apply_operations_add_and_remove_line():
    base_lines = make_test_lines()
    base_terms = {"payment_terms": "Net 30", "delivery_terms": "Ex-Works"}

    ops = [
        ProposalOperation(
            operation_id="op-1",
            op_type="remove_line",
            reason="Remove line 2 (piping not required)",
            line_order=2,
        ),
        ProposalOperation(
            operation_id="op-2",
            op_type="add_line",
            reason="Add special gasket",
            payload={
                "sku": "GSK-100",
                "product_name": "Spiral Wound Gasket",
                "quantity": "25.0000",
                "unit_price": "80.00",
                "discount_percent": "0.00",
                "tax_rate_percent": "18.00",
                "unit_cost": "50.00",
            },
        ),
    ]

    proposed_lines, proposed_terms = apply_operations_to_quote(base_lines, base_terms, ops)

    assert len(proposed_lines) == 2
    assert proposed_lines[0].sku == "VALV-50"
    assert proposed_lines[0].line_order == 1
    assert proposed_lines[1].sku == "GSK-100"
    assert proposed_lines[1].line_order == 2


def test_cannot_remove_all_lines():
    base_lines = make_test_lines()
    base_terms = {"payment_terms": "Net 30"}
    ops = [
        ProposalOperation(
            operation_id="op-1",
            op_type="remove_line",
            reason="Remove line 1",
            line_order=1,
        ),
        ProposalOperation(
            operation_id="op-2",
            op_type="remove_line",
            reason="Remove line 2",
            line_order=2,
        ),
    ]
    with pytest.raises(ValueError, match="zero line items"):
        apply_operations_to_quote(base_lines, base_terms, ops)


def test_compute_proposal_diff_and_cost_masking():
    base_lines = make_test_lines()
    base_terms = {"payment_terms": "Net 30", "delivery_terms": "Ex-Works"}
    base_calc = calculate_quote(base_lines)

    ops = [
        ProposalOperation(
            operation_id="op-1",
            op_type="set_line_unit_price",
            reason="Price adjustment",
            line_order=1,
            proposed_value="1200.00",
        ),
    ]

    proposed_lines, proposed_terms = apply_operations_to_quote(base_lines, base_terms, ops)
    proposed_calc = calculate_quote(proposed_lines)

    # 1. Diff with cost visible (Admin/Catalog Manager)
    diff_admin = compute_proposal_diff(
        base_calc, proposed_calc, base_terms, proposed_terms, can_view_cost=True
    )
    assert len(diff_admin["modified_lines"]) == 1
    mod = diff_admin["modified_lines"][0]
    assert mod["sku"] == "VALV-50"
    assert mod["changes"]["unit_price"]["old"] == "1000.00"
    assert mod["changes"]["unit_price"]["proposed"] == "1200.00"
    assert mod["old_unit_cost"] == "700.00"
    assert diff_admin["financial_impact"]["base_total_cost"] is not None
    assert Decimal(diff_admin["financial_impact"]["grand_total_delta"]) > Decimal("0")

    # 2. Diff with cost masked (Sales Rep / Sales Manager)
    diff_rep = compute_proposal_diff(
        base_calc, proposed_calc, base_terms, proposed_terms, can_view_cost=False
    )
    mod_rep = diff_rep["modified_lines"][0]
    assert mod_rep["old_unit_cost"] is None
    assert mod_rep["proposed_margin_percent"] is None
    assert diff_rep["financial_impact"]["base_total_cost"] is None
    assert diff_rep["financial_impact"]["base_margin_percent"] is None


def test_proposal_lifecycle_transitions():
    assert can_transition("draft", "pending_review") is True
    assert can_transition("draft", "cancelled") is True
    assert can_transition("draft", "approved") is False  # Cannot approve a draft directly
    assert can_transition("draft", "committed") is False

    assert can_transition("pending_review", "approved") is True
    assert can_transition("pending_review", "rejected") is True
    assert can_transition("pending_review", "stale") is True
    assert can_transition("approved", "committed") is True

    # Terminal states
    assert can_transition("committed", "pending_review") is False
    assert can_transition("rejected", "pending_review") is False
    assert can_transition("cancelled", "draft") is False

    with pytest.raises(ValueError, match="Illegal proposal state transition"):
        assert_can_transition("draft", "committed")


def test_maker_checker_enforcement():
    user1 = uuid.uuid4()
    user2 = uuid.uuid4()

    # Different users: valid
    assert_maker_checker(user1, user2)

    # Same user: raises Maker-checker violation
    with pytest.raises(ValueError, match="Maker-checker violation"):
        assert_maker_checker(user1, user1)
