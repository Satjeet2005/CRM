"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Tags, Plus } from "lucide-react";
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
import { useCreateCatalogAlias, type CatalogProduct } from "../api";

const aliasSchema = z.object({
  alias_text: z.string().min(1, "Alias text is required").max(180),
});

type AliasFormValues = z.infer<typeof aliasSchema>;

interface AliasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: CatalogProduct;
}

export function AliasDialog({ open, onOpenChange, product }: AliasDialogProps) {
  const createAliasMutation = useCreateCatalogAlias(product.id);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AliasFormValues>({
    resolver: zodResolver(aliasSchema),
    defaultValues: { alias_text: "" },
  });

  const onSubmit = async (values: AliasFormValues) => {
    try {
      await createAliasMutation.mutateAsync({
        alias_text: values.alias_text,
      });
      toast.success(`Alias "${values.alias_text}" added for ${product.sku}`);
      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to add alias");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tags className="h-5 w-5 text-[var(--primary)]" />
            <span>Manage Product Aliases</span>
          </DialogTitle>
          <DialogDescription>
            Aliases allow deterministic matching during future CSV RFQ ingestion for SKU: <strong>{product.sku}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Existing Aliases */}
          <div>
            <span className="text-xs font-semibold text-[var(--muted-foreground)] block mb-1.5">
              Registered Aliases ({product.aliases.length}):
            </span>
            {product.aliases.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)] p-2">
                {product.aliases.map((a) => (
                  <span
                    key={a.id}
                    className="rounded bg-[var(--surface)] border border-[var(--border)] px-2 py-0.5 text-xs font-mono text-[var(--foreground)]"
                  >
                    {a.alias_text}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--muted-foreground)] italic">
                No customer or catalog aliases registered yet.
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 pt-2 border-t border-[var(--border)]">
            <FormField id="alias-text" label="Add New Matching Alias" required error={errors.alias_text?.message}>
              <Input
                id="alias-text"
                {...register("alias_text")}
                placeholder="e.g. 750W AC SERVO DRIVE UNIT"
              />
            </FormField>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button type="submit" disabled={isSubmitting} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                <span>Add Alias</span>
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
