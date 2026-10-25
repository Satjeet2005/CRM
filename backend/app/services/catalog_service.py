import math
import unicodedata
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.auth.dependencies import AuthenticatedContext
from app.auth.rbac import has_permission
from app.models.catalog import CatalogAlias, CatalogProduct
from app.schemas.catalog import (
    CatalogAliasCreate,
    CatalogAliasResponse,
    CatalogProductCreate,
    CatalogProductResponse,
    CatalogProductUpdate,
)
from app.schemas.crm import PaginatedResponse
from app.services.activity_service import record_activity


def normalize_alias_text(text: str) -> str:
    """Deterministic Unicode NFKC normalization and lowercased whitespace collapse."""
    normalized = unicodedata.normalize("NFKC", text.strip().lower())
    return " ".join(normalized.split())


def list_catalog_products(
    db: Session,
    ctx: AuthenticatedContext,
    search: Optional[str] = None,
    category: Optional[str] = None,
    manufacturer: Optional[str] = None,
    stock_status: Optional[str] = None,
    is_active: Optional[bool] = True,
    page: int = 1,
    page_size: int = 25,
) -> PaginatedResponse[CatalogProductResponse]:
    page = max(1, page)
    page_size = min(max(1, page_size), 100)

    query = select(CatalogProduct).where(CatalogProduct.organization_id == ctx.organization.id)
    if is_active is not None:
        query = query.where(CatalogProduct.is_active == is_active)
    if category:
        query = query.where(CatalogProduct.category == category)
    if manufacturer:
        query = query.where(CatalogProduct.manufacturer == manufacturer)
    if stock_status:
        query = query.where(CatalogProduct.stock_status == stock_status)

    if search:
        search_pattern = f"%{search.strip()}%"
        norm_search = normalize_alias_text(search)
        query = (
            query.outerjoin(CatalogProduct.aliases)
            .where(
                or_(
                    CatalogProduct.sku.ilike(search_pattern),
                    CatalogProduct.name.ilike(search_pattern),
                    CatalogProduct.manufacturer_part_number.ilike(search_pattern),
                    CatalogAlias.normalized_alias.ilike(f"%{norm_search}%"),
                )
            )
            .distinct()
        )

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    pages = math.ceil(total / page_size) if total > 0 else 1

    query = (
        query.options(selectinload(CatalogProduct.aliases))
        .order_by(CatalogProduct.sku.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    products = db.execute(query).scalars().all()

    can_view_cost = has_permission(ctx.membership.role, "catalog:cost")
    items = []
    for p in products:
        resp = CatalogProductResponse.model_validate(p)
        resp.aliases = [CatalogAliasResponse.model_validate(a) for a in p.aliases]
        if not can_view_cost:
            resp.unit_cost = None
        items.append(resp)

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


def create_catalog_product(
    db: Session,
    ctx: AuthenticatedContext,
    payload: CatalogProductCreate,
) -> CatalogProductResponse:
    # Check SKU uniqueness within organization
    existing = db.execute(
        select(CatalogProduct).where(
            CatalogProduct.organization_id == ctx.organization.id,
            CatalogProduct.sku == payload.sku,
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "SKU_EXISTS",
                "message": f"Product with SKU '{payload.sku}' already exists",
            },
        )

    product = CatalogProduct(
        organization_id=ctx.organization.id,
        sku=payload.sku,
        name=payload.name,
        description=payload.description,
        category=payload.category,
        manufacturer=payload.manufacturer,
        manufacturer_part_number=payload.manufacturer_part_number,
        base_unit=payload.base_unit,
        sell_price=payload.sell_price,
        unit_cost=payload.unit_cost,
        tax_rate_percent=payload.tax_rate_percent,
        stock_status=payload.stock_status,
        attributes_json=payload.attributes_json,
        is_active=True,
        created_by=ctx.user.id,
        version=1,
    )
    db.add(product)
    db.flush()

    record_activity(
        db=db,
        organization_id=ctx.organization.id,
        entity_type="catalog_product",
        entity_id=product.id,
        event_type="catalog_product_created",
        summary=f"Catalog product '{product.sku}' ({product.name}) created by {ctx.user.display_name}",
        actor_user_id=ctx.user.id,
    )
    db.commit()
    db.refresh(product)

    can_view_cost = has_permission(ctx.membership.role, "catalog:cost")
    resp = CatalogProductResponse.model_validate(product)
    if not can_view_cost:
        resp.unit_cost = None
    return resp


def get_catalog_product_or_404(
    db: Session,
    ctx: AuthenticatedContext,
    product_id: uuid.UUID,
) -> CatalogProduct:
    stmt = (
        select(CatalogProduct)
        .where(
            CatalogProduct.id == product_id, CatalogProduct.organization_id == ctx.organization.id
        )
        .options(selectinload(CatalogProduct.aliases))
    )
    product = db.execute(stmt).scalar_one_or_none()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "PRODUCT_NOT_FOUND",
                "message": "Catalog product not found or inaccessible",
            },
        )
    return product


