"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  FileText,
  Calculator,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Save,
  RotateCcw,
  Eye,
  EyeOff,
  Layers,
  ArrowLeft,
  Info,
  Building,
  Briefcase,
  FileSpreadsheet,
  Check,
  Percent,
} from "lucide-react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetPopup,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ErrorState } from "@/components/data-display/error-state";
import { DateTimeText } from "@/components/data-display/date-time-text";
import { formatMoney, formatDate } from "@/lib/formatters/formatters";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api/client";
import {
  useQuote,
  useCalculationTrace,
  useUpdateQuoteDraft,
  type QuoteDetail,
  type QuoteRevisionLine,
  type QuoteDraftLineUpdateInput,
  type CalculationTrace,
} from "@/features/quotes/api";
import { useSubmitQuoteForApproval } from "@/features/proposals/api";
import { QuoteProposalsSection } from "@/features/proposals/components/quote-proposals-section";
import { QuoteExportSection } from "@/features/quotes/components/quote-export-section";

interface LocalDraftLine {
  id: string;
  line_order: number;
  sku: string;
  product_name: string;
  description: string;
  unit: string;
  quantity: string;
  unit_price: string;
  discount_percent: string;
  tax_rate_percent: string;
  catalog_product_id?: string | null;
  rfq_line_id?: string | null;
  unit_cost?: number | string | null;
}

interface TraceNodeItem {
  output_key: string;
  label?: string;
  inputs?: Record<string, string>;
  operation?: string;
  formula_text?: string;
  rounding?: string;
  result?: string;
  is_internal?: boolean;
}

interface PolicyTriggerItem {
  rule_id: string;
  rule_name: string;
  description?: string;
  message?: string;
  actual_value?: string | number;
  threshold_value?: string | number;
}

export default function QuoteDetailPage() {
  const params = useParams();
  const quoteId = params.quoteId as string;

  const { data: quote, isLoading, isError, error, refetch } = useQuote(quoteId);
  const { data: trace, isLoading: traceLoading } = useCalculationTrace(quoteId);

  if (isLoading) {
    return (
      <PageContainer>
        <div className="space-y-6 mt-4">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </PageContainer>
    );
  }

  if (isError || !quote) {
    return (
      <PageContainer>
        <ErrorState
          title="Failed to load quote details"
          message={error?.message || "Quote not found or access denied."}
          onRetry={refetch}
        />
      </PageContainer>
    );
  }

  return (
    <QuoteBuilderInner
      key={`${quote.id}-v${quote.version}`}
      quote={quote}
      trace={trace}
      traceLoading={traceLoading}
    />
  );
}

interface QuoteBuilderInnerProps {
  quote: QuoteDetail;
  trace?: CalculationTrace;
  traceLoading: boolean;
}

