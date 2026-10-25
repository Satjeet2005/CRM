"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDropzone } from "react-dropzone";
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  FileCheck,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button, Input, Card, Badge } from "@/components/sakani";
import { LoadingSkeleton } from "@/components/data-display/loading-skeleton";
import { useAccounts } from "@/features/accounts/api";
import { useOpportunities } from "@/features/opportunities/api";
import {
  usePreviewRFQ,
  useImportRFQ,
} from "@/features/rfqs/api";

const CANONICAL_FIELDS: { id: string; label: string; required: boolean; description: string }[] = [
  { id: "description", label: "Item Description", required: true, description: "Primary text describing the required line item." },
  { id: "quantity", label: "Quantity", required: true, description: "Numeric quantity or quantity string." },
  { id: "unit", label: "Unit of Measure (UOM)", required: false, description: "Unit such as mtr, nos, pcs, set, kg." },
  { id: "sku", label: "SKU / Part Number", required: false, description: "Direct SKU or supplier part code if known." },
  { id: "specifications", label: "Specifications", required: false, description: "Dimensions, pressure class, or technical attributes." },
  { id: "manufacturer", label: "Manufacturer", required: false, description: "Brand or OEM specified." },
  { id: "manufacturer_part_number", label: "Part Number / MPN", required: false, description: "Manufacturer part number." },
  { id: "notes", label: "Notes / Comments", required: false, description: "Line remarks, project references, or turnaround instructions." },
];

