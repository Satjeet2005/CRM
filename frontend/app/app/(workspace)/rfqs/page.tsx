"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  Plus,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Ban,
} from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/data-display/empty-state";
import { ErrorState } from "@/components/data-display/error-state";
import { useRFQs, type RFQ } from "@/features/rfqs/api";
import { DateTimeText } from "@/components/data-display/date-time-text";

export default function RFQListPage() {
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

  const { data, isLoading, isError, error, refetch } = useRFQs({
    search: debouncedSearch || undefined,
    status: statusFilter,
    page,
    page_size: 20,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ready_to_quote":
        return <StatusBadge variant="success" label="Ready to Quote" />;
      case "needs_review":
        return <StatusBadge variant="warning" label="Needs Review" />;
      case "quoted":
        return <StatusBadge variant="info" label="Quoted" />;
      case "cancelled":
        return <StatusBadge variant="neutral" label="Cancelled" />;
      default:
        return <StatusBadge variant="neutral" label={status} />;
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Request for Quotations (RFQs)"
        description="Ingest customer CSV line items, inspect deterministic catalog matching, and resolve review studio proposals."
        breadcrumbs={[
          { label: "Dashboard", href: "/app/dashboard" },
          { label: "RFQs", href: "/app/rfqs" },
        ]}
        actions={
          <Button
            onClick={() => router.push("/app/rfqs/new")}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Import RFQ CSV
          </Button>
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between mt-6">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search RFQ #, title, reference, or file..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {[
            { id: "all", label: "All RFQs" },
            { id: "needs_review", label: "Needs Review" },
            { id: "ready_to_quote", label: "Ready to Quote" },
            { id: "quoted", label: "Quoted" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setStatusFilter(tab.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                statusFilter === tab.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* RFQ List Table / Content */}
      <div className="mt-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            title="Failed to load RFQs"
            message={error?.message || "An unexpected error occurred."}
            onRetry={refetch}
          />
        ) : !data?.items || data.items.length === 0 ? (
          <EmptyState
            icon={FileSpreadsheet}
            title="No RFQs Found"
            description={
              debouncedSearch || statusFilter !== "all"
                ? "No RFQs match your search and filter criteria. Try adjusting your query."
                : "You haven't imported any customer RFQ spreadsheets yet. Ingest your first CSV to start deterministic line-item matching."
            }
            action={
              <Button onClick={() => router.push("/app/rfqs/new")}>
                <Plus className="w-4 h-4 mr-2" />
                Import First RFQ
              </Button>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground border-b text-xs uppercase font-medium">
                  <tr>
                    <th className="px-4 py-3">RFQ Reference</th>
                    <th className="px-4 py-3">Customer & Opportunity</th>
                    <th className="px-4 py-3 text-center">Lines Summary</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Assigned Rep</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.items.map((rfq: RFQ) => (
                    <tr
                      key={rfq.id}
                      className="hover:bg-muted/30 transition-colors group cursor-pointer"
                      onClick={() => router.push(`/app/rfqs/${rfq.id}`)}
                    >
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          <span>{rfq.rfq_number}</span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-xs font-medium">
                          {rfq.title}
                        </div>
                        {rfq.customer_reference && (
                          <div className="text-[11px] text-muted-foreground/80">
                            Ref: {rfq.customer_reference}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-foreground">
                          {rfq.account_name || "Unknown Account"}
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-xs">
                          {rfq.opportunity_name || "General Opportunity"}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-semibold text-foreground text-xs">
                            {rfq.total_lines} total lines
                          </span>
                          <div className="flex items-center gap-1.5 text-[11px]">
                            {rfq.exact_matches_count ? (
                              <span className="text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded">
                                {rfq.exact_matches_count} exact
                              </span>
                            ) : null}
                            {rfq.needs_review_lines_count ? (
                              <span className="text-amber-600 font-medium bg-amber-50 px-1.5 py-0.5 rounded">
                                {rfq.needs_review_lines_count} review
                              </span>
                            ) : null}
                            {rfq.invalid_lines_count ? (
                              <span className="text-rose-600 font-medium bg-rose-50 px-1.5 py-0.5 rounded">
                                {rfq.invalid_lines_count} invalid
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {getStatusBadge(rfq.status)}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        {rfq.assigned_rep_name || "Unassigned"}
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-medium"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/app/rfqs/${rfq.id}`);
                          }}
                        >
                          Review Studio
                          <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            {data.pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20 text-xs text-muted-foreground">
                <div>
                  Showing Page {data.page} of {data.pages} ({data.total} total RFQs)
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={data.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={data.page >= data.pages}
                    onClick={() => setPage((p) => p + 1)}
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
