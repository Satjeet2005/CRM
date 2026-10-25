"use client";

import * as React from "react";
import { Key, Shield } from "lucide-react";
import { Card, Badge } from "@/components/sakani";
import { groupPermissions } from "@/features/dashboard/components/session-panel";

interface PermissionsGridProps {
  permissions?: string[];
}

export function PermissionsGrid({ permissions = [] }: PermissionsGridProps) {
  const groups = React.useMemo(() => groupPermissions(permissions), [permissions]);
  const permissionsCount = permissions.length;

  return (
    <Card className="p-5 sm:p-6 border-[var(--color-border-default)] shadow-xs rounded-[var(--radius-xl)] bg-[var(--color-bg-surface)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] text-[var(--color-primary-600)] dark:border-[var(--color-primary-800)] dark:bg-[var(--color-primary-950)]/40 dark:text-[var(--color-primary-400)]">
            <Key className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex flex-col justify-center">
            <h2 className="text-base font-semibold leading-[22px] text-[var(--color-fg-default)] truncate">
              Granted Permissions
            </h2>
            <p className="text-[13px] font-medium leading-[18px] text-[var(--color-fg-muted)] mt-0.5 truncate">
              Authoritative role-based access control (RBAC) permission ledger
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="neutral" emphasis="subtle">
            {permissionsCount} {permissionsCount === 1 ? "permission" : "permissions"}
          </Badge>
        </div>
      </div>

      {/* Subtle Horizontal Divider */}
      <div className="border-t border-[var(--color-border-subtle)] my-5" />

      {/* Domain Groups Grid (2-column on desktop, stacked on mobile) */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)]/30 p-4 sm:p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
          {groups.map((group) => (
            <div key={group.key} className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] select-none block">
                {group.label}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {group.permissions.map((perm) => (
                  <span
                    key={perm}
                    className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium leading-4 rounded-[var(--radius-full)] bg-[var(--color-bg-surface)] text-[var(--color-fg-default)] border border-[var(--color-border-subtle)] select-none shadow-2xs"
                  >
                    {perm}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Read-Only Governance Footer */}
      <div className="mt-5 flex items-center gap-2 text-xs text-[var(--color-fg-muted)]">
        <Shield className="h-3.5 w-3.5 shrink-0 text-[var(--color-fg-subtle)]" aria-hidden="true" />
        <span>Permissions are strictly derived from role assignments and enforced at all API boundaries.</span>
      </div>
    </Card>
  );
}
