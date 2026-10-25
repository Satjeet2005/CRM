# Sakani Visual-Conformance Acceptance Criteria

To ensure that the visual-conformance pass is executed with objective rigor, all future UI refinements must satisfy the following acceptance criteria prior to final sign-off.

---

## 1. Design Token & Styling Conformance

- [ ] **Zero Hard-Coded Colors**: All inline hex color values (`#...`) and arbitrary Tailwind color classes (e.g. `bg-gray-100`, `text-slate-800`) are replaced with semantic CSS variables (`var(--color-bg-canvas)`, `var(--color-fg-default)`, `var(--color-border-subtle)`, etc.).
- [ ] **Canonical Saffron Primary Accent**: Primary interactive brand elements strictly use `--color-primary-500` (`#FF4700`) and `--color-primary-600` (`#E63D00`).
- [ ] **Typography Hierarchy**:
  - Headings strictly map to `--font-sans` (Geist Sans) with canonical weights (`600` / `700`) and negative letter spacing (`-0.01em` to `-0.02em`).
  - Monetary values, part numbers, calculation traces, and SHA-256 hashes strictly use `--font-mono` (Geist Mono).
- [ ] **Corner Radii Consistency**:
  - Main application page container (`.page`) features `border-top-left-radius: 28px` and `border-top-right-radius: 28px` on `var(--color-bg-canvas)`.
  - Cards and content panels consistently use `16px` (`--radius-xl`).
  - Action buttons and standard inputs use `8px` (`--radius-md`).
  - Badges and status pills use `6px` (`--radius-sm`).
- [ ] **Elevation & Borders**: Surfaces use `1px solid var(--color-border-subtle)` (`#E7E5E1`) and soft warm shadows (`var(--shadow-xs)` for buttons, `var(--shadow-sm)` for cards).

---

## 2. Component Fidelity & State Completeness

### 2.1 Shared KPI & StatCard Component Acceptance Criteria
- [ ] **Geometry & Surface**:
  - Background strictly `var(--color-bg-surface)` (`#FFFFFF`) with 1px `solid var(--color-border-subtle)` (`#E7E5E1`).
  - Corner radius consistently `16px` (`--radius-xl`).
  - Compact height targeting `110–112px` at standard 1440×900 desktop reference size.
  - Consistent padding (`var(--space-12)` / `p-4`) across all instances.
  - Uniform heights and baseline alignment across all cards in a grid row.
- [ ] **Typography Hierarchy**:
  - Title/Label: 14px font size, 20px line height, font weight 500, muted color (`var(--color-fg-muted)`).
  - Value: 32px prominent bold font (`text-[32px]`), line height 1.1–1.2, font weight 700, tight letter spacing (`-0.02em`), default text color (`var(--color-fg-default)`).
- [ ] **Supporting Row Composition**:
  - Compact bottom row positioned consistently across cards.
  - Supports both contextual metadata descriptions and interactive navigation links.
  - Action links feature subtle chevron/arrow icons and maintain accessible focus rings.
- [ ] **Clean Visual Pattern**:
  - Omit unnecessary top-right decorative icons, adhering strictly to the Sakani minimal card reference pattern.
- [ ] **Semantic Integrity**:
  - Real metrics only: Total Open Pipeline, Open Deals, Active Accounts, Overdue Tasks.
  - Zero fabricated percentage deltas or fake historical trends. Trend pills permitted only where genuine historical trend data exists.
  - Semantic danger coloring (`var(--color-danger-fg)`) reserved exclusively for actual overdue items.
- [ ] **Responsive & Overflow Behavior**:
  - Desktop: 4-column balanced grid with no horizontal clipping.
  - Tablet: Fluid 2×2 grid wrapping without text collisions.
  - Mobile: Single-column clean stacking.
  - Large currency figures (e.g. `₹1,24,50,000`) render cleanly with zero overflow or line break artifacts.

### 2.2 Accounts Directory Table Acceptance Criteria (Figma 45:259, 1269:563, 684:17474)
- [x] **Container & Elevation**:
  - Outer container uses `1px solid var(--color-border-subtle)` (`#E7E5E1`), small radius `var(--radius-xs)` (`4px`), and soft shadow (`shadow-xs`).
  - Table wrapper provides accessible scroll region: `role="region" aria-label="Accounts directory table" tabIndex={0}` with visible focus ring.
