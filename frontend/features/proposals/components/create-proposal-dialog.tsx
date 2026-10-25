"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogPopup, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateProposal } from "@/features/proposals/api";
import type { QuoteDetail } from "@/features/quotes/api";

interface CreateProposalDialogProps {
  quote: QuoteDetail;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (proposalId: string) => void;
}

interface DraftOperation {
  id: string;
  type: string;
  target_line_id?: string;
  field?: string;
  value?: string;
}

interface CreateProposalFormProps {
  quote: QuoteDetail;
  onClose: () => void;
  onSuccess?: (proposalId: string) => void;
}

function CreateProposalForm({ quote, onClose, onSuccess }: CreateProposalFormProps) {
  const createMutation = useCreateProposal();
  const lines = quote.current_revision?.lines || [];

  const [title, setTitle] = React.useState("");
  const [justification, setJustification] = React.useState("");
  const [operations, setOperations] = React.useState<DraftOperation[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  // New operation builder state
  const [opType, setOpType] = React.useState("set_line_discount_percent");
  const [selectedLineId, setSelectedLineId] = React.useState<string>(
    lines.length > 0 ? lines[0].id : ""
  );
  const [opValue, setOpValue] = React.useState("");

  const handleAddOperation = () => {
    setError(null);
    if (opType.startsWith("set_line_") || opType === "remove_line") {
      if (!selectedLineId) {
        setError("Please select a target line item.");
        return;
      }
      if (opType !== "remove_line" && !opValue.trim()) {
        setError("Please enter a new value for the operation.");
        return;
      }
    } else {
      if (!opValue.trim()) {
        setError("Please enter a new value for the quotation term.");
        return;
      }
    }

    const newOp: DraftOperation = {
      id: `op-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type: opType,
      target_line_id: opType.startsWith("set_line_") || opType === "remove_line" ? selectedLineId : undefined,
      value: opType !== "remove_line" ? opValue.trim() : undefined,
    };

    setOperations((prev) => [...prev, newOp]);
    setOpValue("");
  };

  const handleRemoveOperation = (id: string) => {
    setOperations((prev) => prev.filter((op) => op.id !== id));
  };

  const handleSubmit = async () => {
    setError(null);
    if (!title.trim()) {
      setError("A descriptive title is required.");
      return;
    }
    if (!justification.trim()) {
      setError("Commercial justification is required to explain the rationale for changes.");
      return;
    }
    if (operations.length === 0) {
      setError("Please add at least one allowlisted operation to this change proposal.");
      return;
    }

    if (!quote.current_revision_id) {
      setError("Quote does not have an active base revision.");
      return;
    }

    try {
      const created = await createMutation.mutateAsync({
        quoteId: quote.id,
        idempotencyKey: `prop-create-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        payload: {
          quote_id: quote.id,
          base_revision_id: quote.current_revision_id,
          title: title.trim(),
          justification: justification.trim(),
          operations: operations.map((op) => ({
            type: op.type,
            target_line_id: op.target_line_id,
            value: op.value,
          })),
        },
      });

      onClose();
      if (onSuccess) {
        onSuccess(created.id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create change proposal.";
      setError(msg);
    }
  };

  const getLineLabel = (lineId?: string) => {
    const l = lines.find((ln) => ln.id === lineId);
    if (!l) return "Target Line";
    return `Line #${l.line_order}: ${l.product_name} (${l.sku})`;
  };

  return (
    <>
      <div className="space-y-4 pt-2">
        {error && (
          <div
            role="alert"
            className="rounded-[var(--radius-md)] border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 p-3 text-xs text-[var(--destructive)]"
          >
            {error}
          </div>
        )}

        {/* Proposal Title */}
        <div>
          <label htmlFor="prop-title" className="block text-xs font-medium text-[var(--foreground)]">
            Proposal Title <span className="text-[var(--destructive)]">*</span>
          </label>
          <Input
            id="prop-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Volume Discount Adjustment for Key Account"
            className="mt-1 text-xs"
          />
        </div>

        {/* Commercial Justification */}
        <div>
          <label htmlFor="prop-justification" className="block text-xs font-medium text-[var(--foreground)]">
            Commercial Justification <span className="text-[var(--destructive)]">*</span>
          </label>
          <textarea
            id="prop-justification"
            rows={2}
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Explain the commercial rationale for these adjustments (mandatory for managerial maker-checker review)..."
            className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-2.5 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:outline-hidden"
          />
        </div>

        {/* Operation Builder */}
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] p-3.5">
          <h4 className="text-xs font-semibold text-[var(--foreground)] mb-2">
            Add Allowlisted Operation
          </h4>
          <div className="space-y-2.5">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label htmlFor="op-type-select" className="block text-[11px] font-medium text-[var(--muted-foreground)] mb-1">
                  Operation Type
                </label>
                <select
                  id="op-type-select"
                  value={opType}
                  onChange={(e) => setOpType(e.target.value)}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-2 text-xs text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-hidden"
                >
                  <option value="set_line_discount_percent">Set Line Discount %</option>
                  <option value="set_line_unit_price">Set Line Selling Price (₹)</option>
                  <option value="set_line_quantity">Set Line Quantity</option>
                  <option value="remove_line">Remove Line</option>
                  <option value="set_payment_terms">Set Payment Terms</option>
                  <option value="set_delivery_terms">Set Delivery Terms</option>
                  <option value="set_valid_until">Set Validity Date (YYYY-MM-DD)</option>
                </select>
              </div>

              {/* Target line selector if line-level operation */}
              {(opType.startsWith("set_line_") || opType === "remove_line") && (
                <div>
                  <label htmlFor="target-line-select" className="block text-[11px] font-medium text-[var(--muted-foreground)] mb-1">
                    Target Line Item
                  </label>
                  <select
                    id="target-line-select"
                    value={selectedLineId}
                    onChange={(e) => setSelectedLineId(e.target.value)}
                    className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-2 text-xs text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-hidden"
                  >
                    {lines.map((l) => (
                      <option key={l.id} value={l.id}>
                        #{l.line_order}: {l.product_name} ({l.sku})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Value Input (unless removing line) */}
            {opType !== "remove_line" && (
              <div>
                <label htmlFor="op-value-input" className="block text-[11px] font-medium text-[var(--muted-foreground)] mb-1">
                  {opType === "set_line_discount_percent"
                    ? "New Discount % (e.g. 8.50)"
                    : opType === "set_line_unit_price"
                    ? "New Unit Price in INR (e.g. 1250.00)"
                    : opType === "set_line_quantity"
                    ? "New Quantity (e.g. 50)"
                    : opType === "set_payment_terms"
                    ? "New Payment Terms (e.g. Net 45)"
                    : opType === "set_delivery_terms"
                    ? "New Delivery Terms (e.g. CIF Mumbai)"
                    : "New Date (YYYY-MM-DD)"}
                </label>
                <div className="flex gap-2">
                  <Input
                    id="op-value-input"
                    value={opValue}
                    onChange={(e) => setOpValue(e.target.value)}
                    placeholder="Enter new value..."
                    className="text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddOperation();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddOperation}
                    className="shrink-0 gap-1 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Add</span>
                  </Button>
                </div>
              </div>
            )}

            {opType === "remove_line" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddOperation}
                className="w-full text-xs text-[var(--destructive)]"
              >
                <Plus className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                <span>Add Line Removal to Operations</span>
              </Button>
            )}
          </div>
        </div>

        {/* Staged Operations List */}
        <div>
          <h4 className="text-xs font-semibold text-[var(--foreground)] mb-1.5">
            Staged Operations ({operations.length})
          </h4>
          {operations.length === 0 ? (
            <p className="text-xs text-[var(--muted-foreground)] italic">
              No operations added yet. Use the builder above to stage allowlisted modifications.
            </p>
          ) : (
            <div className="space-y-1.5">
              {operations.map((op) => (
                <div
                  key={op.id}
                  className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-[var(--foreground)] capitalize">
                      {op.type.replace(/_/g, " ")}
                    </span>
                    {op.target_line_id && (
                      <span className="text-[11px] text-[var(--muted-foreground)]">
                        {getLineLabel(op.target_line_id)}
                      </span>
                    )}
                    {op.value && (
                      <span className="text-[11px] font-mono text-[var(--primary)]">
                        Proposed Value: {op.value}
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveOperation(op.id)}
                    className="h-7 w-7 text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
                    aria-label="Remove operation"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] pt-4 mt-4">
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={createMutation.isPending || operations.length === 0}
        >
          {createMutation.isPending ? "Creating Proposal..." : "Create Change Proposal"}
        </Button>
      </div>
    </>
  );
}

export function CreateProposalDialog({
  quote,
  isOpen,
  onClose,
  onSuccess,
}: CreateProposalDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPopup className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogTitle className="text-lg font-bold text-[var(--foreground)]">
          Create Change Proposal
        </DialogTitle>
        <DialogDescription className="text-xs text-[var(--muted-foreground)]">
          Propose isolated changes against Revision #{quote.current_revision?.revision_number || 1}. The current quotation remains unchanged until this proposal is reviewed, approved, and committed.
        </DialogDescription>

        {isOpen && (
          <CreateProposalForm
            quote={quote}
            onClose={onClose}
            onSuccess={onSuccess}
          />
        )}
      </DialogPopup>
    </Dialog>
  );
}
