# ForgeFlow API Documentation

All API endpoints are prefixed with `/api/v1`. All mutations require cookie-based session authentication and valid double-submit CSRF headers (`X-CSRF-Token`).

---

## 1. System & Authentication (Phase 0 / Phase 1)

### `GET /health/live`
- **Description**: Lightweight liveness probe.
- **Auth**: None.
- **Response**: `200 OK`
```json
{ "status": "ok" }
```

### `GET /health/ready`
- **Description**: Readiness probe verifying PostgreSQL connectivity.
- **Auth**: None.
- **Response**: `200 OK`
```json
{ "status": "ready", "database": "connected" }
```

### `POST /api/v1/auth/login`
- **Description**: Authenticate with email and password. Sets HTTP-only `forgeflow_session` cookie and readable `forgeflow_csrf` cookie.
- **Headers**:
  - `Content-Type: application/json`
  - `X-CSRF-Token: <csrf-token>`
  - `Origin: <trusted-origin>`
- **Request Body**:
```json
{
  "email": "sales@forgeflow.demo",
  "password": "ForgeFlowDemo!2026"
}
```
- **Response**: `200 OK`
```json
{
  "user": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "email": "sales@forgeflow.demo",
    "display_name": "Sarah Sales",
    "role": "sales_rep",
    "organization": {
      "id": "7fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "ForgeFlow Demo Manufacturing",
      "slug": "forgeflow-demo"
    },
    "permissions": ["crm:read", "crm:write", "rfq:import", "quotes:draft", "proposals:create"]
  }
}
```

### `POST /api/v1/auth/logout`
- **Description**: Invalidate the session server-side and clear session cookies.
- **Auth**: Session cookie + `X-CSRF-Token`.
- **Response**: `200 OK` `{"message": "Logged out successfully"}`

### `GET /api/v1/auth/me`
- **Description**: Get active user identity, tenant organization, role, and permission grants.
- **Auth**: Session cookie.
- **Response**: `200 OK` (Matches user object from `/login`).

---

## 2. Core CRM Endpoints (Phase 2)

All CRM endpoints enforce tenant boundary isolation (`organization_id`) and RBAC permissions.

### Accounts

#### `GET /api/v1/accounts`
- **Description**: List paginated accounts with optional filtering and search.
- **Permissions**: `crm:read`
- **Query Parameters**:
  - `search` (string, optional): Search by account name or legal name.
  - `account_type` (string, optional): `prospect` | `customer` | `vendor` | `partner`.
  - `status` (string, optional, default: `active`): `active` | `inactive` | `archived`.
  - `page` (int, default: 1)
  - `page_size` (int, default: 25)
- **Response**: `200 OK`
```json
{
  "items": [
    {
      "id": "c0000000-0000-0000-0000-000000000001",
      "organization_id": "7fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "Apex Heavy Engineering Ltd.",
      "legal_name": "Apex Heavy Engineering Limited",
      "account_type": "customer",
      "industry": "Heavy Machinery & Structural Fabrication",
      "website": "https://apexengineering.example",
      "phone": "+91 22 5550 0101",
      "billing_email": "finance@apexengineering.example",
      "billing_address_json": { "city": "Pune", "state": "Maharashtra", "country": "India" },
      "shipping_address_json": {},
      "assigned_rep_user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "assigned_rep_name": "Sarah Sales",
      "status": "active",
      "custom_fields_json": {},
      "version": 1,
      "created_at": "2026-10-01T00:00:00Z",
      "updated_at": "2026-10-01T00:00:00Z"
    }
  ],
  "total": 10,
  "page": 1,
  "page_size": 25,
  "pages": 1
}
```

#### `POST /api/v1/accounts`
- **Description**: Create a new customer or prospect account.
- **Permissions**: `crm:write`
- **Request Body**: `AccountCreate` (`name`, `legal_name`, `account_type`, `industry`, `website`, `phone`, `billing_email`, etc.)
- **Response**: `201 Created`

#### `GET /api/v1/accounts/{account_id}`
- **Description**: Fetch account details by ID.
- **Permissions**: `crm:read`
- **Response**: `200 OK`

