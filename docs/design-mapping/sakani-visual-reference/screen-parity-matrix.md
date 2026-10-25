# Screen Parity Matrix & Visual Gap Analysis

This matrix documents a screen-by-screen comparative audit between the canonical **Sakani CRM reference screens** (`saas-crm-sakani-ds.vercel.app` / local port 5173) and the **ForgeFlow application screens** (local port 3000), clearly distinguishing direct comparisons, component references, and purpose-built manufacturing compositions.

---

## 1. Evidentiary Classification of Routes

| Category | Routes Included | Evidence / Methodology |
| :--- | :--- | :--- |
| **Tier 1: Direct Screenshot Comparisons** | `/app/dashboard` vs Sakani `/` | Identical viewport comparison across Desktop (`1440×900`), Tablet (`1024×768`), and Mobile (`390×844`). |
| **Tier 2: Component & Layout References** | `/app/accounts` (vs Sakani `/customers`), `/app/opportunities` (vs Sakani `/sales`), `/app/activity` | Sakani CRM pages serve as **structural and layout references** (`DataTableBlock`, `MetricRow`, charts, and `Panel`), **not** 1:1 screen equivalents. |
| **Tier 3: Purpose-Built Manufacturing Compositions** | `/app/catalog`, `/app/rfqs/*`, `/app/quotes/*`, `/app/approvals`, Export Studio | Unique industrial CPQ workflows with no generic SaaS CRM equivalent; built by composing verified Sakani primitives (`DataTableBlock`, `Sheet`, `Badge`, `Button`, `Panel`). |
| **Tier 4: Pending Multi-Viewport Captures** | Account Detail (`/app/accounts/[id]`), RFQ Ingestion Wizard (`/app/rfqs/new`) | Baseline captured on desktop; tablet and mobile captures scheduled for their respective batches. |

---

## 2. Global Shell & Navigation Framework

### Comparative Audit
| Dimension | Canonical Sakani CRM Reference | Current ForgeFlow Implementation | Parity Gap & Concrete Action Required |
| :--- | :--- | :--- | :--- |
| **Sidebar Desktop** | `248px` expanded, `64px` collapsed icon rail | `248px` expanded, `64px` icon rail implemented | **Match**: Geometry matches. Active indicator uses saffron `--color-primary-500` (`#FF4700`) with `left: -1px` active bar. |
| **Sidebar Mobile** | Drawer slides in at `<= 760px` with dark scrim overlay | Off-canvas drawer implemented | **Match**: Mobile drawer behavior consistent. Scrim backdrop opacity matches `rgba(0,0,0,0.4)`. |
| **TopBar Header** | `64px` height, breadcrumb on left, search + theme toggle + user menu on right | `64px` height, breadcrumb present, user profile on right | **Gap**: TopBar search and user alignment to be refined in Batch 1. |
| **Page Canvas (`.page`)**| **`border-top-left-radius: 28px`**, **`border-top-right-radius: 28px`**, white surface background on warm neutral canvas | Standard rectangular content area without top corner radii | **High-Impact Parity Gap (Batch 1)**: ForgeFlow adopts `.page`'s signature `border-top-left-radius: 28px` and `border-top-right-radius: 28px` on `var(--color-bg-canvas)`. |
| **Canvas Background** | `--color-bg-canvas: #FAFAF9` | Light neutral background `#F8FAFC` | **Gap (Batch 1)**: Update outer canvas to canonical warm stone `#FAFAF9`. |

---

## 3. Core CRM Screens Audit

### 3.1 Dashboard (`/app/dashboard` — Tier 1: Direct Comparison)
- **Sakani Reference**: Sakani CRM Dashboard (`/` on `saas-crm-sakani-ds.vercel.app` / local port 5173) (Visual Target)
- **ForgeFlow Route**: `/app/dashboard`
- **KPI / Stat-Card Visual Target Comparison & Anatomy**:
  - **Visual Benchmark**: The Sakani CRM dashboard reference establishes the exact target geometry and typography:
    - **Surface & Border**: Pure white surface (`var(--color-bg-surface)` / `#FFFFFF`) with a subtle 1px warm-neutral border (`var(--color-border-subtle)` / `#E7E5E1`) and soft elevation (`var(--shadow-xs)`).
    - **Border Radius**: 16px (`--radius-xl: 16px`).
    - **Card Height & Padding**: Compact, uniform height targeting ~110–112px at standard desktop reference (`1440×900`), with consistent internal padding (`var(--space-12)` / 12–16px). Cards must maintain identical height across the entire 4-card row.
    - **Metric Label**: Muted 14px label (`text-sm font-medium leading-5 text-[var(--color-fg-muted)]`).
    - **Metric Value**: Prominent 32px bold value with tight letter spacing (`text-[32px] font-bold tracking-tight text-[var(--color-fg-default)] leading-tight`).
    - **Supporting Row**: Compact supporting row beneath the metric, aligned consistently across all cards (`flex items-center gap-1.5 text-xs text-[var(--color-fg-muted)]`).
    - **No Top-Right Decorative Icons**: Omit top-right decorative icons (`TrendingUp`, `Briefcase`, `Building`, `AlertTriangle`), matching the clean Sakani minimal card pattern.
    - **Row Value & Baseline Alignment**: Values and supporting rows must be vertically and horizontally aligned across all cards without vertical displacement.
