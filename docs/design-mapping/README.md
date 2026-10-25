# ForgeFlow × Sakani CRM — Design Mapping & Redesign Strategy Audit

> **Audit Type:** Read-Only Application, Architecture, and Visual Design Mapping  
> **Target Application:** ForgeFlow Enterprise CPQ & Precision Manufacturing CRM  
> **Reference Design:** Sakani CRM (`saas-crm-sakani-ds.vercel.app`) & Sakani Design System (`@sakaniui/react` v0.9.0)  
> **Investigation Date:** October 2026  
> **Status:** Completed & Ready for Human Review  

---

## 1. Executive Summary

This audit establishes an evidence-backed design crosswalk and technical migration blueprint to transform **ForgeFlow** into a modern, cohesive enterprise application adopting the visual design, layouts, reusable components, and interaction patterns of **Sakani CRM**.

The audit was conducted strictly under **read-only conditions**:
- **Zero application source code files were modified.**
- **Zero package manifests, styles, lockfiles, or configurations were altered.**
- **Zero database schemas, API contracts, or backend behaviors were disturbed.**
- **Zero commits, pushes, or deployments were executed.**

### Key Audit Findings

1. **Architecture Alignment**:
   ForgeFlow is built on **Next.js 16.4.3** (App Router), **React 19.0.0**, Tailwind CSS 4, and TypeScript. The Sakani live CRM is built on Vite + React 18, but the underlying design system repository (`Sakani-design-system` / `@sakaniui/react` v0.9.0) provides modern, modular, CSS-variable-driven primitives licensed under the permissive **MIT License**.

2. **Live Site vs Design System Discrepancy**:
   - The live Sakani CRM (`https://saas-crm-sakani-ds.vercel.app/`) implements only 3 active pages (`/`, `/sales`, `/customers`). The remaining 7 navigation links are disabled placeholders (`page: false`).
   - In contrast, the design system repository provides **169 production-ready primitives and application blocks**, including full CRM dashboards, data tables, metrics banners, Kanban boards, and modal workflows.

3. **Core Domain Invariants to Preserve**:
   ForgeFlow possesses 5 mission-critical manufacturing CPQ invariants that must remain untouched during visual re-skinning:
   - **Authoritative Pure-Python Decimal Pricing**: All saved calculations, line totals, discounts, taxes, and `trace_hash` are computed exclusively by backend Python `Decimal` with `ROUND_HALF_UP`. Form inputs preserve validated strings; client-side math is strictly a non-authoritative typing preview.
   - **Server-enforced RBAC cost masking**: `unit_cost` and margins strictly omitted from server response and UI for `sales_rep`.
   - **RFQ Line-Item Matching Thresholds**: Similarity constants $K=5$, $T_{min}=0.30$, $T_{propose}=0.60$, candidate threshold `0.75`.
   - **Maker-Checker Governance**: Proposers cannot approve their own high-discount quotes.
   - **Export Watermarking & Tamper-Evident Hashing**: Fail-closed export gate, draft watermark, and byte-level SHA-256 integrity logs on PDF exports.

4. **Strategic Recommendation: Selective Vendor-Copy (Approach 2)**:
   We reject full repository replacement (Approach 4), total custom CSS re-implementation (Approach 1), and direct package installation (Approach 3). We recommend selectively vendor-copying Sakani's MIT-licensed UI primitives directly into `frontend/components/sakani/` with explicit `"use client"` directives for interactive components, applying a CSS variable token bridge, and preserving ForgeFlow's server-driven data-fetching and calculation logic.

---

## 2. Component Reuse Summary

