# Sakani Live CRM & Design System Comprehensive Audit

This document provides a verified, evidence-backed technical audit of the **Sakani CRM** live deployment, the **Sakani CRM source repository**, and the **Sakani Design System** (`@sakaniui/react`).

---

## 1. Primary Sources Evaluated

1. **Live CRM Deployment**: [`https://saas-crm-sakani-ds.vercel.app/`](https://saas-crm-sakani-ds.vercel.app/)
2. **CRM Source Repository**: `https://github.com/samzydd/saas-crm-sakani-ds` (inspected in `/tmp/saas-crm-sakani-ds`)
3. **Design System Source Repository**: `https://github.com/samzydd/Sakani-design-system` (inspected in `/tmp/sakani-design-system`)
4. **Connected Design Tooling**: Bundled `sakaniui` MCP server v0.9.0 (`list_components`, `get_component`, `get_tokens`, `search_icons`, `get_guide`, `check_code`).

---

## 2. Live Application Audit (`saas-crm-sakani-ds.vercel.app`)

### 2.1 Route Inventory & Accessible Screens
Inspection of the live Vercel deployment and client JavaScript bundle (`/assets/index-DhXhFax4.js`) reveals:
- **Active Accessible Routes**:
  - `/` — **Dashboard Overview**: Displays 4 KPI `StatCard`s, Revenue BarChart, Growth LineChart, Channels DonutChart, Recent Orders table, and Activity Feed.
  - `/sales` — **Sales Analytics**: Revenue metrics, Conversion Funnel, Regional Revenue table, Payment methods DonutChart, Product Sales table.
  - `/customers` — **Customer Intelligence**: Customer metrics, Customer Segments DonutChart, Satisfaction scores, Acquisition vs Retention LineChart, Recent Customers table.
- **Disabled Navigation Items**:
  In [`src/layout/AppShell.tsx`](file:///tmp/saas-crm-sakani-ds/src/layout/AppShell.tsx), 7 of the 10 sidebar links (`Products`, `Marketing`, `Analytics`, `Operations`, `Team`, `Integrations`, `Settings`) are explicitly declared with `page: false`. They render in the sidebar for visual hierarchy but cannot be navigated to.

### 2.2 Vercel Direct Route Routing Bug (Observed Defect)
- Direct HTTP requests to `https://saas-crm-sakani-ds.vercel.app/sales` and `https://saas-crm-sakani-ds.vercel.app/customers` return **HTTP 404 NOT_FOUND**.
- **Root Cause**: The Vite Single Page Application is deployed without a Vercel SPA rewrite configuration (`vercel.json` containing `"rewrites": [{ "source": "/(.*)", "destination": "/" }]`). Client-side navigation via React Router works, but browser refreshes or direct deep links fail.

### 2.3 Observable Layout & Geometry
- **Page Canvas**: Warm neutral background (`#FAFAF9` / `--color-bg-canvas`).
- **Sidebar**:
  - Desktop Expanded Width: **248px** (`--sidebar-width`).
  - Desktop Icon-Rail Collapsed Width: **64px** (`--sidebar-collapsed-width`).
  - Mobile Behavior: At viewports `<= 760px`, the sidebar detaches from normal document flow and slides in as a mobile drawer (`transform: translateX(0)`) backed by a darkened scrim overlay.
- **TopBar**:
  - Height: **64px** (`--topbar-height`).
  - Elements: Left section contains mobile hamburger toggle and page title; right section contains expandable search (`SearchExpand`), light/dark theme switch (`ThemeToggle`), and user account avatar with popup menu (`Menu`).
- **Surface Cards & Panels**:
  - Border radius: **16px** (`--radius-xl`) for main content cards (`Panel`).
  - Inner controls / buttons: **8px** (`--radius-md`).
  - Badges / chips: **6px** (`--radius-sm`).

---

## 3. Sakani Design System Architecture (`@sakaniui/react` 0.9.0)

The design system is a comprehensive, production-grade enterprise component library with 169 exported components and application blocks:

### 3.1 Technology Stack & Exports
- **Package**: `@sakaniui/react` v0.9.0
- **Language**: TypeScript 5.8+ with strict `.d.ts` type declarations.
- **Runtime Dependencies**: Peer dependencies on `react: ^19.0.0` and `react-dom: ^19.0.0`; direct dependency on `recharts: ^3.9.2`.
- **RSC & App Router Constraint**: Package build artifacts do **not** include `"use client"` directives. Interactive components call React client hooks (`useState`, `useEffect`, `useRef`). Because `@sakaniui/react` exports via monolithic barrel files without per-component subpaths, importing components directly into Next.js App Router Server Components triggers RSC evaluation failures unless wrapped in client proxies or vendored with `"use client"`.
- **CSS Architecture**: Dual stylesheet model:
  - `@sakaniui/react/tokens.css`: Core design tokens (CSS custom properties).
  - `@sakaniui/react/style.css`: Component styling rules with dark mode (`.dark`) and surface mode (`data-surface="solid" | "glass" | "liquid"`) support.
- **Icon System**: Complete integration of Tabler Icons (over 6,000 outline and filled icons) re-exported from `@sakaniui/react/icons`.
- **Entry Points**:
  - `@sakaniui/react`: Primitives and composite components.
  - `@sakaniui/react/blocks`: Full-page and composite application blocks.
  - `@sakaniui/react/icons`: Icon components typed as `IconComponent`.
  - `@sakaniui/react/tokens.css` & `style.css`: Required stylesheets.

### 3.2 Design Token System

| Token Category | Token Pattern | Key Values |
| :--- | :--- | :--- |
| **Primary Brand** | `--color-primary-{50-950}` | **`--color-primary-500: #FF4700`** (warm saffron orange) |
| **Neutral Canvas**| `--color-neutral-{50-950}` | Light Canvas: `#FAFAF9`, Surface: `#FFFFFF`; Dark Canvas: `#0F0E0C`, Surface: `#141414` |
| **Semantic Status**| `--color-{success,warning,danger,info}-*` | Success: `#12B76A`, Warning: `#F79009`, Danger: `#F04438`, Info: `#2E90FA` |
| **Charts** | `--color-chart-{1-6}` | Orange (`#FF4700`), Blue (`#5B92DD`), Teal (`#47A8A2`), Purple (`#9179D6`), Gold (`#DCA84F`), Green (`#12B76A`) |
| **Spacing Scale** | `--space-{N}` (pixel-named) | `0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32, 40, 48, 64, 80, 96` |
| **Radius Scale** | `--radius-{none,2xs,xs,sm,md,lg,xl,2xl,3xl,full}` | `md: 8px` (controls), `lg: 12px`, `xl: 16px` (cards), `full: 9999px` |
| **Typography** | `--font-sans`, `--font-mono` | Geist Sans Variable (`--font-sans`), Geist Mono Variable (`--font-mono`) |

### 3.3 Available High-Value Application Blocks
In `@sakaniui/react/blocks`, Sakani provides pre-composed application screens designed after Figma frames:
1. **`CRMDashboardBlock`** (Figma node `889:35330`): Complete CRM pipeline with icon-rail sidebar, TopBar with breadcrumb, stage tabs, collapsible filter panel (owner, company, deal value slider), and paginated data table.
2. **`DataTableBlock`**: Enterprise data table supporting 6 explicit visual states: `default`, `filtered`, `bulk` (floating bulk actions bar), `loading` (animated skeletons), `empty`, and `error`.
3. **`KanbanBoardBlock`**: Pointer-driven drag-and-drop Kanban board supporting column counts, add cards, skeletons, and empty drop zones.
4. **`FileUploadPanelBlock`**: Dashed dropzone with per-file status badges (complete, pending, uploading progress), remove, and confirm actions.
5. **`LoginBlock`**: Full authentication card supporting idle, validation error, server error, and loading states with password eye toggle.
6. **`ActivityLogBlock`**: Activity feed card with timeline and compact variants.
7. **`MultistepModalBlock`**: Multi-step wizard dialog with step indicator and form layout.

---

## 4. Connected MCP Tooling & Design Assets

### 4.1 SakaniUI MCP Server (`sakaniui`)
- Fully available and verified in the environment.
- Provides real-time programmatic access to component contracts, required props, TypeScript shapes, CSS variables, and verified code recipes.
- Enables safe validation via `check_code` before any snippet is recommended.

### 4.2 Figma Tooling Availability Limitation
- **Observation**: No active Figma MCP server is connected in the runtime environment (only `github` and `sakaniui` are registered).
- **Impact & Mitigation**: We cannot directly execute live Figma REST API node queries. However, because `@sakaniui/react` source code explicitly documents its Figma node bindings (e.g., `CRMDashboardBlock` binds to node `889:35330`), and because both source repositories are cloned locally, all design tokens, component variants, and layouts have been verified from source code and compiled assets.

---

## 5. Licensing & Code Reuse Evaluation

| Artifact | Repository | Declared License | Reuse Implications |
| :--- | :--- | :--- | :--- |
| **`@sakaniui/react`** | `samzydd/Sakani-design-system` | **MIT License** (Copyright 2026 Samuel Okpere) | **Fully Permitted**: Can be consumed as a direct npm dependency or copied with copyright notice. |
| **`@sakaniui/react/icons`** | Tabler Icons bundle | **MIT License** (Copyright 2020-2026 Paweł Kuna) | **Fully Permitted**: Compatible MIT license. |
| **`saas-crm-sakani-ds`** | `samzydd/saas-crm-sakani-ds` | **Private / Unspecified** (`"private": true` in `package.json`, no root `LICENSE` file) | **Caution**: Do not fork or directly vendor raw application code without clarification. Treat as visual and structural reference only. |

---

## 6. Design Strengths & Enterprise Limitations

### Strengths Worth Adopting
1. **Visual Sophistication & Warm Palette**: The warm neutral canvas (`#FAFAF9`) paired with subtle borders (`#E7E5E1`) and vibrant saffron brand accent (`#FF4700`) produces an elevated, executive SaaS feel compared to default cold-gray templates.
2. **First-Class Geist Typography**: Geist Sans and Geist Mono are deeply integrated via tokens, offering crisp legibility for dense industrial part numbers and financial quantities.
3. **Pre-Built Enterprise Blocks**: `CRMDashboardBlock`, `DataTableBlock`, `KanbanBoardBlock`, and `FileUploadPanelBlock` solve standard CRM layout challenges out of the box.
4. **Rich Chart Token System**: 6 dedicated data-visualization color tokens (`--color-chart-1` through `6`) ensure charts harmonize across light and dark modes.

### Technical Limitations Requiring Adaptation for ForgeFlow
1. **Missing Native Sheet / Drawer Primitive**:
   - SakaniUI has `Modal` (centered dialog) and `Popover` (anchored dropdown), but **no native `Sheet` or slide-over drawer component**.
   - ForgeFlow relies heavily on side sheets for RFQ candidate matching, calculation trace inspection, and change proposal diff review.
   - *Solution*: Compose a custom Drawer from Sakani tokens (`--color-bg-surface`, `--shadow-xl`, `--transition-base`) or preserve ForgeFlow's accessible Base UI Sheet styled with Sakani tokens.
2. **Simplified Client-Only Table Model**:
   - Sakani's `Table<T>` is a presentational component expecting in-memory row arrays; it lacks built-in server-side sorting, column filtering, and virtualization.
   - ForgeFlow uses `@tanstack/react-table` with backend pagination, sorting, and row selection.
   - *Solution*: Retain TanStack Table for headless state and wrap it in Sakani's visual table styling.
3. **Contrast Sensitivity on Subtle Text**:
   - Sakani's own `tokens.css` contains an explicit comment: `/* --color-fg-subtle: var(--color-neutral-400); note: 2.53:1 contrast on canvas bg, below WCAG AA's 4.5:1 for text */`.
   - In ForgeFlow, subtle text must be clamped to `--color-neutral-500` (or higher) to maintain ForgeFlow's verified 0-violation Axe-core WCAG AA baseline.
