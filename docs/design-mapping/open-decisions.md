# ForgeFlow × Sakani CRM — Open Decisions & Human Review Register

> **Status:** Documented for Human Review & Sign-Off (Consistency-Reviewed)  
> **Investigation Date:** October 2026  
> **Scope:** Architecture, Theming, Component Selection, Financial Precision, and Accessibility  

---

## 1. Executive Summary

This register presents the five strategic architectural and design decisions identified during the ForgeFlow × Sakani CRM audit. Each decision represents a trade-off between visual alignment with the Sakani reference application, preservation of ForgeFlow's existing domain invariants, accessibility standards, and long-term maintenance overhead.

No code modifications, dependency installations, or visual migrations may proceed until each decision has an explicit human sign-off recorded.

---

## 2. Decision Register

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 DECISION MATRIX SUMMARY                                 │
├────┬─────────────────────────────┬──────────────────────────┬──────────────────────────┤
│ ID │ Decision Topic              │ Recommended Option       │ Impact Surface Area      │
├────┼─────────────────────────────┼──────────────────────────┼──────────────────────────┤
│ D1 │ Primary Brand Accent Color  │ Option B: Hybrid Indigo  │ Global CSS tokens & brand│
│ D2 │ Design System Integration   │ Option B: Vendor Copy    │ Component architecture   │
│ D3 │ Side-Drawer / Sheet Strategy│ Option B: Styled Base UI │ RFQ, Trace, Review Panels│
│ D4 │ Pipeline Kanban Usability   │ Option C: Accessible Hybrid │ Opportunity Workspace    │
│ D5 │ Table Pagination Model      │ Option A: TanStack Svr   │ All List Workspaces (10) │
└────┴─────────────────────────────┴──────────────────────────┴──────────────────────────┘
```

---

### Decision 1: Primary Brand Accent Color

#### Context & Source Evidence
- **Upstream Sakani Reference CRM & Design System**:
  - Primary accent token: `--color-primary-500: #FF4700` (RGB: `255, 71, 0`).
  - Neutral canvas: `--color-bg-canvas: #FAFAF9` (neutral-50).
  - Surface: `--color-bg-surface: #FFFFFF` (base-white).
- **Current ForgeFlow Implementation**:
  - Primary accent: `--primary: #5B55D9` (with hover `#4B45C6` and soft background `#F0EFFF`).
