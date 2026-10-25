# ForgeFlow Release Performance & Latency Report

This document reports empirical performance benchmarks, API latency percentiles, PDF rendering throughput, and RFQ line-item normalization measurements evaluated against PRD Section 17 non-functional requirements.

---

## 1. Executive Summary & SLO Compliance

All measured endpoints and domain services comfortably exceed the performance requirements established in the PRD:

| Operation | Metric | Measured p50 | Measured p95 | PRD Target | Compliance Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Dashboard Overview** | Latency | **10.66 ms** | **11.85 ms** | < 500 ms | **PASS** (42x faster) |
| **Accounts List (25 rows)** | Latency | **9.99 ms** | **11.28 ms** | < 300 ms | **PASS** (26x faster) |
| **Catalog List (25 rows)** | Latency | **10.37 ms** | **11.34 ms** | < 300 ms | **PASS** (26x faster) |
| **Quotes List (25 rows)** | Latency | **15.67 ms** | **17.41 ms** | < 300 ms | **PASS** (17x faster) |
| **Customer PDF Render** | Latency | **427.67 ms** | **435.90 ms** | < 2000 ms | **PASS** (4.5x faster) |
| **RFQ Normalization** | Throughput | **0.059 ms/line** | **17,046 lines/s**| > 1,000 lines/s | **PASS** (17x faster) |

---

## 2. API Latency Percentile Distribution

*Measurements conducted across 20 iterations per endpoint against local production container stack with warm connection pooling.*

```text
================================================================================
  FORGEFLOW PRODUCTION PERFORMANCE BENCHMARK
================================================================================
1. GET /api/v1/crm/dashboard
   - Min:   9.47 ms
   - p50:  10.66 ms
   - p95:  11.85 ms
   - p99:  12.01 ms
   - Max:  12.05 ms
   - Result: PASS (Target < 500 ms)

2. GET /api/v1/crm/accounts?limit=25
   - Min:   9.20 ms
   - p50:   9.99 ms
   - p95:  11.28 ms
   - p99:  11.66 ms
   - Max:  11.75 ms
   - Result: PASS (Target < 300 ms)

3. GET /api/v1/catalog/products?limit=25
   - Min:   9.50 ms
   - p50:  10.37 ms
   - p95:  11.34 ms
   - p99:  11.67 ms
   - Max:  11.76 ms
   - Result: PASS (Target < 300 ms)

4. GET /api/v1/quotes?limit=25
   - Min:  13.88 ms
   - p50:  15.67 ms
   - p95:  17.41 ms
   - p99:  17.84 ms
   - Max:  17.95 ms
   - Result: PASS (Target < 300 ms)

5. POST /api/v1/quotes/{id}/export/customer (PDF Generation)
   - Min: 412.33 ms
   - p50: 427.67 ms
   - p95: 435.90 ms
   - p99: 438.74 ms
   - Max: 439.45 ms
   - Result: PASS (Target < 2000 ms)
================================================================================
```

---

## 3. RFQ Domain Normalization & Ingestion Throughput

Pure domain parsing, text normalization, unit canonicalization, and catalog matching were benchmarked using a synthetic batch of 500 multi-category industrial RFQ line items.

- **Total Execution Time**: **29.33 ms** for 500 line items
- **Average Per-Line Processing Time**: **0.0587 ms**
- **Effective Processing Velocity**: **17,046 lines per second**
- **Memory Footprint**: < 2.5 MB during full batch transformation

The deterministic string normalization algorithms (`normalize_line` and `normalize_unit`) operate purely in-memory with zero I/O or network dependencies, ensuring lightning-fast preview and validation during CSV upload workflows.

---

## 4. Test Environment Specifications

- **Operating System**: Linux 6.6 (x86_64)
- **Runtime Engines**: Python 3.12.3 / Node.js 22 LTS
- **Database Engine**: PostgreSQL 16.4 on Docker container network
- **Concurrency**: Sequential and pipelined warm-pool requests
- **Tooling**: `scripts/measure_performance.py` using `httpx` async HTTP client and Python `time.perf_counter` high-precision clock.
