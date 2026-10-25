"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useCreateOpportunity, useUpdateOpportunity, type Opportunity } from "../api";
import { useAccounts } from "@/features/accounts/api";

const oppSchema = z.object({
  account_id: z.string().uuid("Please select a valid account"),
  name: z.string().min(3, "Title must be at least 3 characters").max(140),
  description: z.string().max(2000).optional(),
  estimated_value: z.coerce.number().min(0, "Value must be positive"),
  probability_percent: z.coerce.number().min(0).max(100).optional(),
  expected_close_date: z.string().optional(),
  stage: z.enum(["lead", "qualified", "solutioning", "proposal", "negotiation", "won", "lost"]).default("lead"),
});

type OppFormValues = z.infer<typeof oppSchema>;

interface OpportunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity?: Opportunity | null;
  defaultAccountId?: string;
}

export function OpportunityDialog({
  open,
  onOpenChange,
  opportunity,
  defaultAccountId,
}: OpportunityDialogProps) {
  const isEditing = !!opportunity;
  const createMutation = useCreateOpportunity();
  const updateMutation = useUpdateOpportunity(opportunity?.id || "");
  const { data: accountsData } = useAccounts({ page_size: 100 });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<OppFormValues>({
    resolver: zodResolver(oppSchema),
    defaultValues: {
      account_id: opportunity?.account_id || defaultAccountId || "",
      name: opportunity?.name || "",
      description: opportunity?.description || "",
      estimated_value: opportunity ? Number(opportunity.estimated_value) : 0,
      probability_percent: opportunity?.probability_percent ? Number(opportunity.probability_percent) : 20,
      expected_close_date: opportunity?.expected_close_date || "",
      stage: (opportunity?.stage as any) || "lead",
    },
  });

  React.useEffect(() => {
    if (opportunity) {
      reset({
        account_id: opportunity.account_id,
        name: opportunity.name,
        description: opportunity.description || "",
        estimated_value: Number(opportunity.estimated_value),
        probability_percent: opportunity.probability_percent ? Number(opportunity.probability_percent) : 20,
        expected_close_date: opportunity.expected_close_date || "",
        stage: opportunity.stage as any,
      });
    } else {
      reset({
        account_id: defaultAccountId || "",
        name: "",
        description: "",
        estimated_value: 0,
        probability_percent: 20,
        expected_close_date: "",
        stage: "lead",
      });
    }
  }, [opportunity, defaultAccountId, reset]);

  const onSubmit = async (values: OppFormValues) => {
    try {
      if (isEditing && opportunity) {
        await updateMutation.mutateAsync({
          name: values.name,
          description: values.description || undefined,
          estimated_value: values.estimated_value.toFixed(2),
          probability_percent: values.probability_percent?.toString(),
          expected_close_date: values.expected_close_date || undefined,
          expected_version: opportunity.version,
        });
        toast.success(`Opportunity "${values.name}" updated`);
      } else {
        await createMutation.mutateAsync({
          account_id: values.account_id,
          name: values.name,
          description: values.description || undefined,
          estimated_value: values.estimated_value.toFixed(2),
          currency_code: "INR",
          probability_percent: values.probability_percent?.toString(),
          expected_close_date: values.expected_close_date || undefined,
          stage: values.stage,
        });
        toast.success(`Opportunity "${values.name}" created`);
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save opportunity");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Opportunity" : "New Opportunity"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          {!isEditing && (
            <FormField id="opp-account" label="Account" required error={errors.account_id?.message}>
              <select
                id="opp-account"
                {...register("account_id")}
                className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
              >
                <option value="">Select Account...</option>
                {accountsData?.items.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </FormField>
          )}

          <FormField id="opp-name" label="Opportunity Title" required error={errors.name?.message}>
            <Input id="opp-name" {...register("name")} placeholder="e.g. 500kW Motor Drive Replacement" />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField id="opp-val" label="Estimated Value (INR)" required error={errors.estimated_value?.message}>
              <Input id="opp-val" type="number" step="1000" {...register("estimated_value")} />
            </FormField>

            <FormField id="opp-prob" label="Confidence / Probability (%)" error={errors.probability_percent?.message}>
              <Input id="opp-prob" type="number" min="0" max="100" {...register("probability_percent")} />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField id="opp-close" label="Target Close Date" error={errors.expected_close_date?.message}>
              <Input id="opp-close" type="date" {...register("expected_close_date")} />
            </FormField>

            {!isEditing && (
              <FormField id="opp-stage" label="Initial Stage" required>
                <select
                  id="opp-stage"
                  {...register("stage")}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
                >
                  <option value="lead">Lead</option>
                  <option value="qualified">Qualified</option>
                  <option value="solutioning">Solutioning</option>
                </select>
              </FormField>
            )}
          </div>

          <FormField id="opp-desc" label="Description & Scope" error={errors.description?.message}>
            <textarea
              id="opp-desc"
              {...register("description")}
              rows={3}
              className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
              placeholder="Scope details, technical specifications, competitor info..."
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Create Opportunity"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