function QuoteBuilderInner({ quote, trace, traceLoading }: QuoteBuilderInnerProps) {
  const { user } = useAuth();
  const updateMutation = useUpdateQuoteDraft();
  const submitApprovalMutation = useSubmitQuoteForApproval();

  const [previewMode, setPreviewMode] = React.useState(false);
  const [inspectorOpen, setInspectorOpen] = React.useState(false);

  // Initialize state directly from authoritative quote prop (React-recommended pattern)
  const [draftLines, setDraftLines] = React.useState<LocalDraftLine[]>(() => {
    return (
      quote.current_revision?.lines.map((l) => ({
        id: l.id,
        line_order: l.line_order,
        sku: l.sku,
        product_name: l.product_name,
        description: l.description,
        unit: l.unit,
        quantity: String(l.quantity),
        unit_price: String(l.unit_price),
        discount_percent: String(l.discount_percent),
        tax_rate_percent: String(l.tax_rate_percent),
        catalog_product_id: l.catalog_product_id,
        rfq_line_id: l.rfq_line_id,
        unit_cost: l.unit_cost,
      })) || []
    );
  });
  const [notes, setNotes] = React.useState(() => quote.notes || "");
  const [paymentTerms, setPaymentTerms] = React.useState(() => quote.payment_terms || "Net 30");
  const [deliveryTerms, setDeliveryTerms] = React.useState(() => quote.delivery_terms || "Ex-Works");
  const [isDirty, setIsDirty] = React.useState(false);

  // Role permissions
  const canViewCost = Boolean(
    user?.permissions.includes("catalog:cost") ||
      user?.role === "admin" ||
      user?.role === "catalog_manager"
  );
  const canEditDraft = Boolean(
    (user?.permissions.includes("quotes:draft") ||
      user?.role === "admin" ||
      user?.role === "sales_rep") &&
      quote.status === "draft"
  );

  const handleLineChange = (
    index: number,
    field: keyof LocalDraftLine,
    value: string
  ) => {
    setDraftLines((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    setIsDirty(true);
  };

  const handleSaveDraft = async () => {
    for (const ln of draftLines) {
      const q = parseFloat(ln.quantity);
      const p = parseFloat(ln.unit_price);
      const d = parseFloat(ln.discount_percent);
      const t = parseFloat(ln.tax_rate_percent);

      if (isNaN(q) || q <= 0) {
        toast.error(`Line #${ln.line_order}: Quantity must be greater than 0.`);
        return;
      }
      if (isNaN(p) || p < 0) {
        toast.error(`Line #${ln.line_order}: Unit price cannot be negative.`);
        return;
      }
      if (isNaN(d) || d < 0 || d > 100) {
        toast.error(`Line #${ln.line_order}: Discount % must be between 0 and 100.`);
        return;
      }
      if (isNaN(t) || t < 0 || t > 100) {
        toast.error(`Line #${ln.line_order}: Tax % must be between 0 and 100.`);
        return;
      }
    }

    const payloadLines: QuoteDraftLineUpdateInput[] = draftLines.map((ln) => ({
      id: ln.id,
      line_order: ln.line_order,
      sku: ln.sku,
      product_name: ln.product_name,
      description: ln.description,
      unit: ln.unit,
      quantity: ln.quantity,
      unit_price: ln.unit_price,
      discount_percent: ln.discount_percent,
      tax_rate_percent: ln.tax_rate_percent,
      catalog_product_id: ln.catalog_product_id || undefined,
      rfq_line_id: ln.rfq_line_id || undefined,
    }));

    try {
      await updateMutation.mutateAsync({
        quoteId: quote.id,
        payload: {
          expected_version: quote.version,
          notes,
          payment_terms: paymentTerms,
          delivery_terms: deliveryTerms,
          lines: payloadLines,
        },
      });
      toast.success("Quote draft saved and recalculated successfully.");
      setIsDirty(false);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error(
          "Quote version conflict: This quote was updated in another session. Please reload the latest revision."
        );
      } else {
        toast.error(
          err instanceof Error ? err.message : "Failed to update quote draft."
        );
      }
    }
  };

  const handleReset = () => {
    if (quote.current_revision?.lines) {
      setDraftLines(
        quote.current_revision.lines.map((l) => ({
          id: l.id,
          line_order: l.line_order,
          sku: l.sku,
          product_name: l.product_name,
          description: l.description,
          unit: l.unit,
          quantity: String(l.quantity),
          unit_price: String(l.unit_price),
          discount_percent: String(l.discount_percent),
          tax_rate_percent: String(l.tax_rate_percent),
          catalog_product_id: l.catalog_product_id,
          rfq_line_id: l.rfq_line_id,
          unit_cost: l.unit_cost,
        }))
      );
      setNotes(quote.notes || "");
      setPaymentTerms(quote.payment_terms || "Net 30");
      setDeliveryTerms(quote.delivery_terms || "Ex-Works");
      setIsDirty(false);
      toast.info("Unsaved changes discarded.");
    }
  };

  const liveTotals = React.useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let taxable = 0;
    let taxTotal = 0;
    let grandTotal = 0;

    for (const ln of draftLines) {
      const q = parseFloat(ln.quantity) || 0;
      const p = parseFloat(ln.unit_price) || 0;
      const d = parseFloat(ln.discount_percent) || 0;
      const t = parseFloat(ln.tax_rate_percent) || 0;

      const gross = q * p;
      const discAmt = gross * (d / 100);
      const taxBase = gross - discAmt;
      const taxAmt = taxBase * (t / 100);
      const lineTot = taxBase + taxAmt;

      subtotal += gross;
      totalDiscount += discAmt;
      taxable += taxBase;
      taxTotal += taxAmt;
      grandTotal += lineTot;
    }

    return {
      subtotal,
      totalDiscount,
      taxable,
      taxTotal,
      grandTotal,
    };
  }, [draftLines]);

  const currentRev = quote.current_revision;
  const currency = currentRev?.currency || "INR";
  const serverTotals = currentRev?.totals;
  const policyEval = (quote.approval_triggers || []) as unknown as PolicyTriggerItem[];
  const requiresApproval = quote.requires_manager_approval;

  return (
    <PageContainer>
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/app/quotes"
              className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Quotations</span>
            </Link>
            <span className="text-[var(--border)]">|</span>
            <span className="text-xs font-mono text-[var(--muted-foreground)]">
              v{quote.version}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-1.5">
            <h1 className="text-xl font-bold tracking-tight font-mono text-[var(--foreground)]">
              {quote.quote_number}
            </h1>
            <StatusBadge
              variant={quote.status === "draft" ? "neutral" : "info"}
              label={quote.status.toUpperCase()}
            />
            {currentRev && (
              <span className="inline-flex items-center gap-1 rounded bg-[var(--surface-muted)] px-2 py-0.5 text-xs font-medium font-mono text-[var(--foreground)] border border-[var(--border)]">
                <Layers className="h-3 w-3 text-[var(--muted-foreground)]" />
                Revision {currentRev.revision_number}
              </span>
            )}
            {isDirty && (
              <span className="inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                Unsaved Edits
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted-foreground)] mt-1">
            <span className="inline-flex items-center gap-1">
              <Building className="h-3.5 w-3.5" />
              <Link
                href={`/app/accounts/${quote.account_id}`}
                className="hover:underline font-medium text-[var(--foreground)]"
              >
                {quote.account_name}
              </Link>
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <Briefcase className="h-3.5 w-3.5" />
              <Link
                href={`/app/opportunities/${quote.opportunity_id}`}
                className="hover:underline text-[var(--muted-foreground)]"
              >
                {quote.opportunity_name}
              </Link>
            </span>
            {quote.rfq_id && quote.rfq_number && (
              <>
                <span>•</span>
                <span className="inline-flex items-center gap-1">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <Link
                    href={`/app/rfqs/${quote.rfq_id}`}
                    className="hover:underline text-[var(--primary)] font-mono"
                  >
                    {quote.rfq_number}
                  </Link>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Customer Preview Mode Toggle */}
          <Button
            variant={previewMode ? "primary" : "outline"}
            size="sm"
            onClick={() => setPreviewMode(!previewMode)}
            className="gap-1.5 text-xs h-9 cursor-pointer"
          >
            {previewMode ? (
              <>
                <EyeOff className="h-3.5 w-3.5" />
                <span>Exit Customer Preview</span>
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5" />
                <span>Customer Preview Mode</span>
              </>
            )}
          </Button>

          {/* Slide-over Calculation Inspector Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setInspectorOpen(true)}
            className="gap-1.5 text-xs h-9 cursor-pointer"
          >
            <Calculator className="h-3.5 w-3.5 text-[var(--primary)]" />
            <span>Calculation Inspector</span>
          </Button>

          {/* Submit Initial Quote for Approval if in draft and requires approval */}
          {quote.status === "draft" && requiresApproval && !previewMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await submitApprovalMutation.mutateAsync({ quoteId: quote.id });
                  toast.success("Quotation submitted to manager approval queue.");
                } catch (err: any) {
                  toast.error(err.message || "Failed to submit quotation for approval.");
                }
              }}
              disabled={submitApprovalMutation.isPending || isDirty}
              className="gap-1.5 text-xs h-9 cursor-pointer border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
              title={isDirty ? "Save draft changes before submitting for approval" : undefined}
            >
              <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
              <span>{submitApprovalMutation.isPending ? "Submitting..." : "Submit for Approval"}</span>
            </Button>
          )}

          {/* Save Draft Button */}
          {canEditDraft && !previewMode && (
            <>
              {isDirty && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="gap-1 text-xs h-9 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Discard</span>
                </Button>
              )}
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveDraft}
                disabled={!isDirty || updateMutation.isPending}
                className="gap-1.5 text-xs h-9 cursor-pointer"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{updateMutation.isPending ? "Saving..." : "Save Draft"}</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Customer Preview Mode Banner */}
      {previewMode && (
        <div className="my-4 rounded-[var(--radius-lg)] border-2 border-dashed border-amber-300 bg-amber-50 p-4 text-center">
          <span className="text-sm font-bold tracking-widest text-amber-900 uppercase font-mono block">
            DRAFT — NOT APPROVED COMMERCIAL PROPOSAL
          </span>
          <span className="text-xs text-amber-700 mt-1 block">
            Customer presentation mode with internal cost and policy masking. For client review only.
          </span>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Section: Line Items Table (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-muted)]/30">
              <div>
                <h2 className="text-sm font-semibold text-[var(--foreground)]">
                  Line Items ({draftLines.length})
                </h2>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {previewMode
                    ? "Itemized commercial specifications and pricing"
                    : "Edit quantity, unit selling prices, line discount %, and applicable tax rates"}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Line items table">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--surface-muted)] border-b border-[var(--border)] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-2.5 px-3 w-8">#</th>
                    <th className="py-2.5 px-3 min-w-[160px]">Product / Description</th>
                    <th className="py-2.5 px-3 text-right w-24">Qty</th>
                    <th className="py-2.5 px-3 text-right w-28">Price (INR)</th>
                    <th className="py-2.5 px-3 text-right w-20">Disc %</th>
                    <th className="py-2.5 px-3 text-right w-16">Tax %</th>
                    {canViewCost && !previewMode && (
                      <th className="py-2.5 px-3 text-right w-24 text-amber-700">Cost (INR)</th>
                    )}
                    <th className="py-2.5 px-3 text-right min-w-[110px]">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {draftLines.map((ln, idx) => {
                    const q = parseFloat(ln.quantity) || 0;
                    const p = parseFloat(ln.unit_price) || 0;
                    const d = parseFloat(ln.discount_percent) || 0;
                    const t = parseFloat(ln.tax_rate_percent) || 0;

                    const gross = q * p;
                    const discAmt = gross * (d / 100);
                    const taxable = gross - discAmt;
                    const taxAmt = taxable * (t / 100);
                    const lineTotal = taxable + taxAmt;

                    const serverLine = currentRev?.lines[idx];

                    return (
                      <tr key={ln.id} className="hover:bg-[var(--surface-muted)]/30 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[var(--muted-foreground)]">
                          {ln.line_order}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-[var(--foreground)] block">
                            {ln.product_name}
                          </span>
                          <span className="font-mono text-[11px] text-[var(--primary)] block">
                            SKU: {ln.sku}
                          </span>
                          <span className="text-[11px] text-[var(--muted-foreground)] line-clamp-1">
                            {ln.description}
                          </span>
                        </td>

                        {/* Qty */}
                        <td className="py-2.5 px-3 text-right">
                          {canEditDraft && !previewMode ? (
                            <Input
                              type="number"
                              step="any"
                              min="0.0001"
                              aria-label={`Line ${ln.line_order} Quantity`}
                              value={ln.quantity}
                              onChange={(e) => handleLineChange(idx, "quantity", e.target.value)}
                              className="h-7 text-right text-xs font-mono w-20 ml-auto"
                            />
                          ) : (
                            <span className="font-mono font-medium">
                              {parseFloat(ln.quantity).toFixed(2)} {ln.unit}
                            </span>
                          )}
                        </td>

                        {/* Unit Price */}
                        <td className="py-2.5 px-3 text-right">
                          {canEditDraft && !previewMode ? (
                            <Input
                              type="number"
                              step="any"
                              min="0"
                              aria-label={`Line ${ln.line_order} Unit Price`}
                              value={ln.unit_price}
                              onChange={(e) => handleLineChange(idx, "unit_price", e.target.value)}
                              className="h-7 text-right text-xs font-mono w-24 ml-auto"
                            />
                          ) : (
                            <span className="font-mono font-medium">
                              ₹{parseFloat(ln.unit_price).toFixed(2)}
                            </span>
                          )}
                        </td>

                        {/* Discount % */}
                        <td className="py-2.5 px-3 text-right">
                          {canEditDraft && !previewMode ? (
                            <div className="relative inline-block w-16">
                              <Input
                                type="number"
                                step="any"
                                min="0"
                                max="100"
                                aria-label={`Line ${ln.line_order} Discount Percent`}
                                value={ln.discount_percent}
                                onChange={(e) =>
                                  handleLineChange(idx, "discount_percent", e.target.value)
                                }
                                className={`h-7 text-right text-xs font-mono pr-4 ${
                                  parseFloat(ln.discount_percent) > 5
                                    ? "border-amber-400 bg-amber-50 text-amber-900"
                                    : ""
                                }`}
                              />
                              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-[var(--muted-foreground)] pointer-events-none">
                                %
                              </span>
                            </div>
                          ) : (
                            <span
                              className={`font-mono text-xs ${
                                parseFloat(ln.discount_percent) > 5
                                  ? "text-amber-700 font-semibold"
                                  : "text-[var(--muted-foreground)]"
                              }`}
                            >
                              {parseFloat(ln.discount_percent).toFixed(1)}%
                            </span>
                          )}
                        </td>

                        {/* Tax % */}
                        <td className="py-2.5 px-3 text-right">
                          {canEditDraft && !previewMode ? (
                            <div className="relative inline-block w-14">
                              <Input
                                type="number"
                                step="any"
                                min="0"
                                max="100"
                                aria-label={`Line ${ln.line_order} Tax Rate Percent`}
                                value={ln.tax_rate_percent}
                                onChange={(e) =>
                                  handleLineChange(idx, "tax_rate_percent", e.target.value)
                                }
                                className="h-7 text-right text-xs font-mono pr-4"
                              />
                              <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-[var(--muted-foreground)] pointer-events-none">
                                %
                              </span>
                            </div>
                          ) : (
                            <span className="font-mono text-[var(--muted-foreground)]">
                              {parseFloat(ln.tax_rate_percent).toFixed(0)}%
                            </span>
                          )}
                        </td>

                        {/* Unit Cost & Margin (Server-side RBAC restricted) */}
                        {canViewCost && !previewMode && (
                          <td className="py-2.5 px-3 text-right font-mono text-[11px] text-amber-800">
                            {serverLine?.unit_cost !== null && serverLine?.unit_cost !== undefined ? (
                              <div>
                                <span>₹{parseFloat(String(serverLine.unit_cost)).toFixed(2)}</span>
                                {serverLine.margin_percent !== null && (
                                  <span className="block text-[10px] text-emerald-700 font-semibold">
                                    {parseFloat(String(serverLine.margin_percent)).toFixed(1)}% mgn
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[var(--muted-foreground)] italic">uncosted</span>
                            )}
                          </td>
                        )}

                        {/* Line Total */}
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-[var(--foreground)]">
                          ₹
                          {isDirty
                            ? lineTotal.toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })
                            : parseFloat(String(serverLine?.line_total || lineTotal)).toLocaleString(
                                "en-IN",
                                { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                              )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Commercial Terms & Notes */}
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Commercial Terms & Delivery Conditions
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="quote-payment-terms" className="text-xs font-medium text-[var(--foreground)] block mb-1">
                  Payment Terms
                </label>
                {canEditDraft && !previewMode ? (
                  <Input
                    id="quote-payment-terms"
                    type="text"
                    value={paymentTerms}
                    onChange={(e) => {
                      setPaymentTerms(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="e.g. Net 30 days against invoice"
                    className="h-8 text-xs"
                  />
                ) : (
                  <span className="text-xs text-[var(--foreground)] font-medium">
                    {paymentTerms || "Net 30"}
                  </span>
                )}
              </div>

              <div>
                <label htmlFor="quote-delivery-terms" className="text-xs font-medium text-[var(--foreground)] block mb-1">
                  Delivery Terms
                </label>
                {canEditDraft && !previewMode ? (
                  <Input
                    id="quote-delivery-terms"
                    type="text"
                    value={deliveryTerms}
                    onChange={(e) => {
                      setDeliveryTerms(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="e.g. Ex-Works Factory, Freight Extra"
                    className="h-8 text-xs"
                  />
                ) : (
                  <span className="text-xs text-[var(--foreground)] font-medium">
                    {deliveryTerms || "Ex-Works"}
                  </span>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="quote-internal-notes" className="text-xs font-medium text-[var(--foreground)] block mb-1">
                Internal Quote Notes & Special Handling
              </label>
              {canEditDraft && !previewMode ? (
                <textarea
                  id="quote-internal-notes"
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    setIsDirty(true);
                  }}
                  rows={2}
                  placeholder="Notes, scope clarifications, and customer-specific commercial exceptions..."
                  className="w-full text-xs rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-2 focus-visible:outline-2 focus-visible:outline-[var(--primary)] text-[var(--foreground)]"
                />
              ) : (
                <p className="text-xs text-[var(--muted-foreground)] italic">
                  {notes || "No additional commercial conditions recorded."}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Section: Sticky Totals & Policy Triggers Panel */}
        <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-4">
          {/* Totals Summary Card */}
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)] border-b border-[var(--border)] pb-2">
              Quotation Summary
            </h2>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-[var(--muted-foreground)]">
                <span>Gross Subtotal</span>
                <span className="font-mono text-[var(--foreground)]">
                  {isDirty
                    ? formatMoney(liveTotals.subtotal, currency)
                    : formatMoney(serverTotals?.subtotal, currency)}
                </span>
              </div>

              <div className="flex justify-between text-[var(--muted-foreground)]">
                <span>Total Discount</span>
                <span className="font-mono text-emerald-700">
                  -
                  {isDirty
                    ? formatMoney(liveTotals.totalDiscount, currency)
                    : formatMoney(serverTotals?.total_discount, currency)}
                </span>
              </div>

              <div className="flex justify-between text-[var(--muted-foreground)] pt-1 border-t border-[var(--border)]/50">
                <span>Taxable Amount</span>
                <span className="font-mono text-[var(--foreground)]">
                  {isDirty
                    ? formatMoney(liveTotals.taxable, currency)
                    : formatMoney(serverTotals?.taxable_subtotal, currency)}
                </span>
              </div>

              <div className="flex justify-between text-[var(--muted-foreground)]">
                <span>Estimated GST / Tax</span>
                <span className="font-mono text-[var(--foreground)]">
                  {isDirty
                    ? formatMoney(liveTotals.taxTotal, currency)
                    : formatMoney(serverTotals?.tax_total, currency)}
                </span>
              </div>

              <div className="flex justify-between items-baseline pt-3 border-t-2 border-[var(--border)]">
                <div>
                  <span className="text-sm font-bold text-[var(--foreground)] block">Grand Total</span>
                  <span className="text-[10px] text-[var(--muted-foreground)] font-mono">
                    All taxes & discounts included
                  </span>
                </div>
                <span className="text-xl font-extrabold font-mono text-[var(--primary)]">
                  {isDirty
                    ? formatMoney(liveTotals.grandTotal, currency)
                    : formatMoney(serverTotals?.grand_total, currency)}
                </span>
              </div>
            </div>

            {/* Cost & Margin Metrics (Only for authorized roles, never rendered in preview) */}
            {canViewCost && !previewMode && (
              <div className="rounded-[var(--radius-md)] bg-amber-50/70 border border-amber-200/80 p-3 text-xs space-y-1.5 font-mono">
                <div className="text-[11px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-amber-200/60">
                  <span>Internal Margin Intelligence</span>
                </div>
                <div className="flex justify-between text-amber-900">
                  <span>Total Base Cost:</span>
                  <span className="font-bold">
                    {serverTotals?.total_cost !== null
                      ? formatMoney(serverTotals?.total_cost, currency)
                      : "Uncosted lines present"}
                  </span>
                </div>
                <div className="flex justify-between text-amber-900">
                  <span>Projected Gross Margin:</span>
                  <span className="font-bold text-emerald-800">
                    {serverTotals?.overall_margin_percent !== null && serverTotals?.overall_margin_percent !== undefined
                      ? `${parseFloat(String(serverTotals?.overall_margin_percent)).toFixed(2)}%`
                      : "—"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Customer Document Export Section */}
          <QuoteExportSection quote={quote} />

          {/* Policy Governance & Approval Triggers Panel (Hidden in Customer Preview) */}
          {!previewMode && (
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Commercial Policy Governance
                </h3>
                {requiresApproval ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-[var(--radius-sm)]">
                    <ShieldAlert className="h-3 w-3 text-amber-600" />
                    Approval Required
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-[var(--radius-sm)]">
                    <ShieldCheck className="h-3 w-3 text-emerald-600" />
                    Standard Limits
                  </span>
                )}
              </div>

              {policyEval.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-[var(--muted-foreground)]">
                    This quotation activates organization governance policies:
                  </p>
                  <ul className="space-y-1.5">
                    {policyEval.map((trig, idx) => (
                      <li
                        key={idx}
                        className="rounded-[var(--radius-sm)] bg-amber-50 border border-amber-200 p-2 text-xs text-amber-900 flex items-start gap-2"
                      >
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block font-semibold">{trig.rule_name}</strong>
                          <span className="text-[11px] text-amber-800">{trig.description || trig.message}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="rounded-[var(--radius-sm)] bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Compliant with standard sales authorization limits (no discount or value thresholds breached).</span>
                </div>
              )}

              {/* Change Proposals Workspace */}
              <QuoteProposalsSection quote={quote} />
            </div>
          )}
        </div>
      </div>

      {/* Sheet Popup for Calculation Inspector */}
      <Sheet open={inspectorOpen} onOpenChange={setInspectorOpen}>
        <SheetPopup side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <div className="border-b border-[var(--border)] pb-3">
            <SheetTitle className="text-base font-bold flex items-center gap-2">
              <Calculator className="h-4 w-4 text-[var(--primary)]" />
              <span>Authoritative Calculation Trace</span>
            </SheetTitle>
            <SheetDescription className="text-xs text-[var(--muted-foreground)] mt-0.5">
              Ordered arithmetic graph with Decimal ROUND_HALF_UP rounding rules.
            </SheetDescription>
            {trace && (
              <div className="mt-2 text-[11px] font-mono text-[var(--muted-foreground)] flex items-center gap-4">
                <span>Engine: {trace.calculator_version}</span>
                <span>Rev: #{trace.revision_number}</span>
                <span className="truncate max-w-[180px]">
                  Hash: {trace.input_fingerprint.slice(0, 16)}...
                </span>
              </div>
            )}
          </div>

          {traceLoading ? (
            <div className="space-y-3 mt-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : !trace || trace.nodes.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--muted-foreground)]">
              No calculation trace nodes available.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {(trace.nodes as unknown as TraceNodeItem[]).map((node, idx) => (
                <div
                  key={idx}
                  className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)]/40 p-3 space-y-1.5 font-mono text-xs"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-[var(--primary)]">
                      {node.label || node.output_key}
                    </span>
                    <span className="text-[10px] text-[var(--muted-foreground)] uppercase">
                      {node.operation} ({node.rounding})
                    </span>
                  </div>

                  <div className="text-[11px] text-[var(--foreground)] bg-[var(--surface)] p-2 rounded border border-[var(--border)] flex items-center justify-between">
                    <span className="text-[var(--muted-foreground)]">
                      {node.formula_text}
                    </span>
                    <span className="font-bold text-[var(--foreground)]">
                      = {node.result}
                    </span>
                  </div>

                  {node.inputs && Object.keys(node.inputs).length > 0 && (
                    <div className="flex flex-wrap gap-2 text-[10px] text-[var(--muted-foreground)] pt-0.5">
                      {Object.entries(node.inputs).map(([k, v]) => (
                        <span key={k} className="bg-[var(--surface)] px-1.5 py-0.5 rounded border border-[var(--border)]">
                          {k}: <strong className="text-[var(--foreground)]">{String(v)}</strong>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </SheetPopup>
      </Sheet>
    </PageContainer>
  );
}
