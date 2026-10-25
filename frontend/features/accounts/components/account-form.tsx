"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";
import { InlineError } from "@/components/forms/inline-error";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useCreateAccount, useUpdateAccount, type Account } from "../api";

const accountSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(120),
  legal_name: z.string().max(160).optional(),
  account_type: z.enum(["customer", "prospect", "partner", "supplier"]),
  industry: z.string().max(80).optional(),
  website: z.string().url("Must be a valid URL").or(z.literal("")).optional(),
  phone: z.string().max(32).optional(),
  email: z.string().email("Invalid email").or(z.literal("")).optional(),
  notes: z.string().max(2000).optional(),
});

type AccountFormValues = z.infer<typeof accountSchema>;

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account | null;
}

export function AccountDialog({ open, onOpenChange, account }: AccountDialogProps) {
  const isEditing = !!account;
  const createMutation = useCreateAccount();
  const updateMutation = useUpdateAccount(account?.id || "");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: account?.name || "",
      legal_name: account?.legal_name || "",
      account_type: (account?.account_type as any) || "customer",
      industry: account?.industry || "",
      website: account?.website || "",
      phone: account?.phone || "",
      email: account?.email || "",
      notes: account?.notes || "",
    },
  });

  React.useEffect(() => {
    if (account) {
      reset({
        name: account.name,
        legal_name: account.legal_name || "",
        account_type: account.account_type as any,
        industry: account.industry || "",
        website: account.website || "",
        phone: account.phone || "",
        email: account.email || "",
        notes: account.notes || "",
      });
    } else {
      reset({
        name: "",
        legal_name: "",
        account_type: "customer",
        industry: "",
        website: "",
        phone: "",
        email: "",
        notes: "",
      });
    }
  }, [account, reset]);

  const onSubmit = async (values: AccountFormValues) => {
    try {
      if (isEditing && account) {
        await updateMutation.mutateAsync({
          ...values,
          website: values.website || undefined,
          email: values.email || undefined,
          legal_name: values.legal_name || undefined,
          industry: values.industry || undefined,
          notes: values.notes || undefined,
          expected_version: account.version,
        });
        toast.success(`Account "${values.name}" updated successfully`);
      } else {
        await createMutation.mutateAsync({
          ...values,
          website: values.website || undefined,
          email: values.email || undefined,
          legal_name: values.legal_name || undefined,
          industry: values.industry || undefined,
          notes: values.notes || undefined,
        });
        toast.success(`Account "${values.name}" created successfully`);
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save account");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Account" : "Create New Account"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <FormField id="acc-name" label="Account Name" required error={errors.name?.message}>
            <Input id="acc-name" {...register("name")} placeholder="e.g. Acme Industrial Ltd" />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField id="acc-type" label="Account Type" required>
              <select
                id="acc-type"
                {...register("account_type")}
                className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
              >
                <option value="customer">Customer</option>
                <option value="prospect">Prospect</option>
                <option value="partner">Partner</option>
                <option value="supplier">Supplier</option>
              </select>
            </FormField>

            <FormField id="acc-industry" label="Industry" error={errors.industry?.message}>
              <Input id="acc-industry" {...register("industry")} placeholder="e.g. Manufacturing" />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField id="acc-email" label="Email" error={errors.email?.message}>
              <Input id="acc-email" type="email" {...register("email")} placeholder="procurement@company.com" />
            </FormField>

            <FormField id="acc-phone" label="Phone" error={errors.phone?.message}>
              <Input id="acc-phone" {...register("phone")} placeholder="+91 98765 43210" />
            </FormField>
          </div>

          <FormField id="acc-website" label="Website" error={errors.website?.message}>
            <Input id="acc-website" {...register("website")} placeholder="https://example.com" />
          </FormField>

          <FormField id="acc-notes" label="Notes" error={errors.notes?.message}>
            <textarea
              id="acc-notes"
              {...register("notes")}
              rows={3}
              className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
              placeholder="Key notes, payment terms, delivery requirements..."
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Create Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
