import uuid

from fastapi.testclient import TestClient

from app.config import settings
from app.seed.demo_seed import DEMO_PASSWORD


def auth_client(client: TestClient, email: str = "sales@forgeflow.demo") -> dict[str, str]:
    # Clear any previous cookies to avoid CSRF mismatch on re-login
    client.cookies.clear()
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": DEMO_PASSWORD},
    )
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    csrf_token = login_resp.cookies.get(settings.CSRF_COOKIE_NAME, "")
    return {
        "Origin": "http://testserver",
        "X-CSRF-Token": csrf_token,
    }


def test_accounts_crud_and_search(client: TestClient):
    headers = auth_client(client, "sales@forgeflow.demo")

    # 1. List accounts - should have seeded accounts
    resp = client.get("/api/v1/accounts")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 10
    assert len(data["items"]) >= 10

    # 2. Search accounts
    resp_search = client.get("/api/v1/accounts?search=Bharat")
    assert resp_search.status_code == 200
    search_data = resp_search.json()
    assert search_data["total"] >= 1
    assert any("Bharat" in acc["name"] for acc in search_data["items"])

    # 3. Create a new account
    create_payload = {
        "name": "Test Industrial Corporation",
        "industry": "Manufacturing",
        "account_type": "customer",
        "notes": "Testing account creation",
    }
    resp_create = client.post("/api/v1/accounts", json=create_payload, headers=headers)
    assert resp_create.status_code == 201
    created_acc = resp_create.json()
    acc_id = created_acc["id"]
    version = created_acc["version"]
    assert created_acc["name"] == "Test Industrial Corporation"
    assert created_acc["status"] == "active"

    # 4. Read single account
    resp_get = client.get(f"/api/v1/accounts/{acc_id}")
    assert resp_get.status_code == 200
    assert resp_get.json()["id"] == acc_id

    # 5. Update account with optimistic locking
    resp_update = client.patch(
        f"/api/v1/accounts/{acc_id}",
        json={"website": "https://testindcorp.example.com", "expected_version": version},
        headers=headers,
    )
    assert resp_update.status_code == 200
    updated_acc = resp_update.json()
    assert updated_acc["website"] == "https://testindcorp.example.com"
    new_version = updated_acc["version"]
    assert new_version == version + 1

    # 6. Soft archive account via /archive endpoint
    resp_archive = client.post(
        f"/api/v1/accounts/{acc_id}/archive",
        json={"expected_version": new_version},
        headers=headers,
    )
    assert resp_archive.status_code == 200
    assert resp_archive.json()["status"] == "archived"

    # 7. Default list should exclude archived
    resp_list = client.get("/api/v1/accounts")
    assert all(a["id"] != acc_id for a in resp_list.json()["items"])

    # 8. Filter by status=archived should include it
    resp_archived = client.get("/api/v1/accounts?status=archived")
    assert any(a["id"] == acc_id for a in resp_archived.json()["items"])


def test_contact_primary_uniqueness_and_switch(client: TestClient):
    headers = auth_client(client, "sales@forgeflow.demo")

    # Get an account
    resp_accounts = client.get("/api/v1/accounts")
    account_id = resp_accounts.json()["items"][0]["id"]

    # 1. Create first primary contact via /accounts/{account_id}/contacts
    c1_payload = {
        "first_name": "Arun",
        "last_name": "Kumar",
        "email": "arun.kumar@testcompany.example",
        "phone": "+91 98765 00001",
        "job_title": "Procurement Lead",
        "is_primary": True,
    }
    resp_c1 = client.post(
        f"/api/v1/accounts/{account_id}/contacts", json=c1_payload, headers=headers
    )
    assert resp_c1.status_code == 201
    c1 = resp_c1.json()
    c1_id = c1["id"]
    assert c1["is_primary"] is True

    # 2. Create second contact, also set to primary -> previous should be flipped to False
    c2_payload = {
        "first_name": "Priya",
        "last_name": "Nair",
        "email": "priya.nair@testcompany.example",
        "phone": "+91 98765 00002",
        "job_title": "Director of Supply Chain",
        "is_primary": True,
    }
    resp_c2 = client.post(
        f"/api/v1/accounts/{account_id}/contacts", json=c2_payload, headers=headers
    )
    assert resp_c2.status_code == 201
    c2 = resp_c2.json()
    c2_id = c2["id"]
    assert c2["is_primary"] is True

    # Verify c1 is no longer primary
    resp_c1_updated = client.get(f"/api/v1/contacts?account_id={account_id}")
    items = {c["id"]: c for c in resp_c1_updated.json()["items"]}
    assert items[c1_id]["is_primary"] is False
    c1_latest_version = items[c1_id]["version"]

    # 3. Patch c1 back to primary -> c2 should become non-primary
    resp_switch = client.patch(
        f"/api/v1/contacts/{c1_id}",
        json={"is_primary": True, "expected_version": c1_latest_version},
        headers=headers,
    )
    assert resp_switch.status_code == 200
    assert resp_switch.json()["is_primary"] is True

    resp_after = client.get(f"/api/v1/contacts?account_id={account_id}")
    items_after = {c["id"]: c for c in resp_after.json()["items"]}
    assert items_after[c2_id]["is_primary"] is False


