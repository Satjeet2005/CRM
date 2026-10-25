"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Search,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  Layers,
} from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/sakani/button";
import { Input } from "@/components/sakani/input";
import { Badge } from "@/components/sakani/badge";
import { EmptyState } from "@/components/data-display/empty-state";
import { ErrorState } from "@/components/data-display/error-state";
import { LoadingSkeleton } from "@/components/data-display/loading-skeleton";
import { DateTimeText } from "@/components/data-display/date-time-text";
import { formatMoney } from "@/lib/formatters/formatters";
import { useQuotes, type QuoteListItem } from "@/features/quotes/api";

export default function QuotesListPage() {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isError, error, refetch } = useQuotes({
    search: debouncedSearch || undefined,
    status: statusFilter,
    page,
    page_size: 20,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="neutral" emphasis="subtle">Draft</Badge>;
      case "in_review":
        return <Badge variant="warning" emphasis="subtle">In Review</Badge>;
      case "approved":
        return <Badge variant="success" emphasis="subtle">Approved</Badge>;
      case "rejected":
        return <Badge variant="danger" emphasis="subtle">Rejected</Badge>;
      case "converted":
        return <Badge variant="info" emphasis="subtle">Converted</Badge>;
      default:
        return <Badge variant="neutral" emphasis="subtle">{status}</Badge>;
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Quotations"
        description="Deterministic B2B quotation builder, revision control, calculation traces, and policy approval tracking."
        breadcrumbs={[
          { label: "Workspace", href: "/app/dashboard" },
          { label: "Quotations", href: "/app/quotes" },
        ]}
      />

      <div className="mt-6 space-y-4">
        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-[var(--color-bg-surface)] p-3 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] shadow-2xs">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-fg-muted)] pointer-events-none" />
            <Input
              type="text"
              placeholder="Search by quote # or account..."
              aria-label="Search quotations by quote number or account name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 bg-[var(--color-bg-subtle)] p-1 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)]">
            {[
              { id: "all", label: "All Statuses" },
              { id: "draft", label: "Draft" },
              { id: "in_review", label: "In Review" },
              { id: "approved", label: "Approved" },
              { id: "rejected", label: "Rejected" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  statusFilter === tab.id
                    ? "bg-[var(--color-bg-surface)] text-[var(--color-fg-default)] shadow-xs font-semibold"
                    : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg-default)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content list / table */}
        {isLoading ? (
          <div className="py-4 space-y-3">
            <LoadingSkeleton rows={5} />
          </div>
        ) : isError ? (
          <ErrorState
            title="Failed to load quotations"
            message={error?.message || "An unexpected error occurred."}
            onRetry={refetch}
          />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No quotations found"
            description={
              search
                ? `No quotations matching "${search}".`
                : "Convert an RFQ or create a new quote draft to begin pricing."
            }
            action={
              <Button
                variant="outline"
                onClick={() => router.push("/app/rfqs")}
                className="gap-2 text-xs"
              >
                Go to RFQ Review Queue
              </Button>
            }
          />
        ) : (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] overflow-hidden shadow-2xs">
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Quotations list table">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--color-bg-subtle)] border-b border-[var(--color-border-subtle)] text-[var(--color-fg-muted)] uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Quote Number</th>
                    <th className="py-3 px-4">Account & Deal</th>
                    <th className="py-3 px-4">Revision</th>
                    <th className="py-3 px-4 text-right">Grand Total</th>
                    <th className="py-3 px-4">Policy Triggers</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-subtle)]">
                  {data.items.map((quote: QuoteListItem) => (
                    <tr
                      key={quote.id}
                      className="hover:bg-[var(--color-bg-subtle)]/60 transition-colors cursor-pointer group"
                      onClick={() => router.push(`/app/quotes/${quote.id}`)}
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-[var(--color-primary-700)] group-hover:underline">
                        {quote.quote_number}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-[var(--color-fg-default)] block">
                          {quote.account_name}
                        </span>
                        <span className="text-[11px] text-[var(--color-fg-muted)] block truncate max-w-xs font-medium">
                          {quote.opportunity_name}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--color-bg-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-fg-default)] border border-[var(--color-border-subtle)]">
                          <Layers className="h-3 w-3 text-[var(--color-fg-muted)]" />
                          <span>Rev {quote.current_revision_number}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[var(--color-fg-default)]">
                        {formatMoney(quote.grand_total, quote.currency)}
                      </td>
                      <td className="py-3 px-4">
                        {quote.requires_manager_approval ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-warning-700)] bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-[var(--radius-sm)]">
                            <ShieldAlert className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                            <span>Requires Approval</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-success-700)] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-[var(--radius-sm)]">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            <span>Standard Policy</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(quote.status)}</td>
                      <td className="py-3 px-4 text-[var(--color-fg-muted)] whitespace-nowrap">
                        <DateTimeText value={quote.created_at} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-[var(--color-primary-700)] hover:text-[var(--color-primary-800)] gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/app/quotes/${quote.id}`);
                          }}
                        >
                          <span>Open</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            {data.total_pages > 1 && (
              <div className="flex items-center justify-between p-3 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)]/40 text-xs text-[var(--color-fg-muted)]">
                <span>
                  Showing page {data.page} of {data.total_pages} ({data.total} total)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    className="h-7 text-xs"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= data.total_pages}
                    onClick={() => setPage((p) => Math.min(p + 1, data.total_pages))}
                    className="h-7 text-xs"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
