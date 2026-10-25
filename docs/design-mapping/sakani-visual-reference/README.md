# Sakani Visual-Conformance Reference Package

## 1. Objectives & Scope

This reference package serves as the definitive source of truth and architectural roadmap for the comprehensive **Sakani Visual-Conformance Pass** of the ForgeFlow Enterprise CPQ & CRM application.

Following human sign-off on the Phase 1–8 functional and security baseline, the visual-conformance pass systematically brings ForgeFlow's visual layer into strict fidelity with the canonical **Sakani CRM** design system (`@sakaniui/react` v0.9.0 and `saas-crm-sakani-ds`).

### Key Visual Directives for Conformance
- **Canonical Saffron Brand Accent**: Adopt Sakani saffron (`#FF4700`) as the primary interactive and brand accent (`--color-primary-500: #FF4700`, `--color-brand-default: #FF4700`), superseding the earlier hybrid enterprise indigo direction.
- **Warm Stone Canvas & Signature Shell**: Implement Sakani's warm stone canvas (`#FAFAF9`) with the signature workspace page container featuring `border-top-left-radius: 28px` and `border-top-right-radius: 28px` on white surface (`#FFFFFF`).
- **Standardized Component Primitives**: Map all buttons, badges, inputs, selects, tables, cards, and sheets to canonical Sakani contracts and tokens.
- **Root-Cause Overflow Correction**: Diagnose and fix layout overflow at the container and flex-item level rather than applying blunt blanket `overflow-x: hidden` rules.

---

## 2. Source-of-Truth Hierarchy & Evidence Categorization

To eliminate ambiguity, design data in this package is strictly classified into four distinct evidentiary tiers:

1. **Direct Screenshot Comparisons**:
   Visual comparisons captured at identical viewports (`1440×900`, `1024×768`, `390×844`) between the running Sakani CRM demo (`http://localhost:5173`) and ForgeFlow (`http://localhost:3000`).
2. **Source-Verified Implementation Details**:
   Exact tokens, CSS variables, HTML structures, and component props inspected directly in the `@sakaniui/react` v0.9.0 package, the MCP tooling (`get_tokens`, `get_component`), and the local source code repositories (`/tmp/saas-crm-sakani-ds` and `/tmp/sakani-design-system`).
3. **Inferred & Purpose-Built Manufacturing Compositions**:
   Manufacturing-specific screens (RFQ Ingestion Wizard, RFQ Review Studio, Quotation Pricing Engine, Calculation Trace Inspector, Approvals Diff Sheet, and Export Studio) that have no direct 1:1 equivalent in a SaaS CRM. These compose verified Sakani primitives (`DataTableBlock`, `Sheet`, `Badge`, `Button`, `Panel`, `MetricRow`) tailored for high-density industrial CPQ.
4. **Screens Pending Captures**:
   Screens whose multi-viewport visual baseline has not yet been fully captured; these are cataloged explicitly with pending status.

---

## 3. Non-Negotiable Operational & Security Invariants

Visual refinement must never compromise ForgeFlow's authoritative operational, security, and mathematical invariants:

1. **Quote Calculation Engine**: Python `Decimal` with `ROUND_HALF_UP` arithmetic remains authoritative. Frontend calculations are strictly preview-only and must reconcile with backend authoritative totals.
2. **Cost & Margin RBAC Isolation**: Internal manufacturing unit costs and projected margins must never be disclosed to unauthorized roles (`sales_rep`, unauthenticated visitors, or customer exports).
3. **RFQ Governance**: Ingestion heuristics, unit normalization, catalog candidate scoring, and quote readiness thresholds must remain intact.
4. **Maker-Checker Separation of Duties**: Proposal authors are strictly prohibited from approving their own commercial adjustments.
5. **PostgreSQL Concurrency Controls**: Transactional row locking (`SELECT ... FOR UPDATE`), optimistic revision verification, and immutable revision trees must be preserved.
6. **Fail-Closed Document Exports**: Unapproved customer exports must fail closed with `HTTP 409 Conflict`. Draft previews must bear conspicuous diagonal watermarks, and delivery ledger records must maintain SHA-256 integrity.

---

## 4. Package Navigation

- [`design-tokens.md`](./design-tokens.md): Exhaustive catalog of verified Sakani design tokens (colors, space, radius, shadow, font, layout geometry), featuring canonical saffron `#FF4700`.
- [`component-reference.md`](./component-reference.md): Specification of Sakani primitives, block components (`DataTableBlock`, `KanbanBoardBlock`), and their ForgeFlow mappings.
- [`screen-parity-matrix.md`](./screen-parity-matrix.md): Screen-by-screen comparative audit distinguishing direct comparisons from layout references and purpose-built compositions.
- [`acceptance-criteria.md`](./acceptance-criteria.md): Quantitative and qualitative gates required for approving visual parity (overflow rules, contrast, touch targets).
- [`screenshots/`](./screenshots/): Direct visual evidence comparing Sakani ground-truth screens with ForgeFlow baseline screens.
