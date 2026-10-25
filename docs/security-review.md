# ForgeFlow Release Security Review & Threat Assessment

This document provides a comprehensive security review of the ForgeFlow platform for production release readiness.

---

## 1. Secret Scanning & Credential Governance

### Automated Secret Scanning
- Static analysis was executed across the entire repository to detect committed passwords, API keys, tokens, or private certificates.
- **Finding**: **0 hardcoded credentials or private keys detected in source code.**
- All sensitive variables (`APP_SECRET_KEY`, `POSTGRES_PASSWORD`, `DATABASE_URL`) are read from process environment variables via Pydantic Settings.

### Production Fail-Closed Safeguards
When `APP_ENV=production`:
1. **Demo Mode Prohibited**: If `DEMO_MODE=true` is set while `APP_ENV=production`, backend startup aborts immediately with an uncaught `ValueError`, preventing synthetic accounts or pre-seeded credentials from entering production.
2. **Secret Entropy Guard**: If `APP_SECRET_KEY` is empty, default, or fewer than 32 characters, startup halts immediately.
3. **Cookie Security**: `forgeflow_session` and `forgeflow_csrf` automatically enforce `Secure=True`, preventing cookie transmission over unencrypted HTTP.
4. **CORS Tightening**: Disallows wildcard `*` origins; requires explicit, comma-separated domain origins.

---

## 2. Dependency Vulnerability Assessment

### Backend (Python 3.12 / uv)
- Dependencies were reviewed and locked via `backend/uv.lock`.
- Key cryptographic dependencies: `pwdlib[argon2]`, `cryptography`.
- **Finding**: Zero known CVEs in locked backend production dependencies.

### Frontend (Node 22 / pnpm)
- Evaluated via `pnpm audit --prod`.
- **Finding**: **0 known vulnerabilities found** (`zod` updated to `4.6.7`, resolving `GHSA-mrhx-c7xc-m3w5`).
- Form validation schemas, React Hook Form integration, Vitest unit tests, and Playwright browser E2E test suites were re-verified across all viewports with zero regressions. In addition, the backend continues to enforce strict boundary validation via FastAPI and Pydantic v2 schemas as the primary security perimeter.

---

## 3. Session & Authentication Architecture

ForgeFlow rejects JWTs in favor of cryptographically secure, stateful server-side sessions:

| Parameter | Specification | Purpose |
| :--- | :--- | :--- |
| **Password Hashing** | Argon2id (`time_cost=3, memory_cost=65536, parallelism=4`) | State-of-the-art password derivation resistant to GPU/ASIC cracking. |
| **Session Identifier** | 32-byte cryptographically random token (`secrets.token_urlsafe(32)`) | High-entropy opaque token. |
| **Storage Security** | SHA-256 hash of session token stored in PostgreSQL | Database dumps or SQL injection exposure cannot recover usable session tokens. |
| **Cookie Flags** | `HttpOnly=True`, `SameSite=Lax`, `Path=/`, `Secure` (prod) | Prevents XSS cookie theft and mitigates cross-site request forgery. |
| **Expiration Policy** | 12-hour absolute lifetime, 60-minute sliding idle timeout | Restricts replay window of abandoned sessions. |
| **Revocation** | Immediate invalidation on logout or account deactivation | Session record deleted from DB; cookie cleared. |

---

## 4. Cross-Site Request Forgery (CSRF) Protection

All state-mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`) require:
1. Valid session cookie (`forgeflow_session`).
2. Valid double-submit CSRF cookie (`forgeflow_csrf`).
3. HTTP request header `X-CSRF-Token` exactly matching the decoded token in `forgeflow_csrf`.
4. HTTP `Origin` header matching configured CORS whitelist.

Requests failing any of these checks are rejected immediately with HTTP 403 `CSRF_FAILED`.

---

## 5. Commercial Confidentiality & Data Masking (RBAC)

ForgeFlow enforces strict commercial privilege separation between Sales Representatives and Catalog / Management roles:

| Domain Field | `sales_rep` | `catalog_manager` | `sales_manager` | `admin` |
| :--- | :--- | :--- | :--- | :--- |
| Catalog Unit Cost | **MASKED (`None`)** | Visible | Visible | Visible |
| Target Markup % | **MASKED (`None`)** | Visible | Visible | Visible |
| Internal Margin $ | **MASKED (`None`)** | Visible | Visible | Visible |
| Customer Sell Price | Visible | Visible | Visible | Visible |

### Architectural Enforcement
- Cost masking is not merely a CSS or UI toggle: queries executed by `sales_rep` users omit unit costs at the repository query and Pydantic DTO serialization layer.
- Unit cost data is physically absent from JSON payloads transmitted over the wire to `sales_rep` sessions.

---

## 6. Document Export Governance & Watermarking

ForgeFlow implements strict dual-mode document export controls:

1. **Approved Customer Exports (`POST /api/v1/quotes/{id}/export/customer`)**:
   - Permitted **only** when `quote.status == 'approved'`.
   - Generates production-ready, clean PDF with seller legal headers and line-item details.
   - Computes SHA-256 hash and registers cryptographic delivery entry in `quote_customer_deliveries`.
   - Attempting customer export on draft quotes fails closed with HTTP 409 `QUOTE_NOT_APPROVED`.
2. **Draft Preview Exports (`POST /api/v1/quotes/{id}/preview-export`)**:
   - Available to sales reps during quotation drafting.
   - Embeds a mandatory 45-degree diagonal semi-transparent red watermark:
     `DRAFT — NOT FOR CUSTOMER USE`
   - Clearly marks the document as an unapproved internal draft.
