from decimal import Decimal

from fastapi.testclient import TestClient


def auth_client(client: TestClient, email: str) -> dict[str, str]:
    """Helper to login synthetic role account and retrieve CSRF headers."""
    client.cookies.clear()
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "ForgeFlowDemo!2026"},
    )
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    csrf_token = resp.cookies.get("forgeflow_csrf") or client.cookies.get("forgeflow_csrf", "")
    return {
        "X-CSRF-Token": csrf_token,
        "Origin": "http://testserver",
    }


def test_list_quotes(client: TestClient):
    headers = auth_client(client, "sales@forgeflow.demo")
    resp = client.get("/api/v1/quotes", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert data["total"] >= 2
    q_numbers = [item["quote_number"] for item in data["items"]]
    assert "QT-2026-0001" in q_numbers
    assert "QT-2026-0002" in q_numbers


def test_quote_detail_and_rbac_cost_masking(client: TestClient):
    # 1. Sales Rep must NOT see unit cost or margin fields
    sales_headers = auth_client(client, "sales@forgeflow.demo")
    list_resp = client.get("/api/v1/quotes", headers=sales_headers)
    q1 = next(q for q in list_resp.json()["items"] if q["quote_number"] == "QT-2026-0001")
    q1_id = q1["id"]

    detail_resp = client.get(f"/api/v1/quotes/{q1_id}", headers=sales_headers)
    assert detail_resp.status_code == 200
    rep_data = detail_resp.json()

    # Lines cost masking
    assert rep_data["current_revision"] is not None
    for line in rep_data["current_revision"]["lines"]:
        assert line["unit_cost"] is None
        assert line["line_cost"] is None
        assert line["line_gross_profit"] is None
        assert line["margin_percent"] is None

    # Totals cost masking
    totals = rep_data["current_revision"]["totals"]
    assert totals["total_cost"] is None
    assert totals["total_gross_profit"] is None
    assert totals["overall_margin_percent"] is None
    assert Decimal(str(totals["grand_total"])) > Decimal("500000.00")

    # Policy evaluation triggers must be visible to Sales Rep
    assert rep_data["requires_manager_approval"] is True
    trigger_rules = [t["rule_id"] for t in rep_data["approval_triggers"]]
    assert "rule_line_discount_threshold" in trigger_rules
    assert "rule_quote_grand_total_threshold" in trigger_rules

    # 2. Admin MUST see real unit costs and margin
    admin_headers = auth_client(client, "admin@forgeflow.demo")
    admin_detail = client.get(f"/api/v1/quotes/{q1_id}", headers=admin_headers)
    assert admin_detail.status_code == 200
    admin_data = admin_detail.json()

    admin_lines = admin_data["current_revision"]["lines"]
    assert admin_lines[0]["unit_cost"] is not None
    assert Decimal(str(admin_lines[0]["unit_cost"])) == Decimal("2000.00")
    assert admin_lines[0]["margin_percent"] is not None

    admin_totals = admin_data["current_revision"]["totals"]
    assert admin_totals["total_cost"] is not None
    assert admin_totals["overall_margin_percent"] is not None


def test_calculation_trace_and_masking(client: TestClient):
    sales_headers = auth_client(client, "sales@forgeflow.demo")
    list_resp = client.get("/api/v1/quotes", headers=sales_headers)
    q1 = next(q for q in list_resp.json()["items"] if q["quote_number"] == "QT-2026-0001")
    q1_id = q1["id"]

    # Rep sees trace without internal cost/margin nodes
    rep_trace_resp = client.get(f"/api/v1/quotes/{q1_id}/calculation-trace", headers=sales_headers)
    assert rep_trace_resp.status_code == 200
    rep_trace = rep_trace_resp.json()
    assert len(rep_trace["nodes"]) > 0
    for node in rep_trace["nodes"]:
        assert node["is_internal"] is False
        assert "cost" not in node["label"].lower()
        assert "margin" not in node["label"].lower()

    # Admin sees full trace including internal cost/margin nodes
    admin_headers = auth_client(client, "admin@forgeflow.demo")
    admin_trace_resp = client.get(
        f"/api/v1/quotes/{q1_id}/calculation-trace", headers=admin_headers
    )
    assert admin_trace_resp.status_code == 200
    admin_trace = admin_trace_resp.json()
    internal_nodes = [n for n in admin_trace["nodes"] if n["is_internal"]]
    assert len(internal_nodes) > 0


def test_quote_revisions_list_and_detail(client: TestClient):
    headers = auth_client(client, "sales@forgeflow.demo")
    list_resp = client.get("/api/v1/quotes", headers=headers)
    q1 = next(q for q in list_resp.json()["items"] if q["quote_number"] == "QT-2026-0001")
    q1_id = q1["id"]

    revs_resp = client.get(f"/api/v1/quotes/{q1_id}/revisions", headers=headers)
    assert revs_resp.status_code == 200
    revs = revs_resp.json()
    assert len(revs) >= 1
    rev1 = revs[0]
    assert rev1["revision_number"] == 1

    rev_detail_resp = client.get(f"/api/v1/quotes/{q1_id}/revisions/{rev1['id']}", headers=headers)
    assert rev_detail_resp.status_code == 200
    assert rev_detail_resp.json()["id"] == rev1["id"]


def test_update_quote_draft_and_optimistic_locking(client: TestClient):
    headers = auth_client(client, "sales@forgeflow.demo")
    list_resp = client.get("/api/v1/quotes", headers=headers)
    q2 = next(q for q in list_resp.json()["items"] if q["quote_number"] == "QT-2026-0002")
    q2_id = q2["id"]

    detail_resp = client.get(f"/api/v1/quotes/{q2_id}", headers=headers)
    curr_q = detail_resp.json()
    curr_version = curr_q["version"]
    lines = curr_q["current_revision"]["lines"]

    # 1. Update line 1 quantity from 100 to 120 and add a 4% discount
    updated_lines_payload = [
        {
            "id": lines[0]["id"],
            "line_order": lines[0]["line_order"],
            "sku": lines[0]["sku"],
            "product_name": lines[0]["product_name"],
            "description": lines[0]["description"],
            "unit": lines[0]["unit"],
            "quantity": "120.0000",
            "unit_price": str(lines[0]["unit_price"]),
            "discount_percent": "4.00",
            "tax_rate_percent": str(lines[0]["tax_rate_percent"]),
            "catalog_product_id": lines[0]["catalog_product_id"],
        },
        {
            "id": lines[1]["id"],
            "line_order": lines[1]["line_order"],
            "sku": lines[1]["sku"],
            "product_name": lines[1]["product_name"],
            "description": lines[1]["description"],
            "unit": lines[1]["unit"],
            "quantity": str(lines[1]["quantity"]),
            "unit_price": str(lines[1]["unit_price"]),
            "discount_percent": str(lines[1]["discount_percent"]),
            "tax_rate_percent": str(lines[1]["tax_rate_percent"]),
            "catalog_product_id": lines[1]["catalog_product_id"],
        },
    ]

    patch_resp = client.patch(
        f"/api/v1/quotes/{q2_id}/draft",
        json={
            "expected_version": curr_version,
            "notes": "Updated fasteners quote with revised quantity",
            "payment_terms": "Net 30",
            "delivery_terms": "Ex-Works Pune",
            "lines": updated_lines_payload,
        },
        headers=headers,
    )
    assert patch_resp.status_code == 200
    updated_q = patch_resp.json()
    assert updated_q["version"] == curr_version + 1
    assert updated_q["payment_terms"] == "Net 30"
    new_lines = updated_q["current_revision"]["lines"]
    assert Decimal(str(new_lines[0]["quantity"])) == Decimal("120.0000")
    assert Decimal(str(new_lines[0]["discount_percent"])) == Decimal("4.00")

    # 2. Stale version update must fail with 409 Conflict
    stale_resp = client.patch(
        f"/api/v1/quotes/{q2_id}/draft",
        json={
            "expected_version": curr_version,  # Old version!
            "notes": "Attempting stale update",
            "lines": updated_lines_payload,
        },
        headers=headers,
    )
    assert stale_resp.status_code == 409
    assert stale_resp.json()["code"] == "STALE_VERSION"