A breakdown of ForgeFlow's UI requirements mapped against the Sakani component catalog:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       COMPONENT REUSE DISTRIBUTION                          │
├──────────────────────┬─────────────┬─────────────┬──────────────────────────┤
│ Category             │ Component # │ Percentage  │ Action Path              │
├──────────────────────┼─────────────┼─────────────┼──────────────────────────┤
│ Direct Reuse         │     18      │    45.0%    │ Import Sakani Primitives │
│ Adapt with Extension │     14      │    35.0%    │ Wrap with Domain Handlers│
│ Bespoke / Custom     │      8      │    20.0%    │ Token-Styled Domain UI   │
├──────────────────────┼─────────────┼─────────────┼──────────────────────────┤
│ Total Evaluated      │     40      │   100.0%    │ Full Application Coverage│
└──────────────────────┴─────────────┴─────────────┴──────────────────────────┘
```

### Strongest Opportunities for Immediate Reuse
- **Application Shell & Navigation**: Sakani's 260px collapsible sidebar, breadcrumbs, search triggers, and user profile badges map directly to `frontend/components/layout/`.
- **Form Primitives**: `Input`, `Select`, `Textarea`, `Checkbox`, `Radio`, and `Switch` drop in seamlessly with standard React Hook Form bindings.
- **Surface Elevation & Cards**: Sakani's cards (`--color-bg-surface: #FFFFFF`, `--color-border-subtle: #E7E5E1`, `--shadow-sm: 0 1px 3px 0 rgba(16,15,12,0.10)`) instantly modernize ForgeFlow's dense data panels.
- **Metrics Stat Banners**: Sakani's `MetricCardBlock` and trend pills provide the exact visual hierarchy needed for the Executive Dashboard and Opportunity Pipeline summaries.

### Adaptations Required for Enterprise CPQ
- **TanStack Server-Pagination Table**: Retain TanStack Table v8 for massive datasets (50,000+ line items), but re-skin header, row hover, and pagination styling using Sakani's table CSS tokens.
- **Status & Risk Badges**: Extend Sakani's 5 badge variants to include ForgeFlow's specialized status states (`EXPEDITED`, `ITAR_RESTRICTED`, `DEVIATION_PENDING`, `MAKER_CHECKER_HOLD`).

### Bespoke Domain UI (Styled with Sakani Tokens)
- **RFQ Candidate Match Drawer**: Slide-over drawer with confidence sliders and side-by-side CAD preview.
- **Calculation Trace Tree**: 5-level recursive dependency visualizer for engineering cost verification.
- **Maker-Checker Proposal Diff View**: Side-by-side comparative inspection with real-time audit ledger.
- **Export Watermark Ledger**: Cryptographic SHA-256 verification pill with tamper-detection banner.

---

## 3. Key Risks & Mitigation Matrix

| Risk Identified | Severity | Technical Impact | Concrete Mitigation |
| :--- | :---: | :--- | :--- |
| **Color Contrast Regression** | **HIGH** | Sakani's saffron accent (`#FF4700`) and subtle text (`#A8A29B`) fail WCAG AA contrast (3.41:1 vs `#FFFFFF`, 3.27:1 vs `#FAFAF9` for `#FF4700`; 2.53:1 vs `#FFFFFF`, 2.42:1 vs `#FAFAF9` for `#A8A29B`). | Adopt Option B in [open-decisions.md](file:///home/satjeet/Desktop/CRM/docs/design-mapping/open-decisions.md): Anchor primary actions on WCAG-compliant indigo (`#4F46E5`, 6.29:1 vs `#FFFFFF`, 6.02:1 vs `#FAFAF9`), clamp readable text to `--color-neutral-500` (`#78716A`, 4.81:1 vs `#FFFFFF`, 4.60:1 vs `#FAFAF9`). |
| **Missing Drawer / Sheet Primitive** | **MEDIUM** | SakaniUI lacks a native slide-over drawer, threatening RFQ matching and trace inspection workflows. | Author `frontend/components/sakani/sheet.tsx` by wrapping the existing Base UI accessible Dialog in Sakani elevation, border, and backdrop tokens. |
| **Vercel Deep-Link Routing Bug** | **LOW** | Direct URLs on the reference CRM return HTTP 404 due to missing SPA rewrites. | ForgeFlow uses Next.js 16 App Router with server-side routing; deep links are inherently stable and immune to Vite SPA routing bugs. |
| **Floating-Point Price Drift** | **CRITICAL** | Replacing form controls could inadvertently parse numbers as standard JavaScript IEEE-754 floats. | Mandate that all numerical inputs preserve raw string state and payloads (`quantity: string`, `unit_price: string`), delegating all financial arithmetic exclusively to backend Python `Decimal` (`ROUND_HALF_UP`). Automated pricing regression tests (`pytest backend/tests/unit/test_quote_domain.py`) run on every build. |

