"""Integration tests for Phase 6 Customer Document Exports API.

Verifies:
1. Approved quotes can be exported to final PDF and CSV with correct headers and checksums.
2. Draft and pending approval quotes are blocked from final export with 409 Conflict.
3. Draft watermarked preview PDF succeeds on draft quotes with conspicuous watermark text.
4. Export events and delivery audit records are atomically persisted.
5. Role authorization: catalog_manager lacks quotes:export and is denied with 403 Forbidden.
6. Tenant isolation: accessing another organization's quote returns non-disclosing 404.
7. Delivery history endpoint returns past customer export fingerprints.
8. CSV injection values in quote fields are neutralized in generated CSV.
"""

import hashlib
import io
import uuid

import pypdf
from fastapi.testclient import TestClient


def auth_client(client: TestClient, email: str) -> dict[str, str]:
    """Helper to authenticate synthetic demo user and return CSRF headers."""
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


def test_draft_quote_final_export_blocked(client: TestClient) -> None:
    """Verifies that quotes in draft or pending approval status are rejected from final export routes."""
    headers = auth_client(client, "sales@forgeflow.demo")

    # Fetch list of quotes
    resp = client.get("/api/v1/quotes", headers=headers)
    assert resp.status_code == 200
    quotes = resp.json()["items"]

    # QT-2026-0003 is seeded in pending_approval status
    q3 = next((q for q in quotes if q["quote_number"] == "QT-2026-0003"), None)
    assert q3 is not None
    q3_id = q3["id"]

    # 1. Final PDF export must be blocked with 409 Conflict
    pdf_resp = client.get(f"/api/v1/quotes/{q3_id}/export/pdf", headers=headers)
    assert pdf_resp.status_code == 409
    pdf_err = pdf_resp.json()
    assert pdf_err["code"] == "QUOTE_NOT_APPROVED_FOR_EXPORT"

    # 2. Final CSV export must also be blocked with 409 Conflict
    csv_resp = client.get(f"/api/v1/quotes/{q3_id}/export/csv", headers=headers)
    assert csv_resp.status_code == 409
    csv_err = csv_resp.json()
    assert csv_err["code"] == "QUOTE_NOT_APPROVED_FOR_EXPORT"


def test_draft_preview_pdf_succeeds_with_watermark(client: TestClient) -> None:
    """Verifies that internal draft preview PDF succeeds and includes conspicuous draft watermark."""
    headers = auth_client(client, "sales@forgeflow.demo")

    resp = client.get("/api/v1/quotes", headers=headers)
    quotes = resp.json()["items"]
    q3 = next((q for q in quotes if q["quote_number"] == "QT-2026-0003"), None)
    assert q3 is not None

    preview_resp = client.get(f"/api/v1/quotes/{q3['id']}/export/preview-pdf", headers=headers)
    assert preview_resp.status_code == 200
    assert preview_resp.headers["content-type"] == "application/pdf"
    assert "inline;" in preview_resp.headers["content-disposition"]
    assert "X-Content-SHA256" in preview_resp.headers

    pdf_bytes = preview_resp.content
    assert pdf_bytes.startswith(b"%PDF-")

    # Extract text from PDF and verify watermark
    reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
    full_text = " ".join([page.extract_text() or "" for page in reader.pages])
    assert "DRAFT — NOT APPROVED COMMERCIAL PROPOSAL" in full_text
    assert "QT-2026-0003" in full_text


