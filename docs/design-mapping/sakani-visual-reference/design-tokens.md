# Sakani Design Tokens Specification

All design tokens listed below are verified directly from **Sakani UI v0.9.0** (`@sakaniui/react`), the `sakaniui` MCP tool (`get_tokens`), and the live Sakani CRM demo repository (`/tmp/saas-crm-sakani-ds/src/vendor-sakani-tokens.css`).

---

## 1. Typography & Hierarchy

Sakani standardizes on the **Geist** font family (`@fontsource-variable/geist`), providing clean neo-grotesque legibility across technical dashboards and enterprise tabular data.

### Font Families
| Token | Value | Source / Verification |
| :--- | :--- | :--- |
| `--font-sans` | `"Geist Variable", "Geist", system-ui, -apple-system, sans-serif` | Verified via `@sakaniui/react` MCP `get_tokens(font)` |
| `--font-mono` | `"Geist Mono Variable", "Geist Mono", ui-monospace, monospace` | Verified via `@sakaniui/react` MCP `get_tokens(font)` |

### Typography Scale & Rhythms
| Level | Font Size | Line Height | Font Weight | Letter Spacing | Sakani Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display 2XL** | `36px` (`2.25rem`) | `44px` (`1.22`) | `700` (Bold) | `-0.02em` | Marketing headings, primary KPIs |
| **Display XL** | `30px` (`1.875rem`)| `38px` (`1.26`) | `700` (Bold) | `-0.02em` | Modal titles, hero metrics |
| **Heading LG** | `24px` (`1.5rem`) | `32px` (`1.33`) | `600` (SemiBold) | `-0.015em`| Page titles, main workspace headers |
| **Heading MD** | `20px` (`1.25rem`)| `28px` (`1.40`) | `600` (SemiBold) | `-0.01em` | Section headers, sheet titles |
| **Heading SM** | `16px` (`1.0rem`) | `24px` (`1.50`) | `600` (SemiBold) | `-0.005em`| Panel / Card titles (`.title`) |
| **Body MD** | `14px` (`0.875rem`)| `20px` (`1.43`) | `400` / `500` | `0` | Standard body, table data cells |
| **Body SM** | `13px` (`0.8125rem`)| `18px` (`1.38`)| `500` (Medium) | `0` | Panel descriptions (`.description`) |
| **Caption / Label**| `12px` (`0.75rem`)| `16px` (`1.33`) | `500` / `600` | `0.01em` | Badge text, chart labels, legend |
| **Overline / Mono**| `10px` / `11px` | `14px` (`1.27`) | `700` (Bold) | `0.05em` | Table column headers, revision tags |

---

## 2. Color System

Sakani uses a dual-layer palette: primitive numeric scales (`50`–`950`) mapped to semantic intent aliases for light (`:root`) and dark (`.dark`) modes.

### 2.1 Primary Brand Accent (Canonical Sakani Saffron)
The visual-conformance pass adopts **canonical Sakani saffron** as the primary interactive and brand accent, superseding earlier hybrid enterprise indigo directions:

| Token | Hex Value | Role / Usage |
| :--- | :--- | :--- |
| `--color-primary-50` | `#FFF3ED` | Brand subtle fill / light badge background |
| `--color-primary-100`| `#FFE4D4` | Hover tint for subtle brand containers |
| `--color-primary-200`| `#FFC7A8` | Light brand border |
| `--color-primary-300`| `#FFA170` | Brand border hover |
| `--color-primary-400`| `#FF7538` | Interactive active states |
| **`--color-primary-500`**| **`#FF4700`** | **Primary brand accent, main CTAs, active sidebar bar** |
| `--color-primary-600`| `#E63D00` | Primary button hover |
| `--color-primary-700`| `#BF3200` | Primary button active / pressed |
| `--color-primary-800`| `#99290A` | Deep brand text |
| `--color-primary-900`| `#7D250D` | High-contrast dark brand accent |
| `--color-primary-950`| `#431004` | Darkest brand shade |

