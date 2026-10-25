import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthenticatedContext, require_permission
from app.db.session import get_db
from app.schemas.catalog import (
    CatalogAliasCreate,
    CatalogAliasResponse,
    CatalogProductCreate,
    CatalogProductResponse,
    CatalogProductUpdate,
)
from app.schemas.crm import PaginatedResponse
from app.services import catalog_service

router = APIRouter(prefix="/catalog", tags=["Catalog"])


class ProductArchiveRequest(BaseModel):
    expected_version: int = Field(..., ge=1)


@router.get("/products", response_model=PaginatedResponse[CatalogProductResponse])
def get_catalog_products(
    search: Optional[str] = Query(None, description="Search SKU, name, MPN, or alias"),
    category: Optional[str] = Query(None, description="Filter by category"),
    manufacturer: Optional[str] = Query(None, description="Filter by manufacturer"),
    stock_status: Optional[str] = Query(None, description="Filter by stock status"),
    is_active: Optional[bool] = Query(True, description="Filter active/archived products"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    ctx: AuthenticatedContext = Depends(require_permission("catalog:read")),
    db: Session = Depends(get_db),
) -> PaginatedResponse[CatalogProductResponse]:
    return catalog_service.list_catalog_products(
        db=db,
        ctx=ctx,
        search=search,
        category=category,
        manufacturer=manufacturer,
        stock_status=stock_status,
        is_active=is_active,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/products", response_model=CatalogProductResponse, status_code=status.HTTP_201_CREATED
)
def create_catalog_product(
    payload: CatalogProductCreate,
    ctx: AuthenticatedContext = Depends(require_permission("catalog:manage")),
    db: Session = Depends(get_db),
) -> CatalogProductResponse:
    return catalog_service.create_catalog_product(db=db, ctx=ctx, payload=payload)


@router.get("/products/{product_id}", response_model=CatalogProductResponse)
def get_catalog_product(
    product_id: uuid.UUID,
    ctx: AuthenticatedContext = Depends(require_permission("catalog:read")),
    db: Session = Depends(get_db),
) -> CatalogProductResponse:
    product = catalog_service.get_catalog_product_or_404(db=db, ctx=ctx, product_id=product_id)
    can_view_cost = "catalog:cost" in ctx.permissions
    resp = CatalogProductResponse.model_validate(product)
    resp.aliases = [CatalogAliasResponse.model_validate(a) for a in product.aliases]
    if not can_view_cost:
        resp.unit_cost = None
    return resp


@router.patch("/products/{product_id}", response_model=CatalogProductResponse)
def update_catalog_product(
    product_id: uuid.UUID,
    payload: CatalogProductUpdate,
    ctx: AuthenticatedContext = Depends(require_permission("catalog:manage")),
    db: Session = Depends(get_db),
) -> CatalogProductResponse:
    return catalog_service.update_catalog_product(
        db=db, ctx=ctx, product_id=product_id, payload=payload
    )


@router.post("/products/{product_id}/archive", response_model=CatalogProductResponse)
def archive_catalog_product(
    product_id: uuid.UUID,
    payload: ProductArchiveRequest,
    ctx: AuthenticatedContext = Depends(require_permission("catalog:manage")),
    db: Session = Depends(get_db),
) -> CatalogProductResponse:
    return catalog_service.archive_catalog_product(
        db=db, ctx=ctx, product_id=product_id, expected_version=payload.expected_version
    )


@router.get("/products/{product_id}/aliases", response_model=list[CatalogAliasResponse])
def get_product_aliases(
    product_id: uuid.UUID,
    ctx: AuthenticatedContext = Depends(require_permission("catalog:read")),
    db: Session = Depends(get_db),
) -> list[CatalogAliasResponse]:
    product = catalog_service.get_catalog_product_or_404(db=db, ctx=ctx, product_id=product_id)
    return [CatalogAliasResponse.model_validate(a) for a in product.aliases]


@router.post(
    "/products/{product_id}/aliases",
    response_model=CatalogAliasResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_product_alias(
    product_id: uuid.UUID,
    payload: CatalogAliasCreate,
    ctx: AuthenticatedContext = Depends(require_permission("catalog:manage")),
    db: Session = Depends(get_db),
) -> CatalogAliasResponse:
    return catalog_service.add_product_alias(db=db, ctx=ctx, product_id=product_id, payload=payload)


@router.delete("/aliases/{alias_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product_alias(
    alias_id: uuid.UUID,
    ctx: AuthenticatedContext = Depends(require_permission("catalog:manage")),
    db: Session = Depends(get_db),
) -> None:
    catalog_service.delete_product_alias(db=db, ctx=ctx, alias_id=alias_id)
