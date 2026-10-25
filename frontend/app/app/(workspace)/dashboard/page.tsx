"use client";

import * as React from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Building,
  Key,
  ArrowRight,
  TrendingUp,
  Briefcase,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Card, Badge } from "@/components/sakani";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { formatMoney } from "@/lib/formatters/formatters";
import { useDashboardSummary, useDashboardAttention } from "@/features/dashboard/api";
import { StageChart } from "@/features/dashboard/components/stage-chart";
import { AttentionQueue } from "@/features/dashboard/components/attention-queue";

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary();
  const { data: attentionItems, isLoading: attentionLoading } = useDashboardAttention(10);

  return (
    <PageContainer>
      <PageHeader
        title="Operations Overview"
        description="Unified B2B Workspace — CRM Pipeline, Industrial Catalog & Action Queue"
        breadcrumbs={[{ label: "Workspace" }, { label: "Overview" }]}
      />

      <div className="mt-6 space-y-6">
        {/* KPI Summary Cards */}
        {summaryLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton className="h-28 w-full rounded-[var(--radius-xl)]" />
            <Skeleton className="h-28 w-full rounded-[var(--radius-xl)]" />
            <Skeleton className="h-28 w-full rounded-[var(--radius-xl)]" />
            <Skeleton className="h-28 w-full rounded-[var(--radius-xl)]" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Open Pipeline Value */}
            <Card className="p-5 space-y-2">
              <div className="flex items-center justify-between text-xs text-[var(--color-fg-muted)]">
                <span className="font-medium">Total Open Pipeline</span>
                <TrendingUp className="h-4 w-4 text-[var(--color-primary-500)]" aria-hidden="true" />
              </div>
              <div className="text-2xl font-bold tracking-tight text-[var(--color-fg-default)]">
                {summary ? formatMoney(summary.open_pipeline_value, "INR") : "—"}
              </div>
              <p className="text-[11px] text-[var(--color-fg-muted)]">
                Across {summary?.open_opportunities_count || 0} active opportunities
              </p>
            </Card>

            {/* Open Opportunities */}
            <Card className="p-5 space-y-2">
              <div className="flex items-center justify-between text-xs text-[var(--color-fg-muted)]">
                <span className="font-medium">Open Deals</span>
                <Briefcase className="h-4 w-4 text-[var(--color-primary-500)]" aria-hidden="true" />
              </div>
              <div className="text-2xl font-bold tracking-tight text-[var(--color-fg-default)]">
                {summary?.open_opportunities_count ?? 0}
              </div>
              <Link
                href="/app/opportunities"
                className="text-[11px] text-[var(--color-primary-600)] hover:underline inline-flex items-center gap-1 font-medium focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)]"
              >
                <span>View pipeline board</span>
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </Card>

            {/* Active Accounts */}
            <Card className="p-5 space-y-2">
              <div className="flex items-center justify-between text-xs text-[var(--color-fg-muted)]">
                <span className="font-medium">Active Accounts</span>
                <Building className="h-4 w-4 text-[var(--color-primary-500)]" aria-hidden="true" />
              </div>
              <div className="text-2xl font-bold tracking-tight text-[var(--color-fg-default)]">
                {summary?.active_accounts_count ?? 0}
              </div>
              <Link
                href="/app/accounts"
                className="text-[11px] text-[var(--color-primary-600)] hover:underline inline-flex items-center gap-1 font-medium focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)]"
              >
                <span>Manage customer accounts</span>
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </Card>

            {/* Overdue Action Items */}
            <Card className="p-5 space-y-2">
              <div className="flex items-center justify-between text-xs text-[var(--color-fg-muted)]">
                <span className="font-medium">Overdue Tasks</span>
                <AlertTriangle
                  className={`h-4 w-4 ${(summary?.overdue_tasks_count || 0) > 0 ? "text-[var(--color-danger-500)]" : "text-[var(--color-fg-muted)]"}`}
                  aria-hidden="true"
                />
              </div>
              <div
                className={`text-2xl font-bold tracking-tight ${(summary?.overdue_tasks_count || 0) > 0 ? "text-[var(--color-danger-fg)]" : "text-[var(--color-fg-default)]"}`}
              >
                {summary?.overdue_tasks_count ?? 0}
              </div>
              <Link
                href="/app/tasks"
                className="text-[11px] text-[var(--color-primary-600)] hover:underline inline-flex items-center gap-1 font-medium focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)]"
              >
                <span>Review follow-up items</span>
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </Card>
          </div>
        )}

        {/* Phase Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/app/rfqs"
            className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-subtle)] transition-colors p-4 flex items-center justify-between focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-warning-bg)] text-[var(--color-warning-fg)] border border-[var(--color-warning-border)]">
                <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <span className="text-xs font-semibold text-[var(--color-fg-default)] block">RFQ Review Queue</span>
                <span className="text-[11px] text-[var(--color-fg-muted)]">
                  {summary?.open_rfq_review_lines ?? 0} lines requiring review
                </span>
              </div>
            </div>
            <Badge variant="warning" emphasis="subtle">
              Active in Phase 3
            </Badge>
          </Link>

          <Link
            href="/app/quotes"
            className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-subtle)] transition-colors p-4 flex items-center justify-between focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-info-bg)] text-[var(--color-info-fg)] border border-[var(--color-info-border)]">
                <FileText className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <span className="text-xs font-semibold text-[var(--color-fg-default)] block">Quotations & Pricing</span>
                <span className="text-[11px] text-[var(--color-fg-muted)]">
                  {summary?.draft_quotes_count ?? 0} active quote drafts
                </span>
              </div>
            </div>
            <Badge variant="info" emphasis="subtle">
              Active in Phase 4
            </Badge>
          </Link>
        </div>

        {/* Main Section: Chart & Attention Queue */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Stage Distribution Chart (7 cols) */}
          <Card className="lg:col-span-7 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-fg-default)]">Opportunity Stage Distribution</h2>
                <p className="text-xs text-[var(--color-fg-muted)]">Weighted pipeline across active qualification stages</p>
              </div>
              <Link
                href="/app/opportunities"
                className="text-xs text-[var(--color-primary-600)] hover:underline font-medium focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)]"
              >
                View All
              </Link>
            </div>

            {summary ? (
              <StageChart distribution={summary.stage_distribution} />
            ) : (
              <Skeleton className="h-64 w-full rounded-[var(--radius-lg)]" />
            )}
          </Card>

          {/* Attention Queue (5 cols) */}
          <Card className="lg:col-span-5 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-fg-default)]">Attention Required</h2>
                <p className="text-xs text-[var(--color-fg-muted)]">Overdue tasks & closing deals</p>
              </div>
              <Link
                href="/app/tasks"
                className="text-xs text-[var(--color-primary-600)] hover:underline font-medium focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)]"
              >
                Tasks
              </Link>
            </div>

            {attentionLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full rounded-[var(--radius-md)]" />
                <Skeleton className="h-14 w-full rounded-[var(--radius-md)]" />
                <Skeleton className="h-14 w-full rounded-[var(--radius-md)]" />
              </div>
            ) : (
              <AttentionQueue items={attentionItems || []} />
            )}
          </Card>
        </div>

        {/* User Session Profile Card */}
        <Card className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--color-border-subtle)] pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary-600)] border border-[var(--color-primary-100)]">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[var(--color-fg-default)]">
                  Active Session: {user?.display_name}
                </h2>
                <p className="text-xs text-[var(--color-fg-muted)]">{user?.email}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="accent" emphasis="subtle">
                Role: {user?.role || "sales_rep"}
              </Badge>
              <Badge variant="success" emphasis="subtle">
                Session Verified
              </Badge>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-[var(--color-fg-default)]">
                <Building className="h-4 w-4 text-[var(--color-fg-muted)]" aria-hidden="true" />
                <span>Organization Context</span>
              </div>
              <p className="text-[var(--color-fg-muted)]">
                Tenant: <strong className="text-[var(--color-fg-default)]">{user?.organization.name}</strong> ({user?.organization.slug})
              </p>
              <p className="text-[var(--color-fg-muted)]">
                Currency: <strong className="text-[var(--color-fg-default)]">{user?.organization.currency}</strong> | Timezone: <strong className="text-[var(--color-fg-default)]">{user?.organization.timezone}</strong>
              </p>
            </div>

            <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-[var(--color-fg-default)]">
                <Key className="h-4 w-4 text-[var(--color-fg-muted)]" aria-hidden="true" />
                <span>Granted Permissions ({user?.permissions.length || 0})</span>
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {user?.permissions.map((perm) => (
                  <span
                    key={perm}
                    className="rounded-[var(--radius-xs)] bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-fg-default)]"
                  >
                    {perm}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
