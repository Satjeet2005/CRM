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
