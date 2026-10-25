# Sakani Component Reference & Crosswalk

This document catalogs canonical **Sakani UI** components, their verified contracts from `@sakaniui/react` v0.9.0, source implementations in `/tmp/sakani-design-system`, and their designated mappings into ForgeFlow.

---

## 1. Core Primitives & Containers

### 1.1 Button
- **Package Import**: `@sakaniui/react` or `@/components/sakani/button`
- **Source Path**: `/tmp/sakani-design-system/src/components/Button/Button.tsx`
- **Variants**:
  - `primary`: Solid saffron accent fill (`#FF4700`), white text, hover `#E63D00` (`--color-primary-600`), active `#BF3200`.
  - `secondary`: Neutral surface fill (`#FFFFFF`), subtle border (`#E7E5E1`), dark text, subtle hover fill (`#F5F4F2`).
  - `outline`: Transparent background with neutral border (`#DBDAD7`).
  - `ghost`: Transparent background, hover subtle fill (`#F5F4F2`).
  - `destructive`: Error fill (`#F04438`), white text.
- **Sizes**: `sm` (h: 32px, text: 12px), `md` (h: 36px, text: 14px), `lg` (h: 40px, text: 14px), `icon` (square).
- **Props**: `variant`, `size`, `isLoading`, `leftIcon`, `rightIcon`, `disabled`.

### 1.2 Badge & Status Pills
- **Package Import**: `@sakaniui/react` or `@/components/sakani/badge`
- **Source Path**: `/tmp/sakani-design-system/src/components/Badge/Badge.tsx`
- **Variants**: `neutral`, `accent` (saffron), `success`, `warning`, `danger`, `info`.
- **Emphasis**:
  - `subtle`: Tinted background (`-50`), matching dark text (`-700`). Standard for table rows and cards.
  - `solid`: High-contrast solid fill (`-500` / `-900`), white text. Used for critical counters.
- **Corner Radius**: `6px` (`--radius-sm`).

### 1.3 Card & Panel
- **Package Import**: `@sakaniui/react` or `@/components/sakani/card`
- **CRM Source**: `/tmp/saas-crm-sakani-ds/src/components/Panel.tsx` and `Panel.module.css`
- **DS Source**: `/tmp/sakani-design-system/src/components/Card/Card.tsx`
- **Anatomy**:
  - Container: `border: 1px solid var(--color-border-subtle)` (`#E7E5E1`), `border-radius: 16px` (`--radius-xl`), `background: var(--color-bg-surface)` (`#FFFFFF`), `padding: 20px`.
  - Header Row (`.headerRow`): Flex container with Title (`16px/24px`, font-weight 600, color `#141414`), Description (`13px/18px`, font-weight 500, color `#A8A29B`), and flush-right Action slots.
  - Internal Gap: `12px` between header, actions, and content.

### 1.4 StatCard (Executive KPI Tile)
- **Package Import**: `@sakaniui/react` or `@/components/sakani/card`
- **Source Path**: `/tmp/sakani-design-system/src/components/StatCard/StatCard.tsx`
- **Props**: `title`, `value`, `delta` (e.g. `"+12.5%"`), `trend` (`"up" | "down" | "flat"`), `description` (e.g. `"vs last month"`), `sparkline` (`number[]`).
- **Anatomy**:
  - Title: `14px`, font-weight 500, color `--color-fg-muted`.
  - Value: `28px` / `32px`, font-weight 700, tracking tight.
  - Delta Badge: Pill with trend arrow icon (emerald for up, rose for down).

### 1.5 Table (Enterprise Tabular Data)
- **Package Import**: `@sakaniui/react`
- **Source Path**: `/tmp/sakani-design-system/src/components/Table/Table.tsx`
- **Props**: `columns` (`TableColumn<T>[]`), `rows` (`T[]`), `bordered` (`boolean`), `selectable`, `responsive` (`"default" | "stacked" | "auto"`).
- **Column Definition**:
  - `key`: key of data object
  - `header`: string title
  - `align`: `"left" | "center" | "right"`
  - `render`: `(row: T) => ReactNode`
  - `width`: string pixel or percentage

### 1.6 Slide-Over Sheet (Inspection Drawer)
- **Component**: `frontend/components/sakani/sheet.tsx`
- **Underlying Primitives**: `@base-ui/react/dialog` or `@radix-ui/react-dialog`
- **Styling**: Side sheet emerging from right (`side="right"`), max width `2xl` (`42rem` / `672px`), background `var(--color-bg-surface)`, elevation shadow `var(--shadow-xl)`, border left `var(--color-border-subtle)`.
- **Keyboard & A11y**: Focus-trapped, ESC dismiss, `SheetBody` focusable (`tabIndex={0}`, `role="region"`).

---

## 2. Documented Application Block Components

