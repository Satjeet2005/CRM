# ForgeFlow × Sakani CRM — Pre-Approval Consistency Review

> **Review Type:** Pre-Approval Technical Consistency, Evidence Audit & Invariant Verification  
> **Investigation Date:** October 2026  
> **Target Status:** Completed — Standing by for Human Sign-Off  

---

## 1. Contradictions Found & How Each Was Resolved

During the cross-document consistency review, four technical discrepancies and ambiguities were identified and systematically resolved across all documentation in `docs/design-mapping/`:

| Issue ID | Identified Contradiction / Ambiguity | Prior State Across Documents | Source Evidence & Resolution |
| :--- | :--- | :--- | :--- |
| **C1** | **Design System Integration Strategy (D2)** | `open-decisions.md` recommended Option B (vendor-copy), while `redesign-strategy.md` and `implementation-roadmap.md` instructed `pnpm add @sakaniui/react` and importing `@sakaniui/react/style.css`. | **Resolved to Selective Vendor-Copy (Option B)** across all files. Inspection of `@sakaniui/react` 0.9.0 showed monolithic barrel exports without `"use client"` directives, which crash Next.js 16 App Router Server Components upon evaluation. |
| **C2** | **Design Token Canonicalization** | Earlier drafts cited approximated neutral values (`#F7F6F4` for canvas, `#0F0D0B` for dark canvas, `#E8E6E1` for subtle border). | **Resolved to canonical upstream values** from `Sakani-design-system/src/styles/tokens.css`: Canvas light: `--color-neutral-50: #FAFAF9`; Canvas dark: `--color-neutral-950: #0F0E0C`; Border subtle: `--color-neutral-200: #E7E5E1`. Subtle text (`--color-neutral-400: #A8A29B`, 2.53:1 vs `#FFFFFF`, 2.42:1 vs `#FAFAF9`) is restricted to decorative icons, with body text clamped to `--color-neutral-500: #78716A` (4.81:1 vs `#FFFFFF`, 4.60:1 vs `#FAFAF9`, passing WCAG AA). Proposed Hybrid Indigo (`#4F46E5`) achieves 6.29:1 vs `#FFFFFF` and 6.02:1 vs `#FAFAF9` (both pass WCAG AA). |
| **C3** | **Opportunity Pipeline Dual-Mode Status** | Text in earlier drafts discussed adding a table/Kanban view switcher as an uncommitted design option. | **Verified existing behavior**: `frontend/app/app/(workspace)/opportunities/page.tsx` **already implements** `viewMode: "pipeline" \| "table"`, with `PipelineBoard`, `OpportunityTable`, and `StageTransitionDialog`. The redesign preserves both views, skinning them with Sakani card and table tokens. |
| **C4** | **Financial Calculation Authority** | Earlier summaries were ambiguous about whether client-side code performed authoritative math. | **Clarified authoritative hierarchy**: Backend pure-Python `Decimal` (`backend/app/domain/quotes/calculator.py`) is the **sole authority** for saved quotes, rounding (`ROUND_HALF_UP`), and `trace_hash`. Client-side `useMemo` is strictly a non-authoritative typing preview. Line item form inputs store and transmit exact strings (`quantity: string`, `unit_price: string`) to prevent JavaScript IEEE-754 floating-point drift. |

---

## 2. Evidence for the Final Integration Strategy

Our unified recommendation is **Option B: Selective Vendor-Copy of Primitives into `frontend/components/sakani/`**.

### 2.1 Manifest & Source Code Inspection Evidence (`@sakaniui/react` 0.9.0)
1. **Missing `"use client"` Directives**:
   - Source code search (`grep -rn "\"use client\"" /tmp/sakani-design-system/src/`) yielded **zero matches**.
   - Interactive components (`Modal`, `Popover`, `Combobox`, `SegmentedControl`, `Sonner`, `Balance`) directly call React client hooks (`useState`, `useEffect`, `useRef`).
   - In Next.js 16 App Router, importing these components into a Server Component without `"use client"` triggers instant React Server Component (RSC) build and runtime errors.
2. **Monolithic Barrel Exports**:
   - `package.json` exports only `.`, `./blocks`, and `./icons`.
   - **No granular subpath exports exist** (e.g., `@sakaniui/react/button` is not an export).
   - Importing *any* component from `@sakaniui/react` evaluates `dist/index.mjs`, which imports all components including unflagged client-hook components, contaminating Server Components.
3. **CSS Bundle Inflexibility**:
   - Bundled `./style.css` contains hardcoded component styles compiled for Vite, risking cascade collisions with ForgeFlow's Tailwind CSS v4 `@theme` layers.
4. **Manufacturing CPQ Requirements**:
   - Form inputs must preserve raw strings for Python `Decimal` parsing.
   - Status badges require manufacturing compliance variants (`ITAR_RESTRICTED`, `DEVIATION_PENDING`).
   - Tables must bind to TanStack Table server-side pagination rather than client-side array slicing.
   - A slide-over `SakaniSheet` must be authored because SakaniUI has no native drawer.

