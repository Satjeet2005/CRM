# ForgeFlow-to-Sakani Component Crosswalk & Sourcing Matrix

> **Status:** Reviewed for Pre-Approval Consistency & Licensing Verification  
> **Investigation Date:** October 2026  
> **Scope:** Component Mapping, Definitive Sourcing Matrix, RSC Boundaries, and IP Verification  

---

## 1. High-Level Component Mapping

| ForgeFlow Component or Need | Sakani Equivalent | Reuse Strategy | Compatibility Assessment | Required Adaptation |
| :--- | :--- | :--- | :--- | :--- |
| **Application Shell** (`components/layout/app-shell.tsx`) | `Sidebar`, `TopBar` primitives | **Retained & Restyled** | High (React 19 / Next.js 16) | Restyle existing ForgeFlow shell using MIT-licensed `Sidebar` and `TopBar` primitives. Do not copy code from `saas-crm-sakani-ds` (private repository). |
| **Sidebar Navigation** (`components/layout/app-sidebar.tsx`) | `Sidebar`, `SidebarHeader`, `SidebarGroupLabel`, `SidebarItem`, `SidebarPromo` | **Copied from MIT DS** | High | Map ForgeFlow role permissions to conditionally render items; replace Lucide icons with Tabler icons. Add `"use client"`. |
| **Top Header Bar** (`components/layout/app-header.tsx`) | `TopBar`, `Breadcrumb`, `Avatar`, `Menu`, `MenuItem` | **Copied from MIT DS** | High | Compose `TopBar` with breadcrumb slot on left, user account avatar menu, and theme switcher on right. Add `"use client"`. |
| **Action Buttons** (`components/ui/button.tsx`) | `Button`, `IconButton` | **Copied from MIT DS** | Full (Server/Client) | Adopt Sakani's 5 variants (`primary`, `secondary`, `outline`, `ghost`, `destructive`) × 3 sizes (`sm`, `md`, `lg`). |
| **Text & Numeric Inputs** (`components/ui/input.tsx`) | `Input`, `Textarea` | **Copied from MIT DS** | High (Client) | Wire with React Hook Form. **Strict Invariant**: Line item numerical inputs preserve exact string representations (`quantity: string`, `unit_price: string`) to avoid JavaScript floating-point corruption prior to backend Python `Decimal` calculation. |
| **Select Menus** (native `<select>` in filters) | `Select` | **Copied from MIT DS** | High (Client) | Replace native `<select>` with Sakani custom styled listbox `Select`. Add `"use client"`. |
| **Combobox / Autocomplete** | `Combobox` | **Copied from MIT DS** | High (Client) | Use for account/contact picker and multi-tag filters; supports chips and keyboard navigation. Add `"use client"`. |
| **Checkboxes & Toggles** | `Checkbox`, `Switch` | **Copied from MIT DS** | High (Client) | Use `Checkbox` for table row selection and tasks; use `Switch` for Presentation Mode toggle. Add `"use client"`. |
| **Status Badges** (`components/ui/status-badge.tsx`) | `Badge` | **Copied from MIT DS** | Full (Server/Client) | Map ForgeFlow statuses to Sakani badge variants (`neutral`, `accent`, `success`, `warning`, `danger`, `info`). Extend with domain variants (`ITAR_RESTRICTED`, `DEVIATION_PENDING`, `MAKER_CHECKER_HOLD`). |
| **Dialogs & Confirmations** (`components/ui/dialog.tsx`, `confirm-dialog.tsx`) | `Modal` | **Copied from MIT DS** | High (Client) | Sakani `Modal` includes header, description, divider, confirm/cancel buttons, and destructive styling. Add `"use client"`. |
| **Dropdown Menus & Popovers** (`components/ui/dropdown-menu.tsx`, `popover.tsx`) | `Popover` + `Menu` / `MenuItem` | **Copied from MIT DS** | High (Client) | Anchor Sakani `Menu` inside Sakani `Popover` for row actions, column visibility, and export menus. Add `"use client"`. |
| **Side Drawer / Sheet** (`components/ui/sheet.tsx`) | *No native Sakani Sheet* | **Newly Implemented** | High (Client) | Author `frontend/components/sakani/sheet.tsx` by wrapping ForgeFlow's accessible Base UI Dialog in Sakani tokens (`--color-bg-surface`, `--shadow-xl`, `--transition-base`). |
| **Tabs & Stepper** (`components/ui/tabs.tsx`) | `Tabs`, `Stepper` | **Copied from MIT DS** | High (Client) | Use Sakani `Tabs` for account/task sub-views; use `Stepper` for RFQ import wizard and deal stages. Add `"use client"`. |
| **Toast Notifications** (`sonner`) | `Toaster` + `toast()` | **Retained & Restyled** | API-compatible | Retain existing `sonner` dependency in `frontend/package.json`, re-skinned with Sakani CSS tokens and border radiuses. |
| **Loading Skeletons** (`components/data-display/loading-skeleton.tsx`) | `Skeleton` | **Copied from MIT DS** | Full (Server/Client) | Replace custom pulse divs with Sakani `Skeleton`. |
| **Empty State** (`components/data-display/empty-state.tsx`) | `EmptyState` | **Copied from MIT DS** | Full (Server/Client) | Leverage Sakani's 3 semantic empty state variants: `no-data`, `no-results`, and `error`. |
| **Error Banner** (`components/data-display/error-state.tsx`) | `Alert` (`variant="danger"`) | **Copied from MIT DS** | Full (Server/Client) | Replace custom error card with Sakani `Alert` with retry action button slot. |
| **Data Tables** (`components/data-display/data-table.tsx`) | TanStack Table + Sakani `Table` styling | **Retained & Restyled** | High (Client) | **Preserve TanStack Table v8 server pagination**, sorting, and URL query params. Restyle `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<td>` using Sakani table CSS tokens. |
| **Charts** (`recharts` wrappers) | `BarChart`, `LineChart`, `DonutChart` | **Copied from MIT DS** | High (Client) | Adopt Sakani's chart wrappers backed by `--color-chart-1`..`6`. Transitive dependency `recharts: "^3.9.2"` is already satisfied by ForgeFlow (`3.10.1`). |
| **CSV File Dropzone** (`react-dropzone` wrapper) | `FileUploadPanelBlock` styling | **Retained & Restyled** | High (Client) | Retain ForgeFlow's `react-dropzone` CSV parsing logic; skin dashed upload card using Sakani file upload styles. |

