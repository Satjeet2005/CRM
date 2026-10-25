from enum import StrEnum


class Role(StrEnum):
    SALES_REP = "sales_rep"
    SALES_MANAGER = "sales_manager"
    CATALOG_MANAGER = "catalog_manager"
    ADMIN = "admin"


# Role to permissions mapping
ROLE_PERMISSIONS: dict[str, set[str]] = {
    Role.SALES_REP: {
        "crm:read",
        "crm:write",
        "rfq:read",
        "rfq:import",
        "rfq:resolve",
        "catalog:read",
        "quotes:draft",
        "quotes:read",
        "proposals:create",
        "quotes:export",
    },
    Role.SALES_MANAGER: {
        "crm:read",
        "crm:write",
        "rfq:read",
        "catalog:read",
        "quotes:read",
        "proposals:approve",
        "quotes:export",
        "audit:read",
    },
    Role.CATALOG_MANAGER: {
        "crm:read",
        "rfq:read",
        "rfq:resolve",
        "catalog:read",
        "catalog:manage",
        "catalog:cost",
    },
    Role.ADMIN: {
        "crm:read",
        "crm:write",
        "rfq:read",
        "rfq:import",
        "rfq:resolve",
        "catalog:read",
        "catalog:manage",
        "catalog:cost",
        "quotes:draft",
        "quotes:read",
        "proposals:create",
        "proposals:approve",
        "quotes:export",
        "audit:read",
        "users:manage",
        "settings:manage",
    },
}


def get_role_permissions(role: str) -> list[str]:
    """Retrieve the sorted list of permission keys for a given role."""
    return sorted(list(ROLE_PERMISSIONS.get(role, set())))


def has_permission(role: str, permission: str) -> bool:
    """Check whether a role possesses a specific permission."""
    return permission in ROLE_PERMISSIONS.get(role, set())
