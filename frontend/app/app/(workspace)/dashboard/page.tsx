"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Card, Badge, StatCard, Button } from "@/components/sakani";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { formatMoney } from "@/lib/formatters/formatters";
import { useDashboardSummary, useDashboardAttention } from "@/features/dashboard/api";
import { StageChart } from "@/features/dashboard/components/stage-chart";
import { AttentionQueue } from "@/features/dashboard/components/attention-queue";
import { RFQMatchHealthChart } from "@/features/dashboard/components/rfq-match-health-chart";
import { QuoteLifecycleChart } from "@/features/dashboard/components/quote-lifecycle-chart";
import { TaskDueLoadChart } from "@/features/dashboard/components/task-due-load-chart";

export default function DashboardPage() {
  const { user } = useAuth();
  const [isAttentionSheetOpen, setIsAttentionSheetOpen] = React.useState(false);
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
          <div data-slot="kpi-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Skeleton className="h-[109px] w-full rounded-[var(--radius-xl)]" />
            <Skeleton className="h-[109px] w-full rounded-[var(--radius-xl)]" />
            <Skeleton className="h-[109px] w-full rounded-[var(--radius-xl)]" />
            <Skeleton className="h-[109px] w-full rounded-[var(--radius-xl)]" />
          </div>
        ) : (
          <div data-slot="kpi-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Total Open Pipeline */}
            <StatCard
              title="Total Open Pipeline"
              value={summary ? formatMoney(summary.open_pipeline_value, "INR") : "—"}
              description={`Across ${summary?.open_opportunities_count || 0} active opportunities`}
            />

            {/* 2. Open Deals */}
            <StatCard
              title="Open Deals"
              value={summary?.open_opportunities_count ?? 0}
              action={
                <Link
                  href="/app/opportunities"
                  className="text-xs text-[var(--color-primary-600)] hover:underline inline-flex items-center gap-1 font-medium focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)]"
                >
                  <span>View pipeline board</span>
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              }
            />

            {/* 3. Active Accounts */}
            <StatCard
              title="Active Accounts"
              value={summary?.active_accounts_count ?? 0}
              action={
                <Link
                  href="/app/accounts"
                  className="text-xs text-[var(--color-primary-600)] hover:underline inline-flex items-center gap-1 font-medium focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)]"
                >
                  <span>Manage customer accounts</span>
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              }
            />

            {/* 4. Overdue Tasks */}
            <StatCard
              title="Overdue Tasks"
              value={summary?.overdue_tasks_count ?? 0}
              valueClassName={(summary?.overdue_tasks_count || 0) > 0 ? "text-[var(--color-danger-fg)]" : undefined}
              action={
                <Link
                  href="/app/tasks"
                  className="text-xs text-[var(--color-primary-600)] hover:underline inline-flex items-center gap-1 font-medium focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)]"
                >
                  <span>Review follow-up items</span>
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              }
            />
          </div>
        )}

        {/* Work Queues Section */}
        <section aria-labelledby="work-queues-heading" className="space-y-3">
          <h2
            id="work-queues-heading"
            className="text-base font-semibold leading-[22px] text-[var(--color-fg-default)]"
          >
            Work queues
          </h2>

          <div
            data-slot="work-queues-grid"
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {/* RFQ Review Queue */}
            <div
              data-slot="work-queues-card"
              className="min-h-[76px] rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 flex items-center justify-between gap-4 transition-colors"
            >
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] text-[var(--color-primary-600)] p-2.5">
                  <FileSpreadsheet className="h-5 w-5 shrink-0" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1 flex flex-col justify-center gap-1">
                  <span className="text-sm font-semibold leading-5 text-[var(--color-fg-default)] truncate">
                    RFQ Review Queue
                  </span>
                  <span className="text-sm font-medium leading-5 text-[var(--color-fg-muted)]">
                    {summary?.open_rfq_review_lines ?? 0} {(summary?.open_rfq_review_lines ?? 0) === 1 ? "line needs" : "lines need"} review
                  </span>
                </div>
              </div>
              <Button
                href="/app/rfqs"
                variant="outline"
                size="sm"
                rightIcon={<ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                className="shrink-0"
              >
                Review RFQs
              </Button>
            </div>

            {/* Quotations & Pricing */}
            <div
              data-slot="work-queues-card"
              className="min-h-[76px] rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 flex items-center justify-between gap-4 transition-colors"
            >
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-info-border)] bg-[var(--color-info-bg)] text-[var(--color-info-fg)] p-2.5">
                  <FileText className="h-5 w-5 shrink-0" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1 flex flex-col justify-center gap-1">
                  <span className="text-sm font-semibold leading-5 text-[var(--color-fg-default)] truncate">
                    Quotations & Pricing
                  </span>
                  <span className="text-sm font-medium leading-5 text-[var(--color-fg-muted)]">
                    {summary?.draft_quotes_count ?? 0} active {(summary?.draft_quotes_count ?? 0) === 1 ? "draft" : "drafts"}
                  </span>
                </div>
              </div>
              <Button
                href="/app/quotes"
                variant="outline"
                size="sm"
                rightIcon={<ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                className="shrink-0"
              >
                View quotations
              </Button>
            </div>
          </div>
        </section>

        {/* Main Section: Chart & Attention Queue */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Stage Distribution Chart (7 cols) */}
          <Card className="lg:col-span-7 p-5 border-[var(--color-border-default)]">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-base font-medium leading-[22px] text-[var(--color-fg-default)]">
                  Opportunity Stage Distribution
                </h2>
                <p className="text-[13px] font-medium leading-[18px] text-[var(--color-fg-muted)] mt-0.5">
                  Deal count and total value by stage, including closed outcomes.
                </p>
              </div>
              <Button href="/app/opportunities" variant="outline" size="sm" className="shrink-0">
                View All
              </Button>
            </div>

            {summary ? (
              <StageChart distribution={summary.stage_distribution} />
            ) : (
              <Skeleton className="h-64 w-full rounded-[var(--radius-lg)]" />
            )}
          </Card>

          {/* Attention Queue (5 cols) */}
          <Card className="lg:col-span-5 p-5 border-[var(--color-border-default)]">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-base font-medium leading-[22px] text-[var(--color-fg-default)]">
                  Attention Required
                </h2>
                <p className="text-[13px] font-medium leading-[18px] text-[var(--color-fg-muted)] mt-0.5">
                  Overdue tasks & closing deals
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => setIsAttentionSheetOpen(true)}
              >
                View all
              </Button>
            </div>

            {attentionLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full rounded-[var(--radius-md)]" />
                <Skeleton className="h-14 w-full rounded-[var(--radius-md)]" />
                <Skeleton className="h-14 w-full rounded-[var(--radius-md)]" />
              </div>
            ) : (
              <AttentionQueue
                items={attentionItems || []}
                isSheetOpen={isAttentionSheetOpen}
                onSheetOpenChange={setIsAttentionSheetOpen}
              />
            )}
          </Card>
        </div>

        {/* Section 5: Operational Analytics */}
        <section aria-labelledby="operational-analytics-heading" className="space-y-3 pt-2">
          <div>
            <h2
              id="operational-analytics-heading"
              className="text-base font-semibold leading-[22px] text-[var(--color-fg-default)]"
            >
              Operational Analytics
            </h2>
            <p className="text-[13px] font-medium leading-[18px] text-[var(--color-fg-muted)] mt-0.5">
              RFQ resolution, quotation governance, and upcoming work.
            </p>
          </div>

          <div
            data-slot="operational-analytics-grid"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch"
          >
            {/* Chart A: RFQ Match Health */}
            {summaryLoading ? (
              <Skeleton className="h-[310px] w-full rounded-[var(--radius-xl)]" />
            ) : (
              <RFQMatchHealthChart data={summary?.rfq_match_health} />
            )}

            {/* Chart B: Quotation Lifecycle */}
            {summaryLoading ? (
              <Skeleton className="h-[310px] w-full rounded-[var(--radius-xl)]" />
            ) : (
              <QuoteLifecycleChart data={summary?.quote_lifecycle} />
            )}

            {/* Chart C: Task Due-Date Load */}
            {summaryLoading ? (
              <Skeleton className="h-[310px] w-full rounded-[var(--radius-xl)]" />
            ) : (
              <TaskDueLoadChart data={summary?.task_due_load} />
            )}
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