---

## 2. Definitive Component-Sourcing & Licensing Matrix

Every component, block, and layout referenced in the redesign plan is categorized into one of four mutually exclusive sourcing classifications:

1. **Copied from MIT DS**: Source code vendored from `Sakani-design-system/src/components/` under MIT License into `frontend/components/sakani/`.
2. **Retained & Restyled**: Existing ForgeFlow component preserved with domain logic intact; presentation restyled with Sakani CSS tokens.
3. **Newly Implemented**: Authored specifically for ForgeFlow CPQ workflows using Sakani tokens and accessible headless primitives.
4. **Not Selected**: Upstream Sakani component evaluated but excluded from Phase 1–8 enterprise CPQ scope.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                 DEFINITIVE SOURCING & IP MATRIX                                                         │
├──────────────────────┬──────────────────────┬───────────────────────────────────────────┬───────────────┬────────────┬─────────────────┤
│ Component Name       │ Sourcing Category    │ Upstream or Internal Source Path          │ Transitive    │ Boundary   │ License Status  │
│                      │                      │                                           │ Dependencies  │            │                 │
├──────────────────────┼──────────────────────┼───────────────────────────────────────────┼───────────────┼────────────┼─────────────────┤
│ Button               │ Copied from MIT DS   │ Sakani-design-system/src/components/Button│ clsx          │ Server/Clt │ MIT Verified    │
│ IconButton           │ Copied from MIT DS   │ Sakani-design-system/src/components/Icon..│ clsx          │ Server/Clt │ MIT Verified    │
│ Input (raw strings)  │ Copied from MIT DS   │ Sakani-design-system/src/components/Input │ clsx          │ Client     │ MIT Verified    │
│ Textarea             │ Copied from MIT DS   │ Sakani-design-system/src/components/Text..│ clsx          │ Client     │ MIT Verified    │
│ Select               │ Copied from MIT DS   │ Sakani-design-system/src/components/Select│ clsx          │ Client     │ MIT Verified    │
│ Combobox             │ Copied from MIT DS   │ Sakani-design-system/src/components/Comb..│ clsx          │ Client     │ MIT Verified    │
│ Checkbox             │ Copied from MIT DS   │ Sakani-design-system/src/components/Check.│ clsx          │ Client     │ MIT Verified    │
│ Switch               │ Copied from MIT DS   │ Sakani-design-system/src/components/Switch│ clsx          │ Client     │ MIT Verified    │
│ Badge (with domain)  │ Copied from MIT DS   │ Sakani-design-system/src/components/Badge │ clsx          │ Server/Clt │ MIT Verified    │
│ Modal                │ Copied from MIT DS   │ Sakani-design-system/src/components/Appl..│ clsx          │ Client     │ MIT Verified    │
│ Popover              │ Copied from MIT DS   │ Sakani-design-system/src/components/Pop.. │ clsx          │ Client     │ MIT Verified    │
│ Menu / MenuItem      │ Copied from MIT DS   │ Sakani-design-system/src/components/Menu/ │ clsx          │ Client     │ MIT Verified    │
│ Tabs                 │ Copied from MIT DS   │ Sakani-design-system/src/components/Tabs/ │ clsx          │ Client     │ MIT Verified    │
│ Stepper              │ Copied from MIT DS   │ Sakani-design-system/src/components/Step..│ clsx          │ Client     │ MIT Verified    │
│ Skeleton             │ Copied from MIT DS   │ Sakani-design-system/src/components/Skel..│ clsx          │ Server/Clt │ MIT Verified    │
│ EmptyState           │ Copied from MIT DS   │ Sakani-design-system/src/components/Empty.│ clsx          │ Server/Clt │ MIT Verified    │
│ Alert                │ Copied from MIT DS   │ Sakani-design-system/src/components/Alert/│ clsx          │ Server/Clt │ MIT Verified    │
│ Card / StatCard      │ Copied from MIT DS   │ Sakani-design-system/src/components/Card/ │ clsx          │ Server/Clt │ MIT Verified    │
│ Sidebar & Items      │ Copied from MIT DS   │ Sakani-design-system/src/components/Side..│ clsx          │ Client     │ MIT Verified    │
│ TopBar               │ Copied from MIT DS   │ Sakani-design-system/src/components/TopBar│ clsx          │ Client     │ MIT Verified    │
│ Breadcrumb           │ Copied from MIT DS   │ Sakani-design-system/src/components/Bre.. │ clsx          │ Server/Clt │ MIT Verified    │
│ Avatar / AvatarGroup │ Copied from MIT DS   │ Sakani-design-system/src/components/Avat..│ clsx          │ Server/Clt │ MIT Verified    │
│ BarChart             │ Copied from MIT DS   │ Sakani-design-system/src/components/Bar.. │ recharts      │ Client     │ MIT Verified    │
│ LineChart            │ Copied from MIT DS   │ Sakani-design-system/src/components/Line..│ recharts      │ Client     │ MIT Verified    │
│ DonutChart           │ Copied from MIT DS   │ Sakani-design-system/src/components/Donut.│ recharts      │ Client     │ MIT Verified    │
│ ActivityFeed         │ Copied from MIT DS   │ Sakani-design-system/src/components/Appl..│ clsx          │ Client     │ MIT Verified    │
├──────────────────────┼──────────────────────┼───────────────────────────────────────────┼───────────────┼────────────┼─────────────────┤
│ AppShell Layout      │ Retained & Restyled  │ frontend/components/layout/app-shell.tsx  │ None (internal)Client     │ ForgeFlow Code  │
│ Opportunity Pipeline │ Retained & Restyled  │ frontend/features/opportunities/pipeline..│ None (internal)Client     │ ForgeFlow Code  │
│ Opportunity Table    │ Retained & Restyled  │ frontend/features/opportunities/table..   │ @tanstack/tab.Client     │ ForgeFlow Code  │
│ TanStack Data Table  │ Retained & Restyled  │ frontend/components/data-display/data-tab.│ @tanstack/tab.Client     │ ForgeFlow Code  │
│ Quote Lines Editor   │ Retained & Restyled  │ frontend/app/app/(workspace)/quotes/[id]..│ React Hook FrmClient     │ ForgeFlow Code  │
│ RFQ Ingestion Wizard │ Retained & Restyled  │ frontend/app/app/(workspace)/rfqs/new/..  │ react-dropzoneClient     │ ForgeFlow Code  │
│ Toaster / Toast      │ Retained & Restyled  │ frontend/components/ui/sonner.tsx         │ sonner        │ Client     │ MIT Verified    │
├──────────────────────┼──────────────────────┼───────────────────────────────────────────┼───────────────┼────────────┼─────────────────┤
│ SakaniSheet (Drawer) │ Newly Implemented    │ frontend/components/sakani/sheet.tsx      │ @base-ui/reactClient     │ ForgeFlow Code  │
│ RFQ Match Drawer     │ Newly Implemented    │ frontend/features/rfqs/components/match.. │ SakaniSheet   │ Client     │ ForgeFlow Code  │
│ Calc Trace Tree      │ Newly Implemented    │ frontend/features/quotes/components/tra.. │ SakaniSheet   │ Client     │ ForgeFlow Code  │
│ Proposal Diff Sheet  │ Newly Implemented    │ frontend/features/proposals/components/.. │ SakaniSheet   │ Client     │ ForgeFlow Code  │
│ Export Status Banner │ Newly Implemented    │ frontend/features/quotes/components/exp.. │ Alert, Table  │ Client     │ ForgeFlow Code  │
├──────────────────────┼──────────────────────┼───────────────────────────────────────────┼───────────────┼────────────┼─────────────────┤
│ CRMDashboardBlock    │ Not Selected (Block) │ Sakani-design-system/src/blocks/CRM..     │ N/A (excluded)N/A          │ Replaced by comp│
│ DataTableBlock       │ Not Selected (Block) │ Sakani-design-system/src/blocks/Data..    │ N/A (excluded)N/A          │ Incompatible slc│
│ KanbanBoardBlock     │ Not Selected (Block) │ Sakani-design-system/src/blocks/Kanban..  │ N/A (excluded)N/A          │ Missing a11y dlg│
│ FileUploadPanelBlock │ Not Selected (Block) │ Sakani-design-system/src/blocks/File..    │ N/A (excluded)N/A          │ Replaced by comp│
│ E-Commerce Widgets   │ Not Selected (Scope) │ Sakani-design-system/src/components/EComm.│ N/A (excluded)N/A          │ B2C specific    │
│ Marketing Widgets    │ Not Selected (Scope) │ Sakani-design-system/src/components/Mark..│ N/A (excluded)N/A          │ Public site only│
│ LiquidGlass Surfaces │ Not Selected (Style) │ Sakani-design-system/src/lib/LiquidGlass..│ N/A (excluded)N/A          │ Unfit for CPQ   │
│ AppShell.module.css  │ Not Selected (IP)    │ saas-crm-sakani-ds/src/layout/AppShell..  │ N/A (excluded)N/A          │ Private CRM repo│
└──────────────────────┴──────────────────────┴───────────────────────────────────────────┴───────────────┴────────────┴─────────────────┤
```

---

## 3. Specialized Enterprise Domain Components (Bespoke Treatment)

Four key ForgeFlow interfaces represent specialized industrial workflows that standard CRM components cannot supply directly. Each must be deliberately styled and composed from Sakani tokens:

### 3.1 RFQ Candidate Match Drawer (`rfqs/[rfqId]/page.tsx`)
- **Requirement**: Displays raw customer specification text, normalized description, canonical UOM, and the top $K=5$ ranked catalog SKU candidates with similarity scores, pricing, stock availability, and match rationale tokens.
- **Sourcing & Composition Plan**:
  - Mounted inside a newly implemented `SakaniSheet` (`--color-bg-surface`, border `--color-border-subtle`, radius `--radius-none`).
  - Candidate SKU cards composed from Sakani `Card` with subtle borders (`--color-border-subtle: #E7E5E1`).
  - Similarity score rendered as a Sakani `Badge` (`score >= 0.60` -> `success`, `0.30..0.59` -> `warning`, `< 0.30` -> `danger`).
  - Action buttons: "Accept Match" (primary Sakani `Button`), "Manual Override" (outline `Button`), "Reject" (destructive `Button`).

