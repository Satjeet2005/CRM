"use client";

import * as React from "react";
import {
  GitPullRequest,
  Plus,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/sakani/button";
import { Badge } from "@/components/sakani/badge";
import { Card } from "@/components/sakani/card";
import { LoadingSkeleton } from "@/components/data-display/loading-skeleton";
import { DateTimeText } from "@/components/data-display/date-time-text";
import { useQuoteProposals, type ProposalListItem } from "@/features/proposals/api";
import type { QuoteDetail } from "@/features/quotes/api";
import { ProposalReviewSheet } from "@/features/proposals/components/proposal-review-sheet";
import { CreateProposalDialog } from "@/features/proposals/components/create-proposal-dialog";

interface QuoteProposalsSectionProps {
  quote: QuoteDetail;
}

export function QuoteProposalsSection({ quote }: QuoteProposalsSectionProps) {
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [selectedProposalId, setSelectedProposalId] = React.useState<string | null>(null);

  const { data, isLoading, refetch } = useQuoteProposals(quote.id);
  const proposals = data?.items || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_review":
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
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-3">
        <div>
          <h3 className="text-xs font-bold text-[var(--color-fg-default)] uppercase tracking-wider flex items-center gap-2">
            <GitPullRequest className="h-4 w-4 text-[var(--color-primary-700)]" aria-hidden="true" />
            <span>Change Proposals ({proposals.length})</span>
          </h3>
          <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
            Isolated review-before-write modifications against committed quotation revisions.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setIsCreateOpen(true)}
          className="gap-1.5 text-xs h-8 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>New Proposal</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="py-2 space-y-2.5">
          <LoadingSkeleton rows={2} />
        </div>
      ) : proposals.length === 0 ? (
        <div className="py-6 text-center text-xs text-[var(--color-fg-muted)]">
          <p>No change proposals created for this quotation yet.</p>
          <p className="mt-1">
            Click &ldquo;New Proposal&rdquo; above to propose adjustments to discounts, quantities, prices, or payment terms.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {proposals.map((prop: ProposalListItem) => (
            <div
              key={prop.id}
              className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)]/40 p-3 text-xs transition-colors hover:bg-[var(--color-bg-subtle)]/80"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--color-fg-default)]">
                    {prop.title}
                  </span>
                  {getStatusBadge(prop.status)}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-[var(--color-fg-muted)] font-medium">
                  <span>Base Rev #{prop.base_revision_number}</span>
                  <span>•</span>
                  <span>{prop.operations_count} operation(s)</span>
                  <span>•</span>
                  <span>By {prop.proposer_name || "Unknown"}</span>
                  <span>•</span>
                  <DateTimeText value={prop.created_at} />
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedProposalId(prop.id)}
                className="h-7 text-xs gap-1"
              >
                <span>Inspect Diff</span>
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Create Proposal Modal */}
      {isCreateOpen && (
        <CreateProposalDialog
          quote={quote}
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={(newPropId) => {
            refetch();
            setSelectedProposalId(newPropId);
          }}
        />
      )}

      {/* Review Proposal Sheet */}
      {selectedProposalId && (
        <ProposalReviewSheet
          proposalId={selectedProposalId}
          quoteId={quote.id}
          isOpen={!!selectedProposalId}
          onClose={() => {
            setSelectedProposalId(null);
            refetch();
          }}
        />
      )}
    </Card>
  );
}