- [x] **Header Geometry & Typography (Figma 45:259)**:
  - Header height: exactly `44px` (`h-11 min-h-[44px]`), background `var(--color-bg-canvas)` (`#FAFAF9`), bottom divider `1px solid var(--color-border-subtle)` (`#E7E5E1`).
  - Header typography: Geist Sans `11px / 16px`, font weight `600`, color `var(--color-fg-muted)` (`#706A63`), letter spacing `0.04em` (`tracking-[0.04em]`).
  - Column headers in Title Case: `Account Name`, `Type`, `Industry`, `Status`, `Contacts`, `Deals`, `Last Updated`, `Actions` (no all-caps).
  - Header alignment strictly matches data alignment (Contacts, Deals, Actions centered; others left-aligned).
- [x] **Body Rows & Cells (Figma 45:259)**:
  - Row height: standard `44px` (`h-11 min-h-[44px]`), background `var(--color-bg-surface)` (`#FFFFFF`), horizontal padding `10px` (`px-2.5`), vertical centering.
  - Body text: Geist Sans `13px / 18px`, font weight `500`, color `var(--color-fg-default)` (`#141414`).
  - Subtle horizontal divider: `1px solid var(--color-border-subtle)` (`#E7E5E1`). Zero vertical gridlines or zebra stripes.
  - Hover state: restrained subtle tint `hover:bg-[var(--color-bg-subtle)]/60` without vertical shift.
  - Column percentage allocations: Account Name ~32%, Type ~10%, Industry ~14%, Status ~9%, Contacts ~6%, Deals ~6%, Last Updated ~12%, Actions ~11%.
  - Account name cell: Building outline icon (`Building2`, 16px, muted) + 8px gap (`gap-2`) + semibold link (`text-[13px] font-semibold text-[var(--color-primary-600)] hover:underline truncate`).
- [x] **Badges & Actions**:
  - Status badge: height `20px` (`h-5`), Geist Sans `12px / 16px`, weight `500`, `radius/full` (`rounded-full`), padded `2px` vertical / `8px` horizontal (`px-2 py-0.5`).
  - Row action targets: clickable `32 × 32px` buttons (`h-8 w-8 p-0`), 16px outline icons (`h-4 w-4`). Edit: ghost muted; Delete/Archive: destructive ghost. Accessible labels `Edit account {name}` and `Delete account {name}` with visible focus rings.
- [x] **Stacked Mobile Table (Figma 1269:563)**:
  - Viewports `< 768px` render stacked record cards with account link, status badge, 2-column detail grid, and 32px action buttons.
  - Zero horizontal page overflow (`scrollWidth === window.innerWidth`).
- [x] **Accessibility (WCAG 2.1 AA)**:
  - 0 Axe violations across Desktop Light, Desktop Dark, Tablet, and Mobile.
  - Label-in-Name (WCAG 2.5.3) compliant action labels.

### 2.3 Opportunities Kanban Board Acceptance Criteria (Figma 686:2, 678:179, 2781:38110)
- [x] **Board Column Geometry & Surface (Figma 686:2)**:
  - Column width: `352px` fixed desktop reference (`w-[352px] min-w-[352px] shrink-0`), inner content width `328px`.
  - Column radius: `12px` (`var(--radius-lg)`), padding `12px` (`p-3`), vertical card gap `10px` (`gap-2.5`).
  - Column surface: `var(--color-bg-canvas)` (`#FAFAF9`), border `1px solid var(--color-border-subtle)` (`#E7E5E1`), soft elevation `shadow-xs`.
  - Column height aligned across board (`min-h-[480px]`), content-driven growth with clean min-height drop zone.
- [x] **Stage Column Header (Figma 686:2)**:
  - Height: `32px` (`h-8`), horizontal flex, centered vertically.
  - Left side: 8 × 8px stage-color dot, 14px / 20px stage name at weight `600`, neutral count badge (`12px / 16px`, weight 500, `bg/subtle`, `fg/muted`, full-pill radius).
  - Right side: right-aligned stage monetary total in INR, tabular numerals, visually secondary.
  - 8px gap between dot, label, and count badge. No saturated header backgrounds.