#### `PATCH /api/v1/accounts/{account_id}`
- **Description**: Update account fields with optimistic locking verification (`expected_version`).
- **Permissions**: `crm:write`
- **Response**: `200 OK` (Returns updated account with incremented version).
- **Errors**: `409 Conflict` on `STALE_VERSION`.

---

### Contacts

#### `GET /api/v1/contacts`
- **Description**: List contacts across accounts or filtered to a single account.
- **Permissions**: `crm:read`
- **Query Parameters**: `account_id`, `search`, `status`, `is_primary`, `page`, `page_size`.
- **Response**: `200 OK` (`PaginatedResponse[ContactResponse]`)

#### `POST /api/v1/accounts/{account_id}/contacts`
- **Description**: Create a contact associated with an account. If `is_primary=true`, atomically demotes existing primary contact.
- **Permissions**: `crm:write`
- **Response**: `201 Created`

#### `GET /api/v1/contacts/{contact_id}`
- **Description**: Retrieve contact details.
- **Permissions**: `crm:read`

#### `PATCH /api/v1/contacts/{contact_id}`
- **Description**: Update contact with optimistic locking (`expected_version`).
- **Permissions**: `crm:write`

#### `DELETE /api/v1/contacts/{contact_id}`
- **Description**: Soft-delete/archive contact with optimistic locking.
- **Permissions**: `crm:write`

---

### Opportunities & Pipeline

#### `GET /api/v1/opportunities`
- **Description**: List sales opportunities with stage and rep filtering.
- **Permissions**: `crm:read`
- **Query Parameters**: `stage`, `account_id`, `assigned_rep_user_id`, `search`, `page`, `page_size`.
- **Response**: `200 OK` (`PaginatedResponse[OpportunityResponse]`)

#### `POST /api/v1/opportunities`
- **Description**: Create opportunity.
- **Permissions**: `crm:write`
- **Response**: `201 Created`

#### `PATCH /api/v1/opportunities/{opportunity_id}/stage`
- **Description**: Transition opportunity pipeline stage with strict validation:
  - Moving to `closed_won` requires `actual_close_date`.
  - Moving to `closed_lost` requires `closed_reason` and `actual_close_date`.
  - Reopening a closed opportunity requires manager permission (`crm:manage` or `quotes:approve`).
  - Enforces optimistic concurrency (`expected_version`).
- **Permissions**: `crm:write` (or `crm:manage` if reopening closed)
- **Request Body**:
```json
{
  "stage": "closed_lost",
  "expected_version": 2,
  "closed_reason": "Competitor pricing lower by 14%",
  "actual_close_date": "2026-10-24"
}
```
- **Response**: `200 OK`

---

### Tasks

#### `GET /api/v1/tasks`
- **Description**: List operational tasks with priority, status, and due date filters.
- **Permissions**: `crm:read`
- **Query Parameters**: `status`, `priority`, `assigned_to_user_id`, `account_id`, `opportunity_id`, `overdue_only`.
- **Response**: `200 OK` (`PaginatedResponse[TaskResponse]`)

#### `POST /api/v1/tasks`
- **Description**: Create task.
- **Permissions**: `crm:write`
- **Response**: `201 Created`

#### `POST /api/v1/tasks/{task_id}/complete`
- **Description**: Mark open task as completed with optimistic concurrency.
- **Permissions**: `crm:write`
- **Request Body**: `{ "expected_version": 1 }`
- **Response**: `200 OK`

#### `POST /api/v1/tasks/{task_id}/reopen`
- **Description**: Reopen completed task with optimistic concurrency.
- **Permissions**: `crm:write`
- **Request Body**: `{ "expected_version": 2 }`
- **Response**: `200 OK`

---

### Audit & Activity Feed

#### `GET /api/v1/activity`
- **Description**: List tenant activity audit trail.
- **Permissions**: `crm:read`
- **Query Parameters**: `entity_type`, `entity_id`, `event_type`, `limit` (max: 100), `offset`.
- **Response**: `200 OK` (`ActivityListResponse`)

---

## 3. Industrial Catalog & RBAC Isolation (Phase 2)

### Products

