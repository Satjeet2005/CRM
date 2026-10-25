"use client";

import * as React from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Building,
  Key,
  Layers,
  ArrowRight,
  TrendingUp,
  Briefcase,
  Users,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  Clock,
  Sparkles,
} from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
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
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Open Pipeline Value */}
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                <span className="font-medium">Total Open Pipeline</span>
                <TrendingUp className="h-4 w-4 text-[var(--primary)]" />
              </div>
              <div className="text-2xl font-bold text-[var(--foreground)]">
                {summary ? formatMoney(summary.open_pipeline_value, "INR") : "—"}
              </div>
              <p className="text-[11px] text-[var(--muted-foreground)]">
                Across {summary?.open_opportunities_count || 0} active opportunities
              </p>
            </div>

            {/* Open Opportunities */}
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                <span className="font-medium">Open Deals</span>
                <Briefcase className="h-4 w-4 text-[var(--primary)]" />
              </div>
              <div className="text-2xl font-bold text-[var(--foreground)]">
                {summary?.open_opportunities_count ?? 0}
              </div>
              <Link
                href="/app/opportunities"
                className="text-[11px] text-[var(--primary)] hover:underline inline-flex items-center gap-1"
              >
                <span>View pipeline board</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {/* Active Accounts */}
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                <span className="font-medium">Active Accounts</span>
                <Building className="h-4 w-4 text-[var(--primary)]" />
              </div>
              <div className="text-2xl font-bold text-[var(--foreground)]">
                {summary?.active_accounts_count ?? 0}
              </div>
              <Link
                href="/app/accounts"
                className="text-[11px] text-[var(--primary)] hover:underline inline-flex items-center gap-1"
              >
                <span>Manage customer accounts</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {/* Overdue Action Items */}
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                <span className="font-medium">Overdue Tasks</span>
                <AlertTriangle className={`h-4 w-4 ${(summary?.overdue_tasks_count || 0) > 0 ? "text-[var(--danger)]" : "text-[var(--muted-foreground)]"}`} />
              </div>
              <div className={`text-2xl font-bold ${(summary?.overdue_tasks_count || 0) > 0 ? "text-[var(--danger)]" : "text-[var(--foreground)]"}`}>
                {summary?.overdue_tasks_count ?? 0}
              </div>
              <Link
                href="/app/tasks"
                className="text-[11px] text-[var(--primary)] hover:underline inline-flex items-center gap-1"
              >
                <span>Review follow-up items</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        )}

        {/* Future Phase Placeholders (Explicitly Sealed per PRD Section 11.2 & ADR-0008) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/app/rfqs"
            className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-muted)] transition-colors p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-amber-50 text-amber-600">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-[var(--foreground)] block">RFQ Review Queue</span>
                <span className="text-[11px] text-[var(--muted-foreground)]">
                  {summary?.open_rfq_review_lines ?? 0} lines requiring review
                </span>
              </div>
            </div>
            <span className="rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              Active in Phase 3
            </span>
          </Link>

          <Link
            href="/app/quotes"
            className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-muted)] transition-colors p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-blue-50 text-blue-600">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-[var(--foreground)] block">Quotations & Pricing</span>
                <span className="text-[11px] text-[var(--muted-foreground)]">
                  {summary?.draft_quotes_count ?? 0} active quote drafts
                </span>
              </div>
            </div>
            <span className="rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
              Active in Phase 4
            </span>
          </Link>
        </div>

        {/* Main Section: Chart & Attention Queue */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Stage Distribution Chart (7 cols) */}
          <div className="lg:col-span-7 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--foreground)]">Opportunity Stage Distribution</h2>
                <p className="text-xs text-[var(--muted-foreground)]">Weighted pipeline across active qualification stages</p>
              </div>
              <Link href="/app/opportunities" className="text-xs text-[var(--primary)] hover:underline">
                View All
              </Link>
            </div>

            {summary ? (
              <StageChart distribution={summary.stage_distribution} />
            ) : (
              <Skeleton className="h-64 w-full" />
            )}
          </div>

          {/* Attention Queue (5 cols) */}
          <div className="lg:col-span-5 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--foreground)]">Attention Required</h2>
                <p className="text-xs text-[var(--muted-foreground)]">Overdue tasks & closing deals</p>
              </div>
              <Link href="/app/tasks" className="text-xs text-[var(--primary)] hover:underline">
                Tasks
              </Link>
            </div>

            {attentionLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : (
              <AttentionQueue items={attentionItems || []} />
            )}
          </div>
        </div>

        {/* User Session Profile Card */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--border)] pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)] font-semibold">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[var(--foreground)]">
                  Active Session: {user?.display_name}
                </h2>
                <p className="text-xs text-[var(--muted-foreground)]">{user?.email}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                label={`Role: ${user?.role || "sales_rep"}`}
                variant="info"
              />
              <StatusBadge
                label="Session Verified"
                variant="success"
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="rounded-[var(--radius-sm)] bg-[var(--surface-muted)] p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-[var(--foreground)]">
                <Building className="h-4 w-4 text-[var(--muted-foreground)]" />
                <span>Organization Context</span>
              </div>
              <p className="text-[var(--muted-foreground)]">
                Tenant: <strong className="text-[var(--foreground)]">{user?.organization.name}</strong> ({user?.organization.slug})
              </p>
              <p className="text-[var(--muted-foreground)]">
                Currency: <strong className="text-[var(--foreground)]">{user?.organization.currency}</strong> | Timezone: <strong className="text-[var(--foreground)]">{user?.organization.timezone}</strong>
              </p>
            </div>

            <div className="rounded-[var(--radius-sm)] bg-[var(--surface-muted)] p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-[var(--foreground)]">
                <Key className="h-4 w-4 text-[var(--muted-foreground)]" />
                <span>Granted Permissions ({user?.permissions.length || 0})</span>
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {user?.permissions.map((perm) => (
                  <span
                    key={perm}
                    className="rounded bg-[var(--surface)] border border-[var(--border)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--foreground)]"
                  >
                    {perm}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