### 3.2 Quotation Calculation Trace Inspector (`quotes/[quoteId]/page.tsx`)
- **Requirement**: Transparent mathematical audit trail showing line item base amounts, discount deductions, tax rates, subtotals, rounding steps (`ROUND_HALF_UP`), and grand totals computed by backend Python `Decimal`.
- **Sourcing & Composition Plan**:
  - Slide-over `SakaniSheet` with Geist Mono typography (`--font-mono`) for all monetary amounts and formula outputs.
  - Step breakdown composed using an adapted recursive tree styled with Sakani surface and border tokens.
  - Diagnostic badges indicating mathematical verification status and cryptographic `trace_hash`.

### 3.3 Review-Before-Write Proposal Diff Inspector (`approvals/page.tsx`)
- **Requirement**: Side-by-side or before/after visual diff of commercial changes (original price vs proposed price, margin delta, tax delta), accompanied by the mandatory maker-checker security invariant warning.
- **Sourcing & Composition Plan**:
  - Maker-checker security notice rendered via Sakani `Alert variant="destructive"`:
    `"Maker-Checker Security Policy: Proposers cannot approve their own commercial proposals."`
  - Diff summary card composed from Sakani `Card` with two columns: Original Revision vs Proposed Changes.
  - Negative margin impact highlighted in `--color-danger-fg` (`#F04438`), positive margin in `--color-success-fg` (`#12B76A`).
  - Approval and Rejection actions trigger Sakani `Modal` dialogs (with mandatory rejection reason textarea).

