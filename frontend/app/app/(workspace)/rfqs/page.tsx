"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  Plus,
  Search,
  ExternalLink,
} from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button, Input, Badge, Tabs } from "@/components/sakani";
import { LoadingSkeleton } from "@/components/data-display/loading-skeleton";
import { EmptyState } from "@/components/data-display/empty-state";
import { ErrorState } from "@/components/data-display/error-state";
import { useRFQs, type RFQ } from "@/features/rfqs/api";

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
        return <Badge variant="success" emphasis="subtle">Ready to Quote</Badge>;
      case "needs_review":
        return <Badge variant="warning" emphasis="subtle">Needs Review</Badge>;
      case "quoted":
        return <Badge variant="info" emphasis="subtle">Quoted</Badge>;
      case "cancelled":
        return <Badge variant="neutral" emphasis="subtle">Cancelled</Badge>;
      default:
        return <Badge variant="neutral" emphasis="subtle">{status}</Badge>;
    }
  };

  const statusTabItems = [
    { value: "all", label: "All RFQs" },
    { value: "needs_review", label: "Needs Review" },
    { value: "ready_to_quote", label: "Ready to Quote" },
    { value: "quoted", label: "Quoted" },
  ];

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
            <span>Import RFQ CSV</span>
          </Button>
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between mt-6">
        <div className="relative w-full sm:w-96">
          <Input
            placeholder="Search RFQ #, title, reference, or file..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leadingIcon={<Search className="h-4 w-4 text-[var(--color-fg-muted)]" />}
          />
        </div>

        <div className="overflow-x-auto">
          <Tabs
            items={statusTabItems}
            value={statusFilter}
            bordered={false}
            onChange={(val) => {
              setStatusFilter(val);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* RFQ List Table / Content */}
      <div className="mt-6">
        {isLoading ? (
          <div className="py-4 space-y-3">
            <LoadingSkeleton rows={5} />
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
                <span>Import First RFQ</span>
              </Button>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-[var(--color-bg-subtle)] text-[var(--color-fg-muted)] border-b border-[var(--color-border-subtle)] text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">RFQ Reference</th>
                    <th className="px-4 py-3">Customer & Opportunity</th>
                    <th className="px-4 py-3 text-center">Lines Summary</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Assigned Rep</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-subtle)]">
                  {data.items.map((rfq: RFQ) => (
                    <tr
                      key={rfq.id}
                      className="hover:bg-[var(--color-bg-subtle)] transition-colors group cursor-pointer"
                      onClick={() => router.push(`/app/rfqs/${rfq.id}`)}
                    >
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-xs text-[var(--color-fg-default)] flex items-center gap-1.5">
                          <span>{rfq.rfq_number}</span>
                        </div>
                        <div className="text-xs text-[var(--color-fg-muted)] truncate max-w-xs font-medium mt-0.5">
                          {rfq.title}
                        </div>
                        {rfq.customer_reference && (
                          <div className="text-[11px] text-[var(--color-fg-muted)] mt-0.5">
                            Ref: {rfq.customer_reference}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-xs text-[var(--color-fg-default)]">
                          {rfq.account_name || "Unknown Account"}
                        </div>
                        <div className="text-xs text-[var(--color-fg-muted)] truncate max-w-xs mt-0.5">
                          {rfq.opportunity_name || "General Opportunity"}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-semibold text-[var(--color-fg-default)] text-xs">
                            {rfq.total_lines} total lines
                          </span>
                          <div className="flex items-center gap-1.5 text-[11px]">
                            {rfq.exact_matches_count ? (
                              <Badge variant="success" emphasis="subtle">
                                {rfq.exact_matches_count} exact
                              </Badge>
                            ) : null}
                            {rfq.needs_review_lines_count ? (
                              <Badge variant="warning" emphasis="subtle">
                                {rfq.needs_review_lines_count} review
                              </Badge>
                            ) : null}
                            {rfq.invalid_lines_count ? (
                              <Badge variant="danger" emphasis="subtle">
                                {rfq.invalid_lines_count} invalid
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {getStatusBadge(rfq.status)}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-[var(--color-fg-muted)]">
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
                          <span>Review Studio</span>
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
              <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] text-xs text-[var(--color-fg-muted)]">
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