- [x] **Board Card Default (Figma 678:179)**:
  - Surface: `var(--color-bg-surface)` (`#FFFFFF`), border `1px solid var(--color-border-subtle)` (`#E7E5E1`), radius `12px` (`var(--radius-lg)`), padding `12px` (`p-3`), vertical gap `8px`.
  - Card dimensions: ~328 × 149px reference size, content-driven height.
  - Content hierarchy:
    1. Opportunity title: Geist Sans `14px / 20px`, weight `600`, foreground `var(--color-fg-default)`, 2-line clamp without clipping.
    2. Account name: Geist Sans `13px / 18px`, weight `500`, muted foreground, 14px `Building2` icon with 8px gap.
    3. Value & close date: 13px weight 600 tabular amount and 12px muted date with 13px `Calendar` icon on same row.
    4. Action footer: 1px top divider (`var(--color-border-subtle)`), subordinate `Mark Lost` destructive text action, 32px `Next` outline button with 8px radius.
    5. Closed stages: 32px `Reopen` ghost action button.
- [x] **Interactive States & Drag-and-Drop (Figma 2781:38110)**:
  - Default: white surface with subtle border and shadow.
  - Hover: restrained border refinement (`hover:border-[var(--color-border-default)] hover:shadow-sm`).
  - Dragging: reduced opacity, elevated appearance, pointer feedback (`cursor-grab active:cursor-grabbing`).
  - Drop Target (Figma 2781:38110): visible 2px dashed outline, `bg/subtle` / tinted lane background, primary accent ring.
- [x] **Horizontal Scrolling & Affordance**:
  - Single shared horizontal scroll container with subtle semantic scrollbar (`.sakani-kanban-scroll`).
  - 16px gap between columns (`gap-4`). End spacer prevents clipping of 7th column (`Closed Lost`).
  - Fully keyboard scrollable (`role="region" aria-label="Opportunities Kanban board" tabIndex={0}`).
  - Zero document-level horizontal overflow (`scrollWidth === window.innerWidth`).
- [x] **Business Invariants Preserved**:
  - All 7 stages preserved in exact order (`lead`, `qualified`, `solutioning`, `proposal`, `negotiation`, `won`, `lost`).
  - Live per-stage counts and totals preserved.
  - Validated stage transitions intact (Won close date, Lost reason dialogs).
  - 0 Axe-core violations across Desktop Light, Dark, Tablet, and Mobile.

### 2.4 Opportunities Table View Acceptance Criteria (Figma 45:259, 684:17474, 16:103, 8:132)
- [x] **Container & Header Geometry (Figma 45:259)**:
  - Outer container uses `1px solid var(--color-border-subtle)` (`#E7E5E1`), radius token `var(--radius-xs)` (`4px`), and soft `shadow-xs`.
  - Accessible scroll wrapper: `role="region" aria-label="Opportunities directory table" tabIndex={0}` with focus visible ring.
  - Header row height: `44px` (`h-11 min-h-[44px]`), background `var(--color-bg-canvas)` (`#FAFAF9`), border-bottom `1px solid var(--color-border-subtle)` (`#E7E5E1`).
  - Header typography: Geist Sans `11px / 16px`, font weight `600`, color `var(--color-fg-muted)` (`#706A63`), letter-spacing `0.04em`.
  - Headers in Title Case: `Opportunity`, `Stage`, `Est. Value`, `Probability`, `Target Close`, `Owner`, `Actions` (no all-caps).
- [x] **Body Rows & Content-Driven Geometry**:
  - Row height: content-driven ~52–63px (`min-h-[52px]`) to comfortably accommodate 2-line title and subtitle without clipping.
  - Background `var(--color-bg-surface)` (`#FFFFFF`), horizontal padding `10px` (`px-2.5`), divider `1px solid var(--color-border-subtle)` (`#E7E5E1`).
  - Restrained hover: `hover:bg-[var(--color-bg-subtle)]/60`. Zero zebra striping or heavy vertical borders.
  - Opportunity title link: Geist Sans `13px / 18px`, weight `600`, foreground `var(--color-fg-default)` (`#141414`), hover primary, with 16px outline `Briefcase` icon.
  - Account subtitle: Geist Sans `12px / 16px`, weight `500`, muted foreground (`#78716A`), indented under title text.
- [x] **Stage Badges & Alignment (Figma 16:103)**:
  - Height: `20px` (`h-5`), Geist Sans `12px / 16px`, weight `500`, padding `2px` vertical / `8px` horizontal (`px-2 py-0.5`), radius `radius/full` (`rounded-full`).
  - Semantic subtle variants: `Lead` (info), `Qualified` (info), `Solutioning` (info), `Proposal` (warning), `Negotiation` (warning), `Won` (success), `Lost` (danger).
  - Numeric alignment: `Est. Value` and `Probability` right-aligned with monospace tabular numerals (`tabular-nums`). Headers match alignment.
