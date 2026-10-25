"""
Authoritative pure-Python Decimal quote domain engine for ForgeFlow.
"""

from app.domain.quotes.calculator import (
    CALCULATOR_VERSION,
    LineCalculationResult,
    QuoteCalculationInput,
    QuoteCalculationResult,
    QuoteLineInput,
    QuoteTotals,
    calculate_quote,
    compute_input_fingerprint,
)
from app.domain.quotes.money import (
    CURRENCY_SCALE,
    PERCENT_SCALE,
    QUANTITY_SCALE,
    parse_decimal,
    round_currency,
    round_percent,
    round_quantity,
)
from app.domain.quotes.policies import (
    PolicyEvaluationResult,
    PolicyTrigger,
    QuotePolicyConfig,
    evaluate_quote_policies,
)
from app.domain.quotes.trace import TraceNode

__all__ = [
    "CALCULATOR_VERSION",
    "CURRENCY_SCALE",
    "LineCalculationResult",
    "PERCENT_SCALE",
    "PolicyEvaluationResult",
    "PolicyTrigger",
    "QUANTITY_SCALE",
    "QuoteCalculationInput",
    "QuoteCalculationResult",
    "QuoteLineInput",
    "QuotePolicyConfig",
    "QuoteTotals",
    "TraceNode",
    "calculate_quote",
    "compute_input_fingerprint",
    "evaluate_quote_policies",
    "parse_decimal",
    "round_currency",
    "round_percent",
    "round_quantity",
]