- **Preservation of ForgeFlow Semantics & Functionality**:
  - **Metric 1 (Total Open Pipeline)**: Value formatted via `formatMoney(summary.open_pipeline_value, "INR")`, supporting row: `"Across {count} active opportunities"`.
  - **Metric 2 (Open Deals)**: Value `summary.open_opportunities_count`, supporting row: interactive `"View pipeline board"` link to `/app/opportunities` with subtle arrow icon.
  - **Metric 3 (Active Accounts)**: Value `summary.active_accounts_count`, supporting row: interactive `"Manage customer accounts"` link to `/app/accounts` with subtle arrow icon.
  - **Metric 4 (Overdue Tasks)**: Value `summary.overdue_tasks_count`, supporting row: interactive link to `/app/tasks`. Uses semantic danger text (`var(--color-danger-fg)`) only when overdue tasks $> 0$.
  - **Strict Policy on Data Integrity**: Do not fabricate percentage changes or fake historical comparisons. Trend pill badges are permitted only when genuine historical baseline data exists; otherwise, present authentic contextual text or navigation action links in the supporting-row slot.
- **Implementation Sequence**:
  - **Batch 2**: Refine the reusable `StatCard` component (`frontend/components/sakani/stat-card.tsx`), establishing the verified visual contract and test suite.
  - **Batch 3**: Apply the refined `StatCard` to the dashboard route (`/app/dashboard`), verifying 4-column desktop composition, tablet 2×2 wrapping, and mobile stacking.
  - **Verification**: Capture before/after screenshots at 1440×900, 1024×768, and 390×844; verify large currency amounts (e.g. `₹1,24,50,000`) do not clip or overflow.
- **Middle Charts & Bottom Activity Audit**:
  - **Charts Row (Middle)**: 3-column equal grid (`threeCol`, height 334px) containing BarChart (Revenue), LineChart (Customer Growth), and DonutChart (Sales Channel with centered value and custom LegendRow).
  - **Recent Orders & Activity Row (Bottom)**: 2:1 column split (`ordersActivityRow`, height 412px). 2-column Recent Orders table with status badges (`Active`, `Failed`, `Pending`), 1-column Activity feed with avatar groups and segmented text.
