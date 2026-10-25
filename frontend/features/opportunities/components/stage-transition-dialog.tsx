"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useUpdateOpportunityStage, type Opportunity } from "../api";

const stageTransitionSchema = z.object({
  targetStage: z.enum(["lead", "qualified", "solutioning", "proposal", "negotiation", "won", "lost"]),
  loss_reason: z.enum(["price", "timing", "competitor", "no_response", "other"]).optional(),
  loss_detail: z.string().max(500).optional(),
  won_override_reason: z.string().max(500).optional(),
});

type StageTransitionValues = z.infer<typeof stageTransitionSchema>;

interface StageTransitionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity: Opportunity;
  targetStage: "lead" | "qualified" | "solutioning" | "proposal" | "negotiation" | "won" | "lost";
}

export function StageTransitionDialog({
  open,
  onOpenChange,
  opportunity,
  targetStage,
}: StageTransitionDialogProps) {
  const { user } = useAuth();
  const updateStageMutation = useUpdateOpportunityStage(opportunity.id);
  const isManagerOrAdmin = user?.role === "sales_manager" || user?.role === "admin";

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<StageTransitionValues>({
    resolver: zodResolver(stageTransitionSchema),
    defaultValues: {
      targetStage,
      loss_reason: "competitor",
      loss_detail: "",
      won_override_reason: "",
    },
  });

  const isWon = targetStage === "won";
  const isLost = targetStage === "lost";

  const onSubmit = async (values: StageTransitionValues) => {
    try {
      if (isWon) {
        if (!isManagerOrAdmin) {
          toast.error("Only sales managers or admins can approve won deals in Phase 2.");
          return;
        }
        if (!values.won_override_reason || values.won_override_reason.trim().length < 3) {
          toast.error("A valid manager override reason is required to mark an opportunity won.");
          return;
        }
        await updateStageMutation.mutateAsync({
          stage: "won",
          won_override_reason: values.won_override_reason,
          expected_version: opportunity.version,
        });
      } else if (isLost) {
        if (!values.loss_reason) {
          toast.error("Please specify a reason for the lost deal.");
          return;
        }
        await updateStageMutation.mutateAsync({
          stage: "lost",
          loss_reason: values.loss_reason,
          loss_detail: values.loss_detail || undefined,
          expected_version: opportunity.version,
        });
      } else {
        await updateStageMutation.mutateAsync({
          stage: targetStage,
          expected_version: opportunity.version,
        });
      }

      toast.success(`Opportunity moved to ${targetStage.replace("_", " ")}`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update opportunity stage");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Move to <span className="capitalize">{targetStage.replace("_", " ")}</span>
          </DialogTitle>
          <DialogDescription>
            Advance &quot;{opportunity.name}&quot; from {opportunity.stage} to {targetStage}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          {/* Normal stage advance confirmation */}
          {!isWon && !isLost && (
            <p className="text-xs text-[var(--muted-foreground)]">
              This will advance the deal to the <strong className="text-[var(--foreground)]">{targetStage}</strong> stage.
              An activity event will be logged automatically.
            </p>
          )}

          {/* Lost stage requirements */}
          {isLost && (
            <div className="space-y-3">
              <div className="rounded-[var(--radius-md)] bg-[var(--danger-soft)] p-3 text-xs text-[var(--danger)] flex items-start gap-2">
                <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Marking an opportunity lost is a terminal state. A loss reason is required for win/loss analytics.</span>
              </div>

              <FormField id="stg-loss-reason" label="Primary Loss Reason" required error={errors.loss_reason?.message}>
                <select
                  id="stg-loss-reason"
                  {...register("loss_reason")}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
                >
                  <option value="price">Price / Commercial Terms</option>
                  <option value="competitor">Competitor Selected</option>
                  <option value="timing">Project Postponed / Cancelled</option>
                  <option value="no_response">Customer Unresponsive</option>
                  <option value="other">Other Technical / Fit Reason</option>
                </select>
              </FormField>

              <FormField id="stg-loss-detail" label="Loss Detail & Feedback" error={errors.loss_detail?.message}>
                <textarea
                  id="stg-loss-detail"
                  {...register("loss_detail")}
                  rows={2}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
                  placeholder="Competitor pricing details, budget cancellation notes..."
                />
              </FormField>
            </div>
          )}

          {/* Won stage Phase 2 guard */}
          {isWon && (
            <div className="space-y-3">
              {!isManagerOrAdmin ? (
                <div className="rounded-[var(--radius-md)] bg-[var(--warning-soft)] p-3 text-xs text-[var(--warning)] flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-semibold">Manager Approval Required</strong>
                    In Phase 2, quotations are not yet integrated. Sales representatives cannot close-win an opportunity directly. Please request a sales manager or admin to record the win override.
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-[var(--radius-md)] bg-[var(--info-soft)] p-3 text-xs text-[var(--info)] flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-semibold">Phase 2 Manager Won Override</strong>
                      Quotation workflow arrives in Phase 4. As a manager, you may mark this opportunity Won with an explicit audit reason (e.g. PO number, signed contract).
                    </div>
                  </div>

                  <FormField id="stg-won-reason" label="Manager Override Reason" required error={errors.won_override_reason?.message}>
                    <textarea
                      id="stg-won-reason"
                      {...register("won_override_reason")}
                      rows={3}
                      className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
                      placeholder="e.g. Advance payment received via Purchase Order PO-98421"
                    />
                  </FormField>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || (isWon && !isManagerOrAdmin)}
              variant={isLost ? "destructive" : "primary"}
            >
              {isSubmitting ? "Updating..." : `Confirm ${targetStage}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
