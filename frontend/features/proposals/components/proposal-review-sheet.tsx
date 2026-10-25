"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  GitCommit,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import {
  Sheet,
  SheetPopup,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
} from "@/components/sakani/sheet";
import { Dialog, DialogPopup, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/sakani/button";
import { Badge } from "@/components/sakani/badge";
import { Card } from "@/components/sakani/card";
import { LoadingSkeleton } from "@/components/data-display/loading-skeleton";
import { DateTimeText } from "@/components/data-display/date-time-text";
import { formatMoney } from "@/lib/formatters/formatters";
import { useAuth } from "@/hooks/use-auth";
import {
  useProposal,
  useProposalDiff,
  useApproveProposal,
  useRejectProposal,
  useCommitProposal,
  useSubmitProposal,
  useCancelProposal,
} from "@/features/proposals/api";

interface ProposalReviewSheetProps {
  proposalId: string;
  quoteId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ProposalReviewSheet({
  proposalId,
  quoteId,
  isOpen,
  onClose,
}: ProposalReviewSheetProps) {
  const { user } = useAuth();
  const { data: proposal, isLoading: isPropLoading, refetch: refetchProposal } = useProposal(proposalId);
  const { data: diff, isLoading: isDiffLoading } = useProposalDiff(proposalId);

  const approveMutation = useApproveProposal();
  const rejectMutation = useRejectProposal();
  const commitMutation = useCommitProposal();
  const submitMutation = useSubmitProposal();
  const cancelMutation = useCancelProposal();

  // Modal states
  const [isRejectOpen, setIsRejectOpen] = React.useState(false);
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [rejectError, setRejectError] = React.useState<string | null>(null);

  const [isApproveOpen, setIsApproveOpen] = React.useState(false);
  const [approvalNotes, setApprovalNotes] = React.useState("");

  const [actionError, setActionError] = React.useState<string | null>(null);

  const isProposer = user?.id === proposal?.proposer_user_id;
  const isManagerOrAdmin = user?.role === "sales_manager" || user?.role === "admin";
  const canApproveOrReject = isManagerOrAdmin && !isProposer;

  const handleApprove = async () => {
    setActionError(null);
    try {
      await approveMutation.mutateAsync({
        proposalId,
        quoteId,
        payload: {
          decision: "approved",
          notes: approvalNotes || undefined,
        },
      });
      setIsApproveOpen(false);
      refetchProposal();
    } catch (err: any) {
      setActionError(err.message || "Failed to approve proposal.");
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setRejectError("A non-empty rejection reason is required.");
      return;
    }
    setRejectError(null);
    setActionError(null);
    try {
      await rejectMutation.mutateAsync({
        proposalId,
        quoteId,
        payload: {
          decision: "rejected",
          rejection_reason: rejectionReason.trim(),
        },
      });
      setIsRejectOpen(false);
      refetchProposal();
    } catch (err: any) {
      setRejectError(err.message || "Failed to reject proposal.");
    }
  };

  const handleCommit = async () => {
    setActionError(null);
    try {
      await commitMutation.mutateAsync({
        proposalId,
        quoteId,
        idempotencyKey: `commit-${proposalId}-${Date.now()}`,
      });
      refetchProposal();
    } catch (err: any) {
      setActionError(err.message || "Failed to commit proposal to a new revision.");
    }
  };

  const handleSubmit = async () => {
    setActionError(null);
    try {
      await submitMutation.mutateAsync({ proposalId, quoteId });
      refetchProposal();
    } catch (err: any) {
      setActionError(err.message || "Failed to submit proposal.");
    }
  };

  const handleCancel = async () => {
    setActionError(null);
    try {
      await cancelMutation.mutateAsync({ proposalId, quoteId });
      refetchProposal();
    } catch (err: any) {
      setActionError(err.message || "Failed to cancel proposal.");
    }
  };

  const fi = diff?.financial_impact;
  const termsDiff = diff?.terms_diff;
  const modifiedLines = diff?.modified_lines || [];
  const addedLines = diff?.added_lines || [];
  const removedLines = diff?.removed_lines || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge variant="success" emphasis="subtle">APPROVED</Badge>;
      case "rejected":
        return <Badge variant="danger" emphasis="subtle">REJECTED</Badge>;
      case "committed":
        return <Badge variant="info" emphasis="subtle">COMMITTED</Badge>;
      case "stale":
        return <Badge variant="danger" emphasis="subtle">STALE</Badge>;
      default:
        return <Badge variant="warning" emphasis="subtle">{status.replace("_", " ").toUpperCase()}</Badge>;
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetPopup
        side="right"
        size="xl"
        closeLabel="Close sheet"
        className="w-full sm:max-w-3xl overflow-hidden flex flex-col"
      >
        <SheetHeader>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-[var(--color-primary-700)] uppercase tracking-wider">
              Change Proposal
            </span>
            <span className="text-xs text-[var(--color-fg-muted)]">•</span>
            {proposal && (
              <>
                <Link
                  href={`/app/quotes/${proposal.quote_id}`}
                  className="text-xs font-semibold text-[var(--color-fg-muted)] hover:text-[var(--color-fg-default)] underline underline-offset-2"
                >
                  {proposal.quote_number || "Quotation"}
                </Link>
                <span className="text-xs text-[var(--color-fg-muted)]">•</span>
                <span className="text-xs text-[var(--color-fg-muted)] font-mono">
                  Base Revision #{proposal.base_revision_number}
                </span>
              </>
            )}
          </div>
          <SheetTitle className="mt-1 text-xl font-bold tracking-tight text-[var(--color-fg-default)]">
            {proposal?.title || "Proposal Review"}
          </SheetTitle>
          {proposal && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {getStatusBadge(proposal.status)}
              <span className="text-xs text-[var(--color-fg-muted)]">
                Proposed by <strong className="text-[var(--color-fg-default)]">{proposal.proposer_name || "Unknown"}</strong>
              </span>
              <span className="text-xs text-[var(--color-fg-muted)]">•</span>
              <DateTimeText value={proposal.created_at} className="text-xs text-[var(--color-fg-muted)]" />
            </div>
          )}
        </SheetHeader>

        <SheetBody className="p-6 space-y-6">
          {isPropLoading || isDiffLoading ? (
            <div className="space-y-4 pt-2" role="status" aria-label="Loading proposal details">
              <LoadingSkeleton rows={4} />
            </div>
          ) : proposal ? (
            <div className="space-y-6">
              {/* Invariant Banner */}
              {proposal.status === "pending_review" && (
                <div
                  role="region"
                  aria-label="Isolation Invariant"
                  className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-primary-200)] bg-[var(--color-primary-50)]/70 p-3 text-xs text-[var(--color-fg-default)]"
                >
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary-700)]" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-[var(--color-primary-700)]">Review-Before-Write Isolation</p>
                    <p className="mt-0.5 text-[var(--color-fg-muted)] leading-relaxed">
                      Nothing is committed yet. Base Revision #{proposal.base_revision_number} remains the active, authoritative quotation revision until an authorized manager approves and commits this proposal.
                    </p>
                  </div>
                </div>
              )}

              {/* Stale Alert */}
              {proposal.status === "stale" && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-red-200 bg-red-50 p-3 text-xs text-[var(--color-danger-700)]"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                  <div>
                    <p className="font-semibold">Stale Base Revision Warning</p>
                    <p className="mt-0.5">
                      This quotation has advanced to a newer revision since this proposal was created. This proposal cannot be committed. Reload the current quotation and create or reconcile a new proposal.
                    </p>
                  </div>
                </div>
              )}

              {/* Error Banner */}
              {actionError && (
                <div
                  role="alert"
                  className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 p-3 text-xs text-[var(--color-danger-700)] font-semibold"
                >
                  {actionError}
                </div>
              )}

              {/* Commercial Justification */}
              <Card className="p-4 bg-[var(--color-bg-subtle)]/40">
                <h3 className="text-xs font-bold text-[var(--color-fg-muted)] uppercase tracking-wider">
                  Commercial Rationale
                </h3>
                <p className="mt-1.5 text-xs text-[var(--color-fg-default)] whitespace-pre-wrap leading-relaxed">
                  {proposal.justification || "No justification provided."}
                </p>
              </Card>

              {/* Financial Impact Cards */}
              {fi && (
                <div>
                  <h3 className="mb-2 text-xs font-bold text-[var(--color-fg-muted)] uppercase tracking-wider">
                    Financial Impact & Commercial Deltas
                  </h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {/* Grand Total */}
                    <Card className="p-3">
                      <span className="text-[11px] font-medium text-[var(--color-fg-muted)]">Proposed Total</span>
                      <p className="mt-1 font-mono text-base font-bold text-[var(--color-fg-default)]">
                        {formatMoney(Number(fi.proposed_grand_total || "0"))}
                      </p>
                      <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-fg-muted)]">
                        {Boolean(fi.grand_total_delta_percent) && (
                          <span>{String(fi.grand_total_delta_percent)} vs base</span>
                        )}
                      </span>
                    </Card>

                    {/* Absolute Delta */}
                    <Card className="p-3">
                      <span className="text-[11px] font-medium text-[var(--color-fg-muted)]">Net Delta</span>
                      <p className="mt-1 font-mono text-base font-bold text-[var(--color-fg-default)]">
                        {Number(fi.grand_total_delta) > 0 ? "+" : ""}
                        {formatMoney(Number(fi.grand_total_delta || "0"))}
                      </p>
                      <span className="mt-1 text-[11px] text-[var(--color-fg-muted)]">
                        Base: {formatMoney(Number(fi.base_grand_total || "0"))}
                      </span>
                    </Card>

                    {/* Total Discount */}
                    <Card className="p-3">
                      <span className="text-[11px] font-medium text-[var(--color-fg-muted)]">Discount Amount</span>
                      <p className="mt-1 font-mono text-base font-bold text-[var(--color-success-700)]">
                        {formatMoney(Number(fi.proposed_discount || "0"))}
                      </p>
                      <span className="mt-1 text-[11px] text-[var(--color-fg-muted)]">
                        Delta: {formatMoney(Number(fi.discount_delta || "0"))}
                      </span>
                    </Card>

                    {/* Tax Amount */}
                    <Card className="p-3">
                      <span className="text-[11px] font-medium text-[var(--color-fg-muted)]">Tax Total</span>
                      <p className="mt-1 font-mono text-base font-bold text-[var(--color-fg-default)]">
                        {formatMoney(Number(fi.proposed_tax || "0"))}
                      </p>
                      <span className="mt-1 text-[11px] text-[var(--color-fg-muted)]">
                        Delta: {formatMoney(Number(fi.tax_delta || "0"))}
                      </span>
                    </Card>
                  </div>
                </div>
              )}

              {/* Terms Diff */}
              {termsDiff && Object.keys(termsDiff).length > 0 && (
                <Card className="p-4">
                  <h3 className="mb-2 text-xs font-bold text-[var(--color-fg-muted)] uppercase tracking-wider">
                    Quotation Terms Changes
                  </h3>
                  <div className="space-y-2 text-xs">
                    {Object.entries(termsDiff).map(([termKey, termVal]: [string, any]) => (
                      <div key={termKey} className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-1.5 last:border-0 last:pb-0">
                        <span className="font-medium text-[var(--color-fg-muted)] capitalize">
                          {termKey.replace("_", " ")}
                        </span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="line-through text-[var(--color-fg-muted)]">{termVal.old || "(None)"}</span>
                          <ArrowRight className="h-3 w-3 text-[var(--color-primary-700)]" aria-hidden="true" />
                          <span className="font-semibold text-[var(--color-fg-default)]">{termVal.proposed || "(None)"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Line Items Diff */}
              <div>
                <h3 className="mb-2 text-xs font-bold text-[var(--color-fg-muted)] uppercase tracking-wider">
                  Line Items Diff ({modifiedLines.length} modified, {addedLines.length} added, {removedLines.length} removed)
                </h3>

                {/* Modified Lines Table */}
                {modifiedLines.length > 0 && (
                  <div className="mb-3 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
                    <div className="bg-[var(--color-bg-subtle)] px-3 py-1.5 text-xs font-bold text-[var(--color-fg-muted)] uppercase tracking-wider border-b border-[var(--color-border-subtle)]">
                      Modified Lines
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs" aria-label="Modified lines diff">
                        <thead className="border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)]/40 text-[11px] text-[var(--color-fg-muted)] font-semibold uppercase">
                          <tr>
                            <th className="px-3 py-2">Line</th>
                            <th className="px-3 py-2">Product</th>
                            <th className="px-3 py-2">Changed Fields</th>
                            <th className="px-3 py-2 text-right">Line Total Delta</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border-subtle)]">
                          {modifiedLines.map((ml: any, idx: number) => (
                            <tr key={idx} className="hover:bg-[var(--color-bg-subtle)]/30">
                              <td className="px-3 py-2.5 font-mono text-[var(--color-fg-muted)]">
                                #{ml.line_order}
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="font-semibold text-[var(--color-fg-default)]">{ml.name}</span>
                                <span className="ml-1 text-[11px] text-[var(--color-fg-muted)] font-mono">({ml.sku})</span>
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="space-y-1">
                                  {Object.entries(ml.changes || {}).map(([fKey, fVal]: [string, any]) => (
                                    <div key={fKey} className="flex items-center gap-1.5 text-[11px] font-mono">
                                      <span className="font-medium text-[var(--color-fg-muted)] capitalize">{fKey.replace("_", " ")}:</span>
                                      <span className="line-through text-[var(--color-fg-muted)]">{fVal.old}</span>
                                      <ArrowRight className="h-2.5 w-2.5 text-[var(--color-primary-700)]" aria-hidden="true" />
                                      <span className="font-bold text-[var(--color-fg-default)]">{fVal.proposed}</span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono font-medium text-[var(--color-fg-default)]">
                                <div>{formatMoney(Number(ml.proposed_line_total))}</div>
                                <span className="text-[10px] text-[var(--color-fg-muted)]">
                                  ({Number(ml.delta_line_total) >= 0 ? "+" : ""}{formatMoney(Number(ml.delta_line_total))})
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Added Lines Table */}
                {addedLines.length > 0 && (
                  <div className="mb-3 overflow-hidden rounded-[var(--radius-md)] border border-emerald-200 bg-[var(--color-bg-surface)]">
                    <div className="bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-[var(--color-success-700)] border-b border-emerald-200">
                      Added Lines
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs" aria-label="Added lines">
                        <thead className="border-b border-[var(--color-border-subtle)] text-[11px] text-[var(--color-fg-muted)] uppercase font-semibold">
                          <tr>
                            <th className="px-3 py-2">Line</th>
                            <th className="px-3 py-2">Product</th>
                            <th className="px-3 py-2">Qty</th>
                            <th className="px-3 py-2">Price</th>
                            <th className="px-3 py-2 text-right">Line Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border-subtle)]">
                          {addedLines.map((al: any, idx: number) => (
                            <tr key={idx}>
                              <td className="px-3 py-2 font-mono text-[var(--color-fg-muted)]">#{al.line_order}</td>
                              <td className="px-3 py-2 font-medium text-[var(--color-fg-default)]">{al.name} ({al.sku})</td>
                              <td className="px-3 py-2 font-mono">{al.quantity} {al.unit}</td>
                              <td className="px-3 py-2 font-mono">{formatMoney(Number(al.unit_price))}</td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-[var(--color-fg-default)]">
                                {formatMoney(Number(al.line_total))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Removed Lines Table */}
                {removedLines.length > 0 && (
                  <div className="mb-3 overflow-hidden rounded-[var(--radius-md)] border border-red-200 bg-[var(--color-bg-surface)]">
                    <div className="bg-red-50 px-3 py-1.5 text-xs font-semibold text-[var(--color-danger-700)] border-b border-red-200">
                      Removed Lines
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs" aria-label="Removed lines">
                        <thead className="border-b border-[var(--color-border-subtle)] text-[11px] text-[var(--color-fg-muted)] uppercase font-semibold">
                          <tr>
                            <th className="px-3 py-2">Line</th>
                            <th className="px-3 py-2">Product</th>
                            <th className="px-3 py-2 text-right">Prior Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border-subtle)]">
                          {removedLines.map((rl: any, idx: number) => (
                            <tr key={idx}>
                              <td className="px-3 py-2 font-mono line-through text-[var(--color-fg-muted)]">#{rl.line_order}</td>
                              <td className="px-3 py-2 line-through text-[var(--color-fg-muted)]">{rl.name} ({rl.sku})</td>
                              <td className="px-3 py-2 text-right font-mono line-through text-[var(--color-fg-muted)]">
                                {formatMoney(Number(rl.line_total))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Policy Evaluation Checklist */}
              {proposal.policy_snapshots && (() => {
                const policySnap = proposal.policy_snapshots as Record<string, any>;
                const triggers = (policySnap?.triggers as any[]) || [];
                return (
                  <Card className="p-4">
                    <h3 className="mb-2 text-xs font-bold text-[var(--color-fg-muted)] uppercase tracking-wider">
                      Commercial Policy Evaluation
                    </h3>
                    <div className="space-y-2 text-xs">
                      {triggers.length > 0 ? (
                        triggers.map((trig: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2.5 rounded-[var(--radius-sm)] border border-amber-200 bg-amber-50 p-2.5 text-[var(--color-fg-default)]"
                          >
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                            <div>
                              <p className="font-semibold text-[var(--color-warning-700)]">{trig.rule_name}</p>
                              <p className="mt-0.5 text-xs text-[var(--color-fg-muted)]">{trig.description}</p>
                              <div className="mt-1 flex items-center gap-2 text-[11px] font-mono text-[var(--color-fg-default)]">
                                <span>Threshold: {trig.threshold_value}</span>
                                <span>•</span>
                                <span className="font-semibold">Measured: {trig.actual_value}</span>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-[var(--color-success-700)] font-medium">
                          <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                          <span>All commercial parameters are within policy thresholds.</span>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })()}

              {/* Decisions History */}
              {proposal.decisions && proposal.decisions.length > 0 && (
                <Card className="p-4">
                  <h3 className="mb-2 text-xs font-bold text-[var(--color-fg-muted)] uppercase tracking-wider">
                    Approval Decision History
                  </h3>
                  <div className="space-y-2">
                    {proposal.decisions.map((dec) => (
                      <div
                        key={dec.id}
                        className="rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)]/40 p-2.5 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[var(--color-fg-default)]">
                            {dec.reviewer_name || "Manager"}
                          </span>
                          {getStatusBadge(dec.decision)}
                        </div>
                        {(dec.notes || dec.rejection_reason) && (
                          <p className="mt-1 text-xs text-[var(--color-fg-default)] italic">
                            &ldquo;{dec.notes || dec.rejection_reason}&rdquo;
                          </p>
                        )}
                        <div className="mt-1 text-[10px] text-[var(--color-fg-muted)]">
                          <DateTimeText value={dec.created_at} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Action Bar */}
              <div className="border-t border-[var(--color-border-subtle)] pt-4">
                {/* Maker-Checker notice if user is proposer */}
                {isProposer && proposal.status === "pending_review" && (
                  <div
                    role="region"
                    aria-label="Maker-Checker Security Notice"
                    className="mb-3 flex items-center gap-2 rounded-[var(--radius-sm)] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-[var(--color-warning-700)]"
                  >
                    <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                    <span>
                      Maker-checker security invariant: As the proposer of this change, you cannot approve it. Another authorized manager must review.
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-end gap-3">
                  <Button variant="outline" onClick={onClose} size="sm">
                    Close
                  </Button>

                  {/* Draft Status Actions */}
                  {proposal.status === "draft" && isProposer && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancel}
                        disabled={cancelMutation.isPending}
                        className="text-[var(--color-danger-700)] hover:bg-red-50 border-red-200"
                      >
                        Cancel Draft
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSubmit}
                        disabled={submitMutation.isPending}
                      >
                        {submitMutation.isPending ? "Submitting..." : "Submit for Review"}
                      </Button>
                    </>
                  )}

                  {/* Pending Review Actions */}
                  {proposal.status === "pending_review" && (
                    <>
                      {/* Reject button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRejectionReason("");
                          setRejectError(null);
                          setIsRejectOpen(true);
                        }}
                        disabled={!isManagerOrAdmin || isProposer}
                        className="text-[var(--color-danger-700)] hover:bg-red-50 border-red-200"
                        title={isProposer ? "Proposer cannot review own proposal" : undefined}
                      >
                        Reject Proposal
                      </Button>

                      {/* Approve button */}
                      <Button
                        size="sm"
                        onClick={() => {
                          setApprovalNotes("");
                          setIsApproveOpen(true);
                        }}
                        disabled={!canApproveOrReject}
                        title={
                          isProposer
                            ? "Maker-checker violation: Proposer cannot approve their own proposal"
                            : !isManagerOrAdmin
                            ? "Commercial approval requires Sales Manager or Admin"
                            : undefined
                        }
                        className="bg-[var(--color-success-700)] text-white hover:bg-[var(--color-success-800)]"
                      >
                        Approve Proposal
                      </Button>
                    </>
                  )}

                  {/* Approved Status Actions -> Atomic Commit */}
                  {proposal.status === "approved" && (
                    <Button
                      size="sm"
                      onClick={handleCommit}
                      disabled={commitMutation.isPending}
                      className="gap-1.5"
                    >
                      <GitCommit className="h-4 w-4" aria-hidden="true" />
                      <span>
                        {commitMutation.isPending
                          ? "Committing..."
                          : `Commit to Revision #${(proposal.base_revision_number || 1) + 1}`}
                      </span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </SheetBody>
      </SheetPopup>

      {/* Reject Modal */}
      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogPopup className="sm:max-w-md bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] text-[var(--color-fg-default)] rounded-[var(--radius-lg)] shadow-xl p-6">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-[var(--color-danger-700)]">
            <XCircle className="h-5 w-5 text-red-600" aria-hidden="true" />
            <span>Reject Change Proposal</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-[var(--color-fg-muted)] mt-1">
            Rejection requires a non-empty commercial reason. This reason will be recorded in the audit trail and visible to the proposer.
          </DialogDescription>
          <div className="space-y-3 pt-3">
            <div>
              <label htmlFor="rejection-reason" className="block text-xs font-semibold text-[var(--color-fg-default)]">
                Rejection Reason <span className="text-[var(--color-danger-700)]">*</span>
              </label>
              <textarea
                id="rejection-reason"
                rows={3}
                value={rejectionReason}
                onChange={(e) => {
                  setRejectionReason(e.target.value);
                  if (rejectError) setRejectError(null);
                }}
                placeholder="Specify why this proposal cannot be accepted (e.g. margin below target, terms unacceptable)..."
                className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-2.5 text-xs text-[var(--color-fg-default)] placeholder:text-[var(--color-fg-muted)] focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)]"
              />
              {rejectError && (
                <p className="mt-1 text-xs text-[var(--color-danger-700)] font-medium">{rejectError}</p>
              )}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-3">
            <Button variant="outline" size="sm" onClick={() => setIsRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReject}
              disabled={rejectMutation.isPending}
              className="bg-[var(--color-danger-700)] text-white hover:bg-[var(--color-danger-800)] border-transparent"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </div>
        </DialogPopup>
      </Dialog>

      {/* Approve Modal */}
      <Dialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
        <DialogPopup className="sm:max-w-md bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] text-[var(--color-fg-default)] rounded-[var(--radius-lg)] shadow-xl p-6">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-[var(--color-success-700)]">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            <span>Approve Change Proposal</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-[var(--color-fg-muted)] mt-1">
            Confirm approval of proposal <span className="font-semibold text-[var(--color-fg-default)]">{proposal?.title}</span>. Once approved, it can be committed atomically as a new revision.
          </DialogDescription>
          <div className="space-y-3 pt-3">
            <div>
              <label htmlFor="approval-notes" className="block text-xs font-semibold text-[var(--color-fg-default)]">
                Approval Notes (Optional)
              </label>
              <textarea
                id="approval-notes"
                rows={2}
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Optional notes or instructions for the account team..."
                className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-2.5 text-xs text-[var(--color-fg-default)] placeholder:text-[var(--color-fg-muted)] focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)]"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-3">
            <Button variant="outline" size="sm" onClick={() => setIsApproveOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={approveMutation.isPending}
              className="bg-[var(--color-success-700)] text-white hover:bg-[var(--color-success-800)]"
            >
              {approveMutation.isPending ? "Approving..." : "Confirm Approval"}
            </Button>
          </div>
        </DialogPopup>
      </Dialog>
    </Sheet>
  );
}