#### `GET /api/v1/catalog/products`
- **Description**: List catalog items with category, stock status, and search filters.
- **Permissions**: `catalog:read`
- **RBAC Data Masking Rule**:
  - `unit_cost` is **strictly stripped (`null`)** for `sales_rep` and `sales_manager`.
  - `unit_cost` is visible **only** to `catalog_manager` and `admin`.
- **Query Parameters**: `category`, `stock_status`, `is_active`, `search`, `page`, `page_size`.
- **Response**: `200 OK` (`PaginatedResponse[CatalogProductResponse]`)

#### `POST /api/v1/catalog/products`
- **Description**: Create catalog product item.
- **Permissions**: `catalog:manage` or `catalog:write` (Catalog Manager / Admin).
- **Response**: `201 Created`

#### `GET /api/v1/catalog/products/{product_id}`
- **Description**: Product detail view (RBAC unit cost rule applied).
- **Permissions**: `catalog:read`

#### `PATCH /api/v1/catalog/products/{product_id}`
- **Description**: Update product attributes, price, or specifications with optimistic locking.
- **Permissions**: `catalog:manage` or `catalog:write`

---

## 4. Real Operational Dashboard (Phase 2)

### `GET /api/v1/dashboard/summary`
- **Description**: Real-time aggregated operational metrics across CRM entities.
- **Permissions**: `crm:read`
- **Response**: `200 OK`
```json
{
  "total_open_pipeline_value": 7820000.00,
  "weighted_pipeline_value": 3128000.00,
  "active_opportunities_count": 8,
  "opportunities_by_stage": {
    "lead": 2,
    "qualified": 2,
    "solutioning": 2,
    "proposal": 1,
    "negotiation": 1,
    "closed_won": 1,
    "closed_lost": 1
  },
  "open_tasks_count": 14,
  "overdue_tasks_count": 5,
  "total_accounts_count": 10,
  "total_catalog_products_count": 96,
  "available_phase_4": false,
  "quote_conversion_rate": null,
  "average_quote_value": null
}
```

### `GET /api/v1/dashboard/attention`
- **Description**: Prioritized operational attention queue identifying actionable items (overdue tasks, stale high-value opportunities, pending approvals).
- **Permissions**: `crm:read`
- **Response**: `200 OK`
```json
{
  "items": [
    {
      "id": "item-overdue-...",
      "type": "overdue_task",
      "severity": "high",
      "title": "Send updated flange datasheet to Apex Heavy Engineering",
      "description": "Task was due on 2026-10-18 (6 days overdue)",
      "target_url": "/app/tasks",
      "metadata": { "task_id": "...", "due_date": "2026-10-18" }
    }
  ],
  "total_items": 7,
  "has_pending_rfqs": false,
  "has_pending_approvals": false
}
```

---

## 5. RFQ Ingestion & Review Studio (Phase 3)

### `GET /api/v1/rfqs`
- **Description**: List paginated RFQs for the authenticated organization with search and status filter.
- **Permissions**: `rfq:read`
- **Parameters**: `status`, `account_id`, `opportunity_id`, `page` (default 1), `page_size` (default 20).
- **Response**: `200 OK` `PaginatedRFQsResponse`

### `POST /api/v1/rfqs/import/preview`
- **Description**: Fast non-persisted preview of uploaded CSV file structure, UTF-8 validity, header detection, sample rows, and canonical mapping recommendations.
- **Permissions**: `rfq:import`
- **Payload**: `RFQImportPreviewRequest` (`filename`, `csv_content`)
- **Response**: `200 OK` `RFQImportPreviewResponse`

### `POST /api/v1/rfqs/import`
- **Description**: Atomic RFQ spreadsheet ingestion with duplicate content hash verification, transactional creation of RFQ header, import job, line normalization, and candidate ranking.
- **Permissions**: `rfq:import`
- **Payload**: `RFQImportRequest` (`account_id`, `opportunity_id`, `title`, `customer_reference`, `filename`, `csv_content`, `header_mapping`, `duplicate_override`)
- **Response**: `201 Created` `RFQResponse`

### `GET /api/v1/rfqs/{rfq_id}`
- **Description**: Detailed RFQ review studio summary including line breakdown, exact matches count, needs-review count, and quote readiness evaluation.
- **Permissions**: `rfq:read`
- **Response**: `200 OK` `RFQDetailResponse`