def test_opportunity_stage_transitions_and_rules(client: TestClient):
    # 1. Login as sales rep
    rep_headers = auth_client(client, "sales@forgeflow.demo")

    resp_accounts = client.get("/api/v1/accounts")
    account_id = resp_accounts.json()["items"][0]["id"]

    # Create new opportunity in lead stage
    opp_payload = {
        "account_id": account_id,
        "name": "Solar Array Inverter Upgrade",
        "stage": "lead",
        "estimated_value": 450000.00,
        "probability_percent": 30,
        "expected_close_date": "2026-11-30",
    }
    resp_opp = client.post("/api/v1/opportunities", json=opp_payload, headers=rep_headers)
    assert resp_opp.status_code == 201
    opp = resp_opp.json()
    opp_id = opp["id"]
    version = opp["version"]
    assert opp["stage"] == "lead"

    # Forward transition to qualified via /stage endpoint
    resp_fwd = client.post(
        f"/api/v1/opportunities/{opp_id}/stage",
        json={"stage": "qualified", "expected_version": version},
        headers=rep_headers,
    )
    assert resp_fwd.status_code == 200
    opp = resp_fwd.json()
    version = opp["version"]
    assert opp["stage"] == "qualified"

    # Forward transition to solutioning via /stage endpoint
    resp_sol = client.post(
        f"/api/v1/opportunities/{opp_id}/stage",
        json={"stage": "solutioning", "expected_version": version},
        headers=rep_headers,
    )
    assert resp_sol.status_code == 200
    opp = resp_sol.json()
    version = opp["version"]
    assert opp["stage"] == "solutioning"

    # Transition to lost without loss_reason should fail (422)
    resp_lost_fail = client.post(
        f"/api/v1/opportunities/{opp_id}/stage",
        json={"stage": "lost", "expected_version": version},
        headers=rep_headers,
    )
    assert resp_lost_fail.status_code == 422

    # Transition to lost with loss_reason succeeds
    resp_lost = client.post(
        f"/api/v1/opportunities/{opp_id}/stage",
        json={
            "stage": "lost",
            "loss_reason": "competitor",
            "loss_detail": "Competitor offered lower upfront pricing",
            "expected_version": version,
        },
        headers=rep_headers,
    )
    assert resp_lost.status_code == 200
    opp = resp_lost.json()
    version = opp["version"]
    assert opp["stage"] == "lost"
    assert opp["loss_reason"] == "competitor"

    # Reopening without reason should fail (422)
    resp_reopen_fail = client.post(
        f"/api/v1/opportunities/{opp_id}/reopen",
        json={"reason": "", "expected_version": version},
        headers=rep_headers,
    )
    assert resp_reopen_fail.status_code == 422

    # Reopening with reason succeeds (returns to qualified)
    resp_reopen = client.post(
        f"/api/v1/opportunities/{opp_id}/reopen",
        json={
            "reason": "Customer re-engaged after competitor failure",
            "expected_version": version,
        },
        headers=rep_headers,
    )
    assert resp_reopen.status_code == 200
    opp = resp_reopen.json()
    version = opp["version"]
    assert opp["stage"] == "qualified"

    # Progress through stages to negotiation
    for next_st in ["solutioning", "proposal", "negotiation"]:
        resp_st = client.post(
            f"/api/v1/opportunities/{opp_id}/stage",
            json={"stage": next_st, "expected_version": version},
            headers=rep_headers,
        )
        assert resp_st.status_code == 200
        opp = resp_st.json()
        version = opp["version"]
        assert opp["stage"] == next_st

    # Phase 2 Won Transition restriction:
    # Sales rep cannot mark won (403)
    rep_headers = auth_client(client, "sales@forgeflow.demo")
    resp_won_rep = client.post(
        f"/api/v1/opportunities/{opp_id}/stage",
        json={
            "stage": "won",
            "won_override_reason": "Signed contract received",
            "expected_version": version,
        },
        headers=rep_headers,
    )
    assert resp_won_rep.status_code == 403

    # Manager marking won without won_override_reason fails (422)
    mgr_headers = auth_client(client, "manager@forgeflow.demo")
    resp_won_mgr_no_reason = client.post(
        f"/api/v1/opportunities/{opp_id}/stage",
        json={"stage": "won", "expected_version": version},
        headers=mgr_headers,
    )
    assert resp_won_mgr_no_reason.status_code == 422

    # Manager marking won with won_override_reason succeeds
    resp_won_mgr = client.post(
        f"/api/v1/opportunities/{opp_id}/stage",
        json={
            "stage": "won",
            "won_override_reason": "Signed advance payment purchase order PO-9982",
            "expected_version": version,
        },
        headers=mgr_headers,
    )
    assert resp_won_mgr.status_code == 200
    assert resp_won_mgr.json()["stage"] == "won"