### 2.2 Licensing Compliance
- The upstream repository `https://github.com/samzydd/Sakani-design-system` is licensed under the **MIT License** (Copyright 2026 Samuel Okpere).
- Selectively copying primitives into `frontend/components/sakani/` with full MIT attribution headers is legally permitted, eliminates lockfile fragility, and establishes an architectural path to resolve React 19 / Next.js 16 App Router RSC boundary errors (subject to verification via `pnpm run build` in Phase 1).

---

## 3. Confirmed Architecture vs. Remaining Open Decisions

### 3.1 Confirmed Technical Facts
- **Framework & Routing**: Next.js 16.4.3 App Router, React 19.0.0, and Tailwind CSS 4 are preserved.
- **Data Fetching & State**: TanStack React Query 5.66 with URL query parameter server pagination is retained across all 10 table views.
- **Calculation Authority**: Backend Python `Decimal` (`ROUND_HALF_UP`) is the exclusive calculation authority; input components preserve string fidelity.
- **Dual-Mode Pipeline**: Existing `Pipeline` (Kanban) and `Table` views in `/app/opportunities` are retained.
- **Licensing**: Permissive MIT license confirmed for all design system primitives and Tabler icons.

### 3.2 Remaining Open Decisions (Awaiting Human Sign-Off)
The five decisions in [open-decisions.md](file:///home/satjeet/Desktop/CRM/docs/design-mapping/open-decisions.md) remain unapproved pending stakeholder review:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        DECISIONS AWAITING HUMAN SIGN-OFF                               │
├────┬─────────────────────────────┬──────────────────────────┬──────────────────────────┤
│ ID │ Decision Topic              │ Recommended Option       │ Review Status            │
├────┼─────────────────────────────┼──────────────────────────┼──────────────────────────┤
│ D1 │ Primary Brand Accent Color  │ Option B: Hybrid Indigo  │ Awaiting Human Sign-Off  │
│ D2 │ Design System Integration   │ Option B: Vendor Copy    │ Awaiting Human Sign-Off  │
│ D3 │ Side-Drawer / Sheet Strategy│ Option B: Styled Base UI │ Awaiting Human Sign-Off  │
│ D4 │ Pipeline Kanban Usability   │ Option C: Accessible Hybrid │ Awaiting Human Sign-Off  │
│ D5 │ Table Pagination Model      │ Option A: TanStack Svr   │ Awaiting Human Sign-Off  │
└────┴─────────────────────────────┴──────────────────────────┴──────────────────────────┘
```

---

## 4. Business Invariants That Must Be Regression-Tested

The following 6 invariants must pass testable verification at each implementation gate:

1. **Python Decimal Pricing & Rounding**:
   - *Test*: `pytest backend/tests/unit/test_quote_domain.py`
   - *Verification*: Evaluates line subtotals, discounts, tax calculations, `ROUND_HALF_UP` banking rules, and cryptographic `trace_hash` consistency.
2. **Role-Based Access Control & Cost Masking**:
   - *Test*: `sales_rep` user session inspection on `/app/catalog` and `/app/quotes/[quoteId]`.
   - *Verification*: `unit_cost`, `markup_percent`, and `margin_amount` must be completely absent from both API payloads and client DOM.
3. **RFQ Line Matching Heuristics & Readiness Gate**:
   - *Test*: Playwright spec `rfq.spec.ts` against `/app/rfqs/[rfqId]`.
   - *Verification*: Ranking constants $K=5$, $T_{min}=0.30$, $T_{propose}=0.60$, candidate threshold $0.75$. "Create Quotation" button remains disabled until all mandatory lines are reviewed.
4. **Maker-Checker Security Policy**:
   - *Test*: Playwright spec `proposal.spec.ts` against `/app/approvals`.
   - *Verification*: A user cannot approve their own proposal ($proposer \ne reviewer$); atomic commit with row-locking (`SELECT ... FOR UPDATE`); non-empty rejection rationale mandatory.
5. **Customer Document Export Watermark & SHA-256 Ledger**:
   - *Test*: Playwright spec `export.spec.ts` against `/app/quotes/[quoteId]`.
   - *Verification*: Unapproved quotes fail closed (`HTTP 409`) on customer export; draft downloads embed diagonal `DRAFT` watermark; approved downloads compute byte-level SHA-256 delivery checksum.
6. **Accessibility & Responsive Geometry**:
   - *Test*: Axe-core audit across Desktop (1440px), Tablet (768px), and Mobile (390px).
   - *Verification*: Color contrast $\ge 4.5:1$ for readable text; keyboard tab focus rings visible on all controls; sidebar collapses to drawer at $\le 760\text{px}$.

---

## 5. Non-Modification & Safety Verification Checklist

The workspace has been verified to ensure strict read-only compliance during this investigation:

```
[✓] Application Source Code:   ZERO files modified in frontend/ or backend/
[✓] Package Manifests:         frontend/package.json & backend/pyproject.toml UNTOUCHED
[✓] Dependency Lockfiles:      frontend/pnpm-lock.yaml UNTOUCHED
[✓] Database Schemas:          Zero Alembic migrations or schema changes created
[✓] Git Working Directory:     Clean (only untracked docs/design-mapping/ documentation)
[✓] Deployment & Repositories: Zero commits, pushes, or external deployments executed
[✓] Implementation Status:     STOPPED — Standing by for human approval
```