### `GET /api/v1/rfqs/{rfq_id}/lines`
- **Description**: Paginated lines for an RFQ with filtering by match status and needs-review filter.
- **Permissions**: `rfq:read`
- **Parameters**: `match_status`, `needs_review_only`, `page`, `page_size`.
- **Response**: `200 OK` `PaginatedRFQLinesResponse`

### `GET /api/v1/rfqs/{rfq_id}/lines/{line_id}`
- **Description**: Inspector details for a single line item, including extracted dimensions, ranked catalog candidate matches, and active decision.
- **Permissions**: `rfq:read`
- **Response**: `200 OK` `RFQLineDetailResponse`

### `POST /api/v1/rfqs/{rfq_id}/lines/{line_id}/decision`
- **Description**: Record human review decision for a line item (`accept_suggestion`, `choose_product`, `mark_unmatched`, or `revert`).
- **Permissions**: `rfq:write`
- **Payload**: `RFQLineDecisionRequest` (`decision_type`, `candidate_id`, `product_id`, `notes`)
- **Response**: `200 OK` `RFQLineDetailResponse`

### `POST /api/v1/rfqs/{rfq_id}/bulk-accept-exact`
- **Description**: Atomically accepts all exact matches and high-confidence suggestions in a single database transaction, bumping RFQ version.
- **Permissions**: `rfq:write`
- **Response**: `200 OK` `{"accepted_count": int, "rfq": RFQDetailResponse}`

### `POST /api/v1/rfqs/{rfq_id}/rematch`
- **Description**: Re-runs catalog matching against current catalog inventory for all unresolved lines without overwriting accepted decisions, bumping RFQ version.
- **Permissions**: `rfq:write` (or `catalog:manage`)
- **Response**: `200 OK` `{"rematched_count": int, "rfq": RFQDetailResponse}`

### `GET /api/v1/rfqs/{rfq_id}/export/csv`
- **Description**: RFC 4180 compliant CSV export of normalized line items with resolved product data, with spreadsheet formula neutralization applied.
- **Permissions**: `rfq:read`
- **Response**: `200 OK` (`text/csv; charset=utf-8`)

### `POST /api/v1/rfqs/{rfq_id}/create-quote`
- **Description**: Server-evaluated quote-readiness transition gate initializing Revision 1 of a draft `Quote`, copying RFQ line snapshots, evaluating policy rules, and converting RFQ to `quoted` status.
- **Permissions**: `quotes:draft`
- **Response**: `201 Created`
```json
{
  "quote_id": "8fa85f64-5717-4562-b3fc-2c963f66afa6",
  "quote_number": "QT-2026-0003",
  "status": "draft",
  "rfq_id": "6fa85f64-5717-4562-b3fc-2c963f66afa6"
}
```

---

## 4. Quotations & Pricing Engine (Phase 4)

All quotation endpoints enforce tenant boundary isolation (`organization_id`), optimistic locking, and server-side RBAC cost/margin masking.

### `GET /api/v1/quotes`
- **Description**: List paginated quotes with commercial status, totals, and policy approval status.
- **Permissions**: `quotes:draft` or `crm:read`
- **Query Parameters**:
  - `status` (string, optional): `draft` | `in_review` | `approved` | `sent` | `accepted` | `rejected`
  - `account_id` (UUID, optional)
  - `opportunity_id` (UUID, optional)
  - `search` (string, optional): Quote number search
  - `page` (int, default: 1)
  - `page_size` (int, default: 25)
- **Response**: `200 OK` `PaginatedQuotesResponse`

### `GET /api/v1/quotes/{quote_id}`
- **Description**: Complete quotation details including authoritative active revision, line items, live totals, commercial terms, and policy governance status.
- **Permissions**: `quotes:draft` or `crm:read`
- **Response**: `200 OK` `QuoteDetailResponse`
- **Cost Isolation**: `unit_cost`, `line_cost`, `line_gross_profit`, and `margin_percent` are returned as `null` unless the requesting user possesses `catalog:cost` or `admin` / `catalog_manager` roles.