- **Operational Analytics Expansion (Section 5 — Fully Conformed)**:
  - **Figma References**: Donut Chart with Text (node `1290:22116`), Horizontal Bar Chart (node `1290:21238`).
  - **Layout**: 3-column balanced grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`) positioned beneath Stage Distribution & Attention Required.
  - **Chart A (RFQ Match Health)**: Recharts Donut (`117` total lines center metric) displaying exact partition of RFQ line match status (`Exact Match`: 20, `Partially Matched`: 66, `Needs Review`: 28, `Unmatched`: 3). Accessible legend + tabular alternative toggle.
  - **Chart B (Quotation Lifecycle)**: Horizontal progress bars for quote governance (`Draft`: 1, `In Review / Pending`: 1, `Approved`: 2, `Rejected`: 0, `Expired`: 0; total 4). Tabular toggle.
  - **Chart C (Task Due-Date Load)**: Horizontal urgency bars binned by `Asia/Kolkata` date boundaries (`Overdue`: 4, `Due Today`: 1, `Next 7 Days`: 6, `Later`: 0; total 11 open tasks). Exact match with overdue tasks KPI (`4`). Tabular toggle.
  - **Stage Chart Color Mapping**: Polished stage colors across chart and breakdown table (`lead` = blue, `qualified` = teal, `solutioning` = saffron, `proposal` = purple, `negotiation` = gold, `won` = green, `lost` = red).
  - **Accessibility**: 0 Axe-core violations across Desktop Light, Desktop Dark, Tablet, and Mobile viewports. Verified via automated test suite.

### 3.2 Accounts Directory (`/app/accounts` — Tier 2: Layout Reference)
- **Sakani Layout Reference**: Sakani `/customers` provides the component reference for table styling and `Panel` headers, but is **not** an exact screen equivalent.
- **Reference Model**: Sakani **`Table — Default`** (Figma node `45:259`), **`Table — Stacked Mobile`** (Figma node `1269:563`), and **`Data Table + Toolbar`** (Figma node `684:17474`).
- **Implementation Status**: **Fully Conformed**
  - **Desktop Header & Body**: 44px header height (`h-11`), 44px body rows (`h-11`), 10px horizontal padding (`px-2.5`), 4px container radius (`rounded-[var(--radius-xs)]`), Title Case headers, 20px status badges, 32px row action buttons.
  - **Stacked Mobile Table**: Renders record cards below 768px with account name, status badge, 2-column detail grid, and 32px actions with zero horizontal overflow.
  - **Toolbar**: 32px search input (`h-8`), 32px filters, 36px New Account button, 32px pagination footer with Previous/Next buttons.
  - **Accessibility**: 0 Axe-core violations across Desktop Light, Desktop Dark, Tablet, and Mobile viewports.

### 3.3 Opportunities Pipeline (`/app/opportunities` — Tier 2: Layout Reference)
- **Sakani Layout Reference**: Sakani `/sales` provides chart and metric patterns; ForgeFlow's core pipeline is a **Kanban board with mandatory table switcher** (Decision D4).
- **Reference Model**: Sakani **`Board Column — Default`** (Figma node `686:2`), **`Board Card — Default`** (Figma node `678:179`), **`Table — Default`** (Figma node `45:259`), and **`Data Table + Toolbar`** (Figma node `684:17474`).
- **Implementation Status**: **Fully Conformed (Kanban & Table Views)**
  - **Kanban Board**: 352px desktop column width (`w-[352px] min-w-[352px]`), 12px radius, 12px padding, 10px vertical card gap, warm canvas background (`#FAFAF9`), 16px inter-column spacing, 32px header with 8px dot/count, 328 × 149px cards, drag & drop with 2px dashed drop target styling (`2781:38110`), and subtle semantic scrollbar (`.sakani-kanban-scroll`).
  - **Table View**: 44px Title Case headers (`Opportunity`, `Stage`, `Est. Value`, `Probability`, `Target Close`, `Owner`, `Actions`), content-driven row height (~52–63px) without clipping subtitle, right-aligned tabular numerals for value/probability, 20px semantic badges, 32px Advance/Mark lost/Reopen action controls with fixed-width alignment.
  - **Accessibility**: 0 Axe-core violations across Desktop Light, Desktop Dark, Tablet, and Mobile in both Kanban and Table views.

### 3.4 Tasks & Follow-ups (`/app/tasks` — Tier 2: Layout Reference)
- **Reference Model**: Sakani **`Table — Default`** (Figma node `45:259`), **`Data Table + Toolbar`** (Figma node `684:17474`), **`Tabs`**, and **`Badge`** (Figma node `16:103`).
- **Implementation Status**: **Fully Conformed**
  - **Status Tabs & Toolbar**: Canonical saffron active underline, Geist Sans 13px / 18px weight 500, muted inactive tabs, 32px search input (`h-8 text-xs`), 32px priority selector (`Select size="sm"`), 16px vertical gap to table.
  - **Table Shell & Typography**: 44px header height (`h-11`), `bg/canvas` (`#FAFAF9`), 1px bottom border `border/subtle` (`#E7E5E1`), Geist Sans 11px / 16px weight 600, `fg/muted` (`#78716A`), tracking 4%. Title Case headers: `Completion`, `Action Item`, `Priority`, `Due Date`, `Related Account`, `Related Deal`, `Assignee`, `Actions`.
  - **Body Rows**: Content-driven row height (~60–90px) without clipping 2-line action-item titles/descriptions or related-record links; 1px `border/subtle` divider; no zebra stripes.
  - **Priority & Overdue Independence**: High priority rendered as Warning/Subtle (`#FEF0C7` / `#B54708`), Normal/Low as Neutral/Subtle (`#F5F4F2` / `#78716A`). Overdue tasks receive a dedicated Danger/Subtle badge (`#FEE4E2` / `#B42318`) alongside readable date text in contrast-safe default foreground (`#141414`).
  - **Related Record Links**: Contrast-safe `fg/default` (`#141414`) text, canonical saffron hover underline, 16px building/briefcase icons with 8px text gap. Generous 18% column widths allowing long names to wrap across two lines.
  - **Completion & Row Actions**: Centered completion toggle with 32 × 32px hit target and accessible `Mark task {title} as completed` label; centered 32 × 32px edit ghost button with accessible `Edit task {title}` label; 10-second undo toast with backend version locking.
  - **Accessibility**: 0 Axe-core violations across Desktop Light, Desktop Dark, Tablet, and Mobile. Stacked mobile cards for viewports $< 768px$ with 0 horizontal page overflow.