Sakani provides canonical, production-ready blocks in `@sakaniui/react/blocks` modeled directly after Figma frames:

| Block Name | Figma Node | Key Features | ForgeFlow Target |
| :--- | :--- | :--- | :--- |
| **`CRMDashboardBlock`** | `889:35330` | TopBar, Breadcrumb, Stage Tabs, Deal value slider, Filter bar, Table | `/app/dashboard`, `/app/opportunities` |
| **`DataTableBlock`** | `892:12401` | 6 visual states: Default, Filtered, Bulk action bar, Loading skeleton, Empty, Error | `/app/accounts`, `/app/quotes`, `/app/rfqs` |
| **`KanbanBoardBlock`** | `915:20412` | Column drag-and-drop, Stage counts, Add card CTA, Stage transition validation | `/app/opportunities` (Kanban mode) |
| **`FileUploadPanelBlock`**| `904:18290` | Drag-and-drop dashed zone, Multi-file progress bars, Remove file, Preview | `/app/rfqs/new` (Ingestion Wizard) |
| **`LoginBlock`** | `840:11204` | Centered authentication card, Floating labels, Password toggle, Error alert | `/login` |
| **`ActivityLogBlock`** | `872:14920` | Chronological activity timeline, Actor avatars, Segmented action text | `/app/activity` |

---

## 3. ForgeFlow Screen-to-Component Crosswalk

| ForgeFlow Screen / Route | Current Implementation | Target Canonical Sakani Architecture |
| :--- | :--- | :--- |
| **`/login`** | `frontend/app/(auth)/login/page.tsx` | Sakani `LoginBlock` with synthetic demo role switcher |
| **`/app/dashboard`** | `frontend/app/app/(workspace)/dashboard/page.tsx` | 4 `StatCard`s + 3-col `Panel`s with Recharts + 2:1 Orders/Activity row |
| **`/app/activity`** | `frontend/app/app/(workspace)/activity/page.tsx` | Sakani `ActivityLogBlock` with filter pills and date groupings |
| **`/app/accounts`** | `frontend/app/app/(workspace)/accounts/page.tsx` | Sakani `DataTableBlock` with search, tier filter, and row actions |
| **`/app/accounts/[id]`** | `frontend/app/app/(workspace)/accounts/[accountId]/page.tsx` | Sakani Two-column detail layout: Master metadata panel + Tabbed history |
| **`/app/opportunities`** | `frontend/app/app/(workspace)/opportunities/page.tsx` | Hybrid `KanbanBoardBlock` and `DataTableBlock` with stage switcher |
| **`/app/catalog`** | `frontend/app/app/(workspace)/catalog/page.tsx` | Sakani Catalog Grid/Table with category tree and unit cost masking |
| **`/app/rfqs`** | `frontend/app/app/(workspace)/rfqs/page.tsx` | Sakani Filtered Table with urgency badges and quote-readiness scores |
| **`/app/rfqs/new`** | `frontend/app/app/(workspace)/rfqs/new/page.tsx` | Sakani `FileUploadPanelBlock` + Stepper Ingestion Wizard |
| **`/app/rfqs/[rfqId]`** | `frontend/app/app/(workspace)/rfqs/[rfqId]/page.tsx` | Split-view Review Studio: RFQ line list + Candidate Matcher drawer |
| **`/app/quotes`** | `frontend/app/app/(workspace)/quotes/page.tsx` | Sakani Quotations list with status segmented controls (`draft`, `pending`, `approved`) |
| **`/app/quotes/[quoteId]`**| `frontend/app/app/(workspace)/quotes/[quoteId]/page.tsx` | Commercial Pricing Studio: Interactive Line Items + Calculation Inspector sheet |
| **`/app/approvals`** | `frontend/app/app/(workspace)/approvals/page.tsx` | Reviews & Approvals Queue: Multi-role table + Proposal Review diff sheet |

---

## 4. Non-Blocking Reference Questions (Figma-Specific Details)

The following design details exist primarily in the Figma community file (`node-id=1515-5`). They are recorded here for reference and do **not** block global foundation or shell work:

1. **Kanban Card Drop Zone Visuals**:
   - *Status*: Non-blocking reference request.
   - *Detail*: Confirmation of exact border style and background fill when dragging deal cards between columns (e.g. `dashed 2px var(--color-primary-500)` vs `var(--color-bg-subtle)`).
2. **Deal Value Slider Dimensions**:
   - *Status*: Non-blocking reference request.
   - *Detail*: Exact thumb diameter (16px vs 20px) and active track height (4px vs 6px) in `CRMDashboardBlock`.
3. **Empty State Art Convention**:
   - *Status*: Non-blocking reference request.
   - *Detail*: Confirmation whether empty data tables use minimal Lucide/Tabler icon circles or specific SVG illustrations.
