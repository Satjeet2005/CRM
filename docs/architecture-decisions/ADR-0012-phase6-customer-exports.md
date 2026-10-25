# ADR-0012: Phase 6 Customer Document Exports, Watermark Governance, and Delivery Auditing

## Status
Accepted

## Context
ForgeFlow requires customer-facing quotation exports in PDF and CSV formats following quote creation and Phase 5 maker-checker proposal approval.

Key architectural and security constraints include:
1. **Authoritative Server Generation**: Customer exports must always be generated server-side from an authoritative committed quote revision. Client-side HTML, local totals, or unverified request parameters must never be used.
2. **Confidentiality & RBAC Cost Masking**: Internal unit costs, line costs, gross profits, profit margins, internal notes, candidate match scores, and user tokens must never appear in customer exports or customer-facing DTOs.
3. **Watermark Governance & Status Gate**: Quotes in `draft`, `pending_approval`, `rejected`, `stale`, or `cancelled` statuses must never be released through the final export route (`QUOTE_NOT_APPROVED_FOR_EXPORT`). For internal review purposes, an explicit draft-preview endpoint (`/export/preview-pdf`) renders a prominent, high-contrast watermark `DRAFT — NOT APPROVED COMMERCIAL PROPOSAL` across every page.
4. **Spreadsheet Formula Injection Neutralization**: In customer CSV exports, any untrusted textual field whose first stripped character is `=`, `+`, `-`, `@`, `\t`, `\r`, or `\n` must be sanitized with a leading single quote (`'`), while preserving valid negative numeric domain values.
5. **Audit Separation & Hash Integrity**: 
   - `export_events`: Records every export attempt (success, denied, failed), including actor, organization, resource, format, status, request ID, safe error code, and SHA-256 hash.
   - `quote_customer_deliveries`: Records successful customer deliveries with exact byte-level SHA-256 fingerprint, format, recipient, actor, and watermark status.

## Decision
1. **Renderer**: Use WeasyPrint in the FastAPI backend with a version-controlled HTML/CSS template (`forgeflow-quotation-template/1.0.0`). Native packages (`libpango-1.0-0`, `fonts-dejavu-core`, etc.) are installed in the Debian-based Docker image.
2. **SSRF Sandboxing**: WeasyPrint URL fetching is restricted to local/static assets; remote network protocols and external file paths are denied.
3. **Data Models**:
   - `export_events`: Captures all export requests and outcomes.
   - `quote_customer_deliveries`: Tracks successful delivered artifacts.
4. **API Endpoints**:
   - `GET /api/v1/quotes/{id}/export/pdf`: Final unwatermarked PDF (requires `approved` or `sent` status).
   - `GET /api/v1/quotes/{id}/export/csv`: Customer-safe RFC 4180 CSV (requires `approved` or `sent` status).
   - `GET /api/v1/quotes/{id}/export/preview-pdf`: Watermarked draft preview.
   - `GET /api/v1/quotes/{id}/deliveries`: Retrieval of customer export manifests and SHA-256 fingerprints.
5. **Headers**: Generated file downloads return `Content-Disposition: attachment; filename="..."` and `X-Content-SHA256: <digest>`.

## Consequences
- Guaranteed commercial confidentiality: Customer quotations never expose supplier profit margins.
- Strict workflow compliance: Unapproved quotations cannot leak as final commercial commitments.
- Complete regulatory and delivery traceability: Every artifact can be verified against its SHA-256 hash in `quote_customer_deliveries`.
