# ForgeFlow × Sakani — Settings Information Architecture

This document defines the authoritative Settings information architecture for ForgeFlow Enterprise CPQ, mapped against the Sakani design language (`Profile Settings 1628:29382`, `Account Overview 1624:29249`, `Tags 1618:29197`, `Badge 16:103`).

---

## 1. Governance & Security Policy

1. **Authoritative Context Binding**:
   Settings reflect live session state retrieved from `/api/v1/auth/me`. The frontend never mocks, guesses, or fabricates organization metadata or user permissions.
2. **Access Control & RBAC**:
   Users can only view metadata and permissions granted to their active session context. Access guards (`settings:manage`, `users:manage`, `audit:read`) are strictly enforced at the API gateway boundary.
3. **No Inert Controls**:
   No toggle switches, save buttons, or edit forms are rendered unless a functional, persistent backend API endpoint (`PATCH` / `PUT`) and validation pipeline exist. Unimplemented modules remain documented as future architecture rather than misleading dead-end controls.

---

## 2. Comprehensive Module Matrix

| Module / Area | Purpose | Existing Route & API Support | Required Permission | Implementation Status | Safe to Expose in Settings Nav Now? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Settings Overview** | High-level summary of active organization context, authenticated session status, and quick links to configuration sub-areas. | Route: `/app/settings`<br>API: `/api/v1/auth/me` | Authenticated session | **Implemented** (Phase 2) | **Yes** — Primary entry point. |
| **Organization Settings** | Authoritative multi-tenant organization metadata: legal tenant name, slug, operational CPQ currency, and timezone. | Route: `/app/settings/organization`<br>API: `/api/v1/auth/me` (`user.organization`) | Authenticated session | **Implemented (Read-Only)**<br>Read-only configuration; enterprise provisioning path. | **Yes** — Safe read-only context. |
| **Security & Access** | Current authenticated session identity, role assignment verification, and complete functional domain-grouped RBAC permissions ledger. | Route: `/app/settings/security`<br>API: `/api/v1/auth/me`, `/api/v1/auth/logout` | Authenticated session | **Implemented** (Phase 2)<br>Read-only permissions ledger + secure logout. | **Yes** — Safe session & permissions ledger. |
| **Users & Roles** | Multi-user tenant administration: user invitations, role assignment (`sales_rep`, `sales_manager`, `catalog_manager`, `admin`), and session deactivation. | Existing API: None<br>Proposed API: `/api/v1/users`, `/api/v1/roles` | `users:manage` | **Future Architecture**<br>Requires Phase 9 enterprise IAM engine. | **No** — Do not introduce inert user tables or fake invite dialogs. |
| **Preferences** | User-specific workspace preferences: theme persistence, numeric formatting conventions, density modes, and table pagination defaults. | Existing API: Client-side theme (`useTheme`)<br>Proposed API: `/api/v1/users/me/preferences` | Authenticated session | **Future Architecture**<br>Theme currently managed via header toggle; backend persistence pending. | **No** — Avoid non-persisting switches. |
| **Notifications** | Alert routing and subscription rules for quote approvals, RFQ assignments, and overdue task escalations. | Existing API: None<br>Proposed API: `/api/v1/notifications/rules` | Authenticated session | **Future Architecture**<br>Requires webhook & email notification service. | **No** — Do not render fake email/SMS toggles. |
| **Integrations** | External ERP (SAP / NetSuite), CAD/PLM, and export ledger webhooks. | Existing API: None<br>Proposed API: `/api/v1/integrations` | `settings:manage` | **Future Architecture**<br>Requires Phase 10 integration connectors. | **No** — Avoid unbacked API key forms. |
| **Audit & Activity** | Cryptographic delivery trail, stage transitions, and tenant security audit logs. | Route: `/app/activity`<br>API: `/api/v1/activity` | `audit:read` | **Implemented as Dedicated Module**<br>Accessible directly via global sidebar navigation. | **Cross-Link Only** — Linked from Security & Access documentation; not duplicated in Settings subnav. |

---

## 3. Visual & Component Mapping

### 3.1 Subnavigation Layout
- **Desktop (`1440 × 900`)**: Compact 240px left column (`w-full md:w-60 shrink-0`) using Sakani Card container (`border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] rounded-[var(--radius-xl)]`).
- **Active Tab Styling**: Saffron accent bar (`border-l-2 border-[var(--color-primary-500)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)] font-semibold`).
- **Inactive Tab Styling**: Muted foreground (`text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg-default)]`).
- **Tablet / Mobile (`< 768px`)**: Horizontal pill navigation with responsive overflow scroll and touch-friendly targets ($\ge 36\text{px}$).

### 3.2 Organization Context (`Account Overview 1624:29249`)
- 40px icon tile with `Building2` icon.
- Two-column metadata grid on desktop; vertical stacking on mobile.
- Labeled values: Organization Name, Tenant Slug, Operational Currency, Workspace Timezone.
- Informational enterprise governance notice.

### 3.3 Security & Access (`Profile Settings 1628:29382` & `Badge 16:103`)
- Compact identity card with 40px icon tile, Geist 16px/22px bold name, 13px/18px muted email, Neutral/Subtle role badge, and Success/Subtle `Session verified` badge.
- Functional domain-grouped permissions grid:
  - `Audit`: `audit:read`
  - `Catalog`: `catalog:cost`, `catalog:manage`, `catalog:read`
  - `CRM`: `crm:read`, `crm:write`
  - `Proposals`: `proposals:approve`, `proposals:create`
  - `Quotes`: `quotes:draft`, `quotes:export`, `quotes:read`
  - `RFQ`: `rfq:import`, `rfq:read`, `rfq:resolve`
  - `Administration`: `settings:manage`, `users:manage`
- Fully rounded pill chips (`rounded-[var(--radius-full)] bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)]`).

---

## 4. Accessibility Compliance (WCAG 2.1 AA)

- Semantic HTML (`<nav aria-label="Settings navigation">`, `<main>`, `<h2>`, `<label>`).
- Visible keyboard focus rings (`focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)]`).
- Verified color contrast ratios exceeding 4.5:1 across all light and dark tokens.
- **Zero Axe-core violations** verified across Desktop Light, Desktop Dark, Tablet, and Mobile viewports.