### `PATCH /api/v1/quotes/{quote_id}/draft`
- **Description**: Update draft quote lines (quantity, unit selling price, discount %, tax %), commercial conditions, delivery terms, and notes. Atomically triggers pure Decimal recalculation and policy evaluation, bumping the quote version.
- **Permissions**: `quotes:draft`
- **Request Body**:
```json
{
  "expected_version": 1,
  "notes": "Urgent turnaround supply conditions",
  "payment_terms": "Net 30 days",
  "delivery_terms": "Ex-Works Factory",
  "lines": [
    {
      "id": "1fa85f64-5717-4562-b3fc-2c963f66afa6",
      "line_order": 1,
      "sku": "VALV-BALL-BR-50",
      "product_name": "Brass Ball Valve Screwed 50mm",
      "unit": "nos",
      "quantity": "200.0000",
      "unit_price": "2850.00",
      "discount_percent": "6.50",
      "tax_rate_percent": "18.00"
    }
  ]
}
```
- **Responses**:
  - `200 OK`: Updated `QuoteDetailResponse` with new version and recalculated totals.
  - `409 Conflict`: `{"code": "QUOTE_VERSION_CONFLICT", "message": "Quote version conflict: expected 1, but quote is at version 2."}`

### `GET /api/v1/quotes/{quote_id}/revisions`
- **Description**: Retrieve chronological revision history for a quotation.
- **Permissions**: `quotes:draft` or `crm:read`
- **Response**: `200 OK` `List[QuoteRevisionResponse]`

### `GET /api/v1/quotes/{quote_id}/revisions/{revision_id}`
- **Description**: Detail of a specific historical or active quote revision.
- **Permissions**: `quotes:draft` or `crm:read`
- **Response**: `200 OK` `QuoteRevisionResponse`

### `GET /api/v1/quotes/{quote_id}/calculation-trace`
- **Description**: Retrieve the ordered arithmetic computation graph generated by the pure Decimal pricing engine (`forgeflow-quote-calculator/1.0.0`). Contains formula steps, rounding rules (`ROUND_HALF_UP`), input fingerprints, and server-side cost node redactions.
- **Permissions**: `quotes:draft` or `crm:read`
- **Query Parameters**:
  - `revision_id` (UUID, optional): Defaults to active revision if omitted.
- **Response**: `200 OK` `CalculationTraceResponse`

---

## 5. Phase 5 Proposals & Governance Endpoints

### 5.1 Proposals Lifecycle & Diff

#### `GET /api/v1/quotes/{quote_id}/proposals`
- **Method**: `GET`
- **Roles**: `sales_rep`, `sales_manager`, `catalog_manager`, `admin`
- **Query Parameters**: `status` (optional), `page`, `page_size`
- **Response**: `200 OK` `PaginatedProposalsResponse`

#### `POST /api/v1/quotes/{quote_id}/proposals`
- **Method**: `POST`
- **Roles**: `sales_rep`, `sales_manager`, `admin`
- **Headers**: `X-CSRF-Token`
- **Request Body**: `CreateProposalRequest` (`quote_id`, `base_revision_id`, `title`, `justification`, `operations`, `idempotency_key`)
- **Allowlisted Operations**:
  - `set_line_quantity`: `target_line_id`, `value` (numeric string)
  - `set_line_unit_price`: `target_line_id`, `value` (numeric string in INR)
  - `set_line_discount_percent`: `target_line_id`, `value` (numeric string 0.00-100.00)
  - `set_line_tax_rate_percent`: `target_line_id`, `value` (numeric string 0.00-100.00)
  - `add_line`: `payload` (`catalog_product_id`, `quantity`, `unit_price`, etc.)
  - `remove_line`: `target_line_id`
  - `set_valid_until`: `value` (ISO date `YYYY-MM-DD`)
  - `set_payment_terms`: `value` (string)
  - `set_delivery_terms`: `value` (string)
- **Response**: `200 OK` `ProposalDetailResponse`

#### `GET /api/v1/proposals/{id}`
- **Method**: `GET`
- **Roles**: `sales_rep`, `sales_manager`, `catalog_manager`, `admin`
- **Response**: `200 OK` `ProposalDetailResponse`

#### `PUT /api/v1/proposals/{id}`
- **Method**: `PUT`
- **Roles**: `sales_rep`, `sales_manager`, `admin` (only author can edit while status is `draft`)
- **Headers**: `X-CSRF-Token`
- **Request Body**: `UpdateProposalDraftRequest` (`title`, `description`, `justification`, `operations`)
- **Response**: `200 OK` `ProposalDetailResponse`

