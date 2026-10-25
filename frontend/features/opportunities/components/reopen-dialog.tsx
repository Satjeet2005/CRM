"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/forms/form-field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useReopenOpportunity, type Opportunity } from "../api";

const reopenSchema = z.object({
  reason: z.string().min(3, "Reason must be at least 3 characters").max(500),
});

type ReopenValues = z.infer<typeof reopenSchema>;

interface ReopenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity: Opportunity;
}

export function ReopenDialog({ open, onOpenChange, opportunity }: ReopenDialogProps) {
  const reopenMutation = useReopenOpportunity(opportunity.id);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReopenValues>({
    resolver: zodResolver(reopenSchema),
    defaultValues: { reason: "" },
  });

  const onSubmit = async (values: ReopenValues) => {
    try {
      await reopenMutation.mutateAsync({
        reason: values.reason,
        expected_version: opportunity.version,
      });
      toast.success(`Opportunity "${opportunity.name}" reopened to Qualified stage`);
      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to reopen opportunity");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-[var(--primary)]" />
            <span>Reopen Opportunity</span>
          </DialogTitle>
          <DialogDescription>
            Reopening &quot;{opportunity.name}&quot; will move it from <strong>{opportunity.stage}</strong> back to <strong>qualified</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <FormField id="reopen-reason" label="Reopening Reason & Justification" required error={errors.reason?.message}>
            <textarea
              id="reopen-reason"
              {...register("reason")}
              rows={3}
              className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
              placeholder="e.g. Customer reopened tender following competitor delivery failure..."
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Reopening..." : "Reopen to Qualified"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
