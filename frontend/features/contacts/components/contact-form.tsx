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
import { useCreateContact, useUpdateContact, type Contact } from "../api";

const contactSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(80),
  last_name: z.string().min(1, "Last name is required").max(80),
  job_title: z.string().max(100).optional(),
  email: z.string().email("Invalid email").or(z.literal("")).optional(),
  phone: z.string().max(32).optional(),
  is_primary: z.boolean().default(false),
  notes: z.string().max(1000).optional(),
});

type ContactFormValues = z.infer<typeof contactSchema>;

interface ContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  contact?: Contact | null;
}

export function ContactDialog({ open, onOpenChange, accountId, contact }: ContactDialogProps) {
  const isEditing = !!contact;
  const createMutation = useCreateContact(accountId);
  const updateMutation = useUpdateContact(contact?.id || "");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      first_name: contact?.first_name || "",
      last_name: contact?.last_name || "",
      job_title: contact?.job_title || "",
      email: contact?.email || "",
      phone: contact?.phone || "",
      is_primary: contact?.is_primary || false,
      notes: contact?.notes || "",
    },
  });

  React.useEffect(() => {
    if (contact) {
      reset({
        first_name: contact.first_name,
        last_name: contact.last_name,
        job_title: contact.job_title || "",
        email: contact.email || "",
        phone: contact.phone || "",
        is_primary: contact.is_primary,
        notes: contact.notes || "",
      });
    } else {
      reset({
        first_name: "",
        last_name: "",
        job_title: "",
        email: "",
        phone: "",
        is_primary: false,
        notes: "",
      });
    }
  }, [contact, reset]);

  const onSubmit = async (values: ContactFormValues) => {
    try {
      if (isEditing && contact) {
        await updateMutation.mutateAsync({
          ...values,
          job_title: values.job_title || undefined,
          email: values.email || undefined,
          phone: values.phone || undefined,
          notes: values.notes || undefined,
          expected_version: contact.version,
        });
        toast.success(`Contact "${values.first_name} ${values.last_name}" updated`);
      } else {
        await createMutation.mutateAsync({
          ...values,
          job_title: values.job_title || undefined,
          email: values.email || undefined,
          phone: values.phone || undefined,
          notes: values.notes || undefined,
        });
        toast.success(`Contact "${values.first_name} ${values.last_name}" created`);
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save contact");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Contact" : "Add Contact"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <FormField id="c-first-name" label="First Name" required error={errors.first_name?.message}>
              <Input id="c-first-name" {...register("first_name")} placeholder="Priya" />
            </FormField>

            <FormField id="c-last-name" label="Last Name" required error={errors.last_name?.message}>
              <Input id="c-last-name" {...register("last_name")} placeholder="Sharma" />
            </FormField>
          </div>

          <FormField id="c-job-title" label="Job Title" error={errors.job_title?.message}>
            <Input id="c-job-title" {...register("job_title")} placeholder="Head of Procurement" />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField id="c-email" label="Email" error={errors.email?.message}>
              <Input id="c-email" type="email" {...register("email")} placeholder="priya@company.example" />
            </FormField>

            <FormField id="c-phone" label="Phone" error={errors.phone?.message}>
              <Input id="c-phone" {...register("phone")} placeholder="+91 98765 00000" />
            </FormField>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="is_primary"
              {...register("is_primary")}
              className="h-4 w-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--ring)]"
            />
            <label htmlFor="is_primary" className="text-xs font-medium text-[var(--foreground)] cursor-pointer">
              Set as primary contact for this account
            </label>
          </div>

          <FormField id="c-notes" label="Notes" error={errors.notes?.message}>
            <textarea
              id="c-notes"
              {...register("notes")}
              rows={2}
              className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
              placeholder="Preferred contact times, communication style..."
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Add Contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