def test_tasks_lifecycle_and_due_dates(client: TestClient):
    headers = auth_client(client, "sales@forgeflow.demo")

    resp_accounts = client.get("/api/v1/accounts")
    account_id = resp_accounts.json()["items"][0]["id"]

    # 1. Create a task with overdue date (past date)
    task_payload = {
        "title": "Submit revised electrical drawing",
        "description": "Send single line diagrams for feeder line 3",
        "account_id": account_id,
        "priority": "high",
        "due_date": "2026-10-01",
    }
    resp_task = client.post("/api/v1/tasks", json=task_payload, headers=headers)
    assert resp_task.status_code == 201
    task = resp_task.json()
    task_id = task["id"]
    version = task["version"]
    assert task["status"] == "open"
    assert task["is_overdue"] is True
    assert task["completed_at"] is None

    # 2. Complete task
    resp_complete = client.post(
        f"/api/v1/tasks/{task_id}/complete",
        json={"expected_version": version},
        headers=headers,
    )
    assert resp_complete.status_code == 200
    completed_task = resp_complete.json()
    version = completed_task["version"]
    assert completed_task["status"] == "completed"
    assert completed_task["completed_at"] is not None
    # Completed task should not be overdue
    assert completed_task["is_overdue"] is False

    # 3. Reopen task (undo completion)
    resp_reopen = client.post(
        f"/api/v1/tasks/{task_id}/reopen",
        json={"expected_version": version},
        headers=headers,
    )
    assert resp_reopen.status_code == 200
    reopened_task = resp_reopen.json()
    assert reopened_task["status"] == "open"
    assert reopened_task["completed_at"] is None
    assert reopened_task["is_overdue"] is True


def test_catalog_rbac_cost_isolation(client: TestClient):
    # 1. Sales rep logs in
    rep_headers = auth_client(client, "sales@forgeflow.demo")
    resp_rep = client.get("/api/v1/catalog/products", headers=rep_headers)
    assert resp_rep.status_code == 200
    products_rep = resp_rep.json()["items"]
    assert len(products_rep) > 0
    # Sales rep MUST NOT see unit_cost
    for p in products_rep:
        assert p.get("unit_cost") is None

    first_product_id = products_rep[0]["id"]
    # Detail view also hides unit_cost
    resp_detail_rep = client.get(
        f"/api/v1/catalog/products/{first_product_id}", headers=rep_headers
    )
    assert resp_detail_rep.status_code == 200
    assert resp_detail_rep.json().get("unit_cost") is None

    # Sales rep cannot create catalog product (403)
    resp_create_rep = client.post(
        "/api/v1/catalog/products",
        json={
            "sku": "FORBIDDEN-01",
            "name": "Forbidden Item",
            "category": "Raw Materials",
            "base_unit": "ea",
            "sell_price": 100.0,
            "unit_cost": 50.0,
        },
        headers=rep_headers,
    )
    assert resp_create_rep.status_code == 403

    # 2. Catalog manager logs in
    cat_headers = auth_client(client, "catalog@forgeflow.demo")
    resp_cat = client.get("/api/v1/catalog/products", headers=cat_headers)
    assert resp_cat.status_code == 200
    products_cat = resp_cat.json()["items"]
    assert len(products_cat) > 0
    # Catalog manager MUST see unit_cost
    assert any(p.get("unit_cost") is not None for p in products_cat)

    resp_detail_cat = client.get(
        f"/api/v1/catalog/products/{first_product_id}", headers=cat_headers
    )
    assert resp_detail_cat.status_code == 200
    assert resp_detail_cat.json().get("unit_cost") is not None

    # Catalog manager can create product and alias
    new_sku = f"MOTOR-{uuid.uuid4().hex[:6].upper()}"
    create_prod_resp = client.post(
        "/api/v1/catalog/products",
        json={
            "sku": new_sku,
            "name": "High Torque Servo Motor 750W",
            "category": "Motors & Drives",
            "base_unit": "ea",
            "sell_price": 28500.00,
            "unit_cost": 19000.00,
            "tax_rate_percent": 18.0,
        },
        headers=cat_headers,
    )
    assert create_prod_resp.status_code == 201
    new_prod_id = create_prod_resp.json()["id"]

    # Create alias for product
    create_alias_resp = client.post(
        f"/api/v1/catalog/products/{new_prod_id}/aliases",
        json={
            "alias_text": "750W Servo Drive Motor Unit",
        },
        headers=cat_headers,
    )
    assert create_alias_resp.status_code == 201
    assert create_alias_resp.json()["alias_text"] == "750W Servo Drive Motor Unit"


