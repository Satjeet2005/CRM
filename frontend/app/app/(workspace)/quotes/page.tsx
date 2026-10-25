"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Search,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Layers,
} from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/data-display/empty-state";
import { ErrorState } from "@/components/data-display/error-state";
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
        return <StatusBadge variant="neutral" label="Draft" />;
      case "in_review":
        return <StatusBadge variant="warning" label="In Review" />;
      case "approved":
        return <StatusBadge variant="success" label="Approved" />;
      case "rejected":
        return <StatusBadge variant="destructive" label="Rejected" />;
      case "converted":
        return <StatusBadge variant="info" label="Converted" />;
      default:
        return <StatusBadge variant="neutral" label={status} />;
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
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-[var(--surface)] p-3 rounded-[var(--radius-lg)] border border-[var(--border)] shadow-2xs">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
            <Input
              type="text"
              placeholder="Search by quote # or account..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {["all", "draft", "in_review", "approved", "rejected"].map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  statusFilter === st
                    ? "bg-[var(--primary)] text-white"
                    : "bg-[var(--surface-muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                {st === "all"
                  ? "All Statuses"
                  : st === "in_review"
                  ? "In Review"
                  : st.charAt(0).toUpperCase() + st.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Content list / table */}
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
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
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--surface-muted)] border-b border-[var(--border)] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">
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
                <tbody className="divide-y divide-[var(--border)]">
                  {data.items.map((quote: QuoteListItem) => (
                    <tr
                      key={quote.id}
                      className="hover:bg-[var(--surface-muted)]/50 transition-colors cursor-pointer group"
                      onClick={() => router.push(`/app/quotes/${quote.id}`)}
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-[var(--primary)] group-hover:underline">
                        {quote.quote_number}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-[var(--foreground)] block">
                          {quote.account_name}
                        </span>
                        <span className="text-[11px] text-[var(--muted-foreground)] block truncate max-w-xs">
                          {quote.opportunity_name}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <span className="inline-flex items-center gap-1 rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--foreground)] border border-[var(--border)]">
                          <Layers className="h-3 w-3 text-[var(--muted-foreground)]" />
                          Rev {quote.current_revision_number}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-[var(--foreground)]">
                        {formatMoney(quote.grand_total, quote.currency)}
                      </td>
                      <td className="py-3 px-4">
                        {quote.requires_manager_approval ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-[var(--radius-sm)]">
                            <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                            Requires Approval
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-[var(--radius-sm)]">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                            Standard Policy
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(quote.status)}</td>
                      <td className="py-3 px-4 text-[var(--muted-foreground)] whitespace-nowrap">
                        <DateTimeText value={quote.created_at} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-[var(--primary)]"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/app/quotes/${quote.id}`);
                          }}
                        >
                          <span>Open</span>
                          <ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            {data.total_pages > 1 && (
              <div className="flex items-center justify-between p-3 border-t border-[var(--border)] bg-[var(--surface-muted)]/30 text-xs text-[var(--muted-foreground)]">
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