- [x] **Standardized Actions Column (Figma 8:132)**:
  - Fixed-width alignment:
    - Open deals: 32px `Advance` outline button with 8px radius and right arrow + visually subordinate `Mark lost` destructive ghost button.
    - Closed deals: 32px `Reopen` outline button with 8px radius and `RotateCcw` icon at consistent start position.
- [x] **Stacked Mobile Table (Figma 1269:563)**:
  - Viewports `< 768px` render stacked record cards with opportunity title, account subtitle, stage badge, 2-column detail grid, and 32px actions.
  - 0 document-level horizontal overflow (`scrollWidth === window.innerWidth`).
- [x] **Accessibility & Workflow Safeguards**:
  - 0 Axe-core violations across Desktop Light, Desktop Dark, Tablet, and Mobile.
  - Stage transitions strictly enforce validation dialogs (`StageTransitionDialog`, Won close date, Lost reason).

### 2.5 Tasks Table Acceptance Criteria (Figma 45:259, 684:17474, 16:103, Tabs)
- [x] **Tabs & Toolbar Geometry (Figma 684:17474 & Tabs)**:
  - Canonical saffron active line (`border-b-2 border-[var(--color-primary-500)]`), Geist Sans 13px / 18px weight 500, muted inactive tabs.
  - 32px search input (`h-8 text-xs`) and 32px All Priorities selector (`Select size="sm"`).
  - 16px vertical gap between toolbar and table.
- [x] **Table Shell & Header (Figma 45:259)**:
  - Container: 4px radius (`var(--radius-xs)`), 1px border `var(--color-border-subtle)` (`#E7E5E1`), and soft `shadow-xs`.
  - Accessible scroll wrapper: `role="region" aria-label="Tasks directory table" tabIndex={0}`.
  - Header: 44px height (`h-11 min-h-[44px]`), background `var(--color-bg-canvas)` (`#FAFAF9`), border-bottom `1px solid var(--color-border-subtle)`.
  - Header typography: Geist Sans `11px / 16px`, font weight `600`, color `var(--color-fg-muted)` (`#706A63`), letter-spacing `0.04em`.
  - Title Case headers: `Completion`, `Action Item`, `Priority`, `Due Date`, `Related Account`, `Related Deal`, `Assignee`, `Actions`.
- [x] **Body Rows & Content-Driven Proportions**:
  - Content-driven row height (~60–90px) without clipping 2-line action-item titles/descriptions or related-record links.
  - 1px `border/subtle` divider; no zebra stripes; subtle row hover (`var(--color-bg-subtle)`).
- [x] **Priority & Overdue Independence**:
  - High priority rendered with Warning/Subtle badge (`#FEF0C7` / `#B54708`).
  - Normal and Low priorities rendered with Neutral/Subtle badges (`#F5F4F2` / `#78716A`).
  - Overdue items receive a dedicated Danger/Subtle badge (`#FEE4E2` / `#B42318`) alongside readable date text in contrast-safe default foreground (`#141414`).
- [x] **Related Record Links**:
  - Contrast-safe `fg/default` (`#141414`) text, canonical saffron hover underline, 16px building/briefcase icons with 8px text gap.
  - 18% column widths allowing long account and deal names to wrap across two lines.
- [x] **Completion & Action Controls**:
  - Centered completion toggle with 32 × 32px hit target and accessible `Mark task {title} as completed` label.
  - Centered 32 × 32px edit ghost button with accessible `Edit task {title}` label.
  - 10-second undo toast with backend version locking.
- [x] **Responsive & Mobile Viewports**:
  - Desktop: Full 8-column layout.
  - Tablet: Table-local horizontal scrolling with accessible focus ring.
  - Mobile: Stacked record cards with 0 horizontal page overflow.
- [x] **Accessibility & Testing**:
  - 0 Axe-core violations across Desktop Light, Desktop Dark, Tablet, and Mobile.
  - All 72 Vitest unit tests and 9 Playwright CRM E2E tests passing.

