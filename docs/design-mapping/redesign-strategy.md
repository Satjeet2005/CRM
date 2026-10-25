# ForgeFlow × Sakani Redesign Strategy

> **Status:** Reviewed for Pre-Approval Consistency  
> **Investigation Date:** October 2026  
> **Scope:** Architecture, Token Canonicalization, Integration Model, Numerical Authority, and Invariant Preservation  

---

## 1. Evaluation of Architectural Approaches

We evaluated four alternative strategies for adopting Sakani visual patterns:

| Evaluation Criteria | Approach 1: Visual Reference Only | Approach 2: Selective Vendor-Copy of Primitives (Recommended) | Approach 3: Direct Package Installation (`@sakaniui/react`) | Approach 4: Full CRM App Adoption |
| :--- | :--- | :--- | :--- | :--- |
| **Strategy Description** | Hand-recreate Sakani's visual styling in ForgeFlow's existing Tailwind / Base UI setup without importing Sakani source files. | Selectively vendor required primitives from `Sakani-design-system/src/components/` into `frontend/components/sakani/` with `"use client"` and Tailwind v4 token mapping. | Install `@sakaniui/react` 0.9.0 as an npm package and import directly from package barrel exports. | Migrate ForgeFlow into the `saas-crm-sakani-ds` Vite SPA repository and port backend endpoints. |
| **Visual Consistency** | Moderate (risk of manual token drift and imperfect replication) | **Exact** (uses actual Sakani source JSX, SVG geometry, and CSS variable tokens) | Exact | Exact |
| **Component Reuse Potential** | Low (every component must be hand-styled) | **High** (primitives directly ported; blocks adapted into features) | High | Very High |
| **Next.js 16 / React 19 RSC Compatibility** | High | **High** (explicit `"use client"` directives added to interactive primitives) | **Fails** (barrel exports unflagged client-hook components; crashes Server Components) | **None** (Vite SPA template has no RSC/SSR) |
| **Domain Precision (CPQ Strings)** | High | **High** (form inputs adapted to preserve string precision for Python `Decimal`) | Poor (standard inputs may coerce to float or trigger uncontrolled warnings) | Poor |
| **Implementation Complexity** | High (large manual styling effort) | **Moderate** (clean vendored primitives; zero package friction) | High (requires writing local client-boundary proxies for every component) | Extreme (total rewrite of routing and data layer) |
| **Regression Risk to Business Invariants** | Very Low | **Very Low** (backend calculations, API hooks, and RBAC untouched) | Moderate | **Unacceptable** (destroys working Phase 0–7 foundations) |
| **Licensing & IP Compliance** | None | **Legally Permitted** (MIT License with upstream copyright attribution) | Legally Permitted (MIT License) | **Uncertain** (`saas-crm-sakani-ds` has `"private": true`) |

---

## 2. Recommended Approach: Approach 2 (Selective Vendor-Copy)

### 2.1 Why Direct Package Installation (Approach 3) Fails in Next.js 16 App Router
Source inspection of `@sakaniui/react` v0.9.0 reveals critical constraints:
1. **Missing `"use client"` Directives**: Interactive components (`Modal`, `Popover`, `Combobox`, `SegmentedControl`, `Sonner`, `Balance`) directly call React client hooks (`useState`, `useEffect`, `useRef`, browser layout measurements), but neither the source files nor the compiled entry points (`./dist/index.mjs`, `./dist/blocks.mjs`) include `"use client"`.
2. **Monolithic Barrel Exports**: The package manifest only exports `.`, `./blocks`, and `./icons`. Individual component subpaths (e.g. `@sakaniui/react/button`) **do not exist**. Consequently, importing any component from `@sakaniui/react` evaluates the entire barrel inside Next.js Server Components, causing instant RSC evaluation failure.
3. **CSS Bundle Inflexibility**: The package's `./style.css` contains hardcoded component styles compiled for a generic Vite pipeline. Importing it globally risks cascade conflicts with ForgeFlow's Tailwind CSS v4 `@theme` layers.

### 2.2 Why Approach 2 (Selective Vendor-Copy) is Superior
1. **App Router & React 19 RSC Boundary Control**: Vendoring into `frontend/components/sakani/` allows placing `"use client"` explicitly on interactive components, while keeping pure presentational components server-renderable (pending verification via `pnpm run build` in Phase 1).
2. **Domain-Specific Adaptation**: Enables tailoring `Input` to preserve raw string values for Python `Decimal` parsing, extending `Badge` variants for manufacturing compliance (`ITAR_RESTRICTED`, `DEVIATION_PENDING`), and composing `SakaniSheet` for side-panel workflows.
3. **Zero Lockfile Fragility**: Eliminates external package version pinning, unannounced upstream breaking changes, and build-time peer-dependency warnings.
4. **Uncompromised Licensing**: Upstream repository `https://github.com/samzydd/Sakani-design-system` is licensed under MIT (Copyright 2026 Samuel Okpere). Vendoring with copyright preservation is standard and fully compliant.

