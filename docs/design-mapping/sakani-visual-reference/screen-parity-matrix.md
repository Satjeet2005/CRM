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
- **Sakani Reference**: [`sakani-dashboard-desktop-1440x900.png`](./screenshots/sakani-dashboard-desktop-1440x900.png)
- **ForgeFlow Baseline**: [`forgeflow-dashboard-desktop-1440x900.png`](./screenshots/forgeflow-dashboard-desktop-1440x900.png)
- **Detailed Gap Analysis**:
  - **KPI Metrics Row**: 4 `StatCard`s with `title`, bold value, trending pill badge, and `description` ("vs last month"). Refine value typography to `32px` bold.
  - **Charts Row (Middle)**: 3-column equal grid (`threeCol`, height 334px) containing BarChart (Revenue), LineChart (Customer Growth), and DonutChart (Sales Channel with centered value and custom LegendRow).
  - **Recent Orders & Activity Row (Bottom)**: 2:1 column split (`ordersActivityRow`, height 412px). 2-column Recent Orders table with status badges (`Active`, `Failed`, `Pending`), 1-column Activity feed with avatar groups and segmented text.

### 3.2 Accounts Directory (`/app/accounts` — Tier 2: Layout Reference)
- **Sakani Layout Reference**: Sakani `/customers` provides the component reference for table styling and `Panel` headers, but is **not** an exact screen equivalent.
- **Reference Model**: Sakani **`DataTableBlock`** (Figma node `892:12401`).
- **Gap Analysis**:
  - Table typography: Account names use `14px` Medium with subtitle metadata in `12px` `--color-fg-muted`.
  - Filters: Align segmented tier filters (`Strategic`, `Enterprise`, `Mid-Market`) to match Sakani `SegmentedControl` tokens.
  - Actions: Add flush-right row action buttons with Sakani `IconButton` styling.

### 3.3 Opportunities Pipeline (`/app/opportunities` — Tier 2: Layout Reference)
- **Sakani Layout Reference**: Sakani `/sales` provides chart and metric patterns, but ForgeFlow's core pipeline is a **Kanban board with mandatory table switcher** (Decision D4).
- **Reference Model**: Sakani **`KanbanBoardBlock`** (Figma node `915:20412`).
- **Gap Analysis**:
  - View Switcher: Ensure the segmented switch button matches Sakani's subtle border and shadow tokens.
  - Kanban Cards: Cards adopt `12px` border radius (`--radius-lg`), `12px` internal padding, and subtle hover elevation (`--shadow-md`).
  - Deal Values: Formatted with mono font (`--font-mono`) and bold styling.

### 3.4 Activity Audit Timeline (`/app/activity` — Tier 2: Layout Reference)
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
| **Catalog** | Captured | Captured | Captured | Phase 4 Artifacts |
| **RFQ Review** | Captured | Captured | Captured | Phase 5 Artifacts |
| **Quotes List & Studio** | Captured | Captured | Captured | Phase 6 Artifacts |
| **Approvals Queue** | Captured | Captured | Captured | Phase 7 Artifacts |
| **Export Studio** | Captured | Captured | Captured | Phase 8 Artifacts |
