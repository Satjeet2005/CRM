import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

CatalogUnit = Literal["ea", "box", "pack", "m", "mm", "cm", "kg", "g", "l", "ml", "set"]
StockStatus = Literal["in_stock", "limited", "backorder", "discontinued"]


class CatalogProductCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sku: str = Field(..., min_length=2, max_length=64)
    name: str = Field(..., min_length=2, max_length=180)
    description: Optional[str] = Field(None, max_length=1000)
    category: str = Field(..., min_length=1, max_length=80)
    manufacturer: Optional[str] = Field(None, max_length=120)
    manufacturer_part_number: Optional[str] = Field(None, max_length=120)
    base_unit: CatalogUnit = "ea"
    sell_price: Decimal = Field(default=Decimal("0.0000"), ge=0)
    unit_cost: Optional[Decimal] = Field(None, ge=0)
    tax_rate_percent: Decimal = Field(default=Decimal("18.00"), ge=0, le=100)
    stock_status: StockStatus = "in_stock"
    attributes_json: Optional[dict[str, Any]] = None

    @field_validator("sku")
    @classmethod
    def normalize_sku(cls, v: str) -> str:
        trimmed = v.strip().upper()
        if len(trimmed) < 2:
            raise ValueError("SKU must be at least 2 characters")
        return trimmed

    @field_validator("name", "category")
    @classmethod
    def trim_strings(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Field cannot be empty")
        return trimmed


class CatalogProductUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = Field(None, min_length=2, max_length=180)
    description: Optional[str] = Field(None, max_length=1000)
    category: Optional[str] = Field(None, min_length=1, max_length=80)
    manufacturer: Optional[str] = Field(None, max_length=120)
    manufacturer_part_number: Optional[str] = Field(None, max_length=120)
    base_unit: Optional[CatalogUnit] = None
    sell_price: Optional[Decimal] = Field(None, ge=0)
    unit_cost: Optional[Decimal] = Field(None, ge=0)
    tax_rate_percent: Optional[Decimal] = Field(None, ge=0, le=100)
    stock_status: Optional[StockStatus] = None
    attributes_json: Optional[dict[str, Any]] = None
    is_active: Optional[bool] = None
    expected_version: int = Field(..., ge=1)


class CatalogAliasCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    alias_text: str = Field(..., min_length=1, max_length=180)

    @field_validator("alias_text")
    @classmethod
    def validate_alias(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Alias text cannot be empty")
        return trimmed


class CatalogAliasResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    product_id: uuid.UUID
    alias_text: str
    normalized_alias: str
    created_at: datetime


class CatalogProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    sku: str
    name: str
    description: Optional[str]
    category: str
    manufacturer: Optional[str]
    manufacturer_part_number: Optional[str]
    base_unit: str
    sell_price: Decimal
    unit_cost: Optional[Decimal] = None  # None for unauthorized roles
    tax_rate_percent: Decimal
    stock_status: str
    attributes_json: Optional[dict[str, Any]]
    is_active: bool
    version: int
    created_at: datetime
    updated_at: datetime
    aliases: list[CatalogAliasResponse] = []