### 2.3 Why Approach 4 Must Be Firmly Rejected
- `saas-crm-sakani-ds` is a demo Vite SPA containing only 3 active pages (`/`, `/sales`, `/customers`).
- It lacks authentication, CSRF defense, role-based access control, PostgreSQL databases, Alembic migrations, quote calculation engines, and cryptographic PDF/CSV export pipelines.
- Attempting to force ForgeFlow into the Sakani CRM repo would destroy all completed and verified Phase 0–7 work.

---

## 3. Canonical Design Tokens & Theming Plan

### 3.1 Authoritative Upstream Neutral Scale
Extracted directly from `Sakani-design-system/src/styles/tokens.css`:

```css
:root {
  /* Canonical Sakani Neutral Ramp */
  --color-neutral-50:  #FAFAF9;  /* Canvas background (light) */
  --color-neutral-100: #F5F4F2;  /* Subtle element backgrounds */
  --color-neutral-200: #E7E5E1;  /* Subtle borders / dividers */
  --color-neutral-300: #DBDAD7;  /* Default borders */
  --color-neutral-400: #A8A29B;  /* Strong borders / decorative icons */
  --color-neutral-500: #78716A;  /* Muted text (WCAG AA compliant: 4.6:1) */
  --color-neutral-600: #57534E;  /* Secondary text */
  --color-neutral-700: #3A3837;  /* Tertiary text */
  --color-neutral-800: #1F1F1F;  /* Dark surface background */
  --color-neutral-900: #141414;  /* Default body text (light) */
  --color-neutral-950: #0F0E0C;  /* Canvas background (dark) */
}
```

### 3.2 Semantic Token Mapping & Accessible Overrides

```css
:root {
  /* Surface & Canvas Semantics */
  --color-bg-canvas: var(--color-neutral-50);       /* #FAFAF9 */
  --color-bg-surface: #FFFFFF;
  --color-bg-subtle: var(--color-neutral-100);      /* #F5F4F2 */
  --color-bg-muted: var(--color-neutral-200);       /* #E7E5E1 */
  --color-bg-inverse: var(--color-neutral-900);     /* #141414 */

  /* Text & Contrast Enforcement */
  --color-fg-default: var(--color-neutral-900);     /* #141414 — 17.6:1 vs white */
  --color-fg-muted: var(--color-neutral-500);       /* #78716A — 4.6:1 vs canvas (WCAG AA pass) */
  --color-fg-subtle: var(--color-neutral-400);      /* #A8A29B — 2.53:1 (DECORATIVE ONLY, NOT FOR TEXT) */

  /* Borders */
  --color-border-subtle: var(--color-neutral-200);  /* #E7E5E1 */
  --color-border-default: var(--color-neutral-300); /* #DBDAD7 */
  --color-border-strong: var(--color-neutral-400);  /* #A8A29B */

  /* Primary Accent: Subject to Decision D1 Sign-Off */
  /* Upstream Sakani Saffron: #FF4700 (3.41:1 vs #FFFFFF, 3.27:1 vs #FAFAF9 — fails WCAG AA 4.5:1 for normal text) */
  /* Proposed Hybrid Indigo:  #4F46E5 (6.29:1 vs #FFFFFF, 6.02:1 vs #FAFAF9 — passes WCAG AA) */
  --color-primary-500: #4F46E5;
  --color-primary-600: #4338CA;
  --color-primary-50:  #EEF2FF;
  --color-border-focus: var(--color-primary-500);

  /* Status Tokens (Canonical Upstream) */
  --color-success-500: #12B76A;
  --color-success-bg:  #F1FEF6;
  --color-success-fg:  #027A48;

  --color-warning-500: #F79009;
  --color-warning-bg:  #FFFBF0;
  --color-warning-fg:  #B54708;

  --color-danger-500:  #F04438;
  --color-danger-bg:   #FEF3F2;
  --color-danger-fg:   #B42318;

  --color-info-500:    #2E90FA;
  --color-info-bg:     #EFF8FF;
  --color-info-fg:     #175CD3;

  /* Elevation Shadows (Canonical Upstream) */
  --shadow-xs: 0 1px 2px 0 rgba(16,15,12,0.05);
  --shadow-sm: 0 1px 3px 0 rgba(16,15,12,0.10), 0 1px 2px 0 rgba(16,15,12,0.06);
  --shadow-md: 0 4px 8px -2px rgba(16,15,12,0.10), 0 2px 4px -2px rgba(16,15,12,0.06);
  --shadow-lg: 0 12px 16px -4px rgba(16,15,12,0.08), 0 4px 6px -2px rgba(16,15,12,0.03);
  --shadow-xl: 0 20px 24px -4px rgba(16,15,12,0.10), 0 8px 8px -4px rgba(16,15,12,0.03);

  /* Radii */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;
}

.dark {
  --color-bg-canvas: var(--color-neutral-950);       /* #0F0E0C */
  --color-bg-surface: var(--color-neutral-900);      /* #141414 */
  --color-bg-subtle: var(--color-neutral-800);       /* #1F1F1F */
  --color-bg-muted: var(--color-neutral-700);        /* #3A3837 */
  --color-fg-default: var(--color-neutral-50);       /* #FAFAF9 */
  --color-fg-muted: var(--color-neutral-400);        /* #A8A29B */
  --color-border-subtle: var(--color-neutral-800);   /* #1F1F1F */
  --color-border-default: var(--color-neutral-700);  /* #3A3837 */
}
```