### 2.7 Settings Area & Administrative Security Conformance
- [x] **Information Architecture & Navigation**:
  - Relocate session, organization, and permissions from `/app/dashboard` into dedicated `/app/settings` hub.
  - Multi-destination subnavigation (`Overview`, `Organization`, `Security & Access`) using Sakani responsive navigation card and mobile pill navigation.
  - Future areas (`Users & Roles`, `Preferences`, `Notifications`, `Integrations`) documented cleanly without fake forms or inert controls.
- [x] **Organization Context Conformance (Figma 1624:29249)**:
  - Account Overview card geometry (`--radius-xl`, 40px icon tile, header with mono slug chip).
  - Authoritative read-only presentation of organization name, slug, operational currency (`INR`), and timezone (`Asia/Kolkata`).
  - Enterprise tenant governance notice.
- [x] **Profile & Security Conformance (Figma 1628:29382)**:
  - Profile Settings card with 40px shield icon tile, Geist bold display name, email, Neutral/Subtle role badge, Success/Subtle `Session verified` badge, and functional Sign Out button.
  - Domain-grouped permissions card for all 16 canonical permissions across 7 domains with neutral pill chips.
- [x] **Accessibility & Verification**:
  - 0 Axe-core violations across Desktop Light, Desktop Dark, Tablet, and Mobile across all 3 settings routes.
  - All 76 Vitest unit tests and 9 Playwright CRM E2E tests passing.

