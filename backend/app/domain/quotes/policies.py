"""
Authoritative pure-Python Quote Policy Evaluator for ForgeFlow.
Evaluates pricing thresholds for manager approvals and generates immutable policy snapshots.
"""

from dataclasses import asdict, dataclass, field
from decimal import Decimal
from typing import Any, Dict, List, Optional

from app.domain.quotes.calculator import QuoteCalculationResult
from app.domain.quotes.money import parse_decimal


@dataclass
class QuotePolicyConfig:
    line_discount_approval_percent: Decimal = field(default_factory=lambda: Decimal("5.00"))
    quote_total_approval_inr: Decimal = field(default_factory=lambda: Decimal("500000.00"))
    minimum_gross_margin_percent: Decimal = field(default_factory=lambda: Decimal("15.00"))

    @classmethod
    def from_dict(cls, data: Optional[Dict[str, Any]] = None) -> "QuotePolicyConfig":
        if not data:
            return cls()

        def _safe_val(raw: Any, default: str) -> Any:
            if raw is None:
                return default
            if isinstance(raw, float):
                return str(raw)
            return raw

        disc = parse_decimal(
            _safe_val(data.get("line_discount_approval_percent"), "5.00"),
            "line_discount_approval_percent",
        )
        total = parse_decimal(
            _safe_val(data.get("quote_total_approval_inr"), "500000.00"),
            "quote_total_approval_inr",
        )
        margin = parse_decimal(
            _safe_val(data.get("minimum_gross_margin_percent"), "15.00"),
            "minimum_gross_margin_percent",
        )
        return cls(
            line_discount_approval_percent=disc,
            quote_total_approval_inr=total,
            minimum_gross_margin_percent=margin,
        )

    def to_dict(self) -> Dict[str, str]:
        return {
            "line_discount_approval_percent": str(self.line_discount_approval_percent),
            "quote_total_approval_inr": str(self.quote_total_approval_inr),
            "minimum_gross_margin_percent": str(self.minimum_gross_margin_percent),
        }


@dataclass(frozen=True)
class PolicyTrigger:
    rule_id: str
    rule_name: str
    description: str
    severity: str
    threshold_value: str
    actual_value: str
    requires_approval: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class PolicyEvaluationResult:
    requires_manager_approval: bool
    triggers: List[PolicyTrigger]
    evaluated_rules: List[str]
    effective_policy: Dict[str, str]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "requires_manager_approval": self.requires_manager_approval,
            "triggers": [t.to_dict() for t in self.triggers],
            "evaluated_rules": self.evaluated_rules,
            "effective_policy": self.effective_policy,
        }


def evaluate_quote_policies(
    calc_result: QuoteCalculationResult,
    config: Optional[QuotePolicyConfig] = None,
) -> PolicyEvaluationResult:
    """
    Pure policy evaluation over calculation result and policy thresholds.
    Evaluates:
      1. Line discount rule: any line discount > line_discount_approval_percent
      2. Quote total rule: grand_total > quote_total_approval_inr
      3. Minimum margin rule: overall_margin_percent < minimum_gross_margin_percent (only if cost data exists)
    """
    if config is None:
        config = QuotePolicyConfig()

    triggers: List[PolicyTrigger] = []
    evaluated_rules: List[str] = [
        "rule_line_discount_threshold",
        "rule_quote_grand_total_threshold",
        "rule_minimum_gross_margin_threshold",
    ]

    # Rule 1: Line discount threshold (> line_discount_approval_percent)
    max_discount_line = None
    for line in calc_result.lines:
        if line.discount_percent > config.line_discount_approval_percent:
            if (
                max_discount_line is None
                or line.discount_percent > max_discount_line.discount_percent
            ):
                max_discount_line = line

    if max_discount_line is not None:
        triggers.append(
            PolicyTrigger(
                rule_id="rule_line_discount_threshold",
                rule_name="Excessive Line Discount",
                description=(
                    f"Line #{max_discount_line.line_order} ({max_discount_line.sku}) has a discount of "
                    f"{max_discount_line.discount_percent}%, exceeding the maximum self-approval limit of "
                    f"{config.line_discount_approval_percent}%."
                ),
                severity="warning",
                threshold_value=f"{config.line_discount_approval_percent}%",
                actual_value=f"{max_discount_line.discount_percent}%",
                requires_approval=True,
            )
        )

    # Rule 2: Quote grand total threshold (> quote_total_approval_inr)
    if calc_result.totals.grand_total > config.quote_total_approval_inr:
        triggers.append(
            PolicyTrigger(
                rule_id="rule_quote_grand_total_threshold",
                rule_name="High-Value Quotation Threshold",
                description=(
                    f"Quotation grand total of ₹{calc_result.totals.grand_total:,.2f} exceeds the self-approval limit of "
                    f"₹{config.quote_total_approval_inr:,.2f}. Manager review is required."
                ),
                severity="warning",
                threshold_value=f"₹{config.quote_total_approval_inr:,.2f}",
                actual_value=f"₹{calc_result.totals.grand_total:,.2f}",
                requires_approval=True,
            )
        )

    # Rule 3: Minimum gross margin threshold (< minimum_gross_margin_percent)
    # Evaluated only when internal cost exists
    if calc_result.totals.overall_margin_percent is not None:
        if calc_result.totals.overall_margin_percent < config.minimum_gross_margin_percent:
            triggers.append(
                PolicyTrigger(
                    rule_id="rule_minimum_gross_margin_threshold",
                    rule_name="Below Minimum Gross Margin",
                    description=(
                        f"Quotation profit margin of {calc_result.totals.overall_margin_percent}% is below the "
                        f"minimum threshold of {config.minimum_gross_margin_percent}%."
                    ),
                    severity="warning",
                    threshold_value=f"{config.minimum_gross_margin_percent}%",
                    actual_value=f"{calc_result.totals.overall_margin_percent}%",
                    requires_approval=True,
                )
            )

    requires_approval = len(triggers) > 0

    return PolicyEvaluationResult(
        requires_manager_approval=requires_approval,
        triggers=triggers,
        evaluated_rules=evaluated_rules,
        effective_policy=config.to_dict(),
    )