- **WCAG 2.1 Relative-Luminance Contrast Evaluation**:
  - Upstream Saffron (`#FF4700`):
    - Against white surface (`#FFFFFF`): **3.41:1** (fails WCAG AA 4.5:1 for normal text; passes 3.0:1 for large text/graphical UI).
    - Against light canvas (`#FAFAF9`): **3.27:1** (fails WCAG AA 4.5:1 for normal text).
  - Upstream Subtle Text (`#A8A29B`):
    - Against white surface (`#FFFFFF`): **2.53:1** (fails WCAG AA 4.5:1).
    - Against light canvas (`#FAFAF9`): **2.42:1** (fails WCAG AA 4.5:1; acknowledged as failing in Sakani's `tokens.css`).
  - Current ForgeFlow Indigo (`#5B55D9`):
    - Against white surface (`#FFFFFF`): **5.61:1** (passes WCAG AA).
    - Against light canvas (`#FAFAF9`): **5.37:1** (passes WCAG AA).
  - Proposed Hybrid Indigo (`#4F46E5`):
    - Against white surface (`#FFFFFF`): **6.29:1** (passes WCAG AA).
    - Against light canvas (`#FAFAF9`): **6.02:1** (passes WCAG AA).

#### Options

| Option | Description | Pros | Cons |
| :--- | :--- | :--- | :--- |
| **Option A: Full Saffron Adoption (`#FF4700`)** | Adopt Sakani's saffron `#FF4700` as `--color-primary-500` across all ForgeFlow workspaces. | High visual fidelity with Sakani reference deployment; vibrant SaaS visual identity. | High risk of contrast regressions; colored text links in primary-500 fail WCAG AA; clashes with industrial tooling expectations. |
| **Option B: Hybrid Enterprise Indigo (`#4F46E5` / `#4338CA`) [RECOMMENDED]** | Retain ForgeFlow's industrial indigo identity, mapped to Sakani's CSS variable hierarchy (`--color-primary-500: #4F46E5`, `--color-primary-600: #4338CA`, `--color-primary-50: #EEF2FF`). Adopt Sakani's canonical neutral palette (`#0F0E0C`, `#FAFAF9`, `#E7E5E1`). | Passes WCAG AA contrast against both surface (6.29:1) and canvas (6.02:1); preserves enterprise credibility; zero changes to existing status semantics. | Visual divergence from Sakani's marketing demo screenshot. |
| **Option C: Configurable Theme Switcher (Multi-Tenant)** | Implement CSS variable switching allowing users/orgs to toggle between "Sakani Saffron" and "ForgeFlow Indigo". | Maximum flexibility; satisfies all stakeholders. | Increased CSS bundle complexity; requires testing all 16 screens against two distinct palettes; premature optimization. |

#### Recommendation: **Option B (Hybrid Enterprise Indigo)**
> Map the indigo brand palette to Sakani's design token structure. Retain Sakani's exact canonical neutral scale (`--color-bg-canvas: #FAFAF9`, `--color-bg-surface: #FFFFFF`, `--color-border-subtle: #E7E5E1`), but anchor the primary action color on WCAG-compliant indigo (`#4F46E5`).

---

### Decision 2: Design System Integration Method

#### Context & Source Evidence
- **Upstream Package**: `@sakaniui/react` v0.9.0 (git commit `0cd86b2`, MIT License).
- **Package Manifest Inspection**:
  - `peerDependencies`: `"react": "^19.0.0"`, `"react-dom": "^19.0.0"`.
  - `dependencies`: ONLY `"recharts": "^3.9.2"`.
  - `exports`: Single root barrel `.` (`./dist/index.mjs`), `./blocks`, `./icons`, `./style.css`, `./tokens.css`.
- **RSC & Hydration Limitations**:
  - Upstream source files and build artifacts **do not contain `"use client"` directives**.
  - Interactive primitives and blocks (`Modal`, `Popover`, `Combobox`, `SegmentedControl`, `Sonner`, `Balance`) directly call React client hooks (`useState`, `useEffect`, `useRef`).
  - Next.js 16 App Router evaluates imported barrel modules in Server Components. Because the package lacks subpath exports for individual components (e.g. `@sakaniui/react/button`), importing *any* component from `@sakaniui/react` in a Server Component evaluates the entire barrel, triggering RSC compilation failures.
  - Bundled `./style.css` contains hardcoded CSS rules that assume Vite CSS bundling and may collide with ForgeFlow's Tailwind CSS v4 `@theme` layers.

#### Options

| Option | Description | Pros | Cons |
| :--- | :--- | :--- | :--- |
| **Option A: Direct Package Integration (`pnpm add @sakaniui/react`)** | Install `@sakaniui/react` 0.9.0 and import directly from package barrels. | Single package dependency; receives upstream updates via package manager. | **Fails in Next.js Server Components** due to barrel-evaluation of unflagged client hooks; requires manual `"use client"` proxy wrappers for every component; global CSS collision risk. |
| **Option B: Selective Vendor-Copy into `frontend/components/sakani/` [RECOMMENDED]** | Selectively copy required primitives (`Button`, `Input`, `Badge`, `Card`, `Modal`, `Popover`) from `src/components/` into `frontend/components/sakani/` under MIT License, with `"use client"` added to interactive components and Tailwind v4 token mapping. | Direct architectural control over client/server boundaries (`"use client"` placement); avoids barrel-import RSC errors; permits custom prop extensions (e.g. string preservation for Decimals, manufacturing status badges); zero lockfile fragility. Pending build validation (`pnpm run build`). | Upstream fixes must be manually cherry-picked. |
| **Option C: Hybrid (Custom Blocks Vendored, Primitives via Package Proxies)** | Install package for primitives, vendor application blocks into `frontend/features/`. | Reuses upstream primitive package while customizing blocks. | Still suffers from barrel-export RSC issues unless a dedicated local proxy layer wraps every imported primitive. |

#### Recommendation: **Option B (Selective Vendor-Copy)**
> Selectively vendor the required primitive source files from `Sakani-design-system/src/components/` into `frontend/components/sakani/` with full MIT attribution headers. Add `"use client"` to interactive components, integrate with Tailwind v4 `@theme`, and adapt form inputs to preserve exact strings for backend Decimal calculations.

---

### Decision 3: Side-Drawer / Sheet Primitive Strategy

#### Context & Source Evidence
- ForgeFlow relies on dense slide-over side sheets for 3 critical CPQ workflows:
  1. `RFQLineItemMatchingDrawer` (Candidate part matching, AI match scores, confidence sliders)
  2. `CalculationTraceSheet` (5-level dependency tree, intermediate rounding steps, formula inspector)
  3. `ApprovalDiffReviewSheet` (Maker-checker split-view, diff highlighter, sign-off checklist)
- **SakaniUI Limitation**: Upstream SakaniUI has **no native `Sheet` or `Drawer` primitive**. It only exports `Modal` (centered dialog) and `Popover` (anchored dropdown).
- Rendering a 5-level calculation trace or side-by-side CAD preview inside a centered modal severely degrades readability and obstructs table row context.

#### Options

| Option | Description | Pros | Cons |
| :--- | :--- | :--- | :--- |
| **Option A: Convert all Drawers into Centered Sakani Modals** | Replace all side sheets with `@sakaniui/react` `Modal` components. | Uses only upstream Sakani components. | Degrades UX for dense technical data; truncates calculation trace trees; loses row-context visibility during RFQ part matching. |
| **Option B: Token-Compliant `SakaniSheet` Primitive [RECOMMENDED]** | Wrap ForgeFlow's existing accessible Base UI Dialog primitive in Sakani styling tokens (`--color-bg-surface`, `--color-border-subtle`, `--shadow-xl`, `--transition-base`, `--font-sans`). | Preserves critical engineering/estimating workflows; maintains accessible dialog semantics (focus trap, Escape key, ARIA dialog; pending test validation); visually styled with Sakani tokens. | Requires maintaining `frontend/components/sakani/sheet.tsx`. |
| **Option C: Full Page Navigation** | Convert side-sheet workflows into separate sub-routes (e.g., `/quotes/[id]/trace`). | Eliminates overlay complexity. | Disorients users; requires saving state to server before viewing trace; breaks rapid quoting iteration. |

#### Recommendation: **Option B (Token-Compliant `SakaniSheet`)**
> Preserve ForgeFlow's high-efficiency side-drawer interaction model by authoring `frontend/components/sakani/sheet.tsx` that wraps the existing accessible dialog primitive in Sakani design tokens.

---

### Decision 4: Opportunity Pipeline (Kanban Interaction Model)

#### Context & Source Evidence
- **Current Implemented Behavior**:
  - `frontend/app/app/(workspace)/opportunities/page.tsx` **already implements a dual-mode view switcher**: `Pipeline` (Kanban) and `Table` (TanStack Table list).
  - Deals move through 7 qualification stages: `lead`, `qualified`, `solutioning`, `proposal`, `negotiation`, `won`, `lost`.
  - Stage transitions trigger `StageTransitionDialog` requiring validation data, while terminal states trigger `ReopenDialog`.
- **SakaniUI Source**:
  - Sakani provides `KanbanBoardBlock` in `packages/react/src/components/kanban-board/` with pointer drag-and-drop.
- **Accessibility Invariant**:
  - Pointer-only drag-and-drop violates WCAG 2.1 Success Criterion 2.5.7 (Dragging Movements) unless an accessible single-pointer or keyboard alternative is provided. Dragging directly across columns bypasses stage-transition validation dialogs.

#### Options

| Option | Description | Pros | Cons |
| :--- | :--- | :--- | :--- |
| **Option A: Pure Sakani `KanbanBoardBlock` (Drag-and-Drop Only)** | Replace current pipeline view with Sakani's pointer drag-and-drop board. | Visually dynamic; matches Sakani marketing demos. | Breaks keyboard navigation; bypasses transition validation modals; high risk of accidental stage shifts. |
| **Option B: Table-Only Interface** | Remove Kanban board and retain only the accessible TanStack Table list. | Maximum simplicity and keyboard accessibility. | Loses visual pipeline overview favored by sales managers. |
| **Option C: Accessible Hybrid Kanban Board [RECOMMENDED]** | Skin the existing dual-mode `PipelineBoard` using Sakani card and column styling, retaining the `Move to Stage...` keyboard menu and mandatory `StageTransitionDialog` on stage change. | Preserves existing dual-mode toggle; ensures keyboard accessibility for stage transitions (pending keyboard navigation test verification); prevents invalid stage transitions; visually modern. | Requires styling existing board components with Sakani CSS tokens. |

#### Recommendation: **Option C (Accessible Hybrid Kanban Board)**
> Retain ForgeFlow's existing dual-mode (`Pipeline` / `Table`) toggle. Skin the Kanban board columns and deal cards with Sakani's card tokens, maintaining keyboard action menus and mandatory `StageTransitionDialog` validation modals.

---

### Decision 5: Table Pagination & Data Engine

#### Context & Source Evidence
- **Current Implemented Behavior**:
  - ForgeFlow manages catalog items, quotes, and audit logs via server-driven pagination, filtering, and sorting (`page`, `page_size`, `search`, `status`) backed by TanStack React Query.
  - URL parameters bookmark search queries and page numbers.
- **SakaniUI Source**:
  - Sakani's `DataTableBlock` and `Table` components implement client-side array slicing (`data.slice((page - 1) * pageSize, page * pageSize)`).
  - Passing enterprise manufacturing datasets (thousands of parts or audit rows) to client-side slicing creates unnecessary memory pressure, slow initial page loads, and breaks server pagination contracts.

#### Options

| Option | Description | Pros | Cons |
| :--- | :--- | :--- | :--- |
| **Option A: Retain TanStack Server Pagination with Sakani Visual Shell [RECOMMENDED]** | Keep ForgeFlow's server-driven data fetching and TanStack Table logic, but skin the `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<td>`, and pagination controls using Sakani's CSS classes and tokens. | Zero performance regression on large catalogs; preserves URL query bookmarking; instant initial render. | Requires mapping Sakani table CSS classes to TanStack Table JSX markup. |
| **Option B: Adopt Sakani `DataTableBlock` with Client Slicing** | Pass raw arrays directly to Sakani's `DataTableBlock`. | Out-of-the-box Sakani component reuse. | Breaks on large datasets; destroys backend pagination architecture; creates unnecessary network payloads. |
| **Option C: Virtualized Scrolling (`@tanstack/react-virtual`)** | Implement windowed infinite scrolling styled with Sakani tokens. | Continuous scroll experience. | Inconvenient for manufacturing quoting workflows requiring stable print/export layouts and exact page references. |

#### Recommendation: **Option A (Retain TanStack Server Pagination with Sakani Styling)**
> Retain ForgeFlow's server-driven pagination engine across all 10 table views. Apply Sakani's visual tokens (`--color-bg-subtle`, `--color-border-subtle`, `--color-fg-muted`, sticky header elevations) to the table markup.

---

## 3. Human Sign-Off Sheet

Before initiating implementation, each stakeholder must record approval below:

| Decision ID | Selected Option | Approved By (Name/Role) | Date | Signature / Status |
| :--- | :--- | :--- | :--- | :--- |
| **D1: Primary Color** | [ Option B: Hybrid Indigo ] | `Pending Human Review` | `TBD` | `Awaiting Sign-Off` |
| **D2: DS Integration** | [ Option B: Vendor Copy ] | `Pending Human Review` | `TBD` | `Awaiting Sign-Off` |
| **D3: Side-Drawer** | [ Option B: Styled Base UI ] | `Pending Human Review` | `TBD` | `Awaiting Sign-Off` |
| **D4: Kanban Board** | [ Option C: Accessible Hybrid ] | `Pending Human Review` | `TBD` | `Awaiting Sign-Off` |
| **D5: Table Engine** | [ Option A: TanStack Server ] | `Pending Human Review` | `TBD` | `Awaiting Sign-Off` |

---

## 4. Next Step
Upon review and approval of these five decisions, proceed to execute **Phase 1: Token Bridge & Design Infrastructure** as outlined in [implementation-roadmap.md](file:///home/satjeet/Desktop/CRM/docs/design-mapping/implementation-roadmap.md).
