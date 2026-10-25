"""
Structured Calculation Trace nodes explaining every line and total calculation step.
"""

from dataclasses import asdict, dataclass
from typing import Any, Dict


@dataclass(frozen=True)
class TraceNode:
    output_key: str
    label: str
    inputs: Dict[str, str]
    operation: str
    formula_text: str
    rounding: str
    result: str
    is_internal: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
