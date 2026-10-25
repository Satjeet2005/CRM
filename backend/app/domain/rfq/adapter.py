"""
Adapter converting ForgeFlow Catalog models into the pure matcher catalog input format.
"""

import uuid
from typing import Any, Dict, List, Sequence

from app.models.catalog import CatalogAlias, CatalogProduct


def build_matcher_catalog(
    products: Sequence[CatalogProduct],
    aliases: Sequence[CatalogAlias],
) -> List[Dict[str, Any]]:
    """
    Transforms active CatalogProduct and CatalogAlias database rows
    into the snapshot structure expected by ProposedMatcher.
    """
    aliases_by_product_id: Dict[uuid.UUID, List[str]] = {}
    for a in aliases:
        aliases_by_product_id.setdefault(a.product_id, []).append(a.alias_text)

    catalog_items: List[Dict[str, Any]] = []
    for p in products:
        if not p.is_active:
            continue

        attrs: Dict[str, str] = {}
        if p.attributes_json and isinstance(p.attributes_json, dict):
            for k, v in p.attributes_json.items():
                attrs[str(k).lower()] = str(v)

        # Standard dimension mappings if present in attributes_json
        if "dn_mm" in attrs and "size_mm" not in attrs:
            attrs["size_mm"] = str(attrs["dn_mm"])

        prod_aliases = aliases_by_product_id.get(p.id, [])

        catalog_items.append(
            {
                "id": str(p.id),
                "product_id": str(p.id),
                "sku": p.sku,
                "name": p.name,
                "category": p.category,
                "uom": p.base_unit,
                "manufacturer": p.manufacturer,
                "manufacturer_part_number": p.manufacturer_part_number,
                "attributes": attrs,
                "aliases": prod_aliases,
            }
        )

    return catalog_items