#### `POST /api/v1/proposals/{id}/submit`
- **Method**: `POST`
- **Roles**: `sales_rep`, `sales_manager`, `admin` (transitions `draft -> pending_review`)
- **Headers**: `X-CSRF-Token`
- **Response**: `200 OK` `ProposalDetailResponse`

#### `GET /api/v1/proposals/{id}/diff`
- **Method**: `GET`
- **Roles**: `sales_rep`, `sales_manager`, `catalog_manager`, `admin`
- **RBAC Cost Masking**: Proposers with `sales_rep` role have internal unit costs, margins, and cost deltas masked server-side (`null`). Sales managers and admins receive full internal cost intelligence.
- **Response**: `200 OK` `ProposalDiffResponse`

#### `POST /api/v1/proposals/{id}/approve`
- **Method**: `POST`
- **Roles**: `sales_manager`, `admin`
- **Maker-Checker Security Invariant**: Proposer cannot approve own proposal (`HTTP 403 MAKER_CHECKER_VIOLATION`), even if reviewer holds `sales_manager` or `admin` role.
- **Headers**: `X-CSRF-Token`
- **Request Body**: `ApprovalDecisionRequest` (`decision: "approved"`, optional `notes`, `idempotency_key`)
- **Response**: `200 OK` `ApprovalDecisionResponse`

#### `POST /api/v1/proposals/{id}/reject`
- **Method**: `POST`
- **Roles**: `sales_manager`, `admin`
- **Maker-Checker Security Invariant**: Proposer cannot reject own proposal.
- **Validation**: `rejection_reason` is strictly required (`HTTP 422 REJECTION_REASON_REQUIRED`).
- **Headers**: `X-CSRF-Token`
- **Request Body**: `ApprovalDecisionRequest` (`decision: "rejected"`, `rejection_reason`, `idempotency_key`)
- **Response**: `200 OK` `ApprovalDecisionResponse`

#### `POST /api/v1/proposals/{id}/commit`
- **Method**: `POST`
- **Roles**: `sales_manager`, `admin`
- **Concurrency Control**: Row-lock on Quote (`SELECT ... FOR UPDATE`). Compares `quote.current_revision_id == proposal.base_revision_id`. If mismatched, aborts with `HTTP 409 STALE_BASE_REVISION`.
- **Atomic Execution**: Allocates Revision $N+1$, repoints `current_revision_id`, marks proposal `committed`, appends immutable activity log, and returns committed revision ID.
- **Headers**: `X-CSRF-Token`
- **Request Body**: `CommitProposalRequest` (`idempotency_key`)
- **Response**: `200 OK` `ProposalDetailResponse`

#### `POST /api/v1/proposals/{id}/cancel`
- **Method**: `POST`
- **Roles**: `sales_rep`, `sales_manager`, `admin` (transitions `draft -> cancelled`)
- **Headers**: `X-CSRF-Token`
- **Response**: `200 OK` `ProposalDetailResponse`

---

### 5.2 Approval Queue & Initial Quote Approvals

#### `GET /api/v1/approvals`
- **Method**: `GET`
- **Roles**: `sales_manager`, `admin` (role-gated: 403 Forbidden for `sales_rep`, `catalog_manager`)
- **Query Parameters**: `status` (`pending`, `approved`, `rejected`, `all`), `page`, `page_size`, `search`
- **Response**: `200 OK` `PaginatedApprovalsResponse`

#### `POST /api/v1/quotes/{id}/submit-for-approval`
- **Method**: `POST`
- **Roles**: `sales_rep`, `sales_manager`, `admin`
- **Headers**: `X-CSRF-Token`
- **Transitions**: Quote `draft -> pending_approval`
- **Response**: `200 OK` `QuoteDetailResponse`

#### `POST /api/v1/quotes/{id}/approve-initial`
- **Method**: `POST`
- **Roles**: `sales_manager`, `admin`
- **Maker-Checker Security Invariant**: Proposer (`created_by`) cannot approve own initial quote (`HTTP 403 MAKER_CHECKER_VIOLATION`).
- **Headers**: `X-CSRF-Token`
- **Request Body**: `InitialQuoteDecisionRequest` (`decision`, optional `comment`, `rejection_reason`)
- **Response**: `200 OK` `QuoteDetailResponse`

