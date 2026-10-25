"use client";

import * as React from "react";
import { Building2, Info, Globe, Coins, Clock } from "lucide-react";
import { Card } from "@/components/sakani";
import type { UserOrganization } from "@/hooks/use-auth";

interface OrganizationCardProps {
  organization?: UserOrganization | null;
}

export function OrganizationCard({ organization }: OrganizationCardProps) {
  const org = {
    name: organization?.name || "ForgeFlow Demo Manufacturing",
    slug: organization?.slug || "forgeflow-demo",
    currency: organization?.currency || "INR",
    timezone: organization?.timezone || "Asia/Kolkata",
  };

  return (
    <Card className="p-5 sm:p-6 border-[var(--color-border-default)] shadow-xs rounded-[var(--radius-xl)] bg-[var(--color-bg-surface)]">
      {/* Identity Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] text-[var(--color-primary-600)] dark:border-[var(--color-primary-800)] dark:bg-[var(--color-primary-950)]/40 dark:text-[var(--color-primary-400)]">
            <Building2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex flex-col justify-center">
            <h2 className="text-base font-semibold leading-[22px] text-[var(--color-fg-default)] truncate">
              {org.name}
            </h2>
            <p className="text-[13px] font-medium leading-[18px] text-[var(--color-fg-muted)] mt-0.5 truncate">
              Authoritative multi-tenant organization context
            </p>
          </div>
        </div>

        {/* Tenant Slug Chip */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-medium rounded-[var(--radius-full)] bg-[var(--color-bg-subtle)] text-[var(--color-fg-default)] border border-[var(--color-border-subtle)] select-none">
            <Globe className="h-3 w-3 text-[var(--color-fg-muted)]" aria-hidden="true" />
            <span>{org.slug}</span>
          </span>
        </div>
      </div>

      {/* Subtle Horizontal Divider */}
      <div className="border-t border-[var(--color-border-subtle)] my-5" />

      {/* Labeled Metadata Details (2-column layout on desktop, stacked on mobile) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Field 1: Organization Name */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] select-none">
            Organization Name
          </label>
          <div className="flex items-center gap-2 min-h-[40px] px-3.5 py-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)]/40 text-[13px] font-medium text-[var(--color-fg-default)]">
            <Building2 className="h-4 w-4 text-[var(--color-fg-muted)] shrink-0" aria-hidden="true" />
            <span>{org.name}</span>
          </div>
        </div>

        {/* Field 2: Tenant Slug */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] select-none">
            Tenant Identifier
          </label>
          <div className="flex items-center gap-2 min-h-[40px] px-3.5 py-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)]/40 text-[13px] font-mono font-medium text-[var(--color-fg-default)]">
            <Globe className="h-4 w-4 text-[var(--color-fg-muted)] shrink-0" aria-hidden="true" />
            <span>{org.slug}</span>
          </div>
        </div>

        {/* Field 3: Currency */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] select-none">
            Operational Currency
          </label>
          <div className="flex items-center gap-2 min-h-[40px] px-3.5 py-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)]/40 text-[13px] font-medium text-[var(--color-fg-default)]">
            <Coins className="h-4 w-4 text-[var(--color-fg-muted)] shrink-0" aria-hidden="true" />
            <span>{org.currency} — Indian Rupee (₹)</span>
          </div>
          <p className="text-[11px] font-medium text-[var(--color-fg-muted)] mt-1">
            Authoritative financial currency for CPQ quote calculations and export ledgers.
          </p>
        </div>

        {/* Field 4: Timezone */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] select-none">
            Workspace Timezone
          </label>
          <div className="flex items-center gap-2 min-h-[40px] px-3.5 py-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)]/40 text-[13px] font-medium text-[var(--color-fg-default)]">
            <Clock className="h-4 w-4 text-[var(--color-fg-muted)] shrink-0" aria-hidden="true" />
            <span>{org.timezone} (UTC+05:30)</span>
          </div>
          <p className="text-[11px] font-medium text-[var(--color-fg-muted)] mt-1">
            Used for task commitments, quote expiration schedules, and audit log timestamps.
          </p>
        </div>
      </div>

      {/* Read-Only Governance Notice */}
      <div className="mt-6 pt-5 border-t border-[var(--color-border-subtle)]">
        <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)]/60 p-3.5 text-xs text-[var(--color-fg-muted)]">
          <Info className="h-4 w-4 text-[var(--color-primary-600)] shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-0.5">
            <span className="font-semibold text-[var(--color-fg-default)]">Enterprise Tenant Governance</span>
            <p>
              Organization parameters, financial currency precision, and timezone conventions are provisioned by enterprise tenant administrators. Changes require system administrator credentials.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
