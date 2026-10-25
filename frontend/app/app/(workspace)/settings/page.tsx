"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  ShieldCheck,
  ArrowRight,
  Globe,
  Coins,
  Clock,
  Key,
  Shield,
} from "lucide-react";
import { Card, Badge, Button } from "@/components/sakani";
import { useAuth } from "@/hooks/use-auth";
import { formatRole } from "@/features/dashboard/components/session-panel";

export default function SettingsOverviewPage() {
  const { user, organization, permissions } = useAuth();

  const orgName = organization?.name || user?.organization?.name || "ForgeFlow Demo Manufacturing";
  const orgSlug = organization?.slug || user?.organization?.slug || "forgeflow-demo";
  const currency = organization?.currency || user?.organization?.currency || "INR";
  const timezone = organization?.timezone || user?.organization?.timezone || "Asia/Kolkata";

  const displayName = user?.display_name || "Alexander Admin";
  const email = user?.email || "admin@forgeflow.demo";
  const role = user?.role || "admin";
  const permissionsCount = permissions?.length ?? (user?.permissions?.length || 0);

  return (
    <div className="space-y-6">
      {/* Overview 2-Column Summary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 1. Organization Summary Panel */}
        <Card className="p-5 border-[var(--color-border-default)] shadow-xs rounded-[var(--radius-xl)] bg-[var(--color-bg-surface)] flex flex-col justify-between">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-canvas)] text-[var(--color-fg-default)] shadow-xs">
                  <Building2 className="h-4.5 w-4.5 text-[var(--color-fg-muted)]" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-base font-semibold leading-[22px] text-[var(--color-fg-default)]">
                    Organization
                  </h2>
                  <p className="text-xs text-[var(--color-fg-muted)]">
                    Tenant identity and workspace localization
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-mono font-medium rounded-[var(--radius-full)] bg-[var(--color-bg-subtle)] text-[var(--color-fg-default)] border border-[var(--color-border-subtle)] select-none">
                <Globe className="h-3 w-3 text-[var(--color-fg-muted)]" aria-hidden="true" />
                <span>{orgSlug}</span>
              </span>
            </div>

            {/* Content summary */}
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)]/30 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--color-fg-muted)]">Tenant Name</span>
                <span className="font-medium text-[var(--color-fg-default)]">{orgName}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--color-fg-muted)]">Operational Currency</span>
                <span className="font-medium text-[var(--color-fg-default)] flex items-center gap-1">
                  <Coins className="h-3 w-3 text-[var(--color-fg-muted)]" aria-hidden="true" />
                  <span>{currency} (INR)</span>
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--color-fg-muted)]">Workspace Timezone</span>
                <span className="font-medium text-[var(--color-fg-default)] flex items-center gap-1">
                  <Clock className="h-3 w-3 text-[var(--color-fg-muted)]" aria-hidden="true" />
                  <span>{timezone}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Action Link Footer */}
          <div className="mt-5 pt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between">
            <span className="text-xs text-[var(--color-fg-muted)]">Read-only configuration</span>
            <Button
              href="/app/settings/organization"
              variant="outline"
              size="sm"
              rightIcon={<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              Organization Settings
            </Button>
          </div>
        </Card>

        {/* 2. Security & Access Summary Panel */}
        <Card className="p-5 border-[var(--color-border-default)] shadow-xs rounded-[var(--radius-xl)] bg-[var(--color-bg-surface)] flex flex-col justify-between">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-canvas)] text-[var(--color-fg-default)] shadow-xs">
                  <ShieldCheck className="h-4.5 w-4.5 text-[var(--color-fg-muted)]" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-base font-semibold leading-[22px] text-[var(--color-fg-default)]">
                    Security & Access
                  </h2>
                  <p className="text-xs text-[var(--color-fg-muted)]">
                    Active session credentials and effective permissions
                  </p>
                </div>
              </div>

              <Badge variant="success" emphasis="subtle">
                Session verified
              </Badge>
            </div>

            {/* Content summary */}
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)]/30 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--color-fg-muted)]">Current User</span>
                <span className="font-semibold text-[var(--color-fg-default)]">{displayName}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--color-fg-muted)]">Authenticated Role</span>
                <Badge variant="neutral" emphasis="subtle" className="h-5 px-2 text-xs">
                  {formatRole(role)}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--color-fg-muted)]">Granted Permissions</span>
                <span className="font-medium text-[var(--color-fg-default)] flex items-center gap-1">
                  <Key className="h-3 w-3 text-[var(--color-fg-muted)]" aria-hidden="true" />
                  <span>{permissionsCount} effective permissions</span>
                </span>
              </div>
            </div>
          </div>

          {/* Action Link Footer */}
          <div className="mt-5 pt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between">
            <span className="text-xs text-[var(--color-fg-muted)]">Session & RBAC ledger</span>
            <Button
              href="/app/settings/security"
              variant="outline"
              size="sm"
              rightIcon={<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              Security & Access
            </Button>
          </div>
        </Card>
      </div>

      {/* Enterprise Platform Governance Card */}
      <Card className="p-5 border-[var(--color-border-default)] shadow-xs rounded-[var(--radius-xl)] bg-[var(--color-bg-surface)]">
        <div className="flex items-start gap-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] text-[var(--color-fg-default)]">
            <Shield className="h-4.5 w-4.5" aria-hidden="true" />
          </div>
          <div className="space-y-1.5 flex-1 min-w-0">
            <h3 className="text-sm font-semibold leading-5 text-[var(--color-fg-default)]">
              Enterprise Governance & Multi-Tenant Architecture
            </h3>
            <p className="text-xs font-medium leading-relaxed text-[var(--color-fg-muted)]">
              ForgeFlow enforces strict multi-tenant isolation and cryptographic maker-checker workflow guarantees. Organization configuration, currency precision, and access policies are strictly governed by enterprise administrative roles.
            </p>
            <div className="pt-2 flex flex-wrap gap-4 text-xs text-[var(--color-fg-muted)]">
              <div>
                <span className="text-[var(--color-fg-muted)]">Software Edition: </span>
                <span className="font-semibold text-[var(--color-fg-default)]">ForgeFlow Enterprise v2.2.0</span>
              </div>
              <div>
                <span className="text-[var(--color-fg-muted)]">Authoritative Scope: </span>
                <span className="font-mono font-medium text-[var(--color-fg-default)]">{orgSlug}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