### 3.5 Activity Audit Timeline (`/app/activity` — Tier 2: Layout Reference)
- **Reference Model**: Sakani **`ActivityLogBlock`** (Figma node `872:14920`).
- **Gap Analysis**:
  - Vertical timeline connecting line uses `--color-border-subtle` (`#E7E5E1`).
  - Avatars with rounded-full shape and status indicator dots.
  - Segmented text adopts Sakani `ActivityFeedHighlight` pattern (emphasized bold actor name + muted auxiliary text + timestamp).

---

## 4. Purpose-Built Manufacturing & CPQ Workflows (Tier 3)

These workflows represent ForgeFlow's aerospace/industrial manufacturing domain. They compose verified Sakani primitives mapped to complex technical requirements:

### 4.1 Catalog & Product Master (`/app/catalog`)
- **Pattern**: High-density Sakani `Table` with expandable category hierarchy.
- **Invariants Preserved**: Server-enforced cost isolation (unit costs masked for `sales_rep`).
- **Visual Mapping**: Category tags rendered with `Badge` (variant `neutral`, emphasis `subtle`). ITAR / Export compliance badges styled with high-visibility amber pill.

### 4.2 RFQ Ingestion Wizard (`/app/rfqs/new`)
- **Pattern**: Sakani `FileUploadPanelBlock` + `Stepper` component.
- **Visual Mapping**: Dashed dropzone with subtle border hover transition (`#FF4700`). Uploaded file items rendered with progress bars, file type icons, and remove buttons.

### 4.3 RFQ Review Studio & Candidate Matcher (`/app/rfqs/[rfqId]`)
- **Pattern**: Split-view technical studio with slide-over drawer (`Sheet`).
- **Visual Mapping**: Review table with urgency badges and match quality chips (`Exact`, `Needs Review`, `No Match`). Candidate Matcher side-sheet utilizing Sakani `SheetPopup` (`side="right"`), matching score progress indicators, and keyboard-accessible tabs.

### 4.4 Quotation Builder & Pricing Engine (`/app/quotes/[quoteId]`)
- **Pattern**: Authoritative technical studio with sticky executive summary panel and calculation trace sheet.
- **Visual Mapping**: Table line items with inline numeric inputs (`--font-mono` alignment). Summary card with live Python `Decimal` calculation breakdown. Slide-over Calculation Inspector sheet rendering step-by-step arithmetic formulas, rounding trace, and `trace_hash`.

### 4.5 Reviews & Approvals Queue (`/app/approvals`)
- **Pattern**: Multi-role review table with segmented lifecycle filters (`pending`, `approved`, `rejected`, `all`).
- **Visual Mapping**: Status badges with clear semantic color mapping. Proposal Review Sheet with financial impact cards (baseline vs proposed deltas) and line-item diffs. Maker-checker security notice banner rendered in subtle amber/info alert.

### 4.6 Document Export Studio (`QuoteExportSection`)
- **Pattern**: Enterprise document release studio with cryptographic delivery ledger.
- **Visual Mapping**: Certified release badge vs locked status banner. Two-column document action grid for PDF and CSV exports. Monospace SHA-256 fingerprint copy button with visual checkmark feedback.

---

## 5. Multi-Viewport Baseline Status

| Screen | Desktop (1440×900) | Tablet (1024×768) | Mobile (390×844) | Verification Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **Login** | Captured | Captured | Captured | Phase 2 Artifacts |
| **Dashboard** | Captured | Captured | Captured | Direct Sakani Comparison Captured |
| **Activity** | Captured | Captured | Captured | Phase 2 Artifacts |
| **Accounts** | Captured | Captured | Captured | Phase 3 Artifacts |
| **Opportunities** | Captured | Captured | Captured | Phase 3 Artifacts |
| **Tasks** | Captured | Captured | Captured | Phase 3 Artifacts (0 Axe Violations) |
| **Catalog** | Captured | Captured | Captured | Phase 4 Artifacts |
| **RFQ Review** | Captured | Captured | Captured | Phase 5 Artifacts |
| **Quotes List & Studio** | Captured | Captured | Captured | Phase 6 Artifacts |
| **Approvals Queue** | Captured | Captured | Captured | Phase 7 Artifacts |
| **Export Studio** | Captured | Captured | Captured | Phase 8 Artifacts |
| **Settings Area** | Captured | Captured | Captured | 0 Axe Violations (Overview, Org, Security) |
