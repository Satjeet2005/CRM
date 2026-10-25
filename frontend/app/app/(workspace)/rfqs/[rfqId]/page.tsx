"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Download,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronRight,
  RotateCcw,
  Check,
  X,
  FileCheck2,
  ShieldAlert,
  ArrowRight,
  Info,
  Clock,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/data-display/error-state";
import { EmptyState } from "@/components/data-display/empty-state";
import { MoneyText } from "@/components/data-display/money-text";
import { DateTimeText } from "@/components/data-display/date-time-text";
import {
  Sheet,
  SheetPopup,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
  const { user, role } = useAuth();

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
    isLoading: linesLoading,
    refetch: refetchLines,
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
        <div className="space-y-4 max-w-5xl">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-96 w-full rounded-lg" />
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
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-muted rounded border">
              {rfq.rfq_number}
            </span>
            <h1 className="text-xl font-bold tracking-tight text-foreground">{rfq.title}</h1>
            <span className="text-xs text-muted-foreground font-mono">v{rfq.version}</span>
            {rfq.status === "ready_to_quote" ? (
              <StatusBadge variant="success" label="Ready to Quote" />
            ) : rfq.status === "needs_review" ? (
              <StatusBadge variant="warning" label="Needs Review" />
            ) : rfq.status === "quoted" ? (
              <StatusBadge variant="info" label="Quoted" />
            ) : (
              <StatusBadge variant="neutral" label={rfq.status} />
            )}
          </div>

          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
            <span>
              Customer: <strong className="text-foreground">{rfq.account_name}</strong>
            </span>
            <span>•</span>
            <span>
              Opportunity: <strong className="text-foreground">{rfq.opportunity_name}</strong>
            </span>
            {rfq.customer_reference && (
              <>
                <span>•</span>
                <span>
                  Ref: <strong className="text-foreground">{rfq.customer_reference}</strong>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
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
              Rematch
            </Button>
          )}

          {/* Create Quote Gate */}
          <div className="relative group">
            <Button
              size="sm"
              onClick={handleCreateQuote}
              disabled={!rfq.is_ready_to_quote || createQuoteMutation.isPending || rfq.status === "quoted"}
              className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
            >
              <FileCheck2 className="w-4 h-4" />
              {rfq.status === "quoted" ? "Converted to Quote" : "Create Quotation"}
            </Button>

            {!rfq.is_ready_to_quote && rfq.status !== "quoted" && rfq.blocking_reasons && (
              <div className="absolute right-0 top-full mt-2 w-72 p-3 bg-popover text-popover-foreground text-xs rounded-lg shadow-lg border border-border hidden group-hover:block z-50">
                <div className="font-semibold text-rose-600 mb-1 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" /> Quotation Gate Blocked
                </div>
                <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
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
      <div className="flex items-center justify-between text-xs py-3 border-b bg-muted/20 px-4 rounded-md mt-3">
        <div className="flex items-center gap-1.5 text-emerald-600 font-semibold">
          <CheckCircle2 className="w-4 h-4" /> 1. Imported ({rfq.source_filename})
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
        <div className="flex items-center gap-1.5 text-emerald-600 font-semibold">
          <CheckCircle2 className="w-4 h-4" /> 2. Normalized ({rfq.total_lines} lines)
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
        <div
          className={`flex items-center gap-1.5 font-semibold ${
            rfq.resolved_lines_count === rfq.total_lines ? "text-emerald-600" : "text-amber-600"
          }`}
        >
          {rfq.resolved_lines_count === rfq.total_lines ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
          3. Review Studio ({rfq.resolved_lines_count}/{rfq.total_lines} resolved)
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
        <div
          className={`flex items-center gap-1.5 font-semibold ${
            rfq.is_ready_to_quote ? "text-emerald-600" : "text-muted-foreground"
          }`}
        >
          {rfq.is_ready_to_quote ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
          4. Ready to Quote
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
        <div className="p-3 bg-card rounded-lg border text-xs">
          <span className="text-muted-foreground font-medium">Total Lines</span>
          <div className="text-lg font-bold text-foreground mt-0.5">{rfq.total_lines}</div>
        </div>
        <div className="p-3 bg-card rounded-lg border text-xs">
          <span className="text-muted-foreground font-medium">Resolved / Matched</span>
          <div className="text-lg font-bold text-emerald-600 mt-0.5">
            {rfq.resolved_lines_count}
          </div>
        </div>
        <div className="p-3 bg-card rounded-lg border text-xs">
          <span className="text-muted-foreground font-medium">Exact Matches</span>
          <div className="text-lg font-bold text-blue-600 mt-0.5">
            {rfq.exact_matches_count}
          </div>
        </div>
        <div className="p-3 bg-card rounded-lg border text-xs">
          <span className="text-muted-foreground font-medium">Needs Review</span>
          <div className="text-lg font-bold text-amber-600 mt-0.5">
            {rfq.needs_review_lines_count}
          </div>
        </div>
        <div className="p-3 bg-card rounded-lg border text-xs">
          <span className="text-muted-foreground font-medium">Invalid Lines</span>
          <div className="text-lg font-bold text-rose-600 mt-0.5">
            {rfq.invalid_lines_count}
          </div>
        </div>
      </div>

      {/* Toolbar & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between mt-6">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search description, spec, SKU..."
            value={lineSearch}
            onChange={(e) => setLineSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto justify-end">
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-md text-xs">
            {[
              { id: "all", label: "All" },
              { id: "needs_review", label: "Needs Review" },
              { id: "exact_match", label: "Exact" },
              { id: "matched", label: "Matched" },
              { id: "unmatched", label: "Unmatched" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setFilterStatus(tab.id);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  filterStatus === tab.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
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
              className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-300"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1 text-emerald-600" />
              Bulk Accept Exact ({exactEligibleCount})
            </Button>
          )}
        </div>
      </div>

      {/* Main Review Table */}
      <div className="mt-4 rounded-lg border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 text-muted-foreground border-b uppercase font-semibold">
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
            <tbody className="divide-y divide-border">
              {filteredLines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-muted-foreground">
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
                      className={`hover:bg-muted/30 cursor-pointer transition-colors ${
                        isSelected ? "bg-muted/40 font-medium" : ""
                      }`}
                    >
                      <td className="px-3.5 py-3 text-center font-mono text-muted-foreground">
                        {line.source_row_number}
                      </td>

                      <td className="px-3.5 py-3 max-w-xs">
                        <div className="font-semibold text-foreground truncate">
                          {line.raw_description}
                        </div>
                        <div className="text-[11px] text-muted-foreground/80 font-mono truncate">
                          norm: {line.normalized_description || "—"}
                        </div>
                      </td>

                      <td className="px-3.5 py-3 text-center whitespace-nowrap font-mono">
                        {line.parsed_quantity ? (
                          <span>
                            {line.parsed_quantity} {line.canonical_unit || ""}
                          </span>
                        ) : (
                          <span className="text-rose-500 font-semibold">Invalid Qty</span>
                        )}
                      </td>

                      <td className="px-3.5 py-3 whitespace-nowrap">
                        {isMatched ? (
                          <StatusBadge variant="success" label="Matched" />
                        ) : isExact ? (
                          <StatusBadge variant="info" label="Exact Match" />
                        ) : isInvalid ? (
                          <StatusBadge variant="destructive" label="Invalid" />
                        ) : line.match_status === "unmatched" ? (
                          <StatusBadge variant="neutral" label="Unmatched" />
                        ) : (
                          <StatusBadge variant="warning" label="Needs Review" />
                        )}
                      </td>

                      <td className="px-3.5 py-3 max-w-sm">
                        {line.selected_product ? (
                          <div>
                            <span className="font-mono font-semibold text-foreground">
                              {line.selected_product.product_sku}
                            </span>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {line.selected_product.product_name}
                            </div>
                          </div>
                        ) : line.top_candidate ? (
                          <div>
                            <span className="font-mono text-muted-foreground">
                              {line.top_candidate.product_sku}
                            </span>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {line.top_candidate.product_name}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic text-[11px]">No candidate</span>
                        )}
                      </td>

                      <td className="px-3.5 py-3 text-center font-mono">
                        {line.top_candidate ? (
                          <span
                            className={`font-semibold ${
                              line.top_candidate.similarity_score >= 0.85
                                ? "text-emerald-600"
                                : line.top_candidate.similarity_score >= 0.6
                                ? "text-amber-600"
                                : "text-muted-foreground"
                            }`}
                          >
                            {(line.top_candidate.similarity_score * 100).toFixed(0)}%
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td className="px-3.5 py-3 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLineId(line.id);
                          }}
                        >
                          Review <ArrowRight className="w-3 h-3 ml-1" />
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

      {/* Right Side Inspector Sheet */}
      <Sheet open={!!selectedLineId} onOpenChange={(open) => !open && setSelectedLineId(null)}>
        <SheetPopup className="w-full sm:max-w-xl overflow-y-auto">
          {lineDetailLoading ? (
            <div className="space-y-4 p-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : lineDetail ? (
            <div className="space-y-6 pb-8">
              {/* Sheet Header */}
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 bg-muted rounded border">
                      Line #{lineDetail.source_row_number}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">v{lineDetail.version}</span>
                  </div>
                  {lineDetail.match_status === "matched" ? (
                    <StatusBadge variant="success" label="Matched" />
                  ) : lineDetail.match_status === "exact_match" ? (
                    <StatusBadge variant="info" label="Exact Match" />
                  ) : lineDetail.normalization_status === "invalid" ? (
                    <StatusBadge variant="destructive" label="Invalid" />
                  ) : (
                    <StatusBadge variant="warning" label={lineDetail.match_status} />
                  )}
                </div>
                <SheetTitle className="text-base font-bold text-foreground text-left mt-2">
                  {lineDetail.raw_description}
                </SheetTitle>
                <SheetDescription className="text-xs font-mono text-left">
                  Normalized: {lineDetail.normalized_description || "None"}
                </SheetDescription>
              </div>

              {/* Raw & Normalization Info */}
              <div className="p-3 bg-muted/30 rounded-lg border text-xs space-y-2">
                <div className="font-semibold text-foreground flex items-center justify-between">
                  <span>Parsed Quantity & Dimensions</span>
                  <span className="font-mono text-muted-foreground">
                    {lineDetail.parsed_quantity || "None"} {lineDetail.canonical_unit || ""}
                  </span>
                </div>
                {lineDetail.specifications && Object.keys(lineDetail.specifications).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {Object.entries(lineDetail.specifications).map(([k, v]) => (
                      <span key={k} className="px-2 py-0.5 bg-background border rounded text-[11px] font-mono">
                        {k}: <strong>{String(v)}</strong>
                      </span>
                    ))}
                  </div>
                )}
                {Array.isArray(lineDetail.diagnostics?.issues) && (lineDetail.diagnostics.issues as any[]).length > 0 && (
                  <div className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-700 text-[11px] space-y-1">
                    <strong className="block font-semibold">Validation Diagnostics:</strong>
                    {(lineDetail.diagnostics.issues as any[]).map((iss: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-rose-600" />
                        <span>[{iss.code}] {iss.detail}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Current Resolution State */}
              {lineDetail.selected_product && (
                <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-200 text-xs space-y-2">
                  <div className="flex items-center justify-between font-semibold text-emerald-800">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Assigned Catalog Product
                    </span>
                    {rfq.status !== "quoted" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleRevertDecision}
                        disabled={lineDecisionMutation.isPending}
                        className="h-7 text-[11px] border-emerald-300 hover:bg-emerald-100"
                      >
                        <RotateCcw className="w-3 h-3 mr-1" /> Revert
                      </Button>
                    )}
                  </div>
                  <div className="font-mono font-bold text-foreground">
                    {lineDetail.selected_product.product_sku} — {lineDetail.selected_product.product_name}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                    <span>Base UOM: {lineDetail.selected_product.product_base_unit}</span>
                    <span>
                      Sell Price: <MoneyText amount={lineDetail.selected_product.sell_price} currency="INR" />
                    </span>
                    {lineDetail.selected_product.unit_cost !== null && (
                      <span className="font-semibold text-foreground">
                        Cost: <MoneyText amount={lineDetail.selected_product.unit_cost} currency="INR" />
                      </span>
                    )}
                  </div>
                  {lineDetail.resolution_reason_code && (
                    <div className="text-[11px] text-muted-foreground">
                      Reason: <em>{lineDetail.resolution_reason_code}</em> • {lineDetail.resolution_notes || ""}
                    </div>
                  )}
                </div>
              )}

              {/* Candidate Suggestions */}
              {rfq.status !== "quoted" && lineDetail.candidates && lineDetail.candidates.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    System Candidate Suggestions ({lineDetail.candidates.length})
                  </h3>

                  <div className="space-y-2">
                    {lineDetail.candidates.map((cand) => (
                      <div
                        key={cand.id}
                        className={`p-3 rounded-lg border text-xs transition-colors ${
                          cand.rank === 1 ? "bg-muted/30 border-primary/30" : "bg-card"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-foreground">
                                {cand.product_sku}
                              </span>
                              <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                {(cand.similarity_score * 100).toFixed(0)}% Match
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono uppercase">
                                {cand.match_method}
                              </span>
                            </div>
                            <div className="text-xs text-foreground mt-0.5">
                              {cand.product_name}
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
                              <span>UOM: {cand.product_base_unit}</span>
                              <span>Price: <MoneyText amount={cand.sell_price} currency="INR" /></span>
                              {cand.unit_cost !== null && (
                                <span className="font-medium text-foreground">
                                  Cost: <MoneyText amount={cand.unit_cost} currency="INR" />
                                </span>
                              )}
                            </div>
                          </div>

                          <Button
                            size="sm"
                            onClick={() => handleAcceptSuggestion(cand)}
                            disabled={lineDecisionMutation.isPending}
                            className="h-8 text-xs font-medium"
                          >
                            <Check className="w-3.5 h-3.5 mr-1" />
                            Accept
                          </Button>
                        </div>

                        {cand.flags && cand.flags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {cand.flags.map((flag, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-mono"
                              >
                                {flag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Manual Product Selector */}
              {rfq.status !== "quoted" && (
                <div className="p-3 bg-muted/20 rounded-lg border space-y-3">
                  <h3 className="text-xs font-semibold text-foreground">
                    Manual Product Lookup / Override
                  </h3>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search catalog by SKU or keyword..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="pl-8 h-8 text-xs"
                    />
                  </div>

                  {catalogResults?.items && catalogResults.items.length > 0 && (
                    <div
                      tabIndex={0}
                      role="region"
                      aria-label="Catalog search results"
                      className="max-h-36 overflow-y-auto space-y-1 border rounded p-1 bg-background text-xs"
                    >
                      {catalogResults.items.map((prod) => (
                        <div
                          key={prod.id}
                          onClick={() => setManualSelectedProductId(prod.id)}
                          className={`p-1.5 rounded cursor-pointer transition-colors flex items-center justify-between ${
                            manualSelectedProductId === prod.id
                              ? "bg-primary text-primary-foreground font-semibold"
                              : "hover:bg-muted"
                          }`}
                        >
                          <div>
                            <span className="font-mono">{prod.sku}</span> — {prod.name}
                          </div>
                          <span>{prod.base_unit}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {manualSelectedProductId && (
                    <div className="space-y-2 pt-1 border-t text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] text-muted-foreground font-medium">Reason Code</label>
                          <select
                            value={manualReasonCode}
                            onChange={(e) => setManualReasonCode(e.target.value)}
                            className="w-full h-8 px-2 text-xs bg-background border rounded"
                          >
                            <option value="MANUAL_OVERRIDE">Manual Override</option>
                            <option value="CUSTOMER_REQUEST">Customer Requested Specific Brand</option>
                            <option value="EQUIVALENT_SUBSTITUTE">Equivalent Substitute</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] text-muted-foreground font-medium">Notes</label>
                          <Input
                            placeholder="Optional notes..."
                            value={manualNotes}
                            onChange={(e) => setManualNotes(e.target.value)}
                            className="h-8 text-xs"
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

                  <div className="pt-2 border-t flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleMarkUnmatched}
                      disabled={lineDecisionMutation.isPending}
                      className="text-xs text-muted-foreground hover:text-foreground h-7"
                    >
                      Mark as Unmatched Item
                    </Button>
                  </div>
                </div>
              )}

              {/* Decision History Audit Log */}
              {lineDetail.decision_history && lineDetail.decision_history.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Decision Audit Trail ({lineDetail.decision_history.length})
                  </h4>
                  <div className="space-y-2">
                    {lineDetail.decision_history.map((dh) => (
                      <div key={dh.id} className="p-2 rounded bg-muted/20 border text-[11px] space-y-1">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span className="font-semibold text-foreground">{dh.actor_name}</span>
                          <DateTimeText value={dh.created_at} />
                        </div>
                        <div className="font-mono text-foreground">
                          Action: <strong>{dh.decision_type}</strong> • Status: {dh.previous_match_status} →{" "}
                          {dh.new_match_status}
                        </div>
                        {dh.reason_code && (
                          <div className="text-muted-foreground">
                            Reason: <em>{dh.reason_code}</em> {dh.reason_notes ? `— "${dh.reason_notes}"` : ""}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </SheetPopup>
      </Sheet>
    </PageContainer>
  );
}
