"""
Authoritative pure-Python Structured Before/After Diff Generator for ForgeFlow Proposals.
Computes deterministic line-by-line and financial impact diffs between base and proposed revisions.
"""

from decimal import Decimal
from typing import Any, Dict, List, Optional

from app.domain.quotes.calculator import QuoteCalculationResult
from app.domain.quotes.money import round_percent


def compute_proposal_diff(
    base_calc: QuoteCalculationResult,
    proposed_calc: QuoteCalculationResult,
    base_terms: Dict[str, Any],
    proposed_terms: Dict[str, Any],
    can_view_cost: bool = True,
) -> Dict[str, Any]:
    """
    Computes a deterministic before/after diff summary.
    If can_view_cost is False, confidential cost/margin metrics are masked to None.
    """
    # 1. Terms diff
    terms_diff: Dict[str, Any] = {}
    term_keys = ["payment_terms", "delivery_terms", "valid_until"]
    for k in term_keys:
        old_v = base_terms.get(k)
        new_v = proposed_terms.get(k)
        if old_v != new_v:
            terms_diff[k] = {"old": old_v, "proposed": new_v}

    # 2. Line-by-line diff
    base_line_map = {line_item.line_id: line_item for line_item in base_calc.lines}
    proposed_line_map = {line_item.line_id: line_item for line_item in proposed_calc.lines}

    modified_lines: List[Dict[str, Any]] = []
    added_lines: List[Dict[str, Any]] = []
    removed_lines: List[Dict[str, Any]] = []

    # Detect added lines and modified lines
    for pl in proposed_calc.lines:
        bl = base_line_map.get(pl.line_id)
        if not bl:
            # Check if line was originally at same position or newly added
            # If not in base_line_map, it's newly added
            added_lines.append(
                {
                    "line_order": pl.line_order,
                    "line_id": pl.line_id,
                    "sku": pl.sku,
                    "name": pl.name,
                    "unit": pl.unit,
                    "quantity": str(pl.quantity),
                    "unit_price": str(pl.unit_price),
                    "discount_percent": str(pl.discount_percent),
                    "tax_rate_percent": str(pl.tax_rate_percent),
                    "line_total": str(pl.line_total),
                    "unit_cost": str(pl.unit_cost)
                    if (can_view_cost and pl.unit_cost is not None)
                    else None,
                    "margin_percent": str(pl.margin_percent)
                    if (can_view_cost and pl.margin_percent is not None)
                    else None,
                }
            )
        else:
            # Existing line: check for changes
            field_changes: Dict[str, Any] = {}
            if pl.quantity != bl.quantity:
                field_changes["quantity"] = {
                    "old": str(bl.quantity),
                    "proposed": str(pl.quantity),
                    "delta": str(pl.quantity - bl.quantity),
                }
            if pl.unit_price != bl.unit_price:
                field_changes["unit_price"] = {
                    "old": str(bl.unit_price),
                    "proposed": str(pl.unit_price),
                    "delta": str(pl.unit_price - bl.unit_price),
                }
            if pl.discount_percent != bl.discount_percent:
                field_changes["discount_percent"] = {
                    "old": str(bl.discount_percent),
                    "proposed": str(pl.discount_percent),
                    "delta": str(pl.discount_percent - bl.discount_percent),
                }
            if pl.tax_rate_percent != bl.tax_rate_percent:
                field_changes["tax_rate_percent"] = {
                    "old": str(bl.tax_rate_percent),
                    "proposed": str(pl.tax_rate_percent),
                    "delta": str(pl.tax_rate_percent - bl.tax_rate_percent),
                }

            if field_changes or pl.line_total != bl.line_total:
                line_total_delta = pl.line_total - bl.line_total
                modified_lines.append(
                    {
                        "line_order": pl.line_order,
                        "line_id": pl.line_id,
                        "sku": pl.sku,
                        "name": pl.name,
                        "unit": pl.unit,
                        "changes": field_changes,
                        "old_line_total": str(bl.line_total),
                        "proposed_line_total": str(pl.line_total),
                        "delta_line_total": str(line_total_delta),
                        "old_unit_cost": str(bl.unit_cost)
                        if (can_view_cost and bl.unit_cost is not None)
                        else None,
                        "proposed_unit_cost": str(pl.unit_cost)
                        if (can_view_cost and pl.unit_cost is not None)
                        else None,
                        "old_margin_percent": str(bl.margin_percent)
                        if (can_view_cost and bl.margin_percent is not None)
                        else None,
                        "proposed_margin_percent": str(pl.margin_percent)
                        if (can_view_cost and pl.margin_percent is not None)
                        else None,
                    }
                )

    # Detect removed lines
    for bl in base_calc.lines:
        if bl.line_id not in proposed_line_map:
            removed_lines.append(
                {
                    "line_order": bl.line_order,
                    "line_id": bl.line_id,
                    "sku": bl.sku,
                    "name": bl.name,
                    "unit": bl.unit,
                    "quantity": str(bl.quantity),
                    "unit_price": str(bl.unit_price),
                    "line_total": str(bl.line_total),
                }
            )

    # 3. Overall financial impact
    bt = base_calc.totals
    pt = proposed_calc.totals

    gt_delta = pt.grand_total - bt.grand_total
    gt_delta_pct: Optional[str] = None
    if bt.grand_total > Decimal("0"):
        pct = round_percent((gt_delta / bt.grand_total) * Decimal("100"))
        gt_delta_pct = f"{'+' if pct > 0 else ''}{pct}%"

    subtotal_delta = pt.subtotal - bt.subtotal
    discount_delta = pt.total_discount - bt.total_discount
    tax_delta = pt.tax_total - bt.tax_total

    financial_impact: Dict[str, Any] = {
        "base_grand_total": str(bt.grand_total),
        "proposed_grand_total": str(pt.grand_total),
        "grand_total_delta": str(gt_delta),
        "grand_total_delta_percent": gt_delta_pct,
        "base_subtotal": str(bt.subtotal),
        "proposed_subtotal": str(pt.subtotal),
        "subtotal_delta": str(subtotal_delta),
        "base_discount": str(bt.total_discount),
        "proposed_discount": str(pt.total_discount),
        "discount_delta": str(discount_delta),
        "base_tax": str(bt.tax_total),
        "proposed_tax": str(pt.tax_total),
        "tax_delta": str(tax_delta),
    }

    if can_view_cost:
        margin_delta_pct: Optional[str] = None
        if pt.overall_margin_percent is not None and bt.overall_margin_percent is not None:
            m_delta = round_percent(pt.overall_margin_percent - bt.overall_margin_percent)
            margin_delta_pct = f"{'+' if m_delta > 0 else ''}{m_delta}%"

        financial_impact.update(
            {
                "base_total_cost": str(bt.total_cost) if bt.total_cost is not None else None,
                "proposed_total_cost": str(pt.total_cost) if pt.total_cost is not None else None,
                "cost_delta": (
                    str(pt.total_cost - bt.total_cost)
                    if (pt.total_cost is not None and bt.total_cost is not None)
                    else None
                ),
                "base_margin_percent": (
                    str(bt.overall_margin_percent)
                    if bt.overall_margin_percent is not None
                    else None
                ),
                "proposed_margin_percent": (
                    str(pt.overall_margin_percent)
                    if pt.overall_margin_percent is not None
                    else None
                ),
                "margin_delta_percent": margin_delta_pct,
            }
        )
    else:
        financial_impact.update(
            {
                "base_total_cost": None,
                "proposed_total_cost": None,
                "cost_delta": None,
                "base_margin_percent": None,
                "proposed_margin_percent": None,
                "margin_delta_percent": None,
            }
        )

    return {
        "terms_diff": terms_diff,
        "modified_lines": modified_lines,
        "added_lines": added_lines,
        "removed_lines": removed_lines,
        "total_lines_changed": len(modified_lines) + len(added_lines) + len(removed_lines),
        "financial_impact": financial_impact,
    }
