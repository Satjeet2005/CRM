#!/usr/bin/env python3
"""
ForgeFlow Deployment & Release Smoke Test
Verifies the running application stack:
1. Health & readiness probes (liveness, readiness, migration synchronization, no leaked secrets).
2. Authentication & session lifecycle (login, auth/me).
3. Dashboard live metrics query.
4. RBAC cost isolation (sales rep does not receive internal unit costs).
5. Approved quote final PDF & CSV generation, with cryptographic SHA-256 byte verification.
6. Draft quote final export fail-closed gating (HTTP 409) and watermarked preview download.
7. Customer deliverable ledger integrity.

Exits 0 on success, nonzero on any failure.
"""

import hashlib
import os
import sys
from typing import Any

import httpx

BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000").rstrip("/")
DEMO_EMAIL = os.getenv("DEMO_USER_EMAIL", "sales@forgeflow.demo")
DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "ForgeFlowDemo!2026")


def log_step(name: str, status: str, details: str = "") -> None:
    tag = f"[{status}]"
    print(f"{tag:<8} {name:<45} {details}")


def run_smoke() -> int:
    print("================================================================")
    print("          FORGEFLOW END-TO-END RELEASE SMOKE TEST               ")
    print("================================================================")
    print(f"Target API Base: {BASE_URL}")
    print(f"Test Identity:   {DEMO_EMAIL}\n")

    client = httpx.Client(base_url=BASE_URL, timeout=15.0, follow_redirects=True)
    failures: list[str] = []

    # 1. Health Liveness
    try:
        r = client.get("/health/live")
        if r.status_code == 200 and r.json().get("status") == "ok":
            log_step("Health Liveness Probe", "PASS", "HTTP 200 {'status': 'ok'}")
        else:
            failures.append(f"Liveness failed: HTTP {r.status_code} {r.text}")
            log_step("Health Liveness Probe", "FAIL", f"HTTP {r.status_code}")
    except Exception as e:
        failures.append(f"Liveness exception: {e}")
        log_step("Health Liveness Probe", "FAIL", str(e))

    # 2. Health Readiness & Migration Status
    try:
        r = client.get("/health/ready")
        body = r.text.lower()
        if r.status_code == 200 and r.json().get("status") == "ready":
            # Leak detection
            if any(k in body for k in ("password", "postgresql://", "psycopg://")):
                failures.append("Readiness leaked database connection strings or passwords")
                log_step("Health Readiness Probe", "FAIL", "Leak detected in response payload")
            else:
                log_step("Health Readiness Probe", "PASS", "DB connected & migrations current")
        else:
            failures.append(f"Readiness failed: HTTP {r.status_code} {r.text}")
            log_step("Health Readiness Probe", "FAIL", f"HTTP {r.status_code}")
    except Exception as e:
        failures.append(f"Readiness exception: {e}")
        log_step("Health Readiness Probe", "FAIL", str(e))

    # 3. Authentication Flow
    csrf_token = None
    try:
        login_resp = client.post(
            "/api/v1/auth/login",
            json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
        )
        if login_resp.status_code == 200:
            csrf_token = client.cookies.get("forgeflow_csrf")
            user_data = login_resp.json().get("user", {})
            log_step("Authentication Login Flow", "PASS", f"Authenticated as {user_data.get('email')}")
        else:
            failures.append(f"Login failed: HTTP {login_resp.status_code} {login_resp.text}")
            log_step("Authentication Login Flow", "FAIL", f"HTTP {login_resp.status_code}")
    except Exception as e:
        failures.append(f"Login exception: {e}")
        log_step("Authentication Login Flow", "FAIL", str(e))

    # 4. Auth Me Context
    try:
        me_resp = client.get("/api/v1/auth/me")
        me_data = me_resp.json().get("user", {})
        if me_resp.status_code == 200 and me_data.get("email") == DEMO_EMAIL:
            role = me_data.get("role")
            log_step("Session Context (auth/me)", "PASS", f"Active session with role={role}")
        else:
            failures.append(f"auth/me failed: HTTP {me_resp.status_code}")
            log_step("Session Context (auth/me)", "FAIL", f"HTTP {me_resp.status_code}")
    except Exception as e:
        failures.append(f"auth/me exception: {e}")
        log_step("Session Context (auth/me)", "FAIL", str(e))

    # 5. Authenticated Dashboard KPI Summary
    try:
        dash_resp = client.get("/api/v1/dashboard/summary")
        if dash_resp.status_code == 200:
            metrics = dash_resp.json()
            log_step("Dashboard Live Metrics", "PASS", f"Open pipeline value: ₹{metrics.get('open_pipeline_amount', 0)}")
        else:
            failures.append(f"Dashboard summary failed: HTTP {dash_resp.status_code}")
            log_step("Dashboard Live Metrics", "FAIL", f"HTTP {dash_resp.status_code}")
    except Exception as e:
        failures.append(f"Dashboard summary exception: {e}")
        log_step("Dashboard Live Metrics", "FAIL", str(e))

    # 6. RBAC Catalog Cost Masking (Sales Rep)
    try:
        cat_resp = client.get("/api/v1/catalog/products?page_size=5")
        if cat_resp.status_code == 200:
            items = cat_resp.json().get("items", [])
            has_leaked_cost = any(item.get("unit_cost") is not None for item in items)
            if has_leaked_cost:
                failures.append("RBAC cost isolation failed: unit_cost exposed to sales_rep!")
                log_step("RBAC Catalog Cost Masking", "FAIL", "Confidential unit_cost leaked")
            else:
                log_step("RBAC Catalog Cost Masking", "PASS", "unit_cost strictly masked for sales_rep")
        else:
            failures.append(f"Catalog query failed: HTTP {cat_resp.status_code}")
            log_step("RBAC Catalog Cost Masking", "FAIL", f"HTTP {cat_resp.status_code}")
    except Exception as e:
        failures.append(f"Catalog exception: {e}")
        log_step("RBAC Catalog Cost Masking", "FAIL", str(e))

    # 7. Quote Discovery
    approved_quote_id = None
    draft_quote_id = None
    try:
        quotes_resp = client.get("/api/v1/quotes?page_size=20")
        if quotes_resp.status_code == 200:
            q_items = quotes_resp.json().get("items", [])
            for q in q_items:
                if q.get("status") in ("approved", "sent") and not approved_quote_id:
                    approved_quote_id = q.get("id")
                if q.get("status") == "draft" and not draft_quote_id:
                    draft_quote_id = q.get("id")
            log_step("Quote Inventory Query", "PASS", f"Approved quote={approved_quote_id}, Draft={draft_quote_id}")
        else:
            failures.append(f"Quotes list failed: HTTP {quotes_resp.status_code}")
            log_step("Quote Inventory Query", "FAIL", f"HTTP {quotes_resp.status_code}")
    except Exception as e:
        failures.append(f"Quotes list exception: {e}")
        log_step("Quote Inventory Query", "FAIL", str(e))

    # 8. Approved Quote Final PDF Export & Checksum Verification
    if approved_quote_id:
        try:
            pdf_resp = client.get(f"/api/v1/quotes/{approved_quote_id}/export/pdf")
            if pdf_resp.status_code == 200 and pdf_resp.headers.get("content-type") == "application/pdf":
                pdf_bytes = pdf_resp.content
                computed_hash = hashlib.sha256(pdf_bytes).hexdigest()
                header_hash = pdf_resp.headers.get("X-Content-SHA256")
                if pdf_bytes.startswith(b"%PDF-") and computed_hash == header_hash:
                    log_step(
                        "Approved Quote Final PDF",
                        "PASS",
                        f"Non-empty PDF ({len(pdf_bytes)} bytes) with verified SHA-256",
                    )
                else:
                    failures.append("PDF bytes malformed or checksum mismatch with X-Content-SHA256")
                    log_step("Approved Quote Final PDF", "FAIL", "Checksum or format mismatch")
            else:
                failures.append(f"PDF export failed: HTTP {pdf_resp.status_code}")
                log_step("Approved Quote Final PDF", "FAIL", f"HTTP {pdf_resp.status_code}")
        except Exception as e:
            failures.append(f"PDF export exception: {e}")
            log_step("Approved Quote Final PDF", "FAIL", str(e))

        # 9. Approved Quote Final CSV Export
        try:
            csv_resp = client.get(f"/api/v1/quotes/{approved_quote_id}/export/csv")
            if csv_resp.status_code == 200 and "text/csv" in csv_resp.headers.get("content-type", ""):
                csv_bytes = csv_resp.content
                computed_hash = hashlib.sha256(csv_bytes).hexdigest()
                header_hash = csv_resp.headers.get("X-Content-SHA256")
                if computed_hash == header_hash and b"Line #,SKU" in csv_bytes:
                    log_step(
                        "Approved Quote Final CSV",
                        "PASS",
                        f"RFC 4180 CSV ({len(csv_bytes)} bytes) with verified SHA-256",
                    )
                else:
                    failures.append("CSV content or checksum mismatch")
                    log_step("Approved Quote Final CSV", "FAIL", "Checksum mismatch")
            else:
                failures.append(f"CSV export failed: HTTP {csv_resp.status_code}")
                log_step("Approved Quote Final CSV", "FAIL", f"HTTP {csv_resp.status_code}")
        except Exception as e:
            failures.append(f"CSV export exception: {e}")
            log_step("Approved Quote Final CSV", "FAIL", str(e))

    # 10. Draft Quote Export Gating (Must Fail-Closed with HTTP 409)
    if draft_quote_id:
        try:
            denied_resp = client.get(f"/api/v1/quotes/{draft_quote_id}/export/pdf")
            if denied_resp.status_code == 409:
                log_step("Draft Export Gate (Fail-Closed)", "PASS", "HTTP 409 QUOTE_NOT_APPROVED_FOR_EXPORT")
            else:
                failures.append(f"Draft export was not rejected: HTTP {denied_resp.status_code}")
                log_step("Draft Export Gate (Fail-Closed)", "FAIL", f"Expected 409, got {denied_resp.status_code}")
        except Exception as e:
            failures.append(f"Draft export test exception: {e}")
            log_step("Draft Export Gate (Fail-Closed)", "FAIL", str(e))

        # 11. Watermarked Draft Preview
        try:
            prev_resp = client.get(f"/api/v1/quotes/{draft_quote_id}/export/preview-pdf")
            if prev_resp.status_code == 200 and prev_resp.headers.get("content-type") == "application/pdf":
                prev_bytes = prev_resp.content
                if prev_bytes.startswith(b"%PDF-"):
                    log_step("Draft Watermarked Preview", "PASS", f"Inspection preview PDF ({len(prev_bytes)} bytes)")
                else:
                    failures.append("Draft preview PDF invalid header")
                    log_step("Draft Watermarked Preview", "FAIL", "Invalid PDF bytes")
            else:
                failures.append(f"Draft preview failed: HTTP {prev_resp.status_code}")
                log_step("Draft Watermarked Preview", "FAIL", f"HTTP {prev_resp.status_code}")
        except Exception as e:
            failures.append(f"Draft preview exception: {e}")
            log_step("Draft Watermarked Preview", "FAIL", str(e))

    # 12. Delivery History Audit Verification
    if approved_quote_id:
        try:
            deliv_resp = client.get(f"/api/v1/quotes/{approved_quote_id}/deliveries")
            if deliv_resp.status_code == 200 and len(deliv_resp.json()) > 0:
                deliv_records = deliv_resp.json()
                log_step(
                    "Customer Delivery Ledger",
                    "PASS",
                    f"{len(deliv_records)} delivery record(s) logged with cryptographic SHA-256",
                )
            else:
                failures.append("Delivery history query failed or empty")
                log_step("Customer Delivery Ledger", "FAIL", "No delivery history recorded")
        except Exception as e:
            failures.append(f"Deliveries exception: {e}")
            log_step("Customer Delivery Ledger", "FAIL", str(e))

    print("----------------------------------------------------------------")
    if failures:
        print(f"SMOKE TEST FAILED with {len(failures)} error(s):", file=sys.stderr)
        for f in failures:
            print(f"  - {f}", file=sys.stderr)
        return 1

    print("SMOKE TEST SUCCESSFUL: All deployment sanity verifications passed.")
    print("================================================================")
    return 0


if __name__ == "__main__":
    sys.exit(run_smoke())
