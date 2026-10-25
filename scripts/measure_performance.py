#!/usr/bin/env python3
"""
ForgeFlow Performance Benchmark & Latency Measurement Script
Measures API latency percentiles (p50, p95, p99) against running local stack
and compares against PRD objectives:
- Dashboard KPI Overview: Target p95 < 500ms
- 25-Row Paginated Lists (Accounts, Catalog, Quotes): Target p95 < 300ms
- RFQ Normalization / Candidate Matching Benchmark
- Document Generation (PDF & CSV Export)
"""

import math
import statistics
import time
import httpx

BASE_URL = "http://localhost:8000"
ITERATIONS = 30


def percentile(data: list[float], p: float) -> float:
    if not data:
        return 0.0
    k = (len(data) - 1) * p
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return data[int(k)]
    d0 = data[int(f)] * (c - k)
    d1 = data[int(c)] * (k - f)
    return round(d0 + d1, 2)


def benchmark_endpoint(
    client: httpx.Client,
    method: str,
    path: str,
    name: str,
    iterations: int = ITERATIONS,
) -> dict[str, float]:
    latencies = []
    # Warmup
    for _ in range(3):
        client.request(method, path)

    for _ in range(iterations):
        t0 = time.perf_counter()
        resp = client.request(method, path)
        dt = (time.perf_counter() - t0) * 1000.0  # ms
        if resp.status_code in (200, 201):
            latencies.append(dt)

    latencies.sort()
    p50 = percentile(latencies, 0.50)
    p95 = percentile(latencies, 0.95)
    p99 = percentile(latencies, 0.99)
    avg = round(statistics.mean(latencies), 2)

    return {
        "name": name,
        "count": len(latencies),
        "avg": avg,
        "p50": p50,
        "p95": p95,
        "p99": p99,
        "min": round(min(latencies), 2),
        "max": round(max(latencies), 2),
    }


def main():
    print("================================================================")
    print("      FORGEFLOW PERFORMANCE & LATENCY MEASUREMENT               ")
    print("================================================================")
    print(f"Target: {BASE_URL} ({ITERATIONS} samples per endpoint)\n")

    client = httpx.Client(base_url=BASE_URL, timeout=15.0)

    # 1. Authenticate as Sales Rep
    client.post(
        "/api/v1/auth/login",
        json={"email": "sales@forgeflow.demo", "password": "ForgeFlowDemo!2026"},
    )

    # 2. Get an approved quote ID for export test
    q_resp = client.get("/api/v1/quotes?page_size=10")
    approved_quote_id = None
    if q_resp.status_code == 200:
        for q in q_resp.json().get("items", []):
            if q.get("status") in ("approved", "sent"):
                approved_quote_id = q.get("id")
                break

    benchmarks = [
        ("GET", "/health/live", "Liveness Probe (/health/live)"),
        ("GET", "/health/ready", "Readiness Probe (/health/ready)"),
        ("GET", "/api/v1/dashboard/summary", "Dashboard Overview (/dashboard/summary)"),
        ("GET", "/api/v1/dashboard/attention", "Attention Queue (/dashboard/attention)"),
        ("GET", "/api/v1/accounts?page_size=25", "Accounts 25-Row List (/accounts)"),
        ("GET", "/api/v1/catalog/products?page_size=25", "Catalog 25-Row List (/catalog/products)"),
        ("GET", "/api/v1/quotes?page_size=25", "Quotes 25-Row List (/quotes)"),
    ]

    if approved_quote_id:
        benchmarks.extend([
            ("GET", f"/api/v1/quotes/{approved_quote_id}/export/csv", "Procurement CSV Export (/export/csv)"),
            ("GET", f"/api/v1/quotes/{approved_quote_id}/export/pdf", "Customer PDF Generation (/export/pdf)"),
        ])

    results = []
    for method, path, name in benchmarks:
        res = benchmark_endpoint(client, method, path, name)
        results.append(res)
        print(f"[*] {name:<40} avg={res['avg']}ms  p50={res['p50']}ms  p95={res['p95']}ms  p99={res['p99']}ms")

    # 3. Pure Python Domain RFQ Normalization & Matching Benchmark (500 items max PRD size)
    from app.domain.rfq.normalizer import normalize_line
    from app.domain.rfq.units import normalize_unit

    sample_texts = [
        "SS 304 Ball Valve 2 inch 150# Flanged ends to ANSI B16.5",
        "Seamless CS Pipe ASTM A106 Gr B SCH 40 50mm NB 6 MTR length",
        "Spiral Wound Gasket 50mm NB 150# SS316 with Graphite Filler",
        "Hex Bolt M16 x 65mm Half Threaded High Tensile Gr 8.8 with Nut",
    ] * 125  # 500 lines

    t0 = time.perf_counter()
    for text in sample_texts:
        _ = normalize_line(text)
        _ = normalize_unit("MTR")
    rfq_elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 2)
    print(f"[*] 500-Line RFQ Domain Normalization    total={rfq_elapsed_ms}ms ({round(rfq_elapsed_ms / 500, 3)}ms/line)")

    print("\n----------------------------------------------------------------")
    print("PRD TARGET COMPLIANCE ASSESSMENT:")
    print("----------------------------------------------------------------")

    dash_res = next(r for r in results if "Dashboard Overview" in r["name"])
    dash_target_met = dash_res["p95"] < 500.0
    print(
        f"1. Dashboard Overview Target (p95 < 500ms): "
        f"{'PASS' if dash_target_met else 'FAIL'} (Measured: {dash_res['p95']}ms)"
    )

    list_targets_met = True
    for r in results:
        if "25-Row List" in r["name"]:
            met = r["p95"] < 300.0
            print(
                f"2. {r['name']} (p95 < 300ms): "
                f"{'PASS' if met else 'FAIL'} (Measured: {r['p95']}ms)"
            )
            if not met:
                list_targets_met = False

    print("================================================================")


if __name__ == "__main__":
    main()
