"""
Authoritative pure-Python Quote Proposal Operations for ForgeFlow.
Enforces allowlisted operations, validation boundaries, and isolated scenario calculations.
"""

import uuid
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Dict, List, Optional, Set, Tuple

from app.domain.quotes.calculator import QuoteLineInput
from app.domain.quotes.money import parse_decimal

ALLOWLISTED_OPERATION_TYPES = {
    "set_line_quantity",
    "set_line_unit_price",
    "set_line_discount_percent",
    "set_line_tax_rate_percent",
    "add_line",
    "remove_line",
    "set_valid_until",
    "set_payment_terms",
    "set_delivery_terms",
}


@dataclass
class ProposalOperation:
    operation_id: str
    op_type: str
    reason: str
    line_order: Optional[int] = None
    line_id: Optional[str] = None
    field_name: Optional[str] = None
    old_value: Optional[str] = None
    proposed_value: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None

    def __post_init__(self) -> None:
        if not self.operation_id:
            self.operation_id = str(uuid.uuid4())

        if self.op_type not in ALLOWLISTED_OPERATION_TYPES:
            raise ValueError(
                f"Unsupported proposal operation type '{self.op_type}'. "
                f"Must be one of {sorted(ALLOWLISTED_OPERATION_TYPES)}"
            )

        if not self.reason or not self.reason.strip():
            raise ValueError(
                f"Operation '{self.op_type}' ({self.operation_id}) requires a non-empty reason."
            )
        self.reason = self.reason.strip()

        # Validate line-level vs quote-level operations
        if self.op_type in (
            "set_line_quantity",
            "set_line_unit_price",
            "set_line_discount_percent",
            "set_line_tax_rate_percent",
            "remove_line",
        ):
            if self.line_order is None and not self.line_id:
                raise ValueError(f"Line operation '{self.op_type}' requires line_order or line_id.")

        if self.op_type == "set_line_quantity":
            if self.proposed_value is None:
                raise ValueError("set_line_quantity requires proposed_value.")
            val = parse_decimal(self.proposed_value, "quantity")
            if val <= Decimal("0"):
                raise ValueError(f"Quantity must be strictly greater than 0, got {val}")

        elif self.op_type == "set_line_unit_price":
            if self.proposed_value is None:
                raise ValueError("set_line_unit_price requires proposed_value.")
            val = parse_decimal(self.proposed_value, "unit_price")
            if val < Decimal("0"):
                raise ValueError(f"Unit price cannot be negative, got {val}")

        elif self.op_type in ("set_line_discount_percent", "set_line_tax_rate_percent"):
            if self.proposed_value is None:
                raise ValueError(f"{self.op_type} requires proposed_value.")
            val = parse_decimal(self.proposed_value, "percent")
            if val < Decimal("0") or val > Decimal("100"):
                raise ValueError(f"Percentage must be between 0 and 100, got {val}")

        elif self.op_type == "add_line":
            if not self.payload:
                raise ValueError("add_line requires line payload.")
            required_keys = ["sku", "product_name", "quantity", "unit_price"]
            for rk in required_keys:
                if rk not in self.payload:
                    raise ValueError(f"add_line payload missing required key '{rk}'.")
            qty = parse_decimal(self.payload["quantity"], "quantity")
            price = parse_decimal(self.payload["unit_price"], "unit_price")
            if qty <= Decimal("0"):
                raise ValueError(f"add_line quantity must be > 0, got {qty}")
            if price < Decimal("0"):
                raise ValueError(f"add_line unit_price cannot be negative, got {price}")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "operation_id": self.operation_id,
            "op_type": self.op_type,
            "reason": self.reason,
            "line_order": self.line_order,
            "line_id": self.line_id,
            "field_name": self.field_name,
            "old_value": self.old_value,
            "proposed_value": self.proposed_value,
            "payload": self.payload,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ProposalOperation":
        return cls(
            operation_id=data.get("operation_id") or str(uuid.uuid4()),
            op_type=data["op_type"],
            reason=data.get("reason", ""),
            line_order=data.get("line_order"),
            line_id=data.get("line_id"),
            field_name=data.get("field_name"),
            old_value=str(data["old_value"]) if data.get("old_value") is not None else None,
            proposed_value=(
                str(data["proposed_value"]) if data.get("proposed_value") is not None else None
            ),
            payload=data.get("payload"),
        )


def validate_operation_set(operations: List[ProposalOperation]) -> None:
    """
    Ensures no conflicting/duplicate operations target the exact same field/line.
    """
    seen_targets: Set[Tuple[str, Optional[int], Optional[str]]] = set()

    for op in operations:
        target_key: Tuple[str, Optional[int], Optional[str]]
        if op.op_type in (
            "set_line_quantity",
            "set_line_unit_price",
            "set_line_discount_percent",
            "set_line_tax_rate_percent",
            "remove_line",
        ):
            target_key = (op.op_type, op.line_order, op.line_id)
        elif op.op_type in ("set_valid_until", "set_payment_terms", "set_delivery_terms"):
            target_key = (op.op_type, None, None)
        else:
            # add_line operations are distinct
            target_key = (op.op_type, None, op.operation_id)

        if target_key in seen_targets:
            raise ValueError(
                f"Conflicting duplicate operation '{op.op_type}' detected for target "
                f"(line #{op.line_order or op.line_id or 'quote'}). "
                "Multiple operations targeting the same field are prohibited."
            )
        seen_targets.add(target_key)


