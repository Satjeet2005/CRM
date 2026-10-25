from fastapi.testclient import TestClient


def auth_client(client: TestClient, email: str, role: str = "sales_rep") -> dict[str, str]:
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


def get_first_opp(client: TestClient) -> tuple[str, str]:
    resp = client.get("/api/v1/opportunities")
    items = resp.json()["items"]
    assert len(items) > 0, "No opportunities found in database"
    return items[0]["account_id"], items[0]["id"]


SAMPLE_CSV_VALID = """Item Description,Quantity,UOM,Part Number
GI Pipe 15mm Class A,10,mtr,PIPE-001
GI Pipe 20mm Class A,20,mtr,PIPE-003
Brass Ball Valve Screwed 25mm,5,nos,VALV-003
"""

SAMPLE_CSV_AMBIGUOUS = """Item Description,Quantity,UOM
MS Hex Bolt M12x50,50,nos
GI Pipe 15mm,20,mtr
"""

SAMPLE_CSV_FORMULA = """Item Description,Quantity,UOM
=1+1,10,nos
"@SUM(1,2)",5,mtr
"+cmd|'/C calc'!A0",2,nos
Normal GI Pipe 15mm Class A,10,mtr
"""


def test_rfq_import_preview(client: TestClient):
    headers = auth_client(client, "sales@forgeflow.demo")

    # 1. Valid preview
    resp = client.post(
        "/api/v1/rfqs/import/preview",
        json={"filename": "test_rfq.csv", "csv_content": SAMPLE_CSV_VALID},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["filename"] == "test_rfq.csv"
    assert "Item Description" in data["detected_headers"]
    assert data["recommended_mapping"]["description"] == "Item Description"
    assert data["recommended_mapping"]["quantity"] == "Quantity"
    assert data["total_data_rows"] == 3
    assert data["is_importable"] is True
    assert len(data["sample_rows"]) == 3

    # 2. Empty CSV
    resp_empty = client.post(
        "/api/v1/rfqs/import/preview",
        json={"filename": "empty.csv", "csv_content": ""},
        headers=headers,
    )
    assert resp_empty.status_code == 422

    # 3. File too large (> 5 MiB)
    large_content = "Description,Quantity\n" + ("A" * 1000 + ",1\n") * 5500
    resp_large = client.post(
        "/api/v1/rfqs/import/preview",
        json={"filename": "large.csv", "csv_content": large_content},
        headers=headers,
    )
    assert resp_large.status_code == 413


def test_rfq_import_and_duplicate_prevention(client: TestClient):
    headers = auth_client(client, "sales@forgeflow.demo")

    account_id, opp_id = get_first_opp(client)

    import_payload = {
        "account_id": account_id,
        "opportunity_id": opp_id,
        "title": "Offshore Turnaround Piping Batch A",
        "customer_reference": "PO-REQ-9921",
        "filename": "piping_turnaround.csv",
        "csv_content": SAMPLE_CSV_VALID,
        "header_mapping": {
            "description": "Item Description",
            "quantity": "Quantity",
            "unit": "UOM",
            "manufacturer_part_number": "Part Number",
        },
        "duplicate_override": False,
    }

    # 1. Successful import
    resp_import = client.post("/api/v1/rfqs/import", json=import_payload, headers=headers)
    assert resp_import.status_code == 201
    rfq = resp_import.json()
    rfq_id = rfq["id"]
    assert rfq["rfq_number"].startswith("RFQ-")
    assert rfq["total_lines"] == 3
    assert rfq["status"] == "needs_review"

    # 2. Duplicate import attempt without override -> 409 Conflict
    resp_dup = client.post("/api/v1/rfqs/import", json=import_payload, headers=headers)
    assert resp_dup.status_code == 409
    assert resp_dup.json()["code"] == "DUPLICATE_RFQ_IMPORT"

    # 3. Duplicate import with override -> 201 Created
    import_payload["duplicate_override"] = True
    import_payload["title"] = "Offshore Turnaround Piping Batch A (Re-import)"
    resp_override = client.post("/api/v1/rfqs/import", json=import_payload, headers=headers)
    assert resp_override.status_code == 201
    assert resp_override.json()["id"] != rfq_id


def test_rfq_line_decision_lifecycle_and_optimistic_locking(client: TestClient):
    headers = auth_client(client, "sales@forgeflow.demo")

    account_id, opp_id = get_first_opp(client)

    import_payload = {
        "account_id": account_id,
        "opportunity_id": opp_id,
        "title": "Valves and Fasteners Package",
        "filename": "valves_fasteners.csv",
        "csv_content": SAMPLE_CSV_VALID,
        "header_mapping": {
            "description": "Item Description",
            "quantity": "Quantity",
            "unit": "UOM",
        },
    }
    resp_import = client.post("/api/v1/rfqs/import", json=import_payload, headers=headers)
    assert resp_import.status_code == 201
    rfq_id = resp_import.json()["id"]

    # 1. Fetch lines
    resp_lines = client.get(f"/api/v1/rfqs/{rfq_id}/lines")
    assert resp_lines.status_code == 200
    lines = resp_lines.json()["items"]
    assert len(lines) == 3
    line1 = lines[0]
    line1_id = line1["id"]
    line1_ver = line1["version"]

    # 2. Fetch line detail with candidates
    resp_detail = client.get(f"/api/v1/rfqs/{rfq_id}/lines/{line1_id}")
    assert resp_detail.status_code == 200
    detail = resp_detail.json()
    assert len(detail["candidates"]) > 0
    top_cand = detail["candidates"][0]

    # 3. Accept suggestion
    resp_decision = client.post(
        f"/api/v1/rfqs/{rfq_id}/lines/{line1_id}/decision",
        json={
            "action": "accept_suggestion",
            "candidate_id": top_cand["id"],
            "reason_code": "EXACT_VERIFIED",
            "notes": "Verified against design spec",
            "expected_version": line1_ver,
        },
        headers=headers,
    )
    assert resp_decision.status_code == 200
    dec_line = resp_decision.json()
    assert dec_line["match_status"] == "matched"
    assert dec_line["version"] == line1_ver + 1
    assert len(dec_line["decision_history"]) == 1

    # 4. Attempt decision with stale expected_version -> 409 Conflict
    resp_stale = client.post(
        f"/api/v1/rfqs/{rfq_id}/lines/{line1_id}/decision",
        json={
            "action": "mark_unmatched",
            "expected_version": line1_ver,  # stale!
        },
        headers=headers,
    )
    assert resp_stale.status_code == 409
    assert resp_stale.json()["code"] == "STALE_VERSION"

    # 5. Revert decision with current version
    resp_revert = client.post(
        f"/api/v1/rfqs/{rfq_id}/lines/{line1_id}/decision",
        json={
            "action": "revert",
            "expected_version": dec_line["version"],
        },
        headers=headers,
    )
    assert resp_revert.status_code == 200
    reverted_line = resp_revert.json()
    assert reverted_line["match_status"] in ("exact_match", "needs_review")
    assert len(reverted_line["decision_history"]) == 2


def test_bulk_accept_exact_matches_atomicity(client: TestClient):
    headers = auth_client(client, "sales@forgeflow.demo")

    account_id, opp_id = get_first_opp(client)

    import_payload = {
        "account_id": account_id,
        "opportunity_id": opp_id,
        "title": "Batch Piping Order",
        "filename": "batch_order.csv",
        "csv_content": SAMPLE_CSV_VALID,
        "header_mapping": {
            "description": "Item Description",
            "quantity": "Quantity",
            "unit": "UOM",
        },
    }
    rfq_id = client.post("/api/v1/rfqs/import", json=import_payload, headers=headers).json()["id"]

    lines = client.get(f"/api/v1/rfqs/{rfq_id}/lines").json()["items"]
    line_ids = [line_item["id"] for line_item in lines]
    versions = {line_item["id"]: line_item["version"] for line_item in lines}

    # 1. Deliberately make one line version stale in request
    stale_versions = dict(versions)
    stale_versions[line_ids[1]] = 999  # stale!

    resp_stale_bulk = client.post(
        f"/api/v1/rfqs/{rfq_id}/lines/bulk-decision",
        json={"line_ids": line_ids, "expected_versions": stale_versions},
        headers=headers,
    )
    assert resp_stale_bulk.status_code == 409
    assert resp_stale_bulk.json()["code"] == "STALE_VERSION"

    # Verify atomic rollback: zero lines were modified
    lines_after_stale = client.get(f"/api/v1/rfqs/{rfq_id}/lines").json()["items"]
    for line_item in lines_after_stale:
        assert line_item["match_status"] != "matched"
        assert line_item["version"] == 1

    # 2. Successful atomic bulk accept
    resp_success_bulk = client.post(
        f"/api/v1/rfqs/{rfq_id}/lines/bulk-decision",
        json={"line_ids": line_ids, "expected_versions": versions},
        headers=headers,
    )
    assert resp_success_bulk.status_code == 200
    assert resp_success_bulk.json()["accepted_count"] == 3

    # Verify all lines are now matched and RFQ is ready_to_quote
    rfq_after = client.get(f"/api/v1/rfqs/{rfq_id}").json()
    assert rfq_after["status"] == "ready_to_quote"
    assert rfq_after["is_ready_to_quote"] is True


def test_quote_conversion_gate_and_idempotency(client: TestClient):
    headers = auth_client(client, "sales@forgeflow.demo")

    account_id, opp_id = get_first_opp(client)

    # 1. Import RFQ with ambiguous items that require review
    import_payload = {
        "account_id": account_id,
        "opportunity_id": opp_id,
        "title": "Subsea Flanges & Fasteners",
        "filename": "subsea.csv",
        "csv_content": SAMPLE_CSV_AMBIGUOUS,
        "header_mapping": {
            "description": "Item Description",
            "quantity": "Quantity",
            "unit": "UOM",
        },
    }
    rfq = client.post("/api/v1/rfqs/import", json=import_payload, headers=headers).json()
    rfq_id = rfq["id"]

    # Attempt quote conversion before resolving -> 422 Blocked
    resp_blocked = client.post(
        f"/api/v1/rfqs/{rfq_id}/create-quote",
        json={"expected_rfq_version": rfq["version"]},
        headers=headers,
    )
    assert resp_blocked.status_code == 422
    assert resp_blocked.json()["code"] == "RFQ_NOT_READY_TO_QUOTE"

    # Resolve all lines
    lines = client.get(f"/api/v1/rfqs/{rfq_id}/lines").json()["items"]
    for line_item in lines:
        detail = client.get(f"/api/v1/rfqs/{rfq_id}/lines/{line_item['id']}").json()
        cand_id = detail["candidates"][0]["id"]
        client.post(
            f"/api/v1/rfqs/{rfq_id}/lines/{line_item['id']}/decision",
            json={
                "action": "accept_suggestion",
                "candidate_id": cand_id,
                "expected_version": line_item["version"],
            },
            headers=headers,
        )

    # Re-fetch RFQ to get updated version
    rfq_ready = client.get(f"/api/v1/rfqs/{rfq_id}").json()
    assert rfq_ready["status"] == "ready_to_quote"

    # Convert to quote draft
    resp_quote = client.post(
        f"/api/v1/rfqs/{rfq_id}/create-quote",
        json={"expected_rfq_version": rfq_ready["version"], "notes": "Initial draft quote"},
        headers=headers,
    )
    assert resp_quote.status_code == 201
    quote = resp_quote.json()
    assert quote["quote_number"].startswith("QT-")
    assert quote["status"] == "draft"

    # Attempt second conversion -> 409 RFQ_ALREADY_QUOTED
    resp_dup = client.post(
        f"/api/v1/rfqs/{rfq_id}/create-quote",
        json={"expected_rfq_version": rfq_ready["version"] + 1},
        headers=headers,
    )
    assert resp_dup.status_code == 409
    assert resp_dup.json()["code"] == "RFQ_ALREADY_QUOTED"


def test_rfq_csv_export_formula_neutralization(client: TestClient):
    headers = auth_client(client, "sales@forgeflow.demo")

    account_id, opp_id = get_first_opp(client)

    import_payload = {
        "account_id": account_id,
        "opportunity_id": opp_id,
        "title": "Security Test RFQ",
        "filename": "formula_injection.csv",
        "csv_content": SAMPLE_CSV_FORMULA,
        "header_mapping": {
            "description": "Item Description",
            "quantity": "Quantity",
            "unit": "UOM",
        },
    }
    rfq_id = client.post("/api/v1/rfqs/import", json=import_payload, headers=headers).json()["id"]

    # Export CSV
    resp_export = client.get(f"/api/v1/rfqs/{rfq_id}/export.csv", headers=headers)
    assert resp_export.status_code == 200
    csv_text = resp_export.text
    # Check that dangerous formulas are prefixed with single quote
    assert "'=1+1" in csv_text
    assert "'@SUM(1,2)" in csv_text
    assert "'+cmd" in csv_text


def test_rematch_rbac_isolation(client: TestClient):
    sales_headers = auth_client(client, "sales@forgeflow.demo")

    account_id, opp_id = get_first_opp(client)

    import_payload = {
        "account_id": account_id,
        "opportunity_id": opp_id,
        "title": "Rematch Test RFQ",
        "filename": "rematch.csv",
        "csv_content": SAMPLE_CSV_VALID,
        "header_mapping": {
            "description": "Item Description",
            "quantity": "Quantity",
            "unit": "UOM",
        },
    }
    rfq_id = client.post("/api/v1/rfqs/import", json=import_payload, headers=sales_headers).json()[
        "id"
    ]

    # 1. Sales rep forbidden from rematching -> 403
    resp_sales_rematch = client.post(
        f"/api/v1/rfqs/{rfq_id}/rematch",
        json={"clear_manual_decisions": False},
        headers=sales_headers,
    )
    assert resp_sales_rematch.status_code == 403

    # 2. Catalog manager allowed to rematch -> 200
    catalog_headers = auth_client(client, "catalog@forgeflow.demo")
    resp_cat_rematch = client.post(
        f"/api/v1/rfqs/{rfq_id}/rematch",
        json={"clear_manual_decisions": False},
        headers=catalog_headers,
    )
    assert resp_cat_rematch.status_code == 200
    assert resp_cat_rematch.json()["candidate_set_version"] == 2