### 3.3 Authoritative Token File
The authoritative token file after implementation will be [`frontend/app/globals.css`](file:///home/satjeet/Desktop/CRM/frontend/app/globals.css), integrated into Tailwind CSS v4 via `@theme` custom properties.

---

## 4. Numerical Correctness & Financial Authority Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                   FINANCIAL CALCULATION DATA FLOW                      │
├────────────────────────────────────────────────────────────────────────┤
│ 1. User Types in UI       → Preserved as String: quantity: "250.0000" │
│ 2. Unsaved UI Feedback    → Non-authoritative local preview (useMemo)  │
│ 3. Save Mutation (PATCH)  → Transmits validated string payload         │
│ 4. Backend Domain Engine  → Python Decimal with ROUND_HALF_UP (SOLE)   │
│ 5. Saved Response         → Authoritative totals, lines, trace_hash    │
│ 6. Display in UI          → Formatted via formatMoney() (₹ INR)        │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Sole Calculation Authority**: The backend pure-Python `Decimal` calculator in `backend/app/domain/quotes/calculator.py` is the **exclusive source of truth** for all line calculations, discounts, taxes, totals, rounding (`ROUND_HALF_UP`), and trace hashes (`trace_hash`).
2. **Non-Authoritative Client Previews**: Any client-side `useMemo` calculation in `QuoteDetailPage` is strictly an immediate typing preview to assist the estimator. It is non-authoritative and never persists to database records.
3. **Validated String Preservation**: Input components must store and transmit numerical values as validated strings (`quantity: string`, `unit_price: string`, `discount_percent: string`, `tax_rate_percent: string`). Under no circumstances may an input parse or serialize a value as a floating-point number (`parseFloat`, `Number`) prior to transmission.
4. **Display Utility Boundary**: The `formatMoney` helper in `frontend/lib/formatters/formatters.ts` is strictly a visual presentation utility (`Intl.NumberFormat("en-IN")`). It has no role in calculation or persistence.

---

## 5. Workflow Invariant Preservation Plan

| Invariant | Current Implemented Behavior | Redesign Preservation Rule |
| :--- | :--- | :--- |
| **Pipeline View Selection** | Dual-mode toggle (`viewMode: "pipeline" \| "table"`) in `opportunities/page.tsx`. | **Must retain both views.** Skin `PipelineBoard` and `OpportunityTable` with Sakani tokens. Do not remove either view. |
| **Server-Driven Pagination** | TanStack React Query with URL query params (`page`, `page_size`, `search`, filters) on all 10 lists. | **Must retain server-driven fetching.** Never replace with client-side array slicing from Sakani `DataTableBlock`. |
| **RBAC Cost Masking** | `canViewCost` permission (`catalog:cost` / admin) gates unit costs, margins, and markup columns. | **Server-enforced and UI-masked.** Stripped from unauthorized payloads; columns and summary cards omitted. |
| **RFQ Matching Threshold** | Similarity threshold `0.75` for candidate part matching in `rfqs/[rfqId]/page.tsx`. | **Preserve exact threshold.** Candidate match drawer styled with Sakani tokens while preserving 0.75 scoring logic. |
| **Maker-Checker Validation** | `StageTransitionDialog`, `ReopenDialog`, and approval rule forbidding self-approval of quotes. | **Preserve mandatory validation modals.** Fast-path transitions must open the validation dialog before mutation dispatch. |
| **Export Watermarking & Hashing** | Pre-approval exports receive `DRAFT` watermark; approved exports receive SHA-256 fingerprint pill and history log. | **Preserve fail-closed export logic.** Watermarks and verification timelines styled with Sakani `Alert` and badge tokens. |

---

## 6. Domain-Specific Design Gaps & Technical Solutions

| ForgeFlow Workflow | Problem in Standard Sakani UI | Proposed Technical Solution |
| :--- | :--- | :--- |
| **Side Drawer / Sheet** | Sakani UI has no native `Sheet` or slide-over drawer component. | Author `frontend/components/sakani/sheet.tsx` wrapping the accessible Base UI Dialog in Sakani surface tokens (`--color-bg-surface`, `--shadow-xl`, `--transition-base`). |
| **Calculation Formula Trace** | 5-level formula dependencies, intermediate rounding, and tax breakdowns require structured inspection. | Implement an adapted hierarchical tree styled with Geist Mono and Sakani card tokens. |
| **Maker-Checker Diff Sheet** | Comparative inspection ledger must clearly highlight financial changes. | Use Sakani `Alert variant="destructive"` at the top of the diff drawer, with before/after comparison tables using `--color-danger-fg` and `--color-success-fg`. |
| **Export Integrity Banner** | Official releases require SHA-256 fingerprint verification and tamper-evident history. | Compose an export status banner using Sakani `Alert` and a delivery history ledger using Sakani table tokens with 1-click clipboard copy. |