export default function NewRFQImportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialAccountId = searchParams.get("account_id") || "";
  const initialOppId = searchParams.get("opportunity_id") || "";

  // Step state: 1 = Context & File Upload, 2 = Mapping & Confirmation
  const [currentStep, setCurrentStep] = React.useState<1 | 2>(1);

  // Form state
  const [accountId, setAccountId] = React.useState(initialAccountId);
  const [opportunityId, setOpportunityId] = React.useState(initialOppId);
  const [title, setTitle] = React.useState("");
  const [customerReference, setCustomerReference] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [csvContent, setCsvContent] = React.useState("");
  const [duplicateOverride, setDuplicateOverride] = React.useState(false);
  const [customMapping, setCustomMapping] = React.useState<Record<string, string>>({});

  // Queries
  const { data: accountsData, isLoading: accountsLoading } = useAccounts({ page_size: 100 });
  const { data: oppsData, isLoading: oppsLoading } = useOpportunities({
    account_id: accountId || undefined,
    page_size: 100,
  });

  // Preview mutation
  const previewMutation = usePreviewRFQ();
  const importMutation = useImportRFQ();

  // Dropzone setup
  const onDrop = React.useCallback((acceptedFiles: File[]) => {
    if (!acceptedFiles || acceptedFiles.length === 0) return;
    const selectedFile = acceptedFiles[0];

    if (selectedFile.size > 5 * 1024 * 1024) {
      toast.error("File exceeds maximum allowed size of 5 MiB.");
      return;
    }

    setFile(selectedFile);
    if (!title) {
      const cleanName = selectedFile.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      let content = (e.target?.result as string) || "";
      // Strip BOM if present
      if (content.charCodeAt(0) === 0xfeff) {
        content = content.slice(1);
      }
      setCsvContent(content);

      // Auto trigger preview
      previewMutation.mutate(
        { filename: selectedFile.name, csv_content: content },
        {
          onSuccess: (data) => {
            setCustomMapping(data.recommended_mapping || {});
          },
          onError: (err) => {
            toast.error(`CSV Preview failed: ${err.message}`);
          },
        }
      );
    };
    reader.readAsText(selectedFile, "UTF-8");
  }, [title, previewMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"], "text/plain": [".txt"] },
    maxFiles: 1,
  });

  const handleContextAndFileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) {
      toast.error("Please select a customer account.");
      return;
    }
    if (!opportunityId) {
      toast.error("Please select a target CRM opportunity.");
      return;
    }
    if (!title.trim()) {
      toast.error("Please provide an RFQ title.");
      return;
    }
    if (!csvContent) {
      toast.error("Please upload a valid CSV file.");
      return;
    }
    if (!previewMutation.data?.is_importable) {
      toast.error("CSV has fatal errors preventing import. Please review diagnostics.");
      return;
    }
    setCurrentStep(2);
  };

  const handleImportSubmit = () => {
    if (!previewMutation.data) return;

    importMutation.mutate(
      {
        account_id: accountId,
        opportunity_id: opportunityId,
        title: title.trim(),
        customer_reference: customerReference.trim() || undefined,
        filename: file?.name || "rfq_upload.csv",
        csv_content: csvContent,
        header_mapping: customMapping,
        duplicate_override: duplicateOverride,
      },
      {
        onSuccess: (createdRfq) => {
          toast.success(`RFQ ${createdRfq.rfq_number} successfully ingested!`);
          router.push(`/app/rfqs/${createdRfq.id}`);
        },
        onError: (err: any) => {
          if (err.code === "DUPLICATE_RFQ_IMPORT" || err.message?.includes("DUPLICATE_RFQ_IMPORT")) {
            toast.error("Duplicate content detected. Check the duplicate override toggle to proceed.");
          } else {
            toast.error(`Import failed: ${err.message}`);
          }
        },
      }
    );
  };

  return (
    <PageContainer>
      <PageHeader
        title="Import RFQ Spreadsheet"
        description="Ingest client RFQ line-items via RFC 4180 CSV with deterministic normalization and catalog candidate ranking."
        breadcrumbs={[
          { label: "Dashboard", href: "/app/dashboard" },
          { label: "RFQs", href: "/app/rfqs" },
          { label: "Import Wizard", href: "/app/rfqs/new" },
        ]}
      />

      {/* Progress Stepper Strip */}
      <div className="flex items-center justify-between max-w-2xl mt-6 border-b border-[var(--color-border-subtle)] pb-4">
        <div className="flex items-center gap-2.5">
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              currentStep === 1
                ? "bg-[var(--color-primary-600)] text-white"
                : "bg-[var(--color-success-600)] text-white"
            }`}
          >
            {currentStep > 1 ? <CheckCircle2 className="w-4 h-4" /> : "1"}
          </span>
          <span className="text-sm font-semibold text-[var(--color-fg-default)]">
            Context & File Upload
          </span>
        </div>
        <div className="flex-1 mx-4 h-0.5 bg-[var(--color-border-subtle)]" />
        <div className="flex items-center gap-2.5">
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              currentStep === 2
                ? "bg-[var(--color-primary-600)] text-white"
                : "bg-[var(--color-bg-subtle)] text-[var(--color-fg-muted)] border border-[var(--color-border-subtle)]"
            }`}
          >
            2
          </span>
          <span
            className={`text-sm ${
              currentStep === 2
                ? "text-[var(--color-fg-default)] font-semibold"
                : "text-[var(--color-fg-muted)] font-medium"
            }`}
          >
            Column Mapping & Ingestion
          </span>
        </div>
      </div>

      {currentStep === 1 ? (
        <form onSubmit={handleContextAndFileSubmit} className="max-w-2xl mt-8 space-y-6">
          {/* Account and Opportunity Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="rfq-account-select" className="block text-xs font-semibold text-[var(--color-fg-default)] mb-1.5">
                Customer Account <span className="text-[var(--color-danger-500)]">*</span>
              </label>
              {accountsLoading ? (
                <LoadingSkeleton rows={1} />
              ) : (
                <div className="relative">
                  <select
                    id="rfq-account-select"
                    aria-label="Customer Account"
                    value={accountId}
                    onChange={(e) => {
                      setAccountId(e.target.value);
                      setOpportunityId("");
                    }}
                    className="w-full h-10 px-3 text-xs bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-[var(--radius-md)] text-[var(--color-fg-default)] focus:border-[var(--color-border-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]/20 shadow-xs"
                    required
                  >
                    <option value="">Select Account...</option>
                    {accountsData?.items.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="rfq-opp-select" className="block text-xs font-semibold text-[var(--color-fg-default)] mb-1.5">
                CRM Opportunity <span className="text-[var(--color-danger-500)]">*</span>
              </label>
              {oppsLoading ? (
                <LoadingSkeleton rows={1} />
              ) : (
                <div className="relative">
                  <select
                    id="rfq-opp-select"
                    aria-label="CRM Opportunity"
                    value={opportunityId}
                    onChange={(e) => setOpportunityId(e.target.value)}
                    disabled={!accountId}
                    className="w-full h-10 px-3 text-xs bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-[var(--radius-md)] text-[var(--color-fg-default)] focus:border-[var(--color-border-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]/20 shadow-xs disabled:opacity-50 disabled:bg-[var(--color-bg-subtle)]"
                    required
                  >
                    <option value="">
                      {accountId ? "Select Opportunity..." : "Select Account First"}
                    </option>
                    {oppsData?.items.map((opp) => (
                      <option key={opp.id} value={opp.id}>
                        {opp.name} ({opp.stage})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Title and Customer Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-fg-default)] mb-1.5">
                RFQ Title <span className="text-[var(--color-danger-500)]">*</span>
              </label>
              <Input
                placeholder="e.g. Turnaround Piping Package A"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-fg-default)] mb-1.5">
                Customer Reference #
              </label>
              <Input
                placeholder="e.g. PO-REQ-2026-881"
                value={customerReference}
                onChange={(e) => setCustomerReference(e.target.value)}
              />
            </div>
          </div>

          {/* File Drag and Drop Zone */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-fg-default)] mb-1.5">
              CSV Spreadsheet <span className="text-[var(--color-danger-500)]">*</span>
            </label>

            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-[var(--radius-lg)] p-6 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? "border-[var(--color-primary-500)] bg-[var(--color-primary-50)]/40"
                  : file
                  ? "border-[var(--color-success-500)] bg-[var(--color-success-50)]/30"
                  : "border-[var(--color-border-default)] hover:border-[var(--color-primary-400)] bg-[var(--color-bg-surface)]"
              }`}
            >
              <input {...getInputProps({ "aria-label": "Upload CSV spreadsheet" })} />
              {file ? (
                <div className="flex flex-col items-center">
                  <FileCheck className="w-10 h-10 text-[var(--color-success-600)] mb-2" />
                  <p className="font-semibold text-sm text-[var(--color-fg-default)]">{file.name}</p>
                  <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
                    {(file.size / 1024).toFixed(1)} KB • RFC 4180 / UTF-8
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setCsvContent("");
                    }}
                  >
                    Change File
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <UploadCloud className="w-10 h-10 text-[var(--color-fg-muted)] mb-2" />
                  <p className="font-semibold text-sm text-[var(--color-fg-default)]">
                    Drag and drop customer CSV file here, or click to browse
                  </p>
                  <p className="text-xs text-[var(--color-fg-muted)] mt-1">
                    Up to 5 MiB and 500 rows. UTF-8 encoded with optional BOM.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Preview Status & Feedback */}
          {previewMutation.isPending && (
            <div className="flex items-center gap-2 p-3 bg-[var(--color-bg-subtle)] rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] text-xs text-[var(--color-fg-muted)]">
              <RefreshCw className="w-4 h-4 animate-spin text-[var(--color-primary-600)]" />
              <span>Analyzing CSV headers and validating delimiter...</span>
            </div>
          )}

          {previewMutation.data && (
            <Card className="p-4 text-xs space-y-2">
              <div className="flex items-center justify-between font-medium">
                <span className="text-[var(--color-fg-default)] font-semibold">Analysis Summary</span>
                <span className="text-[var(--color-fg-muted)] font-mono">
                  {previewMutation.data.total_data_rows} data rows detected
                </span>
              </div>
              <div className="flex items-center gap-2">
                {previewMutation.data.is_importable ? (
                  <span className="text-[var(--color-success-600)] flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-4 h-4" /> Valid CSV structure ready for mapping
                  </span>
                ) : (
                  <span className="text-[var(--color-danger-600)] flex items-center gap-1.5 font-medium">
                    <AlertCircle className="w-4 h-4" /> CSV structure has fatal errors
                  </span>
                )}
              </div>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end pt-4 border-t border-[var(--color-border-subtle)]">
            <Button
              type="submit"
              disabled={!file || !accountId || !opportunityId || !title.trim() || previewMutation.isPending}
              className="flex items-center gap-2"
            >
              <span>Continue to Mapping</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </form>
      ) : (
        /* Step 2: Mapping & Confirmation */
        <div className="max-w-4xl mt-8 space-y-6">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-fg-default)]">Header Mapping Configuration</h3>
                <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
                  Match your CSV column headers to ForgeFlow canonical fields. Required fields must be mapped.
                </p>
              </div>
              <Badge variant="neutral" emphasis="subtle">
                {previewMutation.data?.detected_headers.length} headers detected
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {CANONICAL_FIELDS.map((cf) => (
                <div key={cf.id} className="p-3 bg-[var(--color-bg-subtle)] rounded-[var(--radius-md)] border border-[var(--color-border-subtle)]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-[var(--color-fg-default)]">
                      {cf.label} {cf.required && <span className="text-[var(--color-danger-500)]">*</span>}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--color-fg-muted)] mb-2">{cf.description}</p>
                  <select
                    value={customMapping[cf.id] || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomMapping((prev) => {
                        const next = { ...prev };
                        if (!val) {
                          delete next[cf.id];
                        } else {
                          next[cf.id] = val;
                        }
                        return next;
                      });
                    }}
                    className="w-full h-8 px-2 text-xs bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-[var(--radius-sm)] text-[var(--color-fg-default)] focus:border-[var(--color-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-focus)]"
                  >
                    <option value="">(Not Mapped)</option>
                    {previewMutation.data?.detected_headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </Card>

          {/* Sample Rows Preview */}
          {previewMutation.data?.sample_rows && previewMutation.data.sample_rows.length > 0 && (
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] overflow-hidden shadow-2xs">
              <div className="px-4 py-3 bg-[var(--color-bg-subtle)] border-b border-[var(--color-border-subtle)] text-xs font-semibold text-[var(--color-fg-default)]">
                Raw CSV Sample Rows (First {previewMutation.data.sample_rows.length} rows)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[var(--color-bg-subtle)]/50 text-[var(--color-fg-muted)] border-b border-[var(--color-border-subtle)] font-medium">
                    <tr>
                      <th className="px-3 py-2 w-12 font-mono">#</th>
                      {previewMutation.data.detected_headers.map((h) => (
                        <th key={h} className="px-3 py-2 whitespace-nowrap font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-subtle)]">
                    {previewMutation.data.sample_rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-[var(--color-bg-subtle)]/50 transition-colors">
                        <td className="px-3 py-2 font-mono text-[var(--color-fg-muted)]">{rIdx + 1}</td>
                        {previewMutation.data?.detected_headers.map((h) => (
                          <td key={h} className="px-3 py-2 whitespace-nowrap text-[var(--color-fg-default)] font-mono">
                            {row[h] || "-"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Duplicate Override Warning if re-importing */}
          <div className="p-4 rounded-[var(--radius-md)] border border-[var(--color-warning-200)] bg-[var(--color-warning-50)]/40 text-xs space-y-2">
            <div className="flex items-center gap-2 font-semibold text-[var(--color-warning-800)]">
              <AlertTriangle className="w-4 h-4 text-[var(--color-warning-600)]" />
              Duplicate Content Safety Gate
            </div>
            <p className="text-[var(--color-warning-700)]">
              If an identical CSV file was previously ingested into this tenant, the system prevents accidental double-counting. Check below to explicitly override.
            </p>
            <label className="flex items-center gap-2 text-[var(--color-fg-default)] font-medium pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={duplicateOverride}
                onChange={(e) => setDuplicateOverride(e.target.checked)}
                className="rounded border-[var(--color-border-default)] text-[var(--color-primary-600)] focus:ring-[var(--color-border-focus)]"
              />
              <span>Allow re-import if this file content hash already exists</span>
            </label>
          </div>

          {/* Step Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border-subtle)]">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentStep(1)}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Context & File</span>
            </Button>

            <Button
              type="button"
              onClick={handleImportSubmit}
              disabled={importMutation.isPending || !customMapping["description"]}
              className="flex items-center gap-2"
            >
              {importMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Ingesting & Normalizing...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Ingest & Open Review Studio</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