### 2.2 Neutral Palette (Warm Stone Scale)
| Token | Light Hex | Dark Hex | Role / Semantic Mapping |
| :--- | :--- | :--- | :--- |
| `--color-neutral-50` | `#FAFAF9` | `#0F0E0C` | Light Canvas Background (`--color-bg-canvas`) |
| `--color-neutral-100`| `#F5F4F2` | `#141414` | Subtle Background / Hover Fill (`--color-bg-subtle`) |
| `--color-neutral-200`| `#E7E5E1` | `#1F1F1F` | Subtle Border / Divider (`--color-border-subtle`) |
| `--color-neutral-300`| `#DBDAD7` | `#3A3837` | Default Component Border (`--color-border-default`) |
| `--color-neutral-400`| `#A8A29B` | `#57534E` | Subtle Foreground / Placeholder (`--color-fg-subtle`) |
| `--color-neutral-500`| `#78716A` | `#78716A` | Muted Secondary Foreground (`--color-fg-muted`) |
| `--color-neutral-600`| `#57534E` | `#A8A29B` | Icon / Secondary Controls |
| `--color-neutral-700`| `#3A3837` | `#DBDAD7` | Strong Body Text |
| `--color-neutral-800`| `#1F1F1F` | `#E7E5E1` | Deep Text / Dark Accents |
| `--color-neutral-900`| `#141414` | `#F5F4F2` | Primary Foreground Text (`--color-fg-default`) |
| `--color-neutral-950`| `#0F0E0C` | `#FAFAF9` | Darkest Canvas / Contrast Layer |

### 2.3 Semantic Status Palette (Preserved)
| Semantic Group | Scale Base (500) | Subtle BG (50) | Border (200) | Dark FG (700) | Meaning / Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Success** | `#12B76A` | `#F1FEF6` | `#A6F4C5` | `#027A48` | Approved quotes, positive deltas, valid RFQs |
| **Warning** | `#F79009` | `#FFFBF0` | `#FEDF89` | `#B54708` | Draft locks, pending approvals, policy flags |
| **Danger** | `#F04438` | `#FEF3F2` | `#FECDCA` | `#B42318` | Rejections, expired quotes, error alerts |
| **Info** | `#2E90FA` | `#EFF8FF` | `#B2DDFF` | `#175CD3` | Informational callouts, active filters |

### 2.4 Semantic Surface & Border Aliases
```css
/* Light Mode Aliases (:root) */
--color-bg-canvas: var(--color-neutral-50);        /* #FAFAF9 - Outer window canvas */
--color-bg-surface: var(--color-base-white);       /* #FFFFFF - TopBar, Page, and Cards */
--color-bg-subtle: var(--color-neutral-100);       /* #F5F4F2 - Table headers, hover rows */
--color-bg-muted: var(--color-neutral-200);        /* #E7E5E1 - Skeleton fillers */
--color-fg-default: var(--color-neutral-900);      /* #141414 - High contrast text */
--color-fg-muted: var(--color-neutral-500);        /* #78716A - Secondary descriptions */
--color-fg-subtle: var(--color-neutral-400);       /* #A8A29B - Placeholders, timestamps */
--color-border-subtle: var(--color-neutral-200);   /* #E7E5E1 - Card & panel borders */
--color-border-default: var(--color-neutral-300);  /* #DBDAD7 - Interactive input borders */
--color-border-strong: var(--color-neutral-400);   /* #A8A29B - Focused outline bounds */
--color-border-focus: var(--color-primary-500);    /* #FF4700 - Focus rings */
--color-brand-default: var(--color-primary-500);   /* #FF4700 - Primary brand button */
--color-brand-hover: var(--color-primary-600);     /* #E63D00 - Brand hover */
--color-brand-subtle: var(--color-primary-50);     /* #FFF3ED - Brand subtle tint */
--color-brand-fg: var(--color-primary-600);        /* #E63D00 - Brand text */
```

### 2.5 Data Visualization & Charts
| Token | Color | Hex Value | Sakani Role |
| :--- | :--- | :--- | :--- |
| `--color-chart-1` | Saffron Orange | `#FF4700` | Primary series, Acquisition |
| `--color-chart-2` | Slate Blue | `#5B92DD` | Secondary series, Retention |
| `--color-chart-3` | Soft Teal | `#47A8A2` | Tertiary series, Marketplace |
| `--color-chart-4` | Muted Purple | `#9179D6` | Quaternary series, Mobile App |
| `--color-chart-5` | Warm Gold | `#DCA84F` | Quintary series, Retail |
| `--color-chart-6` | Emerald Green | `#12B76A` | Target / Benchmark line |

---

## 3. Spacing Scale