### 3.4 Document Export Studio & Delivery Ledger (`quotes/[quoteId]/page.tsx`)
- **Requirement**: Dual-mode export controls with draft lock warning, watermarked preview download, unwatermarked customer PDF/CSV downloads, and cryptographic SHA-256 fingerprint ledger.
- **Sourcing & Composition Plan**:
  - Draft Quote State: Prominent `Alert color="warning"` explaining that official exports are locked until manager sign-off.
  - Action row: "Download Watermarked Draft Preview" (`Button variant="outline"`), "Export Customer PDF" (`Button variant="primary"` disabled in draft).
  - Delivery ledger rendered as restyled table using Sakani table tokens with 1-click clipboard copy of SHA-256 fingerprint.

---

## 4. IP & Licensing Verification Summary

1. **Design System Repository (`samzydd/Sakani-design-system`)**:
   - Confirmed **MIT License** (Copyright 2026 Samuel Okpere).
   - Vendoring primitive components into `frontend/components/sakani/` with the original MIT copyright notice preserved is 100% permitted.
2. **Icons Bundle (`@tabler/icons`)**:
   - Confirmed **MIT License** (Copyright 2020-2026 Paweł Kuna). Fully compatible.
3. **CRM Application Repository (`samzydd/saas-crm-sakani-ds`)**:
   - Marked `"private": true` in `package.json` with no root `LICENSE` file.
   - **Strict Sourcing Rule**: **Zero files, CSS modules, or layouts from `saas-crm-sakani-ds` will be copied or vendored into ForgeFlow.** ForgeFlow's `app-shell.tsx` and layouts are retained and restyled using design system primitives only.
