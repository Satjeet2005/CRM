"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Download,
  RefreshCw,
  Search,
  ChevronRight,
  RotateCcw,
  Check,
  FileCheck2,
  ShieldAlert,
  ArrowRight,
  Clock,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/page-container";
import {
  Button,
  Input,
  Badge,
  Card,
  Sheet,
  SheetPopup,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
} from "@/components/sakani";
import { LoadingSkeleton } from "@/components/data-display/loading-skeleton";
import { ErrorState } from "@/components/data-display/error-state";
import { MoneyText } from "@/components/data-display/money-text";
import { DateTimeText } from "@/components/data-display/date-time-text";
import { useAuth } from "@/hooks/use-auth";
import { useCatalogProducts } from "@/features/catalog/api";
import {
  useRFQ,
  useRFQLines,
  useRFQLineDetail,
  useLineDecision,
  useBulkAcceptExactMatches,
  useRematchRFQ,
  useCreateQuoteFromRFQ,
  type RFQLine,
  type Candidate,
} from "@/features/rfqs/api";

export default function RFQReviewStudioPage() {
  const router = useRouter();
  const params = useParams();
  const rfqId = (params?.rfqId as string) || "";
  const { role, hasPermission } = useAuth();
  const canSeeCost = hasPermission("catalog:cost");

  // Queries
  const {
    data: rfq,
    isLoading: rfqLoading,
    isError: rfqIsError,
    error: rfqError,
    refetch: refetchRFQ,
  } = useRFQ(rfqId);

  const [selectedLineId, setSelectedLineId] = React.useState<string | null>(null);
  const [filterStatus, setFilterStatus] = React.useState<string>("all");
  const [lineSearch, setLineSearch] = React.useState<string>("");
  const [page, setPage] = React.useState(1);

  const {
    data: linesData,
    isLoading: _linesLoading,
    refetch: _refetchLines,
  } = useRFQLines(rfqId, {
    match_status: filterStatus === "all" ? undefined : filterStatus,
    page,
    page_size: 50,
  });

  const { data: lineDetail, isLoading: lineDetailLoading } = useRFQLineDetail(
    rfqId,
    selectedLineId
  );

  // Mutations
  const lineDecisionMutation = useLineDecision(rfqId);
  const bulkAcceptMutation = useBulkAcceptExactMatches(rfqId);
  const rematchMutation = useRematchRFQ(rfqId);
  const createQuoteMutation = useCreateQuoteFromRFQ(rfqId);

  // Manual catalog search in inspector
  const [productSearch, setProductSearch] = React.useState("");
  const [manualSelectedProductId, setManualSelectedProductId] = React.useState<string | null>(null);
  const [manualReasonCode, setManualReasonCode] = React.useState("MANUAL_OVERRIDE");
  const [manualNotes, setManualNotes] = React.useState("");

  const { data: catalogResults } = useCatalogProducts({
    search: productSearch || undefined,
    page_size: 10,
  });

  // Export CSV handler
  const handleExportCSV = async () => {
    try {
      const res = await fetch(`/api/v1/rfqs/${rfqId}/export.csv`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("CSV Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${rfq?.rfq_number || "rfq"}_line_items.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("CSV export downloaded successfully.");
    } catch (err: any) {
      toast.error(`Export failed: ${err.message}`);
    }
  };

  // Bulk Accept Exact Matches
  const handleBulkAccept = () => {
    if (!linesData?.items) return;
    const exactLines = linesData.items.filter((l) => l.match_status === "exact_match");
    if (exactLines.length === 0) {
      toast.info("No exact match lines available to bulk-accept.");
      return;
    }

    const expectedVersions: Record<string, number> = {};
    const lineIds: string[] = [];
    exactLines.forEach((l) => {
      lineIds.push(l.id);
      expectedVersions[l.id] = l.version;
    });

    bulkAcceptMutation.mutate(
      { line_ids: lineIds, expected_versions: expectedVersions },
      {
        onSuccess: (res) => {
          toast.success(`Bulk-accepted ${res.accepted_count} exact matches!`);
        },
        onError: (err: any) => {
          toast.error(`Bulk acceptance failed: ${err.message}`);
        },
      }
    );
  };

  // Create Quote Draft
  const handleCreateQuote = () => {
    if (!rfq?.is_ready_to_quote) {
      toast.error("RFQ is not ready to quote yet. All lines must be matched and free of errors.");
      return;
    }

    createQuoteMutation.mutate(
      { expected_rfq_version: rfq.version, notes: "Generated from RFQ Review Studio" },
      {
        onSuccess: (res) => {
          toast.success(`Quote draft ${res.quote_number} generated!`);
          router.push(res.quote_id ? `/app/quotes/${res.quote_id}` : `/app/quotes`);
        },
        onError: (err: any) => {
          toast.error(`Quotation conversion failed: ${err.message}`);
        },
      }
    );
  };

  // Line Decision Handlers
  const handleAcceptSuggestion = (candidate: Candidate) => {
    if (!lineDetail) return;
    lineDecisionMutation.mutate(
      {
        lineId: lineDetail.id,
        payload: {
          action: "accept_suggestion",
          candidate_id: candidate.id,
          reason_code: "EXACT_VERIFIED",
          notes: "Accepted in Review Studio",
          expected_version: lineDetail.version,
        },
      },
      {
        onSuccess: () => {
          toast.success(`Line #${lineDetail.source_row_number} matched to ${candidate.product_sku}`);
        },
        onError: (err: any) => {
          toast.error(`Decision failed: ${err.message}`);
        },
      }
    );
  };

  const handleManualProductConfirm = () => {
    if (!lineDetail || !manualSelectedProductId) {
      toast.error("Please choose a catalog product first.");
      return;
    }

    lineDecisionMutation.mutate(
      {
        lineId: lineDetail.id,
        payload: {
          action: "choose_product",
          product_id: manualSelectedProductId,
          reason_code: manualReasonCode,
          notes: manualNotes.trim() || undefined,
          expected_version: lineDetail.version,
        },
      },
      {
        onSuccess: () => {
          toast.success(`Line #${lineDetail.source_row_number} assigned manually.`);
          setManualSelectedProductId(null);
          setProductSearch("");
        },
        onError: (err: any) => {
          toast.error(`Manual assignment failed: ${err.message}`);
        },
      }
    );
  };

  const handleMarkUnmatched = () => {
    if (!lineDetail) return;
    lineDecisionMutation.mutate(
      {
        lineId: lineDetail.id,
        payload: {
          action: "mark_unmatched",
          reason_code: "NO_CATALOG_MATCH",
          notes: manualNotes.trim() || "Item not available in standard catalog",
          expected_version: lineDetail.version,
        },
      },
      {
        onSuccess: () => {
          toast.success(`Line #${lineDetail.source_row_number} marked unmatched.`);
        },
        onError: (err: any) => {
          toast.error(`Action failed: ${err.message}`);
        },
      }
    );
  };

  const handleRevertDecision = () => {
    if (!lineDetail) return;
    lineDecisionMutation.mutate(
      {
        lineId: lineDetail.id,
        payload: {
          action: "revert",
          expected_version: lineDetail.version,
        },
      },
      {
        onSuccess: () => {
          toast.success(`Line #${lineDetail.source_row_number} reverted to original state.`);
        },
        onError: (err: any) => {
          toast.error(`Revert failed: ${err.message}`);
        },
      }
    );
  };

  if (rfqLoading) {
    return (
      <PageContainer>
        <div className="space-y-4 max-w-5xl py-8">
          <LoadingSkeleton rows={6} />
        </div>
      </PageContainer>
    );
  }

  if (rfqIsError || !rfq) {
    return (
      <PageContainer>
        <ErrorState
          title="Failed to load RFQ"
          message={rfqError?.message || "RFQ record could not be loaded."}
          onRetry={refetchRFQ}
        />
      </PageContainer>
    );
  }

  const exactEligibleCount = linesData?.items?.filter((l) => l.match_status === "exact_match").length || 0;
  const filteredLines = linesData?.items?.filter((l) => {
    if (!lineSearch.trim()) return true;
    const term = lineSearch.toLowerCase();
    return (
      l.raw_description.toLowerCase().includes(term) ||
      l.normalized_description.toLowerCase().includes(term) ||
      l.selected_product?.product_sku?.toLowerCase().includes(term) ||
      l.top_candidate?.product_sku?.toLowerCase().includes(term)
    );
  }) || [];

  return (
    <PageContainer>
      {/* Studio Header Bar */}
      <div className="mb-4">
        <Link
          href="/app/rfqs"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg-default)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to RFQs</span>
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-[var(--color-border-subtle)] pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-[var(--color-bg-subtle)] text-[var(--color-fg-default)] rounded border border-[var(--color-border-subtle)]">
              {rfq.rfq_number}
            </span>
            <h1 className="text-xl font-bold tracking-tight text-[var(--color-fg-default)]">{rfq.title}</h1>
            <span className="text-xs text-[var(--color-fg-muted)] font-mono">v{rfq.version}</span>
            {rfq.status === "ready_to_quote" ? (
              <Badge variant="success" emphasis="subtle">Ready to Quote</Badge>
            ) : rfq.status === "needs_review" ? (
              <Badge variant="warning" emphasis="subtle">Needs Review</Badge>
            ) : rfq.status === "quoted" ? (
              <Badge variant="info" emphasis="subtle">Quoted</Badge>
            ) : (
              <Badge variant="neutral" emphasis="subtle">{rfq.status}</Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-[var(--color-fg-muted)]">
            <span>
              Customer: <strong className="text-[var(--color-fg-default)]">{rfq.account_name}</strong>
            </span>
            <span>•</span>
            <span>
              Opportunity: <strong className="text-[var(--color-fg-default)]">{rfq.opportunity_name}</strong>
            </span>
            {rfq.customer_reference && (
              <>
                <span>•</span>
                <span>
                  Ref: <strong className="text-[var(--color-fg-default)]">{rfq.customer_reference}</strong>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </Button>

          {(role === "catalog_manager" || role === "admin") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (confirm("Re-run deterministic matching engine against the latest catalog?")) {
                  rematchMutation.mutate({ clear_manual_decisions: false });
                }
              }}
              disabled={rematchMutation.isPending || rfq.status === "quoted"}
              className="flex items-center gap-1.5 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${rematchMutation.isPending ? "animate-spin" : ""}`} />
              <span>Rematch</span>
            </Button>
          )}

          {/* Create Quote Gate */}
          <div className="relative group">
            <Button
              size="sm"
              onClick={handleCreateQuote}
              disabled={!rfq.is_ready_to_quote || createQuoteMutation.isPending || rfq.status === "quoted"}
              className="flex items-center gap-1.5 text-xs bg-[var(--color-success-600)] hover:bg-[var(--color-success-700)] text-white disabled:opacity-50"
            >
              <FileCheck2 className="w-4 h-4" />
              <span>{rfq.status === "quoted" ? "Converted to Quote" : "Create Quotation"}</span>
            </Button>

            {!rfq.is_ready_to_quote && rfq.status !== "quoted" && rfq.blocking_reasons && (
              <div className="absolute right-0 top-full mt-2 w-72 p-3 bg-[var(--color-bg-surface)] text-[var(--color-fg-default)] text-xs rounded-[var(--radius-lg)] shadow-lg border border-[var(--color-border-subtle)] hidden group-hover:block z-50">
                <div className="font-semibold text-[var(--color-danger-700)] mb-1 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Quotation Gate Blocked</span>
                </div>
                <ul className="list-disc pl-4 space-y-1 text-[var(--color-fg-muted)]">
                  {rfq.blocking_reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress Strip */}
      <div className="flex flex-wrap items-center justify-between text-xs py-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] px-4 rounded-[var(--radius-md)] mt-3 gap-2">
        <div className="flex items-center gap-1.5 text-[var(--color-success-700)] font-semibold">
          <CheckCircle2 className="w-4 h-4" />
          <span>1. Imported ({rfq.source_filename})</span>
        </div>
        <ChevronRight className="w-4 h-4 text-[var(--color-fg-muted)]" />
        <div className="flex items-center gap-1.5 text-[var(--color-success-700)] font-semibold">
          <CheckCircle2 className="w-4 h-4" />
          <span>2. Normalized ({rfq.total_lines} lines)</span>
        </div>
        <ChevronRight className="w-4 h-4 text-[var(--color-fg-muted)]" />
        <div
          className={`flex items-center gap-1.5 font-semibold ${
            rfq.resolved_lines_count === rfq.total_lines ? "text-[var(--color-success-700)]" : "text-[var(--color-warning-700)]"
          }`}
        >
          {rfq.resolved_lines_count === rfq.total_lines ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
          <span>3. Review Studio ({rfq.resolved_lines_count}/{rfq.total_lines} resolved)</span>
        </div>
        <ChevronRight className="w-4 h-4 text-[var(--color-fg-muted)]" />
        <div
          className={`flex items-center gap-1.5 font-semibold ${
            rfq.is_ready_to_quote ? "text-[var(--color-success-700)]" : "text-[var(--color-fg-muted)]"
          }`}
        >
          {rfq.is_ready_to_quote ? <CheckCircle2 className="w-4 h-4 text-[var(--color-success-700)]" /> : <Clock className="w-4 h-4" />}
          <span>4. Ready to Quote</span>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
        <Card className="p-3 text-xs">
          <span className="text-[var(--color-fg-muted)] font-medium">Total Lines</span>
          <div className="text-lg font-bold text-[var(--color-fg-default)] mt-0.5">{rfq.total_lines}</div>
        </Card>
        <Card className="p-3 text-xs">
          <span className="text-[var(--color-fg-muted)] font-medium">Resolved / Matched</span>
          <div className="text-lg font-bold text-[var(--color-success-700)] mt-0.5">
            {rfq.resolved_lines_count}
          </div>
        </Card>
        <Card className="p-3 text-xs">
          <span className="text-[var(--color-fg-muted)] font-medium">Exact Matches</span>
          <div className="text-lg font-bold text-[var(--color-primary-700)] mt-0.5">
            {rfq.exact_matches_count}
          </div>
        </Card>
        <Card className="p-3 text-xs">
          <span className="text-[var(--color-fg-muted)] font-medium">Needs Review</span>
          <div className="text-lg font-bold text-[var(--color-warning-700)] mt-0.5">
            {rfq.needs_review_lines_count}
          </div>
        </Card>
        <Card className="p-3 text-xs">
          <span className="text-[var(--color-fg-muted)] font-medium">Invalid Lines</span>
          <div className="text-lg font-bold text-[var(--color-danger-700)] mt-0.5">
            {rfq.invalid_lines_count}
          </div>
        </Card>
      </div>

      {/* Toolbar & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between mt-6">
        <div className="relative w-full sm:w-80">
          <Input
            placeholder="Search description, spec, SKU..."
            value={lineSearch}
            onChange={(e) => setLineSearch(e.target.value)}
            leadingIcon={<Search className="h-4 w-4 text-[var(--color-fg-muted)]" />}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-1 bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] p-1 rounded-[var(--radius-md)] text-xs">
            {[
              { id: "all", label: "All" },
              { id: "needs_review", label: "Needs Review" },
              { id: "exact_match", label: "Exact" },
              { id: "matched", label: "Matched" },
              { id: "unmatched", label: "Unmatched" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setFilterStatus(tab.id);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-[var(--radius-sm)] text-xs font-medium transition-colors cursor-pointer ${
                  filterStatus === tab.id
                    ? "bg-[var(--color-bg-surface)] text-[var(--color-fg-default)] shadow-xs font-semibold"
                    : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg-default)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Bulk Accept Button */}
          {exactEligibleCount > 0 && rfq.status !== "quoted" && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkAccept}
              disabled={bulkAcceptMutation.isPending}
              className="text-xs font-semibold text-[var(--color-success-700)] bg-[var(--color-success-50)] hover:bg-[var(--color-success-100)] border-[var(--color-success-300)]"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1 text-[var(--color-success-600)]" />
              <span>Bulk Accept Exact ({exactEligibleCount})</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Review Table */}
      <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[var(--color-bg-subtle)] text-[var(--color-fg-muted)] border-b border-[var(--color-border-subtle)] uppercase font-semibold">
              <tr>
                <th className="px-3.5 py-2.5 w-12 text-center">#</th>
                <th className="px-3.5 py-2.5">Raw / Normalized Description</th>
                <th className="px-3.5 py-2.5 text-center">Qty / UOM</th>
                <th className="px-3.5 py-2.5">Match Status</th>
                <th className="px-3.5 py-2.5">Resolved / Top Suggested Product</th>
                <th className="px-3.5 py-2.5 text-center">Score</th>
                <th className="px-3.5 py-2.5 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {filteredLines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-[var(--color-fg-muted)]">
                    No line items match your current filter.
                  </td>
                </tr>
              ) : (
                filteredLines.map((line: RFQLine) => {
                  const isSelected = selectedLineId === line.id;
                  const isMatched = line.match_status === "matched";
                  const isExact = line.match_status === "exact_match";
                  const isInvalid = line.normalization_status === "invalid";

                  return (
                    <tr
                      key={line.id}
                      onClick={() => setSelectedLineId(line.id)}
                      className={`hover:bg-[var(--color-bg-subtle)]/60 cursor-pointer transition-colors ${
                        isSelected ? "bg-[var(--color-bg-subtle)] font-medium" : ""
                      }`}
                    >
                      <td className="px-3.5 py-3 text-center font-mono text-[var(--color-fg-muted)]">
                        {line.source_row_number}
                      </td>

                      <td className="px-3.5 py-3 max-w-xs">
                        <div className="font-semibold text-[var(--color-fg-default)] truncate">
                          {line.raw_description}
                        </div>
                        <div className="text-[11px] text-[var(--color-fg-muted)] font-mono truncate mt-0.5">
                          norm: {line.normalized_description || "—"}
                        </div>
                      </td>

                      <td className="px-3.5 py-3 text-center whitespace-nowrap font-mono">
                        {line.parsed_quantity ? (
                          <span className="text-[var(--color-fg-default)] font-semibold">
                            {line.parsed_quantity} {line.canonical_unit || ""}
                          </span>
                        ) : (
                          <span className="text-[var(--color-danger-700)] font-semibold">Invalid Qty</span>
                        )}
                      </td>

                      <td className="px-3.5 py-3 whitespace-nowrap">
                        {isMatched ? (
                          <Badge variant="success" emphasis="subtle">Matched</Badge>
                        ) : isExact ? (
                          <Badge variant="info" emphasis="subtle">Exact Match</Badge>
                        ) : isInvalid ? (
                          <Badge variant="danger" emphasis="subtle">Invalid</Badge>
                        ) : line.match_status === "unmatched" ? (
                          <Badge variant="neutral" emphasis="subtle">Unmatched</Badge>
                        ) : (
                          <Badge variant="warning" emphasis="subtle">Needs Review</Badge>
                        )}
                      </td>

                      <td className="px-3.5 py-3 max-w-sm">
                        {line.selected_product ? (
                          <div>
                            <span className="font-mono font-semibold text-[var(--color-fg-default)]">
                              {line.selected_product.product_sku}
                            </span>
                            <div className="text-[11px] text-[var(--color-fg-muted)] truncate mt-0.5">
                              {line.selected_product.product_name}
                            </div>
                          </div>
                        ) : line.top_candidate ? (
                          <div>
                            <span className="font-mono text-[var(--color-fg-muted)]">
                              {line.top_candidate.product_sku}
                            </span>
                            <div className="text-[11px] text-[var(--color-fg-muted)] truncate mt-0.5">
                              {line.top_candidate.product_name}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[var(--color-fg-muted)] italic text-[11px]">No candidate</span>
                        )}
                      </td>

                      <td className="px-3.5 py-3 text-center font-mono">
                        {line.top_candidate ? (
                          <span
                            className={`font-semibold ${
                              line.top_candidate.similarity_score >= 0.75
                                ? "text-[var(--color-success-700)]"
                                : line.top_candidate.similarity_score >= 0.6
                                ? "text-[var(--color-warning-700)]"
                                : "text-[var(--color-fg-muted)]"
                            }`}
                          >
                            {(line.top_candidate.similarity_score * 100).toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-[var(--color-fg-muted)]">—</span>
                        )}
                      </td>

                      <td className="px-3.5 py-3 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs px-2 gap-1 text-[var(--color-primary-700)]"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLineId(line.id);
                          }}
                        >
                          <span>Review</span>
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right Side Inspector Sheet (Base UI Sakani Sheet) */}
      <Sheet open={!!selectedLineId} onOpenChange={(open) => !open && setSelectedLineId(null)}>
        <SheetPopup size="lg" className="overflow-y-auto">
          {lineDetailLoading ? (
            <div className="space-y-4 p-6">
              <LoadingSkeleton rows={5} />
            </div>
          ) : lineDetail ? (
            <div className="flex flex-col h-full">
              {/* Sheet Header */}
              <SheetHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] rounded text-[var(--color-fg-default)]">
                      Line #{lineDetail.source_row_number}
                    </span>
                    <span className="text-xs text-[var(--color-fg-muted)] font-mono">v{lineDetail.version}</span>
                  </div>
                  {lineDetail.match_status === "matched" ? (
                    <Badge variant="success" emphasis="subtle">Matched</Badge>
                  ) : lineDetail.match_status === "exact_match" ? (
                    <Badge variant="info" emphasis="subtle">Exact Match</Badge>
                  ) : lineDetail.normalization_status === "invalid" ? (
                    <Badge variant="danger" emphasis="subtle">Invalid</Badge>
                  ) : (
                    <Badge variant="warning" emphasis="subtle">{lineDetail.match_status}</Badge>
                  )}
                </div>
                <SheetTitle className="text-base font-bold text-[var(--color-fg-default)] text-left mt-2">
                  {lineDetail.raw_description}
                </SheetTitle>
                <SheetDescription className="text-xs font-mono text-left text-[var(--color-fg-muted)]">
                  Normalized: {lineDetail.normalized_description || "None"}
                </SheetDescription>
              </SheetHeader>

              <SheetBody className="space-y-6">
                {/* Raw & Normalization Info */}
                <Card className="p-3 text-xs space-y-2">
                  <div className="font-semibold text-[var(--color-fg-default)] flex items-center justify-between">
                    <span>Parsed Quantity & Dimensions</span>
                    <span className="font-mono text-[var(--color-fg-muted)] font-semibold">
                      {lineDetail.parsed_quantity || "None"} {lineDetail.canonical_unit || ""}
                    </span>
                  </div>
                  {lineDetail.specifications && Object.keys(lineDetail.specifications).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {Object.entries(lineDetail.specifications).map(([k, v]) => (
                        <span key={k} className="px-2 py-0.5 bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] rounded text-[11px] font-mono text-[var(--color-fg-default)]">
                          {k}: <strong>{String(v)}</strong>
                        </span>
                      ))}
                    </div>
                  )}
                  {Array.isArray(lineDetail.diagnostics?.issues) && (lineDetail.diagnostics.issues as any[]).length > 0 && (
                    <div className="p-2.5 bg-[var(--color-danger-50)] border border-[var(--color-danger-200)] rounded-[var(--radius-sm)] text-[var(--color-danger-700)] text-[11px] space-y-1">
                      <strong className="block font-semibold">Validation Diagnostics:</strong>
                      {(lineDetail.diagnostics.issues as any[]).map((iss: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-[var(--color-danger-600)] shrink-0" />
                          <span>[{iss.code}] {iss.detail}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Current Resolution State */}
                {lineDetail.selected_product && (
                  <Card className="p-3 bg-[var(--color-success-50)]/40 border-[var(--color-success-200)] text-xs space-y-2">
                    <div className="flex items-center justify-between font-semibold text-[var(--color-success-800)]">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-[var(--color-success-600)]" />
                        <span>Assigned Catalog Product</span>
                      </span>
                      {rfq.status !== "quoted" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleRevertDecision}
                          disabled={lineDecisionMutation.isPending}
                          className="h-7 text-[11px] border-[var(--color-success-300)] hover:bg-[var(--color-success-100)]"
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          <span>Revert</span>
                        </Button>
                      )}
                    </div>
                    <div className="font-mono font-bold text-[var(--color-fg-default)]">
                      {lineDetail.selected_product.product_sku} — {lineDetail.selected_product.product_name}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[var(--color-fg-muted)] pt-1 border-t border-[var(--color-border-subtle)]">
                      <span>Base UOM: {lineDetail.selected_product.product_base_unit}</span>
                      <span>
                        Sell Price: <MoneyText amount={lineDetail.selected_product.sell_price} currency="INR" />
                      </span>
                      {canSeeCost && lineDetail.selected_product.unit_cost !== null && (
                        <span className="font-semibold text-[var(--color-fg-default)]">
                          Cost: <MoneyText amount={lineDetail.selected_product.unit_cost} currency="INR" />
                        </span>
                      )}
                    </div>
                    {lineDetail.resolution_reason_code && (
                      <div className="text-[11px] text-[var(--color-fg-muted)]">
                        Reason: <em>{lineDetail.resolution_reason_code}</em> {lineDetail.resolution_notes ? `• ${lineDetail.resolution_notes}` : ""}
                      </div>
                    )}
                  </Card>
                )}

                {/* System Candidate Suggestions */}
                {rfq.status !== "quoted" && lineDetail.candidates && lineDetail.candidates.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-[var(--color-fg-default)] uppercase tracking-wider">
                      System Candidate Suggestions ({lineDetail.candidates.length})
                    </h3>

                    <div className="space-y-2.5">
                      {lineDetail.candidates.map((cand) => (
                        <Card
                          key={cand.id}
                          className={`p-3 text-xs transition-colors ${
                            cand.rank === 1 ? "bg-[var(--color-bg-subtle)] border-[var(--color-primary-300)]" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono font-bold text-[var(--color-fg-default)]">
                                  {cand.product_sku}
                                </span>
                                <Badge
                                  variant={cand.similarity_score >= 0.75 ? "success" : cand.similarity_score >= 0.60 ? "warning" : "neutral"}
                                  emphasis="subtle"
                                >
                                  {(cand.similarity_score * 100).toFixed(0)}% Match
                                </Badge>
                                <span className="text-[10px] text-[var(--color-fg-muted)] font-mono uppercase">
                                  {cand.match_method}
                                </span>
                              </div>
                              <div className="text-xs text-[var(--color-fg-default)] font-medium">
                                {cand.product_name}
                              </div>
                              <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-fg-muted)] pt-0.5">
                                <span>UOM: {cand.product_base_unit}</span>
                                <span>Price: <MoneyText amount={cand.sell_price} currency="INR" /></span>
                                {canSeeCost && cand.unit_cost !== null && (
                                  <span className="font-medium text-[var(--color-fg-default)]">
                                    Cost: <MoneyText amount={cand.unit_cost} currency="INR" />
                                  </span>
                                )}
                              </div>
                            </div>

                            <Button
                              size="sm"
                              onClick={() => handleAcceptSuggestion(cand)}
                              disabled={lineDecisionMutation.isPending}
                              className="h-8 text-xs font-medium shrink-0"
                            >
                              <Check className="w-3.5 h-3.5 mr-1" />
                              <span>Accept</span>
                            </Button>
                          </div>

                          {cand.flags && cand.flags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {cand.flags.map((flag, idx) => (
                                <span
                                  key={idx}
                                  className="px-1.5 py-0.5 rounded bg-[var(--color-warning-50)] text-[var(--color-warning-800)] border border-[var(--color-warning-200)] text-[10px] font-mono"
                                >
                                  {flag}
                                </span>
                              ))}
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Manual Product Selector */}
                {rfq.status !== "quoted" && (
                  <Card className="p-3.5 space-y-3">
                    <h3 className="text-xs font-semibold text-[var(--color-fg-default)]">
                      Manual Product Lookup / Override
                    </h3>
                    <div className="relative">
                      <Input
                        placeholder="Search catalog by SKU or keyword..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        leadingIcon={<Search className="h-3.5 w-3.5 text-[var(--color-fg-muted)]" />}
                      />
                    </div>

                    {catalogResults?.items && catalogResults.items.length > 0 && (
                      <div
                        tabIndex={0}
                        role="region"
                        aria-label="Catalog search results"
                        className="max-h-36 overflow-y-auto space-y-1 border border-[var(--color-border-subtle)] rounded-[var(--radius-sm)] p-1 bg-[var(--color-bg-surface)] text-xs"
                      >
                        {catalogResults.items.map((prod) => (
                          <div
                            key={prod.id}
                            onClick={() => setManualSelectedProductId(prod.id)}
                            className={`p-1.5 rounded-[var(--radius-xs)] cursor-pointer transition-colors flex items-center justify-between ${
                              manualSelectedProductId === prod.id
                                ? "bg-[var(--color-primary-600)] text-white font-semibold"
                                : "hover:bg-[var(--color-bg-subtle)] text-[var(--color-fg-default)]"
                            }`}
                          >
                            <div>
                              <span className="font-mono">{prod.sku}</span> — {prod.name}
                            </div>
                            <span className="font-mono text-xs">{prod.base_unit}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {manualSelectedProductId && (
                      <div className="space-y-2.5 pt-2 border-t border-[var(--color-border-subtle)] text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[11px] text-[var(--color-fg-muted)] font-medium block mb-1">Reason Code</label>
                            <select
                              value={manualReasonCode}
                              onChange={(e) => setManualReasonCode(e.target.value)}
                              className="w-full h-8 px-2 text-xs bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-[var(--radius-sm)] text-[var(--color-fg-default)]"
                            >
                              <option value="MANUAL_OVERRIDE">Manual Override</option>
                              <option value="CUSTOMER_REQUEST">Customer Requested Specific Brand</option>
                              <option value="EQUIVALENT_SUBSTITUTE">Equivalent Substitute</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[11px] text-[var(--color-fg-muted)] font-medium block mb-1">Notes</label>
                            <Input
                              placeholder="Optional notes..."
                              value={manualNotes}
                              onChange={(e) => setManualNotes(e.target.value)}
                            />
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={handleManualProductConfirm}
                          disabled={lineDecisionMutation.isPending}
                          className="w-full h-8 text-xs font-semibold"
                        >
                          Confirm Manual Assignment
                        </Button>
                      </div>
                    )}

                    <div className="pt-2 border-t border-[var(--color-border-subtle)] flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleMarkUnmatched}
                        disabled={lineDecisionMutation.isPending}
                        className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg-default)] h-7"
                      >
                        Mark as Unmatched Item
                      </Button>
                    </div>
                  </Card>
                )}

                {/* Decision History Audit Log */}
                {lineDetail.decision_history && lineDetail.decision_history.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-[var(--color-border-subtle)]">
                    <h4 className="text-xs font-semibold text-[var(--color-fg-default)] uppercase tracking-wider">
                      Decision Audit Trail ({lineDetail.decision_history.length})
                    </h4>
                    <div className="space-y-2">
                      {lineDetail.decision_history.map((dh) => (
                        <Card key={dh.id} className="p-2.5 text-[11px] space-y-1">
                          <div className="flex items-center justify-between text-[var(--color-fg-muted)]">
                            <span className="font-semibold text-[var(--color-fg-default)]">{dh.actor_name}</span>
                            <DateTimeText value={dh.created_at} />
                          </div>
                          <div className="font-mono text-[var(--color-fg-default)]">
                            Action: <strong>{dh.decision_type}</strong> • Status: {dh.previous_match_status} →{" "}
                            {dh.new_match_status}
                          </div>
                          {dh.reason_code && (
                            <div className="text-[var(--color-fg-muted)]">
                              Reason: <em>{dh.reason_code}</em> {dh.reason_notes ? `— "${dh.reason_notes}"` : ""}
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </SheetBody>
            </div>
          ) : null}
        </SheetPopup>
      </Sheet>
    </PageContainer>
  );
}
