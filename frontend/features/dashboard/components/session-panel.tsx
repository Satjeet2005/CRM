"use client";

import * as React from "react";
import { ShieldCheck, Building2, Key } from "lucide-react";
import { Card, Badge } from "@/components/sakani";
import type { AuthUser } from "@/hooks/use-auth";

export interface SessionPanelProps {
  user?: AuthUser | null;
}

export interface DomainGroup {
  key: string;
  label: string;
  permissions: string[];
}

const DOMAIN_DEFINITIONS: {
  key: string;
  label: string;
  matcher: (p: string) => boolean;
}[] = [
  {
    key: "audit",
    label: "Audit",
    matcher: (p) => p.startsWith("audit"),
  },
  {
    key: "catalog",
    label: "Catalog",
    matcher: (p) => p.startsWith("catalog"),
  },
  {
    key: "crm",
    label: "CRM",
    matcher: (p) => p.startsWith("crm"),
  },
  {
    key: "proposals",
    label: "Proposals",
    matcher: (p) => p.startsWith("proposal"),
  },
  {
    key: "quotes",
    label: "Quotes",
    matcher: (p) => p.startsWith("quote"),
  },
  {
    key: "rfq",
    label: "RFQ",
    matcher: (p) => p.startsWith("rfq"),
  },
  {
    key: "admin",
    label: "Administration",
    matcher: (p) =>
      p.startsWith("admin") ||
      p.startsWith("users") ||
      p.startsWith("settings"),
  },
];

export function formatRole(role?: string): string {
  if (!role) return "Sales Rep";
  const roleMap: Record<string, string> = {
    sales_rep: "Sales Rep",
    sales_manager: "Sales Manager",
    catalog_manager: "Catalog Manager",
    admin: "Admin",
  };
  return roleMap[role] || role.replace(/_/g, " ");
}

export function groupPermissions(permissions: string[] = []): DomainGroup[] {
  const groups: DomainGroup[] = [];
  const assigned = new Set<string>();

  for (const def of DOMAIN_DEFINITIONS) {
    const matching = permissions.filter((p) => def.matcher(p.toLowerCase()));
    if (matching.length > 0) {
      groups.push({
        key: def.key,
        label: def.label,
        permissions: [...matching].sort(),
      });
      matching.forEach((p) => assigned.add(p));
    }
  }

  // Any remaining permissions not covered by predefined domains
  const unassigned = permissions.filter((p) => !assigned.has(p));
  if (unassigned.length > 0) {
    groups.push({
      key: "other",
      label: "Other",
      permissions: [...unassigned].sort(),
    });
  }

  return groups;
}

export function SessionPanel({ user }: SessionPanelProps) {
  const permissions = React.useMemo(() => user?.permissions || [], [user?.permissions]);
  const permissionsCount = permissions.length;
  const groups = React.useMemo(() => groupPermissions(permissions), [permissions]);

  const organization = {
    name: user?.organization?.name || "ForgeFlow Demo Manufacturing",
    slug: user?.organization?.slug || "forgeflow-demo",
    currency: user?.organization?.currency || "INR",
    timezone: user?.organization?.timezone || "Asia/Kolkata",
  };

  const displayName = user?.display_name || "Sarah Sales";
  const email = user?.email || "sales@forgeflow.demo";
  const role = user?.role || "sales_rep";

  return (
    <Card data-slot="session-panel" className="p-5 border-[var(--color-border-default)] shadow-xs">
      {/* Identity Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Left: 40px shield/session icon tile + User display name & email */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] text-[var(--color-primary-600)] dark:border-[var(--color-primary-800)] dark:bg-[var(--color-primary-950)]/40 dark:text-[var(--color-primary-400)]">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex flex-col justify-center">
            <h2 className="text-base font-semibold leading-[22px] text-[var(--color-fg-default)] truncate">
              {displayName}
            </h2>
            <p className="text-[13px] font-medium leading-[18px] text-[var(--color-fg-muted)] mt-0.5 truncate">
              {email}
            </p>
          </div>
        </div>

        {/* Right: Neutral/Subtle role badge + Success/Subtle session status badge */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Badge variant="neutral" emphasis="subtle">
            {formatRole(role)}
          </Badge>
          <Badge variant="success" emphasis="subtle">
            Session verified
          </Badge>
        </div>
      </div>

      {/* Subtle Horizontal Divider */}
      <div className="border-t border-[var(--color-border-subtle)] my-5" />

      {/* Content Body: Split into Two Responsive Sections */}
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
        {/* Left Section: Organization Context (roughly 35-40% width on desktop) */}
        <div className="w-full lg:w-[38%] shrink-0 space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[var(--color-fg-muted)] shrink-0" aria-hidden="true" />
            <h3 className="text-sm font-semibold leading-5 text-[var(--color-fg-default)]">
              Organization context
            </h3>
          </div>

          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)]/30 p-4 space-y-4">
            {/* Labeled row: Tenant name and slug together */}
            <div className="space-y-1">
              <span className="text-xs font-medium leading-4 text-[var(--color-fg-muted)]">
                Tenant
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium leading-5 text-[var(--color-fg-default)]">
                  {organization.name}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-mono font-medium rounded-[var(--radius-full)] bg-[var(--color-bg-subtle)] text-[var(--color-fg-muted)] border border-[var(--color-border-subtle)] select-none">
                  {organization.slug}
                </span>
              </div>
            </div>

            {/* Compact two-column detail group: Currency and Timezone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-[var(--color-border-subtle)]/60">
              <div className="space-y-1">
                <span className="text-xs font-medium leading-4 text-[var(--color-fg-muted)]">
                  Currency
                </span>
                <p className="text-sm font-medium leading-5 text-[var(--color-fg-default)]">
                  {organization.currency}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium leading-4 text-[var(--color-fg-muted)]">
                  Timezone
                </span>
                <p className="text-sm font-medium leading-5 text-[var(--color-fg-default)]">
                  {organization.timezone}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Section: Granted Permissions (roughly 60-65% width on desktop) */}
        <div className="w-full lg:w-[62%] min-w-0 flex-1 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-[var(--color-fg-muted)] shrink-0" aria-hidden="true" />
              <h3 className="text-sm font-semibold leading-5 text-[var(--color-fg-default)]">
                Granted permissions
              </h3>
            </div>
            <Badge variant="neutral" emphasis="subtle">
              {permissionsCount} {permissionsCount === 1 ? "permission" : "permissions"}
            </Badge>
          </div>

          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)]/30 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              {groups.map((group) => (
                <div key={group.key} className="space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
                    {group.label}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {group.permissions.map((perm) => (
                      <span
                        key={perm}
                        className="inline-flex items-center px-2 py-0.5 text-xs font-medium leading-4 rounded-[var(--radius-full)] bg-[var(--color-bg-subtle)] text-[var(--color-fg-muted)] border border-[var(--color-border-subtle)] select-none"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
