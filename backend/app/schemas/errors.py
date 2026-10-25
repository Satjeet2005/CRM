from typing import Any

from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    code: str = Field(..., description="Machine-readable error code")
    message: str = Field(..., description="Human-readable safe error message")
    details: Any | None = Field(default=None, description="Optional safe detail map or list")
    request_id: str | None = Field(default=None, description="Correlation identifier for tracing")
