from app.auth.rbac import Role, get_role_permissions, has_permission


def test_sales_rep_permissions():
    perms = get_role_permissions(Role.SALES_REP)
    assert "crm:read" in perms
    assert "crm:write" in perms
    assert "quotes:draft" in perms
    assert "proposals:create" in perms
    # Hard prohibition: sales_rep cannot approve proposals
    assert "proposals:approve" not in perms
    assert "users:manage" not in perms
    assert has_permission(Role.SALES_REP, "proposals:approve") is False


def test_sales_manager_permissions():
    perms = get_role_permissions(Role.SALES_MANAGER)
    assert "crm:read" in perms
    assert "quotes:read" in perms
    assert "proposals:approve" in perms
    assert "audit:read" in perms
    # Cannot manage users or catalog
    assert "users:manage" not in perms
    assert "catalog:manage" not in perms


def test_catalog_manager_permissions():
    perms = get_role_permissions(Role.CATALOG_MANAGER)
    assert "catalog:read" in perms
    assert "catalog:manage" in perms
    assert "rfq:resolve" in perms
    # Cannot draft quotes or approve proposals
    assert "quotes:draft" not in perms
    assert "proposals:approve" not in perms


def test_admin_permissions():
    perms = get_role_permissions(Role.ADMIN)
    assert "users:manage" in perms
    assert "settings:manage" in perms
    assert "crm:write" in perms
    assert "proposals:approve" in perms
