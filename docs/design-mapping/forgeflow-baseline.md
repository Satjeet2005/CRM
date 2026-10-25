# ForgeFlow Architecture & Application Baseline

This document provides the verified technical baseline of the existing **ForgeFlow** codebase prior to any design system migration or UI redesign.

---

## 1. Architecture and Technology Stack

All information below has been verified directly against [`frontend/package.json`](file:///home/satjeet/Desktop/CRM/frontend/package.json), [`backend/pyproject.toml`](file:///home/satjeet/Desktop/CRM/backend/pyproject.toml), and active repository configurations.

### 1.1 Frontend Framework & Core Runtimes
- **Framework**: **Next.js 16.4.3** using the App Router (`app/` directory).
- **React**: **React 19.0.0** / `react-dom 19.0.0`.
- **Language**: **TypeScript 5.7.3** in strict mode (`tsc --noEmit`).
- **Package Manager**: **pnpm 11.0.0** with strict lockfile enforcement (`pnpm-lock.yaml`).
- **Build Target**: Next.js standalone output (`output: 'standalone'` in `next.config.ts`) containerized in Alpine Node 22.

### 1.2 UI & Styling Architecture
- **CSS Engine**: **Tailwind CSS 4.0.9** via `@tailwindcss/postcss`.
- **Design Tokens**: Defined as CSS custom variables in [`frontend/app/globals.css`](file:///home/satjeet/Desktop/CRM/frontend/app/globals.css) mapped under `@layer base` and `@theme`.
- **Primitives**: Unstyled, accessible primitives provided by **`@base-ui/react` 1.0.0** (dialogs, popovers, separators, sheets, tabs).
- **Icons**: **`lucide-react` 1.16.0**.
- **Animation**: **`motion` 12.4.7** with `prefers-reduced-motion` fallbacks.
- **Utility Helpers**: `clsx 2.1.1`, `tailwind-merge 3.0.1`, `class-variance-authority 0.7.1`.

### 1.3 State Management, Data Fetching & Forms
- **Server State & Caching**: **TanStack React Query 5.66.0** (`@tanstack/react-query`) with automatic query invalidation and optimistic mutations.
- **Form UX**: **React Hook Form 7.54.2** paired with **Zod 4.6.7** validation schemas via `@hookform/resolvers/zod`.
- **Table Foundations**: **TanStack React Table 8.21.2** (`@tanstack/react-table`).
- **Charts & Data Visualization**: **Recharts 3.10.1**.
- **Toast Notifications**: **Sonner 2.0.1** (mounted via `Toaster` in layout).
- **File Uploads**: **React Dropzone 14.3.8** (`react-dropzone`).
- **Date & Currency Formatting**: `date-fns 4.1.0`, `date-fns-tz 3.2.0`, and custom INR currency formatters (`lib/formatters/formatters.ts`).

### 1.4 API Contract & Backend Integration Boundaries
- **Backend**: FastAPI 0.115+, Python 3.12 managed by Astral `uv`.
- **Database**: PostgreSQL 16.4 with SQLAlchemy 2.0 and Alembic migrations (head: `0006_customer_exports`).
- **API Prefix**: `/api/v1` with JSON field naming in `snake_case`.
- **Client Contract**: Generated TypeScript contract in [`frontend/lib/api/schema.d.ts`](file:///home/satjeet/Desktop/CRM/frontend/lib/api/schema.d.ts) generated from FastAPI OpenAPI via `openapi-typescript`.
- **Authentication**: Stateful, server-side session cookies (`forgeflow_session`) backed by Argon2id password hashing and double-submit CSRF cookie protection (`forgeflow_csrf` / `X-CSRF-Token`).

### 1.5 Quality Gates & Testing
- **Unit & Component Testing**: **Vitest 3.0.7** with `@testing-library/react 16.2.0` and `jsdom 26.0.0` (38 passed).
- **End-to-End Browser Testing**: **Playwright 1.50.1** with headless Chromium testing across Desktop (1440×900), Tablet (1024×768), and Mobile (390×844) viewports (48 passed).
- **Accessibility Auditing**: **`@axe-core/playwright` 4.10.1** verifying WCAG 2.1 AA compliance across all application views (0 violations).

---

## 2. Existing Screen & Workflow Inventory

ForgeFlow encompasses 16 workspace views, 1 authentication view, and 1 root redirect:

| Route | Screen Name | Primary User | Key Capabilities & User Actions | Dependencies |
| :--- | :--- | :--- | :--- | :--- |
| `/login` | Sign In | All Roles | Email/password login, quick demo role chooser, error feedback | `POST /api/v1/auth/login` |
| `/app/dashboard` | Operations Overview | All Roles | Pipeline KPI cards, stage distribution chart, action queue | `/api/v1/crm/dashboard` |
| `/app/accounts` | Account Management | Sales Rep, Manager | Paginated account list, search, type filtering, create/edit/archive modal | `/api/v1/crm/accounts` |
| `/app/accounts/[accountId]` | Account Detail | Sales Rep, Manager | Primary contact badge, linked opportunities, contacts tab, activity stream | `/api/v1/crm/accounts/{id}` |
| `/app/contacts` | Contacts Directory | Sales Rep, Manager | Contact listing, search, primary contact toggle, account link | `/api/v1/crm/contacts` |
| `/app/opportunities` | Opportunities Pipeline | Sales Rep, Manager | Dual-mode view: interactive Kanban board vs data table; stage transition modal; reopen modal | `/api/v1/crm/opportunities` |
| `/app/opportunities/[opportunityId]` | Opportunity Detail | Sales Rep, Manager | Deal metadata, stage history, associated quotes, quick actions | `/api/v1/crm/opportunities/{id}` |
| `/app/tasks` | Tasks & Follow-ups | Sales Rep, Manager | Task list, status tabs (open, overdue, completed), completion toggle, create/edit modal | `/api/v1/crm/tasks` |
| `/app/catalog` | Industrial Catalog | All Roles (RBAC) | Product SKU listing, category filter, stock status, alias management; cost masking for sales | `/api/v1/catalog/products` |
| `/app/rfqs` | RFQ Ingestion Log | Sales Rep, Reviewer | Ingested RFQ list, customer reference, parsing status, quote readiness indicators | `/api/v1/rfqs` |
| `/app/rfqs/new` | RFQ Ingestion Wizard | Sales Rep | 2-step CSV import wizard: dropzone, canonical field mapping, parse preview, duplicate warning | `/api/v1/rfqs/preview`, `/import` |
| `/app/rfqs/[rfqId]` | RFQ Review Studio | Sales Rep, Reviewer | Readiness diagnostic counters, candidate drawer ($K=5$), match acceptance, rematch, quote gate | `/api/v1/rfqs/{id}/lines` |
| `/app/quotes` | Quotation Directory | Sales Rep, Manager | Paginated quote list, revision indicators, status filters (Draft, Approved, Rejected) | `/api/v1/quotes` |
| `/app/quotes/[quoteId]` | Quotation Studio | Sales Rep, Manager | Draft line editor, presentation preview mode, cost intelligence toggle, trace sheet, export studio | `/api/v1/quotes/{id}` |
| `/app/approvals` | Reviews & Approvals | Sales Manager, Admin | Commercial proposal queue, maker-checker diff review sheet, approve modal, rejection reason | `/api/v1/proposals` |
| `/app/activity` | Activity Stream | All Roles | Immutable timeline audit log, entity filtering, event type filtering | `/api/v1/crm/activity` |

---

## 3. Business-Critical Invariants That Must Be Preserved

Any visual redesign of ForgeFlow must treat the following business logic, security constraints, and domain rules as **immutable invariants**:

### 3.1 Role-Based Access Control (RBAC) & Cost Masking
- **Unit Cost Isolation**: Sales Representatives (`sales_rep`) must **never** receive or observe `unit_cost`, `markup_percent`, or `margin_amount` in API responses or UI elements.
- **Presentation Preview Mode**: When enabled, masks all commercial markup, margin, and cost columns from client-facing viewports.
- **Admin & Catalog Visibility**: Internal costs and margins remain strictly visible to `catalog_manager`, `sales_manager`, and `admin`.

### 3.2 RFQ Deterministic Normalization & Match Governance
- **Ranking Constants**: Matching heuristics must strictly preserve $K=5$, $T_{min}=0.30$, and $T_{propose}=0.60$.
- **Quote-Readiness Gate**: The "Create Quotation" action must remain disabled with explicit diagnostic counters whenever unreviewed, low-confidence, or rejected lines exist.
- **Provenance Tracking**: Each accepted line item must preserve its association with the original RFQ line, raw customer text, normalized text, and chosen catalog SKU.

### 3.3 Authoritative Quotation Calculation & Precision
- **Decimal Pricing Engine**: All financial math (line items, discounts, taxes, subtotals, grand totals, and `trace_hash`) is calculated exclusively by the backend pure-Python `Decimal` calculator (`backend/app/domain/quotes/calculator.py`) using `ROUND_HALF_UP` banking rules. Client-side math in `QuoteDetailPage` is strictly a non-authoritative typing preview.
- **String Input Preservation**: Form input fields and local state preserve validated string representations (`quantity: string`, `unit_price: string`, etc.) and transmit them as strings in mutation payloads (`QuoteDraftLineUpdateInput`) to avoid JavaScript IEEE-754 floating-point inaccuracies.
- **Calculation Trace Graph**: The formula trace and dependency breakdown must remain inspectable for compliance audits.

### 3.4 Proposal Staging & Maker-Checker Separation of Duties
- **Review-Before-Write Isolation**: Changes to approved or pending quotes must never mutate the active revision directly; they must stage as a `QuoteChangeProposal`.
- **Maker-Checker Security Invariant**: The user who authored a change proposal (`proposer_user_id`) is strictly prohibited from approving or rejecting their own proposal (`decided_by_user_id != proposer_user_id`).
- **Rejection Reason Mandate**: Commercial rejections require an explicit, non-empty commercial explanation.
- **Atomic Commit with Concurrency Gate**: Committing advances the quotation to Revision $N+1$ using database row locks (`SELECT ... FOR UPDATE`), failing with `HTTP 409 Conflict` if the base revision changed in the interim.

### 3.5 Customer Document Export Governance & Watermarking
- **Fail-Closed Gate**: Quotations in `draft` or `pending_approval` status must fail closed with `HTTP 409 Conflict` when unwatermarked customer PDF or CSV exports are requested.
- **Conspicuous Draft Watermark**: Draft previews must embed a 45-degree diagonal semi-transparent red watermark reading: `"DRAFT — NOT FOR CUSTOMER USE"`.
- **SSRF-Safe PDF Compilation**: WeasyPrint URL fetcher strictly denies remote `http://`/`https://` and local `file://` access.
- **RFC 4180 Formula Injection Neutralization**: Exported CSV strings beginning with `=`, `+`, `-`, `@`, `\t`, `\r`, `\n` are neutralized with single-quote prefixes.
- **Tamper-Evident Delivery Ledger**: Every customer export computes a byte-level SHA-256 fingerprint recorded immutably in `quote_customer_deliveries`.
