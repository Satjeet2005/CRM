import {
  LayoutDashboard,
  Building2,
  Users,
  Briefcase,
  CheckSquare,
  FileSpreadsheet,
  FileText,
  Boxes,
  ClipboardCheck,
  History,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  section: "Workspace" | "Quoting" | "Administration";
  /**
   * Phase indicator for progressive implementation.
   * Only items with enabled: true appear as navigable links in the shell.
   */
  phase: number;
  enabled: boolean;
  /** Required permission or role check */
  requiredPermission?: string;
  requiredRole?: string[];
  badgeCountKey?: string;
}

/**
 * Feature Registry for ForgeFlow Navigation.
 *
 * HOW NEXT AGENTS ENABLE MODULES:
 * To enable a module when implementing its phase (e.g. Phase 2 CRM, Phase 3 RFQs):
 * 1. Build the corresponding page in `frontend/app/(workspace)/<module>/page.tsx`.
 * 2. Flip `enabled: true` for the item in this registry.
 * 3. Never render broken dead-end links.
 */
export const NAVIGATION_REGISTRY: NavItem[] = [
  // Workspace section
  {
    id: "dashboard",
    label: "Overview",
    href: "/app/dashboard",
    icon: LayoutDashboard,
    section: "Workspace",
    phase: 1,
    enabled: true, // Enabled in Foundation Phase 1
  },
  {
    id: "accounts",
    label: "Accounts",
    href: "/app/accounts",
    icon: Building2,
    section: "Workspace",
    phase: 2,
    enabled: true,
    requiredPermission: "crm:read",
  },
  {
    id: "contacts",
    label: "Contacts",
    href: "/app/contacts",
    icon: Users,
    section: "Workspace",
    phase: 2,
    enabled: true,
    requiredPermission: "crm:read",
  },
  {
    id: "opportunities",
    label: "Opportunities",
    href: "/app/opportunities",
    icon: Briefcase,
    section: "Workspace",
    phase: 2,
    enabled: true,
    requiredPermission: "crm:read",
  },
  {
    id: "tasks",
    label: "Tasks",
    href: "/app/tasks",
    icon: CheckSquare,
    section: "Workspace",
    phase: 2,
    enabled: true,
    requiredPermission: "crm:read",
  },

  // Quoting section
  {
    id: "rfqs",
    label: "RFQs",
    href: "/app/rfqs",
    icon: FileSpreadsheet,
    section: "Quoting",
    phase: 3,
    enabled: true,
    requiredPermission: "rfq:read",
  },
  {
    id: "catalog",
    label: "Catalog",
    href: "/app/catalog",
    icon: Boxes,
    section: "Quoting",
    phase: 2,
    enabled: true,
    requiredPermission: "catalog:read",
  },
  {
    id: "quotes",
    label: "Quotations",
    href: "/app/quotes",
    icon: FileText,
    section: "Quoting",
    phase: 4,
    enabled: true,
    requiredPermission: "quotes:read",
  },
  {
    id: "approvals",
    label: "Reviews & Approvals",
    href: "/app/approvals",
    icon: ClipboardCheck,
    section: "Quoting",
    phase: 5,
    enabled: true, // Enabled in Phase 5
    requiredPermission: "proposals:approve",
    badgeCountKey: "pendingApprovals",
  },

  // Administration section
  {
    id: "activity",
    label: "Activity & Audit",
    href: "/app/activity",
    icon: History,
    section: "Administration",
    phase: 2,
    enabled: true,
    requiredPermission: "audit:read",
  },
  {
    id: "settings",
    label: "Settings",
    href: "/app/settings",
    icon: Settings,
    section: "Administration",
    phase: 2,
    enabled: true,
  },
];