Sakani utilizes an explicit, pixel-locked spacing scale:
| Token | Computed | Tailwind Equivalent | Primary Usage |
| :--- | :--- | :--- | :--- |
| `--space-0` | `0px` | `p-0` / `gap-0` | Reset |
| `--space-2` | `2px` | `p-0.5` / `gap-0.5` | Icon-to-text micro gap, group items |
| `--space-4` | `4px` | `p-1` / `gap-1` | Inner button padding, badge horizontal |
| `--space-6` | `6px` | `p-1.5` / `gap-1.5` | Compact table cell vertical padding |
| `--space-8` | `8px` | `p-2` / `gap-2` | Standard button padding, input gap |
| `--space-10` | `10px` | `gap-2.5` | TopBar icon spacing |
| `--space-12` | `12px` | `p-3` / `gap-3` | Panel internal element spacing |
| `--space-14` | `14px` | `gap-3.5` | Dense grid spacing |
| `--space-16` | `16px` | `p-4` / `gap-4` | Card header padding, grid gap |
| `--space-20` | `20px` | `p-5` / `gap-5` | Page container padding (`.page`), Panel padding |
| `--space-24` | `24px` | `p-6` / `gap-6` | Major section gap |
| `--space-32` | `32px` | `p-8` / `gap-8` | Empty state vertical spacing |
| `--space-48` | `48px` | `p-12` / `gap-12` | Authentication card vertical margins |
| `--space-64` | `64px` | `p-16` / `gap-16` | Major section vertical rhythm |

---

## 4. Corner Radius Scale

Corner radii establish the organic, modern hierarchy characteristic of Sakani:
| Token | Value | Applied Component |
| :--- | :--- | :--- |
| `--radius-2xs` | `2px` | Micro-indicators, chart dots |
| `--radius-xs` | `4px` | Code blocks, status pills, tags |
| `--radius-sm` | `6px` | Badges, chips, small inputs (`--space-6`) |
| `--radius-md` | `8px` | Buttons, standard inputs, selects, dropdowns |
| `--radius-lg` | `12px` | Sub-panels, nested cards, inner dialog blocks |
| `--radius-xl` | `16px` | Content Panels (`Panel`), standard cards (`Card`) |
| `--radius-2xl` | `24px` | Modal dialogs, drawer panels |
| **`--radius-3xl`**| **`28px`** | **Page container top corners (`.page`)** |
| `--radius-full` | `9999px` | Avatars, toggle switches, pill badges |

---

## 5. Elevation & Box Shadows

Sakani employs soft, warm-tinted shadows based on `rgba(16, 15, 12, ...)`:
| Token | Shadow Value | Primary Component |
| :--- | :--- | :--- |
| `--shadow-xs` | `0 1px 2px 0 rgba(16,15,12,0.05)` | Buttons, standard input resting state |
| `--shadow-sm` | `0 1px 3px 0 rgba(16,15,12,0.10), 0 1px 2px 0 rgba(16,15,12,0.06)` | Page container (`.page`), StatCard hover |
| `--shadow-md` | `0 4px 8px -2px rgba(16,15,12,0.10), 0 2px 4px -2px rgba(16,15,12,0.06)`| Dropdown menus, popovers |
| `--shadow-lg` | `0 12px 16px -4px rgba(16,15,12,0.08), 0 4px 6px -2px rgba(16,15,12,0.03)`| Slide-over sheets (`Sheet`), flyouts |
| `--shadow-xl` | `0 20px 24px -4px rgba(16,15,12,0.10), 0 8px 8px -4px rgba(16,15,12,0.03)`| Modal dialogs, command palettes |

---

## 6. Layout Geometry & Responsive Breakpoints

Directly verified from `AppShell.module.css`:
- **Sidebar Desktop Expanded Width**: `248px` (`--sidebar-width`)
- **Sidebar Desktop Collapsed Width**: `64px` (`--sidebar-collapsed-width`, icon-rail mode)
- **TopBar Height**: `64px` (`--topbar-height`)
- **Mobile Drawer Breakpoint**: `<= 760px` (`MOBILE_QUERY`). Below this threshold, sidebar leaves normal document flow and behaves as an off-canvas slide-over drawer with a darkened backdrop scrim.
- **Main Page Canvas (`.page`)**:
  - `background: var(--color-bg-surface)` (`#FFFFFF`)
  - `border-top-left-radius: 28px`
  - `border-top-right-radius: 28px`
  - `box-shadow: var(--shadow-sm)`
  - `padding: 20px` (`--space-20`)
