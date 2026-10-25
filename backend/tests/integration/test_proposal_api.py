import uuid

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


def test_proposal_lifecycle_and_maker_checker(client: TestClient):
    # 1. Login as Sales Rep and fetch QT-2026-0001
    sales_headers = auth_client(client, "sales@forgeflow.demo")
    quotes_resp = client.get("/api/v1/quotes", headers=sales_headers)
    assert quotes_resp.status_code == 200
    q1 = next(q for q in quotes_resp.json()["items"] if q["quote_number"] == "QT-2026-0001")
    q1_id = q1["id"]

    detail_resp = client.get(f"/api/v1/quotes/{q1_id}", headers=sales_headers)
    assert detail_resp.status_code == 200
    q_data = detail_resp.json()
    base_rev = q_data["current_revision"]
    base_rev_id = base_rev["id"]
    target_line = base_rev["lines"][0]

    # 2. Sales Rep creates change proposal
    create_payload = {
        "quote_id": q1_id,
        "base_revision_id": base_rev_id,
        "title": "Discount Increase for Key Account",
        "justification": "Customer requested 8% discount due to volume purchase commitment.",
        "operations": [
            {
                "type": "set_line_discount_percent",
                "target_line_id": target_line["id"],
                "value": "8.00",
            },
            {
                "type": "set_payment_terms",
                "value": "Net 45",
            },
        ],
        "idempotency_key": str(uuid.uuid4()),
    }
    create_resp = client.post(
        f"/api/v1/quotes/{q1_id}/proposals",
        json=create_payload,
        headers=sales_headers,
    )
    assert create_resp.status_code == 200
    proposal = create_resp.json()
    proposal_id = proposal["id"]
    assert proposal["status"] == "draft"
    assert len(proposal["operations"]) == 2

    # 3. Proposer edits draft proposal
    patch_resp = client.patch(
        f"/api/v1/proposals/{proposal_id}",
        json={"justification": "Updated: Customer committed to annual volume contract."},
        headers=sales_headers,
    )
    assert patch_resp.status_code == 200
    assert (
        patch_resp.json()["justification"]
        == "Updated: Customer committed to annual volume contract."
    )

    # 4. Proposer inspects structured diff
    diff_resp = client.get(f"/api/v1/proposals/{proposal_id}/diff", headers=sales_headers)
    assert diff_resp.status_code == 200
    diff_data = diff_resp.json()
    assert "terms_diff" in diff_data
    assert "payment_terms" in diff_data["terms_diff"]
    assert diff_data["terms_diff"]["payment_terms"]["proposed"] == "Net 45"
    # Cost fields must be masked for sales rep
    assert diff_data["financial_impact"]["base_total_cost"] is None

    # 5. Proposer submits proposal for review
    submit_resp = client.post(f"/api/v1/proposals/{proposal_id}/submit", headers=sales_headers)
    assert submit_resp.status_code == 200
    assert submit_resp.json()["status"] == "pending_review"

    # Editing after submit must be rejected
    cant_patch = client.patch(
        f"/api/v1/proposals/{proposal_id}",
        json={"justification": "Trying to edit after submit"},
        headers=sales_headers,
    )
    assert cant_patch.status_code == 409

    # 6. Maker-Checker Invariant: Sales Rep attempts to approve own proposal -> 403 Forbidden
    self_approve = client.post(
        f"/api/v1/proposals/{proposal_id}/approve",
        json={"decision": "approved", "notes": "Self approving"},
        headers=sales_headers,
    )
    assert self_approve.status_code == 403

    # 7. Login as Sales Manager -> sees proposal in Approval Queue
    manager_headers = auth_client(client, "manager@forgeflow.demo")
    queue_resp = client.get("/api/v1/approvals?status=pending", headers=manager_headers)
    assert queue_resp.status_code == 200
    queue_data = queue_resp.json()
    assert any(item["proposal_id"] == proposal_id for item in queue_data["items"])

    # 8. Sales Manager approves proposal
    approve_resp = client.post(
        f"/api/v1/proposals/{proposal_id}/approve",
        json={"decision": "approved", "notes": "Approved discount based on volume."},
        headers=manager_headers,
    )
    assert approve_resp.status_code == 200
    decision = approve_resp.json()
    assert decision["decision"] == "approved"

    # 9. Atomic Commit: commits proposal creating Revision 2
    sales_headers = auth_client(client, "sales@forgeflow.demo")
    commit_resp = client.post(
        f"/api/v1/proposals/{proposal_id}/commit",
        json={"idempotency_key": "commit-key-1"},
        headers=sales_headers,
    )
    assert commit_resp.status_code == 200
    new_rev = commit_resp.json()
    assert new_rev["revision_number"] == 2
    assert new_rev["is_committed"] is True

    # Verify quote current revision pointer moved
    updated_q = client.get(f"/api/v1/quotes/{q1_id}", headers=sales_headers).json()
    assert updated_q["current_revision_id"] == new_rev["id"]
    assert updated_q["payment_terms"] == "Net 45"

    # 10. Idempotency on commit: repeating with same key returns same revision
    idem_commit = client.post(
        f"/api/v1/proposals/{proposal_id}/commit",
        json={"idempotency_key": "commit-key-1"},
        headers=sales_headers,
    )
    assert idem_commit.status_code == 200
    assert idem_commit.json()["id"] == new_rev["id"]

    # 11. Stale proposal test:
    # Create proposal against Revision 1 (which is now old/stale because quote is at Revision 2)
    stale_payload = {
        "quote_id": q1_id,
        "base_revision_id": base_rev_id,  # Revision 1
        "title": "Stale proposal",
        "justification": "Trying to propose against old revision",
        "operations": [
            {
                "type": "set_payment_terms",
                "value": "Net 60",
            }
        ],
    }
    stale_create = client.post(
        f"/api/v1/quotes/{q1_id}/proposals",
        json=stale_payload,
        headers=sales_headers,
    )
    assert stale_create.status_code == 409
    assert stale_create.json()["code"] == "STALE_BASE_REVISION"


