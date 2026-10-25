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
- **Package Import**: `@sakaniui/react` or `@/components/sakani/stat-card`
- **Source Path**: `/tmp/sakani-design-system/src/components/StatCard/StatCard.tsx`
- **Props**: `title` (`string`), `value` (`string`), `description`? (`string`), `action`? (`ReactNode`), `delta`? (`string`), `trend`? (`"up" | "down" | "flat"`), `badgeVariant`? (`BadgeVariant`), `sparkline`? (`number[]`), `className`? (`string`).
- **Anatomy & Styling Contract**:
  - Container: `border: 1px solid var(--color-border-subtle)` (`#E7E5E1`), `border-radius: 16px` (`--radius-xl`), `background: var(--color-bg-surface)` (`#FFFFFF`), `padding: var(--space-12)` (`12px` / `16px`), target height `110–112px` on desktop.
  - Title/Header: `14px`, line-height `20px`, font-weight 500, color `var(--color-fg-muted)`. No decorative icon in minimal dashboard mode.
  - Value: `32px`, line-height `1.1`, font-weight 700, letter-spacing `-0.02em`, color `var(--color-fg-default)`.
  - Supporting Meta Row: Compact flex row beneath value. Supports contextual description (`12px`, color `var(--color-fg-muted)`) or action link (`11px`/`12px`, font-weight 500, accessible focus ring).
  - Trend Delta Badge: Rendered only when genuine historical trend data exists; never fabricated.
  - Responsive Behavior: Maintains fixed height and alignment across desktop 4-card row, wraps to 2×2 on tablet, stacks cleanly on mobile.

### 1.5 Table (Enterprise Tabular Data)
- **Package Import**: `@sakaniui/react` or `@/features/{accounts,opportunities,tasks}/components/*-table`
- **Figma References**: Table — Default (`45:259`), Table — Stacked Mobile (`1269:563`), Data Table + Toolbar (`684:17474`), Badge (`16:103`)
- **Container Geometry**: `border: 1px solid var(--color-border-subtle)` (`#E7E5E1`), `border-radius: 4px` (`--radius-xs`), `background: var(--color-bg-surface)` (`#FFFFFF`), `box-shadow: var(--shadow-xs)`. Focus-accessible scroll wrapper (`role="region" aria-label="..." tabIndex={0}`).
- **Header Geometry**: Height `44px` (`h-11 min-h-[44px]`), background `var(--color-bg-canvas)` (`#FAFAF9`), border-bottom `1px solid var(--color-border-subtle)` (`#E7E5E1`). Geist Sans `11px/16px`, weight 600, color `var(--color-fg-muted)` (`#706A63`), letter-spacing `0.04em`. Title Case titles.
- **Body Row Geometry**: Height `44px` or content-driven ~56–90px for multi-line action item records, background `var(--color-bg-surface)` (`#FFFFFF`), horizontal padding `10px` (`px-2.5`), vertical centering. Geist Sans `13px/18px`, weight 500, color `var(--color-fg-default)` (`#141414`). Restrained hover `hover:bg-[var(--color-bg-subtle)]/60`. No vertical gridlines or zebra striping.
- **Badges & Row Actions**: Height `20px` badges (`px-2 py-0.5 text-xs rounded-full`), `32 × 32px` clickable action buttons (`h-8 w-8 p-0`) with 16px outline icons. Independent priority (Warning/Neutral) and overdue (Danger) badges. Accessible completion buttons (`32 × 32px`).
- **Mobile Stacked Cards**: Viewports `< 768px` render individual record cards with 2-column detail grid and 32px actions. Zero horizontal page overflow.

### 1.6 Slide-Over Sheet (Inspection Drawer)
- **Component**: `frontend/components/sakani/sheet.tsx`
- **Underlying Primitives**: `@base-ui/react/dialog` or `@radix-ui/react-dialog`
- **Styling**: Side sheet emerging from right (`side="right"`), max width `2xl` (`42rem` / `672px`), background `var(--color-bg-surface)`, elevation shadow `var(--shadow-xl)`, border left `var(--color-border-subtle)`.
- **Keyboard & A11y**: Focus-trapped, ESC dismiss, `SheetBody` focusable (`tabIndex={0}`, `role="region"`).

### 1.7 Board Column & Board Card (Pipeline Kanban)
- **Component**: `frontend/features/opportunities/components/pipeline-board.tsx`
- **Figma References**: Board Column — Default (`686:2`), Board Column — Drop Target (`2781:38110`), Board Card — Default (`678:179`)
- **Column Geometry**: Width `352px` (`w-[352px] min-w-[352px]`), inner width `328px`, padding `12px` (`p-3`), vertical gap `10px` (`gap-2.5`), radius `12px` (`rounded-[var(--radius-lg)]`), background `var(--color-bg-canvas)` (`#FAFAF9`), border `1px solid var(--color-border-subtle)` (`#E7E5E1`).
- **Column Header**: Height `32px` (`h-8`), 8 × 8px stage color dot, 14px weight 600 stage name, neutral count badge (`12px`, weight 500, `bg/subtle`), right-aligned tabular INR totals.
- **Card Geometry**: 328 × 149px reference dimensions, white surface (`#FFFFFF`), 1px border (`#E7E5E1`), radius 12px, padding 12px, vertical gap 8px, subtle shadow (`shadow-xs`).
- **Card Hierarchy**: 14px 2-line title link, 13px account name with 14px building icon, tabular value and date row, 1px top divider, 32px Next outline button and Mark Lost destructive action.
- **Drop Target State**: 2px dashed primary border (`border-2 border-dashed border-[var(--color-primary-400)]`), subtle lane tint, accessible drop target indicator.

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
| **`/app/settings`** | `frontend/app/app/(workspace)/settings/page.tsx` | Settings Area Hub: Responsive subnavigation, Account Overview card, Profile Settings card, and RBAC Permissions Grid |

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