---

## 4. Documentation Index

The audit deliverables are organized across nine comprehensive reports in `docs/design-mapping/`:

```
docs/design-mapping/
├── README.md                      ← You are here (Executive summary, reuse breakdown, index)
├── pre-approval-review.md         ← Pre-approval consistency review, evidence synthesis & safety checklist
├── open-decisions.md              ← 5 strategic decisions awaiting human sign-off
├── forgeflow-baseline.md          ← Current Next.js 16 stack, 16 workspace routes, 5 business invariants
├── sakani-audit.md                ← Live site audit, @sakaniui/react package audit, licensing analysis
├── screen-mapping.md              ← Screen-by-screen crosswalk (A–E classification, confidence, gaps)
├── component-crosswalk.md         ← Component-level mapping, atomic primitives, bespoke CPQ widgets
├── redesign-strategy.md           ← 4-approach evaluation, token bridge specification, domain gap solutions
└── implementation-roadmap.md      ← Sequenced 8-phase implementation plan with approval gates
```

### Quick Links to Audit Chapters:
1. **[Pre-Approval Review](file:///home/satjeet/Desktop/CRM/docs/design-mapping/pre-approval-review.md)**: Details resolved discrepancies, RSC package evidence, confirmed facts, and safety checklist.
2. **[Open Decisions & Sign-Off Register](file:///home/satjeet/Desktop/CRM/docs/design-mapping/open-decisions.md)**: Specific options, pros/cons, and recommended choices for the 5 decisions awaiting human sign-off.
3. **[ForgeFlow Baseline Report](file:///home/satjeet/Desktop/CRM/docs/design-mapping/forgeflow-baseline.md)**: Details framework architecture, complete 16-screen route inventory, state management, and calculation integrity.
4. **[Sakani Reference Audit](file:///home/satjeet/Desktop/CRM/docs/design-mapping/sakani-audit.md)**: Deep dive into the live Vercel app, the 169 design system components, Tabler icons, and MIT licensing constraints.
5. **[Screen-by-Screen Crosswalk](file:///home/satjeet/Desktop/CRM/docs/design-mapping/screen-mapping.md)**: Comprehensive mapping matrix covering all 16 ForgeFlow workspace screens with layout, data, and API dependencies.
6. **[Component Crosswalk & Gap Analysis](file:///home/satjeet/Desktop/CRM/docs/design-mapping/component-crosswalk.md)**: Field-level mapping for inputs, buttons, tables, navigation, modals, and the 4 bespoke domain widgets.
7. **[Redesign Strategy & Token Bridge](file:///home/satjeet/Desktop/CRM/docs/design-mapping/redesign-strategy.md)**: Evaluates migration alternatives and provides the exact CSS variable token bridge specification.
8. **[Implementation Roadmap](file:///home/satjeet/Desktop/CRM/docs/design-mapping/implementation-roadmap.md)**: Detailed 8-phase execution plan with gate criteria, smoke tests, and rollback procedures.

---

## 5. Non-Negotiable Constraint Compliance

- [x] Read-only audit conducted: Zero application code modified.
- [x] Dependencies untouched: `package.json` and lockfiles unchanged.
- [x] Invariants verified: Arbitrary-precision pricing, RBAC masking, and maker-checker rules preserved in all proposed designs.
- [x] Implementation paused: No migration code will be executed until human review and approval is granted.
