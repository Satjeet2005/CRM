"use client";

import * as React from "react";
import Link from "next/link";
import {
  ClipboardCheck,
  Search,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  User,
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
import { useAuth } from "@/hooks/use-auth";
import { useApprovalQueue, type ApprovalQueueItem } from "@/features/approvals/api";
import { ProposalReviewSheet } from "@/features/proposals/components/proposal-review-sheet";

export default function ApprovalsPage() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = React.useState<string>("pending");
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [selectedProposalId, setSelectedProposalId] = React.useState<string | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isError, error, refetch } = useApprovalQueue({
    status: statusFilter,
    search: debouncedSearch || undefined,
    page,
    page_size: 20,
  });

  const isCommercialReviewer = user?.role === "sales_manager" || user?.role === "admin";

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_review":
      case "pending_approval":
        return <Badge variant="warning" emphasis="subtle">Pending Review</Badge>;
      case "approved":
        return <Badge variant="success" emphasis="subtle">Approved</Badge>;
      case "rejected":
        return <Badge variant="danger" emphasis="subtle">Rejected</Badge>;
      case "committed":
        return <Badge variant="info" emphasis="subtle">Committed</Badge>;
      case "stale":
        return <Badge variant="danger" emphasis="subtle">Stale</Badge>;
      case "cancelled":
        return <Badge variant="neutral" emphasis="subtle">Cancelled</Badge>;
      default:
        return <Badge variant="neutral" emphasis="subtle">{status}</Badge>;
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Reviews & Approvals"
        description="Role-gated commercial maker-checker queue for quotation change proposals and policy-triggered terms."
      />

      {/* Role permission banner if sales rep or catalog manager */}
      {!isCommercialReviewer && (
        <div
          role="region"
          aria-label="Permission Notice"
          className="mb-6 flex items-start gap-3 rounded-[var(--radius-md)] border border-amber-200 bg-amber-50/80 p-4 text-xs text-[var(--color-fg-default)]"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <div>
            <p className="font-semibold text-[var(--color-warning-700)]">Read-Only View / Permission Notice</p>
            <p className="mt-1 text-[var(--color-fg-muted)] leading-relaxed">
              Commercial proposals and quote approvals require a <span className="font-semibold text-[var(--color-fg-default)]">Sales Manager</span> or <span className="font-semibold text-[var(--color-fg-default)]">Admin</span> role. As a sales representative or catalog manager, you may inspect changes but cannot approve or reject proposals.
            </p>
          </div>
        </div>
      )}

      {/* Filter and Search Controls */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-[var(--color-bg-surface)] p-3 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] shadow-2xs">
        {/* Status Filter Tabs */}
        <div
          role="tablist"
          aria-label="Approval status filters"
          className="flex flex-wrap items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] p-1 text-xs"
        >
          {[
            { id: "pending", label: "Pending Review" },
            { id: "approved", label: "Approved" },
            { id: "rejected", label: "Rejected" },
            { id: "all", label: "All Records" },
          ].map((tab) => {
            const active = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => {
                  setStatusFilter(tab.id);
                  setPage(1);
                }}
                className={`rounded-[var(--radius-sm)] px-3 py-1.5 font-medium transition-colors cursor-pointer ${
                  active
                    ? "bg-[var(--color-bg-surface)] text-[var(--color-fg-default)] shadow-xs font-semibold"
                    : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg-default)]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-fg-muted)] pointer-events-none"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search quote, proposal, or author..."
            className="pl-9 h-9 text-xs"
            aria-label="Search approval queue"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="py-4 space-y-3" role="status" aria-label="Loading approval queue">
          <LoadingSkeleton rows={5} />
        </div>
      ) : isError ? (
        <ErrorState
          title="Failed to load approval queue"
          message={error?.message || "An unexpected error occurred while fetching approvals."}
          onRetry={() => refetch()}
        />
      ) : data?.items.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No approvals in this queue"
          description={
            statusFilter === "pending"
              ? "All commercial change proposals and quotations have been reviewed. Outstanding requests will appear here automatically."
              : "No records found matching the current status and search filters."
          }
        />
      ) : (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] shadow-2xs">
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Approval queue table region">
              <table className="w-full text-left text-xs" aria-label="Approval queue table">
                <thead className="border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] text-[var(--color-fg-muted)] uppercase tracking-wider font-semibold">
                  <tr>
                    <th scope="col" className="px-4 py-3">Quote / Proposal</th>
                    <th scope="col" className="px-4 py-3">Proposer</th>
                    <th scope="col" className="px-4 py-3">Proposed Value</th>
                    <th scope="col" className="px-4 py-3">Policy Triggers</th>
                    <th scope="col" className="px-4 py-3">Submitted</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-subtle)]">
                  {data?.items.map((item: ApprovalQueueItem) => {
                    const isOwnProposal = user?.id === item.proposer_user_id;
                    return (
                      <tr
                        key={item.id}
                        className="transition-colors hover:bg-[var(--color-bg-subtle)]/60"
                      >
                        {/* Quote & Title */}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col">
                            <span className="font-mono font-semibold text-[var(--color-primary-700)]">
                              {item.quote_number}
                            </span>
                            <span className="mt-0.5 text-xs text-[var(--color-fg-muted)] line-clamp-1 max-w-[280px] font-medium">
                              {item.title}
                            </span>
                          </div>
                        </td>

                        {/* Proposer */}
                        <td className="px-4 py-3.5 text-xs text-[var(--color-fg-default)]">
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-[var(--color-fg-muted)]" aria-hidden="true" />
                            <span className="font-medium">{item.proposer_name || "Unknown"}</span>
                            {isOwnProposal && (
                              <span className="rounded-[var(--radius-xs)] bg-[var(--color-primary-50)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-primary-700)] border border-[var(--color-primary-200)]">
                                You
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Value */}
                        <td className="px-4 py-3.5 font-mono text-xs font-bold text-[var(--color-fg-default)]">
                          {formatMoney(Number(item.total_value))}
                          {item.discount_percent !== null && Number(item.discount_percent) > 0 && (
                            <span className="ml-1.5 text-[11px] font-normal text-[var(--color-fg-muted)]">
                              ({item.discount_percent}% off)
                            </span>
                          )}
                        </td>

                        {/* Triggered Policy Rules */}
                        <td className="px-4 py-3.5">
                          {item.triggered_rules && item.triggered_rules.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {item.triggered_rules.map((rule, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold text-[var(--color-warning-700)]"
                                >
                                  <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600" aria-hidden="true" />
                                  <span>{rule}</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-[var(--color-success-700)] font-medium">
                              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                              <span>Within Policy</span>
                            </span>
                          )}
                        </td>

                        {/* Submitted Age */}
                        <td className="px-4 py-3.5 text-xs text-[var(--color-fg-muted)] whitespace-nowrap">
                          <DateTimeText value={item.pending_since} />
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {getStatusBadge(item.status)}
                        </td>

                        {/* Action */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          {item.item_type === "proposal" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedProposalId(item.proposal_id || item.id);
                                setSelectedQuoteId(item.quote_id);
                              }}
                              className="h-8 gap-1.5 text-xs font-medium"
                              aria-label={`Review proposal for quote ${item.quote_number}`}
                            >
                              <span>Review</span>
                              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                          ) : (
                            <Link href={`/app/quotes/${item.quote_id}`}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1.5 text-xs font-medium"
                                aria-label={`View initial quote ${item.quote_number}`}
                              >
                                <span>Inspect Quote</span>
                                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                              </Button>
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            {data && data.pages > 1 && (
              <div className="flex items-center justify-between border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)]/40 px-4 py-3 text-xs text-[var(--color-fg-muted)]">
                <span>
                  Showing page {data.page} of {data.pages} ({data.total} total items)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-7 px-2.5 text-xs"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= data.pages}
                    onClick={() => setPage((p) => p + 1)}
                    className="h-7 px-2.5 text-xs"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Review Proposal Slide-over Sheet */}
      {selectedProposalId && (
        <ProposalReviewSheet
          proposalId={selectedProposalId}
          quoteId={selectedQuoteId || ""}
          isOpen={!!selectedProposalId}
          onClose={() => {
            setSelectedProposalId(null);
            setSelectedQuoteId(null);
          }}
        />
      )}
    </PageContainer>
  );
}