def test_maker_checker_admin_self_approval_prevented(client: TestClient):
    admin_headers = auth_client(client, "admin@forgeflow.demo")

    # Fetch QT-2026-0002
    quotes_resp = client.get("/api/v1/quotes", headers=admin_headers)
    q2 = next(q for q in quotes_resp.json()["items"] if q["quote_number"] == "QT-2026-0002")
    q2_id = q2["id"]

    detail = client.get(f"/api/v1/quotes/{q2_id}", headers=admin_headers).json()
    base_rev_id = detail["current_revision"]["id"]

    # Admin creates a proposal
    prop_resp = client.post(
        f"/api/v1/quotes/{q2_id}/proposals",
        json={
            "quote_id": q2_id,
            "base_revision_id": base_rev_id,
            "title": "Admin Created Proposal",
            "justification": "Proposal created by admin role",
            "operations": [{"type": "set_payment_terms", "value": "Net 30"}],
        },
        headers=admin_headers,
    )
    assert prop_resp.status_code == 200
    prop_id = prop_resp.json()["id"]

    # Submit
    client.post(f"/api/v1/proposals/{prop_id}/submit", headers=admin_headers)

    # Admin attempts to approve their own proposal -> Maker-checker violation 403
    self_app = client.post(
        f"/api/v1/proposals/{prop_id}/approve",
        json={"decision": "approved", "notes": "Self approval by admin"},
        headers=admin_headers,
    )
    assert self_app.status_code == 403
    assert self_app.json()["code"] == "MAKER_CHECKER_VIOLATION"


def test_rejection_requires_reason(client: TestClient):
    sales_headers = auth_client(client, "sales@forgeflow.demo")

    quotes_resp = client.get("/api/v1/quotes", headers=sales_headers)
    q2 = next(q for q in quotes_resp.json()["items"] if q["quote_number"] == "QT-2026-0002")
    q2_id = q2["id"]

    detail = client.get(f"/api/v1/quotes/{q2_id}", headers=sales_headers).json()
    base_rev_id = detail["current_revision"]["id"]

    prop_resp = client.post(
        f"/api/v1/quotes/{q2_id}/proposals",
        json={
            "quote_id": q2_id,
            "base_revision_id": base_rev_id,
            "title": "High Discount Request",
            "justification": "Requesting 25% discount",
            "operations": [{"type": "set_payment_terms", "value": "Net 90"}],
        },
        headers=sales_headers,
    )
    assert prop_resp.status_code == 200
    prop_id = prop_resp.json()["id"]

    client.post(f"/api/v1/proposals/{prop_id}/submit", headers=sales_headers)

    # Login as Manager to review
    manager_headers = auth_client(client, "manager@forgeflow.demo")

    # Reject without reason -> 422
    no_reason = client.post(
        f"/api/v1/proposals/{prop_id}/reject",
        json={"decision": "rejected", "rejection_reason": ""},
        headers=manager_headers,
    )
    assert no_reason.status_code == 422
    assert no_reason.json()["code"] == "REJECTION_REASON_REQUIRED"

    # Reject with valid reason -> 200
    with_reason = client.post(
        f"/api/v1/proposals/{prop_id}/reject",
        json={
            "decision": "rejected",
            "rejection_reason": "Margin degradation is too severe for 90-day credit.",
        },
        headers=manager_headers,
    )
    assert with_reason.status_code == 200
    assert with_reason.json()["decision"] == "rejected"
    assert (
        with_reason.json()["rejection_reason"]
        == "Margin degradation is too severe for 90-day credit."
    )

    # Verify proposal is rejected
    check_prop = client.get(f"/api/v1/proposals/{prop_id}", headers=manager_headers).json()
    assert check_prop["status"] == "rejected"


def test_initial_quote_approval_and_maker_checker(client: TestClient):
    sales_headers = auth_client(client, "sales@forgeflow.demo")

    quotes_resp = client.get("/api/v1/quotes", headers=sales_headers)
    q2 = next(q for q in quotes_resp.json()["items"] if q["quote_number"] == "QT-2026-0002")
    q2_id = q2["id"]

    # Submit quote for approval
    submit_resp = client.post(f"/api/v1/quotes/{q2_id}/submit-for-approval", headers=sales_headers)
    if submit_resp.status_code == 200:
        assert submit_resp.json()["status"] == "pending_approval"

        # Maker-checker: Creator cannot approve own initial quote
        self_app = client.post(
            f"/api/v1/quotes/{q2_id}/approve-initial",
            json={"decision": "approved", "notes": "Approving my own quote"},
            headers=sales_headers,
        )
        assert self_app.status_code == 403

        # Manager approves
        manager_headers = auth_client(client, "manager@forgeflow.demo")
        mgr_app = client.post(
            f"/api/v1/quotes/{q2_id}/approve-initial",
            json={"decision": "approved", "notes": "Terms are acceptable"},
            headers=manager_headers,
        )
        assert mgr_app.status_code == 200
        assert mgr_app.json()["decision"] == "approved"