def update_catalog_product(
    db: Session,
    ctx: AuthenticatedContext,
    product_id: uuid.UUID,
    payload: CatalogProductUpdate,
) -> CatalogProductResponse:
    product = get_catalog_product_or_404(db, ctx, product_id)

    if product.version != payload.expected_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "STALE_VERSION",
                "message": f"Catalog product version conflict. Expected {payload.expected_version}, current is {product.version}.",
                "current_version": product.version,
            },
        )

    update_data = payload.model_dump(exclude_unset=True, exclude={"expected_version"})
    for field, val in update_data.items():
        setattr(product, field, val)

    product.version += 1
    product.updated_at = datetime.now(timezone.utc)

    record_activity(
        db=db,
        organization_id=ctx.organization.id,
        entity_type="catalog_product",
        entity_id=product.id,
        event_type="catalog_product_updated",
        summary=f"Catalog product '{product.sku}' updated by {ctx.user.display_name}",
        actor_user_id=ctx.user.id,
    )
    db.commit()
    db.refresh(product)

    can_view_cost = has_permission(ctx.membership.role, "catalog:cost")
    resp = CatalogProductResponse.model_validate(product)
    resp.aliases = [CatalogAliasResponse.model_validate(a) for a in product.aliases]
    if not can_view_cost:
        resp.unit_cost = None
    return resp


def archive_catalog_product(
    db: Session,
    ctx: AuthenticatedContext,
    product_id: uuid.UUID,
    expected_version: int,
) -> CatalogProductResponse:
    product = get_catalog_product_or_404(db, ctx, product_id)

    if product.version != expected_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "STALE_VERSION",
                "message": f"Catalog product version conflict. Expected {expected_version}, current is {product.version}.",
                "current_version": product.version,
            },
        )

    product.is_active = False
    product.version += 1
    product.updated_at = datetime.now(timezone.utc)

    record_activity(
        db=db,
        organization_id=ctx.organization.id,
        entity_type="catalog_product",
        entity_id=product.id,
        event_type="catalog_product_archived",
        summary=f"Catalog product '{product.sku}' archived by {ctx.user.display_name}",
        actor_user_id=ctx.user.id,
    )
    db.commit()
    db.refresh(product)

    can_view_cost = has_permission(ctx.membership.role, "catalog:cost")
    resp = CatalogProductResponse.model_validate(product)
    resp.aliases = [CatalogAliasResponse.model_validate(a) for a in product.aliases]
    if not can_view_cost:
        resp.unit_cost = None
    return resp


# ==================== Alias Operations ====================


def add_product_alias(
    db: Session,
    ctx: AuthenticatedContext,
    product_id: uuid.UUID,
    payload: CatalogAliasCreate,
) -> CatalogAliasResponse:
    product = get_catalog_product_or_404(db, ctx, product_id)
    norm_alias = normalize_alias_text(payload.alias_text)

    # Check duplicate alias for this product
    existing_same = db.execute(
        select(CatalogAlias).where(
            CatalogAlias.product_id == product.id,
            CatalogAlias.normalized_alias == norm_alias,
        )
    ).scalar_one_or_none()
    if existing_same:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "ALIAS_EXISTS",
                "message": f"Alias '{payload.alias_text}' already exists for this product.",
            },
        )

    # Detect alias matching another product
    existing_other = db.execute(
        select(CatalogAlias).where(
            CatalogAlias.organization_id == ctx.organization.id,
            CatalogAlias.normalized_alias == norm_alias,
            CatalogAlias.product_id != product.id,
        )
    ).scalar_one_or_none()
    if existing_other:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "ALIAS_CONFLICT",
                "message": f"Alias '{payload.alias_text}' is already assigned to another catalog product.",
            },
        )

    alias = CatalogAlias(
        organization_id=ctx.organization.id,
        product_id=product.id,
        alias_text=payload.alias_text.strip(),
        normalized_alias=norm_alias,
        created_by=ctx.user.id,
    )
    db.add(alias)
    db.flush()

    record_activity(
        db=db,
        organization_id=ctx.organization.id,
        entity_type="catalog_alias",
        entity_id=alias.id,
        event_type="catalog_alias_created",
        summary=f"Alias '{alias.alias_text}' added to product '{product.sku}' by {ctx.user.display_name}",
        actor_user_id=ctx.user.id,
    )
    db.commit()
    db.refresh(alias)

    return CatalogAliasResponse.model_validate(alias)


def delete_product_alias(
    db: Session,
    ctx: AuthenticatedContext,
    alias_id: uuid.UUID,
) -> None:
    alias = db.execute(
        select(CatalogAlias).where(
            CatalogAlias.id == alias_id,
            CatalogAlias.organization_id == ctx.organization.id,
        )
    ).scalar_one_or_none()
    if not alias:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ALIAS_NOT_FOUND", "message": "Catalog alias not found"},
        )

    product = db.execute(
        select(CatalogProduct).where(CatalogProduct.id == alias.product_id)
    ).scalar_one_or_none()
    product_sku = product.sku if product else str(alias.product_id)

    db.delete(alias)
    record_activity(
        db=db,
        organization_id=ctx.organization.id,
        entity_type="catalog_alias",
        entity_id=alias.id,
        event_type="catalog_alias_deleted",
        summary=f"Alias '{alias.alias_text}' removed from product '{product_sku}' by {ctx.user.display_name}",
        actor_user_id=ctx.user.id,
    )
    db.commit()
