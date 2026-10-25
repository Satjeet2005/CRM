"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  FileSpreadsheet,
  FileDown,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/sakani/button";
import { Badge } from "@/components/sakani/badge";
import { DateTimeText } from "@/components/data-display/date-time-text";
import {
  useQuoteDeliveries,
  type QuoteDetail,
} from "@/features/quotes/api";
import { downloadQuoteDocument } from "@/features/quotes/export-utils";

interface QuoteExportSectionProps {
  quote: QuoteDetail;
}

export function QuoteExportSection({ quote }: QuoteExportSectionProps) {
  const queryClient = useQueryClient();
  const { data: deliveries = [], isLoading: deliveriesLoading } = useQuoteDeliveries(quote.id);

  const [downloadingPdf, setDownloadingPdf] = React.useState(false);
  const [downloadingCsv, setDownloadingCsv] = React.useState(false);
  const [downloadingPreview, setDownloadingPreview] = React.useState(false);
  const [copiedHash, setCopiedHash] = React.useState<string | null>(null);

  const isApproved = quote.status === "approved" || quote.status === "sent";

  const handleExportPdf = async () => {
    setDownloadingPdf(true);
    try {
      const res = await downloadQuoteDocument(
        `/api/v1/quotes/${quote.id}/export/pdf`,
        `Quote-${quote.quote_number}.pdf`
      );
      toast.success(
        `Customer PDF downloaded successfully. Fingerprint: ${res.sha256?.slice(0, 16)}...`
      );
      queryClient.invalidateQueries({ queryKey: ["quotes", quote.id, "deliveries"] });
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || "Failed to export quotation PDF.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleExportCsv = async () => {
    setDownloadingCsv(true);
    try {
      const res = await downloadQuoteDocument(
        `/api/v1/quotes/${quote.id}/export/csv`,
        `Quote-${quote.quote_number}.csv`
      );
      toast.success(
        `Procurement CSV downloaded successfully. Fingerprint: ${res.sha256?.slice(0, 16)}...`
      );
      queryClient.invalidateQueries({ queryKey: ["quotes", quote.id, "deliveries"] });
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || "Failed to export quotation CSV.");
    } finally {
      setDownloadingCsv(false);
    }
  };

  const handleDownloadPreview = async () => {
    setDownloadingPreview(true);
    try {
      const res = await downloadQuoteDocument(
        `/api/v1/quotes/${quote.id}/export/preview-pdf`,
        `Draft-Quote-${quote.quote_number}.pdf`
      );
      toast.info(
        `Watermarked draft preview downloaded. Fingerprint: ${res.sha256?.slice(0, 16)}...`
      );
      queryClient.invalidateQueries({ queryKey: ["quotes", quote.id, "deliveries"] });
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || "Failed to download draft preview.");
    } finally {
      setDownloadingPreview(false);
    }
  };

  const handleCopyHash = async (hash: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(hash);
      }
    } catch {
      // Ignore clipboard permission errors in test/unsupported environments
    }
    setCopiedHash(hash);
    toast.success("SHA-256 fingerprint copied to clipboard.");
    setTimeout(() => setCopiedHash(null), 2500);
  };

  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5 shadow-xs space-y-4">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--color-border-subtle)]">
        <div>
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-[var(--color-primary-500)] shrink-0" />
            <h3 className="text-sm font-semibold text-[var(--color-fg-default)] tracking-tight">
              Customer Document Exports
            </h3>
            <Badge
              variant={isApproved ? "success" : "warning"}
              emphasis="subtle"
              className="text-[10px] uppercase font-semibold"
            >
              {isApproved ? "Certified" : "Locked"}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-[var(--color-fg-muted)]">
            Server-generated PDF and CSV quotations bound to authoritative committed revision.
          </p>
        </div>
      </div>

      {/* Export Gate Status & Guidance Banner */}
      {isApproved ? (
        <div className="rounded-[var(--radius-lg)] border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs text-emerald-950 dark:text-emerald-200 space-y-1.5">
          <div className="flex items-center gap-2 font-medium">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-semibold text-emerald-900 dark:text-emerald-100">
              Quotation is approved and certified for commercial customer release.
            </span>
          </div>
          <p className="text-[11px] text-emerald-800 dark:text-emerald-300 pl-6">
            Generated customer documents never expose internal manufacturing unit costs, margins, or private notes.
          </p>
        </div>
      ) : (
        <div className="rounded-[var(--radius-lg)] border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-950 dark:text-amber-200 space-y-1.5">
          <div className="flex items-center gap-2 font-medium">
            <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="font-semibold text-amber-900 dark:text-amber-100">
              Final customer exports locked ({quote.status.toUpperCase()})
            </span>
          </div>
          <p className="text-[11px] text-amber-800 dark:text-amber-300 pl-6">
            Customer-ready unwatermarked PDF and CSV exports require managerial approval. For internal inspection, download a watermarked draft preview below.
          </p>
        </div>
      )}

      {/* Action Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* Customer PDF Card */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)]/40 p-3 flex flex-col justify-between gap-2.5">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-medium text-xs text-[var(--color-fg-default)]">
                <FileText className="h-4 w-4 text-[var(--color-primary-500)] shrink-0" />
                <span>Commercial PDF</span>
              </div>
              <span className="text-[10px] text-[var(--color-fg-muted)] font-mono">PDF / A-1b</span>
            </div>
            <p className="text-[11px] text-[var(--color-fg-muted)] line-clamp-2">
              Customer-ready quotation PDF with formal letterhead and terms.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={handleExportPdf}
            disabled={!isApproved || downloadingPdf}
            isLoading={downloadingPdf}
            className="w-full gap-2 text-xs h-9 cursor-pointer"
            data-testid="export-pdf-button"
            title={
              !isApproved
                ? `Customer PDF export requires approved status (currently ${quote.status})`
                : "Download approved customer quotation PDF"
            }
          >
            <FileText className="h-3.5 w-3.5" />
            <span>{downloadingPdf ? "Generating PDF..." : "Export Customer PDF"}</span>
          </Button>
        </div>

        {/* Procurement CSV Card */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)]/40 p-3 flex flex-col justify-between gap-2.5">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-medium text-xs text-[var(--color-fg-default)]">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Procurement CSV</span>
              </div>
              <span className="text-[10px] text-[var(--color-fg-muted)] font-mono">RFC 4180</span>
            </div>
            <p className="text-[11px] text-[var(--color-fg-muted)] line-clamp-2">
              ERP-safe line item export with formula-injection neutralization.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCsv}
            disabled={!isApproved || downloadingCsv}
            isLoading={downloadingCsv}
            className="w-full gap-2 text-xs h-9 cursor-pointer"
            data-testid="export-csv-button"
            title={
              !isApproved
                ? `Customer CSV export requires approved status (currently ${quote.status})`
                : "Download procurement-safe CSV file"
            }
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span>{downloadingCsv ? "Generating CSV..." : "Export Procurement CSV"}</span>
          </Button>
        </div>
      </div>

      {/* Watermarked Draft Preview Button (when not approved) */}
      {!isApproved && (
        <div className="rounded-[var(--radius-lg)] border border-amber-500/20 bg-amber-500/5 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-fg-default)]">
              <FileDown className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Internal Inspection Preview</span>
            </div>
            <Badge variant="warning" emphasis="subtle" className="text-[10px]">
              DRAFT WATERMARKED
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPreview}
            disabled={downloadingPreview}
            isLoading={downloadingPreview}
            className="w-full gap-2 text-xs h-9 border-amber-300 dark:border-amber-700/50 text-amber-900 dark:text-amber-200 hover:bg-amber-500/10 cursor-pointer"
            data-testid="export-preview-button"
          >
            <FileDown className="h-4 w-4 text-amber-600" />
            <span>
              {downloadingPreview
                ? "Rendering Preview..."
                : "Download Watermarked Draft Preview"}
            </span>
          </Button>
          <span className="block text-[11px] text-[var(--color-fg-muted)] text-center">
            Includes conspicuous diagonal watermark on every page.
          </span>
        </div>
      )}

      {/* Delivery & Checksum History Section */}
      <div className="pt-3 border-t border-[var(--color-border-subtle)] space-y-2.5">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-[var(--color-fg-default)] uppercase tracking-wider">
            Export History &amp; Integrity Verification
          </h4>
          <span className="text-[10px] text-[var(--color-fg-muted)] font-mono">
            {deliveries.length} {deliveries.length === 1 ? "deliverable" : "deliverables"} logged
          </span>
        </div>

        {deliveriesLoading ? (
          <div className="text-xs text-[var(--color-fg-muted)] py-3 text-center">Loading delivery records...</div>
        ) : deliveries.length === 0 ? (
          <div className="text-xs text-[var(--color-fg-muted)] py-3 text-center italic bg-[var(--color-bg-subtle)]/30 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-subtle)]">
            No customer export documents generated yet for this quote.
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {deliveries.map((del) => (
              <div
                key={del.id}
                className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)]/40 p-2.5 text-xs space-y-1.5 transition-colors hover:border-[var(--color-border-default)]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-medium">
                    <span className="uppercase font-mono text-[10px] bg-[var(--color-bg-surface)] px-1.5 py-0.5 rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] font-bold text-[var(--color-fg-default)]">
                      {del.export_type}
                    </span>
                    {del.watermarked ? (
                      <Badge variant="neutral" emphasis="subtle" className="text-[10px]">
                        DRAFT WATERMARKED
                      </Badge>
                    ) : (
                      <Badge variant="success" emphasis="subtle" className="text-[10px]">
                        CLEAN FINAL
                      </Badge>
                    )}
                  </div>
                  <span className="text-[11px] text-[var(--color-fg-muted)]">
                    <DateTimeText value={del.created_at} />
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-[var(--color-border-subtle)]/60">
                  <div className="text-[11px] text-[var(--color-fg-muted)] truncate max-w-[220px]">
                    By: <span className="font-medium text-[var(--color-fg-default)]">{del.exported_by_name || "Sales User"}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopyHash(del.sha256_hash)}
                    className="inline-flex items-center gap-1.5 text-[10px] font-mono bg-[var(--color-bg-surface)] px-2 py-0.5 rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] text-[var(--color-fg-default)] hover:bg-[var(--color-bg-subtle)] hover:border-[var(--color-border-default)] transition-colors cursor-pointer"
                    title="Copy full 64-char SHA-256 fingerprint"
                    aria-label={`Copy SHA-256 fingerprint ${del.sha256_hash.slice(0, 10)}...`}
                  >
                    {copiedHash === del.sha256_hash ? (
                      <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Copy className="h-3 w-3 text-[var(--color-fg-muted)]" />
                    )}
                    <span>{del.sha256_hash.slice(0, 10)}...</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
