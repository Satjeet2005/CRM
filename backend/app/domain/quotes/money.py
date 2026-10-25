"""
Authoritative Decimal arithmetic helpers and explicit rounding boundaries for ForgeFlow.
"""

from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Union

CURRENCY_SCALE = Decimal("0.01")
PERCENT_SCALE = Decimal("0.01")
QUANTITY_SCALE = Decimal("0.0001")


def round_currency(val: Decimal) -> Decimal:
    """
    Round a monetary amount using ROUND_HALF_UP to 2 decimal places.
    """
    if not isinstance(val, Decimal):
        raise TypeError(f"Expected Decimal, got {type(val)}")
    if not val.is_finite():
        raise ValueError("Cannot round non-finite Decimal (NaN/Infinity)")
    return val.quantize(CURRENCY_SCALE, rounding=ROUND_HALF_UP)


def round_quantity(val: Decimal) -> Decimal:
    """
    Round an inventory/order quantity to up to 4 decimal places using ROUND_HALF_UP.
    """
    if not isinstance(val, Decimal):
        raise TypeError(f"Expected Decimal, got {type(val)}")
    if not val.is_finite():
        raise ValueError("Cannot round non-finite Decimal (NaN/Infinity)")
    return val.quantize(QUANTITY_SCALE, rounding=ROUND_HALF_UP)


def round_percent(val: Decimal) -> Decimal:
    """
    Round a percentage value (discount, margin, tax) to 2 decimal places using ROUND_HALF_UP.
    """
    if not isinstance(val, Decimal):
        raise TypeError(f"Expected Decimal, got {type(val)}")
    if not val.is_finite():
        raise ValueError("Cannot round non-finite Decimal (NaN/Infinity)")
    return val.quantize(PERCENT_SCALE, rounding=ROUND_HALF_UP)


def parse_decimal(val: Union[str, int, float, Decimal], field_name: str = "value") -> Decimal:
    """
    Safely parse a Decimal from string or int. Prohibits binary floats to avoid float drift.
    """
    if isinstance(val, float):
        raise TypeError(
            f"Floating point values are prohibited for financial field '{field_name}'. Use a decimal string or int."
        )
    if isinstance(val, Decimal):
        if not val.is_finite():
            raise ValueError(f"Field '{field_name}' must be finite (got NaN or Infinity).")
        return val
    try:
        dec = Decimal(str(val).strip())
        if not dec.is_finite():
            raise ValueError(f"Field '{field_name}' must be finite (got NaN or Infinity).")
        return dec
    except (InvalidOperation, ValueError) as e:
        raise ValueError(f"Invalid decimal value for '{field_name}': {val}") from e