---

## 6. Phase 6 Customer Document Exports & Deliveries

### 6.1 Final Customer Document Exports

#### `GET /api/v1/quotes/{id}/export/pdf`
- **Method**: `GET`
- **Roles**: `sales_rep`, `sales_manager`, `catalog_manager`, `admin`
- **Preconditions**:
  - Quote status MUST be `approved` or `sent` (returns `HTTP 409 QUOTE_NOT_APPROVED_FOR_EXPORT` if draft or pending).
  - Quote must have an authoritative committed revision (`current_revision_id`).
- **Response Headers**:
  - `Content-Type`: `application/pdf`
  - `Content-Disposition`: `attachment; filename="Quote-{quote_number}-Rev{revision_number}.pdf"`
  - `X-Content-SHA256`: Hexadecimal SHA-256 hash of output bytes
- **Security Controls**:
  - Jinja2 template `forgeflow-quotation-template/1.0.0` rendered with WeasyPrint.
  - Custom `safe_url_fetcher` denying SSRF, remote HTTP/HTTPS, and local file scheme traversal.
  - Internal unit costs, line gross profit, and margin intelligence strictly omitted from projection DTO.
  - Fail-closed database audit record in `export_events` and permanent deliverable record in `quote_customer_deliveries`.

#### `GET /api/v1/quotes/{id}/export/csv`
- **Method**: `GET`
- **Roles**: `sales_rep`, `sales_manager`, `catalog_manager`, `admin`
- **Preconditions**:
  - Quote status MUST be `approved` or `sent` (returns `HTTP 409 QUOTE_NOT_APPROVED_FOR_EXPORT` if draft or pending).
- **Response Headers**:
  - `Content-Type`: `text/csv; charset=utf-8`
  - `Content-Disposition`: `attachment; filename="Quote-{quote_number}-Rev{revision_number}.csv"`
  - `X-Content-SHA256`: Hexadecimal SHA-256 hash of output bytes
- **Security Controls**:
  - Strict RFC 4180 CSV emission.
  - Formula injection neutralization: fields starting with `=`, `+`, `-`, `@`, `\t`, `\r`, `\n` prefixed with `'` on strings.
  - Cost masking: Internal purchase costs and margins are not exported to customer procurement CSV.
  - Recorded in `export_events` and `quote_customer_deliveries`.

### 6.2 Watermarked Draft Preview PDF

#### `GET /api/v1/quotes/{id}/export/preview-pdf`
- **Method**: `GET`
- **Roles**: `sales_rep`, `sales_manager`, `catalog_manager`, `admin`
- **Description**: Generates an unapproved inspection PDF at any lifecycle stage (including `draft` and `pending_approval`).
- **Watermark Invariant**: Strictly stamped with bold, semi-transparent diagonal watermark across all pages: `"DRAFT — NOT APPROVED COMMERCIAL PROPOSAL"`.
- **Response Headers**:
  - `Content-Type`: `application/pdf`
  - `Content-Disposition`: `inline; filename="DRAFT_PREVIEW_Quote-{quote_number}.pdf"`
  - `X-Content-SHA256`: Hexadecimal SHA-256 hash of output bytes
- **Audit**: Logged to `export_events` with `is_watermarked=True`.

### 6.3 Customer Delivery History & SHA-256 Verification

#### `GET /api/v1/quotes/{id}/deliveries`
- **Method**: `GET`
- **Roles**: `sales_rep`, `sales_manager`, `catalog_manager`, `admin`
- **Response**: `200 OK` `list[QuoteCustomerDeliveryResponse]`
  - Fields: `id`, `quote_id`, `revision_id`, `export_format` (`pdf` | `csv`), `filename`, `content_sha256`, `byte_size`, `delivered_by_user_id`, `delivered_by_user_name`, `created_at`.

---

## 7. Planned PRD Endpoints (Phase 7)

- **Phase 7**: End-to-End Operational Hardening, Final System Integration & Production Auditing