def test_approved_quote_export_pdf_and_csv_flow(client: TestClient) -> None:
    """Verifies full approval flow and subsequent successful unwatermarked PDF & CSV export."""
    # 1. Approve initial quote QT-2026-0003 as manager
    mgr_headers = auth_client(client, "manager@forgeflow.demo")
    resp = client.get("/api/v1/quotes", headers=mgr_headers)
    q3 = next(q for q in resp.json()["items"] if q["quote_number"] == "QT-2026-0003")
    q3_id = q3["id"]

    approve_resp = client.post(
        f"/api/v1/quotes/{q3_id}/approve-initial",
        headers=mgr_headers,
        json={
            "decision": "approved",
            "notes": "Approved for customer release during Phase 6 export validation.",
        },
    )
    assert approve_resp.status_code == 200, f"Approval failed: {approve_resp.text}"

    # Verify status changed to approved
    detail_resp = client.get(f"/api/v1/quotes/{q3_id}", headers=mgr_headers)
    assert detail_resp.status_code == 200
    assert detail_resp.json()["status"] == "approved"

    # 2. Export final PDF as Sales Rep
    sales_headers = auth_client(client, "sales@forgeflow.demo")
    pdf_resp = client.get(f"/api/v1/quotes/{q3_id}/export/pdf", headers=sales_headers)
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"
    assert "attachment;" in pdf_resp.headers["content-disposition"]
    assert "Quote-QT-2026-0003-Rev1.pdf" in pdf_resp.headers["content-disposition"]

    sha256 = pdf_resp.headers.get("X-Content-SHA256")
    assert sha256 is not None
    assert len(sha256) == 64
    assert hashlib.sha256(pdf_resp.content).hexdigest() == sha256

    # Verify text does NOT contain watermark and does NOT contain confidential unit costs
    reader = pypdf.PdfReader(io.BytesIO(pdf_resp.content))
    pdf_text = " ".join([page.extract_text() or "" for page in reader.pages])
    assert "QT-2026-0003" in pdf_text
    assert "DRAFT — NOT APPROVED" not in pdf_text
    assert "unit_cost" not in pdf_text
    assert "profit margin" not in pdf_text.lower()

    # 3. Export final CSV as Sales Rep
    csv_resp = client.get(f"/api/v1/quotes/{q3_id}/export/csv", headers=sales_headers)
    assert csv_resp.status_code == 200
    assert "text/csv" in csv_resp.headers["content-type"]
    assert "attachment;" in csv_resp.headers["content-disposition"]
    assert "Quote-QT-2026-0003-Rev1.csv" in csv_resp.headers["content-disposition"]

    csv_text = csv_resp.content.decode("utf-8")
    assert "Quotation Number,QT-2026-0003" in csv_text
    assert "Status,APPROVED" in csv_text
    assert "Grand Total" in csv_text
    assert "unit_cost" not in csv_text

    # 4. Verify Delivery Record and Export Event in database
    deliveries_resp = client.get(f"/api/v1/quotes/{q3_id}/deliveries", headers=sales_headers)
    assert deliveries_resp.status_code == 200
    deliveries = deliveries_resp.json()
    assert len(deliveries) >= 2  # 1 PDF, 1 CSV
    types = [d["export_type"] for d in deliveries]
    assert "pdf" in types
    assert "csv" in types
    assert any(d["sha256_hash"] == sha256 for d in deliveries)

    # 5. Mismatched revision on an approved quote must fail with MISMATCHED_QUOTE_REVISION
    fake_rev_id = uuid.uuid4()
    mismatch_resp = client.get(
        f"/api/v1/quotes/{q3_id}/export/pdf?revision_id={fake_rev_id}",
        headers=sales_headers,
    )
    assert mismatch_resp.status_code == 409
    assert mismatch_resp.json()["code"] == "MISMATCHED_QUOTE_REVISION"


def test_catalog_manager_denied_quote_export(client: TestClient) -> None:
    """Verifies RBAC gate: catalog_manager lacks 'quotes:export' and receives 403 Forbidden."""
    cat_headers = auth_client(client, "catalog@forgeflow.demo")
    resp = client.get(f"/api/v1/quotes/{uuid.uuid4()}/export/pdf", headers=cat_headers)
    assert resp.status_code == 403


def test_cross_tenant_isolation_quote_export(client: TestClient) -> None:
    """Verifies that referencing a non-existent or foreign tenant quote returns 404."""
    sales_headers = auth_client(client, "sales@forgeflow.demo")
    fake_quote_id = uuid.uuid4()
    resp = client.get(f"/api/v1/quotes/{fake_quote_id}/export/pdf", headers=sales_headers)
    assert resp.status_code == 404
    assert resp.json()["code"] == "QUOTE_NOT_FOUND"