### 2.8 Dashboard Operational Analytics Conformance (Figma 1290:22116, 1290:21238)
- [x] **Section Placement & Hierarchy**:
  - Positioned immediately beneath Opportunity Stage Distribution and Attention Required row.
  - Section header: Geist Sans 16px / 22px weight 600 title (`Operational Analytics`), 13px / 18px muted subtitle (`RFQ resolution, quotation governance, and upcoming work.`).
  - Balanced 3-column desktop layout (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`), tablet 2-column wrapping, and mobile single-column stacking.
- [x] **Chart A — RFQ Match Health (Figma Donut Chart with Text 1290:22116)**:
  - Recharts Donut (`PieChart`, `Pie`, `Cell`, `Tooltip`) with inner radius 62px, outer radius 84px, and centered total metric typography (`117` in 24px bold, `Total Lines` in 10px muted uppercase).
  - Exact tenant partitioning: `Exact Match` (20, 17.1%), `Partially Matched` (66, 56.4%), `Needs Review` (28, 23.9%), `Unmatched` (3, 2.6%). Sums exactly to 117 RFQ lines.
  - Saffron/chart token palette: `--color-chart-2` (green/saffron), `--color-chart-1` (saffron), `--color-chart-4` (amber), `--color-danger-fg` (red).
  - Accessible legend with color swatches, counts, and percentages.
  - Tabular alternative toggle conforming to WCAG 2.5.3 (`aria-label="{showTable ? 'Switch to Chart view' : 'Switch to Table view'}"`).
- [x] **Chart B — Quotation Lifecycle (Figma Horizontal Bar Chart 1290:21238)**:
  - Horizontal progress bar composition: `Draft` (1), `In Review / Pending` (1), `Approved` (2), `Rejected` (0), `Expired` (0). Sums exactly to 4 tenant quotes.
  - Proportional bar widths calculated relative to total quotes.
  - Neutral badge pill for zero-count states (`None`) preventing visual ambiguity.
  - Tabular view toggle with complete column metadata.
- [x] **Chart C — Task Due-Date Load (Horizontal Urgency Bar Chart)**:
  - Urgency distribution based on organization timezone (`Asia/Kolkata`): `Overdue` (4), `Due Today` (1), `Next 7 Days` (6), `Later` (0). Sums exactly to 11 open tasks.
  - `Overdue` count (4) matches executive KPI `overdue_tasks_count = 4` with 100% mathematical consistency.
  - Semantic warning/danger tokens: Overdue (`--color-danger-fg`), Due Today (`--color-warning-fg`), Next 7 Days (`--color-chart-1`), Later (`--color-fg-muted`).
  - Tabular view toggle with count and share breakdown.
- [x] **Stage Chart Color Mapping Polish**:
  - Polished `STAGE_COLOR_MAP` across Opportunity Stage Distribution chart and breakdown table: `lead` (chart-2 / blue), `qualified` (chart-3 / teal), `solutioning` (chart-1 / saffron), `proposal` (chart-4 / purple), `negotiation` (chart-5 / gold), `won` (chart-6 / green), `lost` (danger red).
  - Synchronized table row color dot indicators matching bar chart `<Cell>` fills.
- [x] **Data Integrity & Pipeline Movement Deferral**:
  - 100% authentic database aggregations; zero hardcoded fake deltas or randomized values.
  - Deferral of optional `Pipeline Movement` chart documented: authoritative database contains only 4 historical stage change activity events without a point-in-time snapshot ledger, preventing reliable monthly trend derivation.
- [x] **Accessibility & Verification**:
  - 0 Axe-core violations across Desktop Light, Desktop Dark, Tablet, and Mobile.
  - 10/10 component unit tests passing; 86/86 full Vitest suite passing; 7/7 backend integration tests passing; 9/9 Playwright CRM E2E tests passing.

### 2.6 General Interactive Component States
For every interactive component across all routes:
- [ ] **Resting State**: Clean typography, correct padding, and visible boundary borders.
- [ ] **Hover State**: Smooth background transition (`var(--color-bg-subtle)`) without layout shifts.
- [ ] **Focus State**: Visible, accessible focus ring using `var(--color-border-focus)` (`#FF4700`) complying with WCAG 2.4.7.
- [ ] **Active / Pressed State**: Tactile feedback using darker active background (`var(--color-neutral-200)`).
- [ ] **Disabled State**: Reduced opacity (`0.5`), cursor `not-allowed`, and explicit `aria-disabled="true"`.
- [ ] **Loading State**: Subtle animated pulse skeleton (`Skeleton`) matching the exact geometry of the loading content.
- [ ] **Empty State**: Clear empty state container with icon, descriptive title, explanatory text, and optional primary CTA.

---

## 3. Responsive & Multi-Viewport Parity

Every screen must be verified across the three standard viewport dimensions:
- [ ] **Desktop (`1440 × 900`)**: Full layout with expanded 248px sidebar, multi-column metric grids, and unclipped data tables.
- [ ] **Tablet (`1024 × 768`)**: Fluid layout with responsive grid wrapping, collapsed icon rail or drawer, and horizontal table scrolling where necessary.
- [ ] **Mobile (`390 × 844`)**: Single-column vertical flow, slide-over navigation drawer with backdrop scrim, stacked action buttons, and touch-friendly targets ($\ge 44\text{px}$).
- [ ] **Root-Cause Overflow Correction**: Unintended horizontal overflow must be diagnosed and resolved at the individual flex/grid item and container level; blanket `overflow-x: hidden` hacks on the document root are strictly prohibited.

---

## 4. Accessibility Compliance (WCAG 2.1 AA)

- [ ] **Axe-core Automated Scans**: **0 violations** reported by `@axe-core/playwright` across all primary views, slide-over sheets, and modal decision dialogs.
- [ ] **Color Contrast Ratios**:
  - Normal text ($\ge 4.5:1$ against surface background).
  - Large text ($\ge 3.0:1$ against surface background).
  - Essential UI components and graphical objects ($\ge 3.0:1$ against adjacent colors).
- [ ] **Keyboard Navigation**: Complete tab order traversal through all interactive elements; ESC dismisses all open modals and slide-over sheets.
- [ ] **Accessible Names (WCAG 2.5.3)**: All icon-only buttons include descriptive `aria-label` or `title` attributes matching visible text or tooltips.

---

## 5. Non-Negotiable Business & Security Invariants

All automated test gates must pass with zero regression:
- [ ] **Calculations**: `uv run pytest tests/unit/test_quote_domain.py` passes 10/10 tests, guaranteeing `ROUND_HALF_UP` Decimal formulas.
- [ ] **Maker-Checker Security**: Proposers cannot approve their own change proposals at both UI and authoritative API boundary.
- [ ] **Fail-Closed Exports**: `GET /api/v1/quotes/{unapprovedId}/export/pdf` returns `HTTP 409 Conflict`.
- [ ] **Watermark Integrity**: Draft PDFs render conspicuous diagonal watermarks on every page.
- [ ] **Relational Database Forensics**: `make verify-audit` satisfies **9/9 checks** against active PostgreSQL database records.

---

## 6. Verification & Sign-Off Protocol

Every implementation batch must provide:
1. Automated test run outputs (TypeScript, ESLint, Vitest, Pytest, Playwright).
2. Multi-viewport screenshot captures (`1440×900`, `1024×768`, `390×844`).
3. Machine-readable verification JSON report.
4. Non-blocking Figma references cataloged for future edge cases without impeding current implementation.