def test_dashboard_metrics_and_attention_contract(client: TestClient):
    headers = auth_client(client, "sales@forgeflow.demo")

    # 1. Summary
    resp_sum = client.get("/api/v1/dashboard/summary", headers=headers)
    assert resp_sum.status_code == 200
    data = resp_sum.json()

    assert "open_pipeline_value" in data
    assert "open_opportunities_count" in data
    assert "active_accounts_count" in data
    assert "overdue_tasks_count" in data
    assert data["open_opportunities_count"] >= 1
    assert data["active_accounts_count"] >= 10
    assert data["overdue_tasks_count"] >= 1

    # Verify phase markers
    assert data["quotes_awaiting_approval"] is None or data["quotes_awaiting_approval"] >= 0
    assert data["open_rfq_review_lines"] is not None and data["open_rfq_review_lines"] >= 0
    assert "phase_4" in data["quotes_availability"] or data["quotes_availability"] == "available"
    assert data["rfq_availability"] == "available"

    # Verify Operational Analytics Aggregates
    assert "rfq_match_health" in data and data["rfq_match_health"] is not None
    rfq_health = data["rfq_match_health"]
    assert "total_lines" in rfq_health
    assert "categories" in rfq_health
    assert sum(c["count"] for c in rfq_health["categories"]) == rfq_health["total_lines"]
    rfq_statuses = {c["status"] for c in rfq_health["categories"]}
    assert rfq_statuses == {"exact_match", "matched", "needs_review", "unmatched"}

    assert "quote_lifecycle" in data and data["quote_lifecycle"] is not None
    quote_life = data["quote_lifecycle"]
    assert "total_quotes" in quote_life
    assert "categories" in quote_life
    assert sum(c["count"] for c in quote_life["categories"]) == quote_life["total_quotes"]
    quote_statuses = {c["status"] for c in quote_life["categories"]}
    assert quote_statuses == {"draft", "pending_approval", "approved", "rejected", "expired"}

    assert "task_due_load" in data and data["task_due_load"] is not None
    task_load = data["task_due_load"]
    assert "total_open_tasks" in task_load
    assert "categories" in task_load
    assert sum(c["count"] for c in task_load["categories"]) == task_load["total_open_tasks"]
    task_buckets = {c["bucket"]: c["count"] for c in task_load["categories"]}
    assert task_buckets["overdue"] == data["overdue_tasks_count"]

    # 2. Attention Queue
    resp_att = client.get("/api/v1/dashboard/attention", headers=headers)
    assert resp_att.status_code == 200
    att_items = resp_att.json()
    assert isinstance(att_items, list)
    assert len(att_items) >= 1
    # Check shape of attention item
    first_att = att_items[0]
    assert "id" in first_att
    assert "item_type" in first_att
    assert "severity" in first_att
    assert "title" in first_att


def test_cross_tenant_isolation(client: TestClient):
    # Log in as demo user
    headers = auth_client(client, "sales@forgeflow.demo")

    # Try accessing random UUID not in this org
    random_id = uuid.uuid4()
    resp_acc = client.get(f"/api/v1/accounts/{random_id}", headers=headers)
    assert resp_acc.status_code == 404
    assert resp_acc.json()["code"] == "ACCOUNT_NOT_FOUND"

    resp_opp = client.get(f"/api/v1/opportunities/{random_id}", headers=headers)
    assert resp_opp.status_code == 404

    resp_task = client.get(f"/api/v1/tasks/{random_id}", headers=headers)
    assert resp_task.status_code == 404

    resp_prod = client.get(f"/api/v1/catalog/products/{random_id}", headers=headers)
    assert resp_prod.status_code == 404