def apply_operations_to_quote(
    base_lines: List[QuoteLineInput],
    base_terms: Dict[str, Any],
    operations: List[ProposalOperation],
) -> Tuple[List[QuoteLineInput], Dict[str, Any]]:
    """
    Pure function that applies an allowlisted operation set to base lines and terms,
    producing an isolated proposed domain scenario. Prior base lines remain immutable.
    """
    validate_operation_set(operations)

    # Clone base lines
    proposed_lines: List[QuoteLineInput] = [
        QuoteLineInput(
            line_id=ln.line_id,
            line_order=ln.line_order,
            sku=ln.sku,
            name=ln.name,
            description=ln.description,
            unit=ln.unit,
            quantity=ln.quantity,
            unit_price=ln.unit_price,
            discount_percent=ln.discount_percent,
            tax_rate_percent=ln.tax_rate_percent,
            unit_cost=ln.unit_cost,
            rfq_line_id=ln.rfq_line_id,
            catalog_product_id=ln.catalog_product_id,
        )
        for ln in base_lines
    ]

    proposed_terms = dict(base_terms)
    removed_line_ids: Set[str] = set()

    for op in operations:
        # Quote-level term updates
        if op.op_type == "set_valid_until":
            proposed_terms["valid_until"] = op.proposed_value
        elif op.op_type == "set_payment_terms":
            proposed_terms["payment_terms"] = op.proposed_value
        elif op.op_type == "set_delivery_terms":
            proposed_terms["delivery_terms"] = op.proposed_value

        # Line removal
        elif op.op_type == "remove_line":
            target = next(
                (
                    ln
                    for ln in proposed_lines
                    if (op.line_order is not None and ln.line_order == op.line_order)
                    or (op.line_id is not None and ln.line_id == op.line_id)
                ),
                None,
            )
            if not target:
                raise ValueError(
                    f"Cannot remove line: line #{op.line_order or op.line_id} not found."
                )
            removed_line_ids.add(target.line_id)

        # Line additions
        elif op.op_type == "add_line":
            assert op.payload is not None
            p = op.payload
            new_id = str(p.get("line_id") or uuid.uuid4())
            new_ln = QuoteLineInput(
                line_id=new_id,
                line_order=len(proposed_lines) + 1,
                sku=p["sku"],
                name=p["product_name"],
                description=p.get("description") or p["product_name"],
                unit=p.get("unit") or "nos",
                quantity=parse_decimal(p["quantity"], "quantity"),
                unit_price=parse_decimal(p["unit_price"], "unit_price"),
                discount_percent=parse_decimal(
                    p.get("discount_percent", "0.00"), "discount_percent"
                ),
                tax_rate_percent=parse_decimal(
                    p.get("tax_rate_percent", "18.00"), "tax_rate_percent"
                ),
                unit_cost=parse_decimal(p["unit_cost"], "unit_cost")
                if p.get("unit_cost")
                else None,
                rfq_line_id=p.get("rfq_line_id"),
                catalog_product_id=p.get("catalog_product_id"),
            )
            proposed_lines.append(new_ln)

        # Line modifications
        elif op.op_type in (
            "set_line_quantity",
            "set_line_unit_price",
            "set_line_discount_percent",
            "set_line_tax_rate_percent",
        ):
            target = next(
                (
                    ln
                    for ln in proposed_lines
                    if (op.line_order is not None and ln.line_order == op.line_order)
                    or (op.line_id is not None and ln.line_id == op.line_id)
                ),
                None,
            )
            if not target:
                raise ValueError(
                    f"Line operation '{op.op_type}': target line #{op.line_order or op.line_id} not found."
                )

            assert op.proposed_value is not None
            if op.op_type == "set_line_quantity":
                target.quantity = parse_decimal(op.proposed_value, "quantity")
            elif op.op_type == "set_line_unit_price":
                target.unit_price = parse_decimal(op.proposed_value, "unit_price")
            elif op.op_type == "set_line_discount_percent":
                target.discount_percent = parse_decimal(op.proposed_value, "discount_percent")
            elif op.op_type == "set_line_tax_rate_percent":
                target.tax_rate_percent = parse_decimal(op.proposed_value, "tax_rate_percent")

    # Filter out removed lines
    active_proposed_lines = [ln for ln in proposed_lines if ln.line_id not in removed_line_ids]

    if not active_proposed_lines:
        raise ValueError("Proposal cannot result in a quotation with zero line items.")

    # Re-sequence line orders cleanly
    for idx, ln in enumerate(active_proposed_lines, start=1):
        ln.line_order = idx

    return active_proposed_lines, proposed_terms
