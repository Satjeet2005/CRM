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
  Clock,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { DateTimeText } from "@/components/data-display/date-time-text";
import {
  useQuoteDeliveries,
  type QuoteDetail,
  type QuoteCustomerDelivery,
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
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-2xs overflow-hidden">
      <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-muted)]/30">
        <div>
          <h2 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-1.5">
            <Download className="h-4 w-4 text-[var(--primary)]" />
            <span>Customer Document Exports</span>
          </h2>
          <p className="text-xs text-[var(--muted-foreground)]">
            Server-generated PDF and CSV quotations bound to authoritative committed revision.
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Export Gate Status & Actions */}
        {isApproved ? (
          <div className="rounded-[var(--radius-md)] border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900 space-y-2">
            <div className="flex items-center gap-2 font-medium">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Quotation is approved and certified for commercial customer release.</span>
            </div>
            <p className="text-[11px] text-emerald-800">
              Generated customer documents never expose internal manufacturing unit costs, margins, or private notes.
            </p>
          </div>
        ) : (
          <div className="rounded-[var(--radius-md)] border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-medium">
              <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Final customer exports locked ({quote.status.toUpperCase()})</span>
            </div>
            <p className="text-[11px] text-amber-800">
              Customer-ready unwatermarked PDF and CSV exports require managerial approval. For internal inspection, download a watermarked draft preview below.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Final PDF Export Button */}
          <Button
            variant="primary"
            size="sm"
            onClick={handleExportPdf}
            disabled={!isApproved || downloadingPdf}
            className="flex-1 gap-2 text-xs h-9 cursor-pointer"
            data-testid="export-pdf-button"
            title={
              !isApproved
                ? `Customer PDF export requires approved status (currently ${quote.status})`
                : "Download approved customer quotation PDF"
            }
          >
            <FileText className="h-4 w-4" />
            <span>{downloadingPdf ? "Generating PDF..." : "Export Customer PDF"}</span>
          </Button>

          {/* Final CSV Export Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={!isApproved || downloadingCsv}
            className="flex-1 gap-2 text-xs h-9 cursor-pointer"
            data-testid="export-csv-button"
            title={
              !isApproved
                ? `Customer CSV export requires approved status (currently ${quote.status})`
                : "Download procurement-safe CSV file"
            }
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>{downloadingCsv ? "Generating CSV..." : "Export Procurement CSV"}</span>
          </Button>
        </div>

        {/* Watermarked Draft Preview Button (when not approved) */}
        {!isApproved && (
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPreview}
              disabled={downloadingPreview}
              className="w-full gap-2 text-xs h-9 border-amber-300 text-amber-900 hover:bg-amber-50 cursor-pointer"
              data-testid="export-preview-button"
            >
              <FileDown className="h-4 w-4 text-amber-600" />
              <span>
                {downloadingPreview
                  ? "Rendering Preview..."
                  : "Download Watermarked Draft Preview"}
              </span>
            </Button>
            <span className="block text-[11px] text-[var(--muted-foreground)] text-center mt-1">
              Includes conspicuous diagonal watermark on every page.
            </span>
          </div>
        )}

        {/* Delivery & Checksum History Section */}
        <div className="pt-3 border-t border-[var(--border)] space-y-2">
          <h3 className="text-xs font-semibold text-[var(--foreground)] uppercase tracking-wider">
            Export History &amp; Integrity Verification
          </h3>

          {deliveriesLoading ? (
            <div className="text-xs text-[var(--muted-foreground)] py-2">Loading deliveries...</div>
          ) : deliveries.length === 0 ? (
            <div className="text-xs text-[var(--muted-foreground)] py-2 italic">
              No customer export documents generated yet for this quote.
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {deliveries.map((del) => (
                <div
                  key={del.id}
                  className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)]/40 p-2 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-medium">
                      <span className="uppercase font-mono text-[10px] bg-[var(--surface)] px-1.5 py-0.5 rounded border border-[var(--border)] font-bold">
                        {del.export_type}
                      </span>
                      {del.watermarked ? (
                        <StatusBadge variant="neutral" label="DRAFT WATERMARKED" />
                      ) : (
                        <StatusBadge variant="success" label="CLEAN FINAL" />
                      )}
                    </div>
                    <span className="text-[11px] text-[var(--muted-foreground)]">
                      <DateTimeText value={del.created_at} />
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="text-[11px] text-[var(--muted-foreground)] truncate max-w-[200px]">
                      By: <span className="text-[var(--foreground)]">{del.exported_by_name || "Sales User"}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopyHash(del.sha256_hash)}
                      className="inline-flex items-center gap-1 text-[10px] font-mono bg-[var(--surface)] px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-muted)] cursor-pointer"
                      title="Copy full 64-char SHA-256 fingerprint"
                      aria-label="Copy SHA-256 fingerprint"
                    >
                      {copiedHash === del.sha256_hash ? (
                        <Check className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <Copy className="h-3 w-3 text-[var(--muted-foreground)]" />
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
    </div>
  );
}
