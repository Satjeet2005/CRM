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
import { useAuth } from "@/hooks/use-auth";
import { useCreateCatalogProduct, useUpdateCatalogProduct, type CatalogProduct } from "../api";

const productSchema = z.object({
  sku: z.string().min(2, "SKU must be at least 2 characters").max(64),
  name: z.string().min(2, "Name must be at least 2 characters").max(180),
  category: z.string().min(1, "Category is required").max(80),
  manufacturer: z.string().max(120).optional(),
  manufacturer_part_number: z.string().max(120).optional(),
  base_unit: z.enum(["ea", "box", "pack", "m", "mm", "cm", "kg", "g", "l", "ml", "set"]).default("ea"),
  sell_price: z.coerce.number().min(0, "Sell price must be >= 0"),
  unit_cost: z.coerce.number().min(0).optional(),
  tax_rate_percent: z.coerce.number().min(0).max(100).default(18),
  stock_status: z.enum(["in_stock", "limited", "backorder", "discontinued"]).default("in_stock"),
  description: z.string().max(1000).optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: CatalogProduct | null;
}

export function ProductDialog({ open, onOpenChange, product }: ProductDialogProps) {
  const isEditing = !!product;
  const { hasPermission } = useAuth();
  const canSeeCost = hasPermission("catalog:cost");

  const createMutation = useCreateCatalogProduct();
  const updateMutation = useUpdateCatalogProduct(product?.id || "");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      sku: product?.sku || "",
      name: product?.name || "",
      category: product?.category || "Electrical & Automation",
      manufacturer: product?.manufacturer || "",
      manufacturer_part_number: product?.manufacturer_part_number || "",
      base_unit: (product?.base_unit as any) || "ea",
      sell_price: product ? Number(product.sell_price) : 0,
      unit_cost: product?.unit_cost ? Number(product.unit_cost) : undefined,
      tax_rate_percent: product ? Number(product.tax_rate_percent) : 18,
      stock_status: (product?.stock_status as any) || "in_stock",
      description: product?.description || "",
    },
  });

  React.useEffect(() => {
    if (product) {
      reset({
        sku: product.sku,
        name: product.name,
        category: product.category,
        manufacturer: product.manufacturer || "",
        manufacturer_part_number: product.manufacturer_part_number || "",
        base_unit: product.base_unit as any,
        sell_price: Number(product.sell_price),
        unit_cost: product.unit_cost ? Number(product.unit_cost) : undefined,
        tax_rate_percent: Number(product.tax_rate_percent),
        stock_status: product.stock_status as any,
        description: product.description || "",
      });
    } else {
      reset({
        sku: "",
        name: "",
        category: "Electrical & Automation",
        manufacturer: "",
        manufacturer_part_number: "",
        base_unit: "ea",
        sell_price: 0,
        unit_cost: undefined,
        tax_rate_percent: 18,
        stock_status: "in_stock",
        description: "",
      });
    }
  }, [product, reset]);

  const onSubmit = async (values: ProductFormValues) => {
    try {
      if (isEditing && product) {
        await updateMutation.mutateAsync({
          name: values.name,
          category: values.category,
          manufacturer: values.manufacturer || undefined,
          manufacturer_part_number: values.manufacturer_part_number || undefined,
          base_unit: values.base_unit,
          sell_price: values.sell_price.toFixed(4),
          unit_cost: canSeeCost && values.unit_cost !== undefined ? values.unit_cost.toFixed(4) : undefined,
          tax_rate_percent: values.tax_rate_percent.toFixed(2),
          stock_status: values.stock_status,
          description: values.description || undefined,
          expected_version: product.version,
        });
        toast.success(`Catalog product "${values.sku}" updated`);
      } else {
        await createMutation.mutateAsync({
          sku: values.sku.toUpperCase(),
          name: values.name,
          category: values.category,
          manufacturer: values.manufacturer || undefined,
          manufacturer_part_number: values.manufacturer_part_number || undefined,
          base_unit: values.base_unit,
          sell_price: values.sell_price.toFixed(4),
          unit_cost: canSeeCost && values.unit_cost !== undefined ? values.unit_cost.toFixed(4) : undefined,
          tax_rate_percent: values.tax_rate_percent.toFixed(2),
          stock_status: values.stock_status,
          description: values.description || undefined,
        });
        toast.success(`Catalog product "${values.sku}" added`);
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save product");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Product" : "Add Catalog Product"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField id="prod-sku" label="SKU Code" required error={errors.sku?.message}>
              <Input
                id="prod-sku"
                {...register("sku")}
                disabled={isEditing}
                placeholder="e.g. MTR-750W-SERVO"
                className="font-mono uppercase"
              />
            </FormField>

            <FormField id="prod-unit" label="Base Unit" required>
              <select
                id="prod-unit"
                {...register("base_unit")}
                className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
              >
                <option value="ea">Each (ea)</option>
                <option value="box">Box</option>
                <option value="pack">Pack</option>
                <option value="set">Set</option>
                <option value="m">Meter (m)</option>
                <option value="kg">Kilogram (kg)</option>
              </select>
            </FormField>
          </div>

          <FormField id="prod-name" label="Product Name" required error={errors.name?.message}>
            <Input id="prod-name" {...register("name")} placeholder="e.g. 750W High-Torque AC Servo Motor" />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField id="prod-cat" label="Category" required error={errors.category?.message}>
              <Input id="prod-cat" {...register("category")} placeholder="e.g. Motors & Drives" />
            </FormField>

            <FormField id="prod-mfr" label="Manufacturer" error={errors.manufacturer?.message}>
              <Input id="prod-mfr" {...register("manufacturer")} placeholder="e.g. Siemens / ABB" />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField id="prod-price" label="Sell Price (INR)" required error={errors.sell_price?.message}>
              <Input id="prod-price" type="number" step="0.01" {...register("sell_price")} />
            </FormField>

            {canSeeCost ? (
              <FormField id="prod-cost" label="Unit Cost (INR) [Confidential]" error={errors.unit_cost?.message}>
                <Input id="prod-cost" type="number" step="0.01" {...register("unit_cost")} />
              </FormField>
            ) : (
              <FormField id="prod-stock-alt" label="Stock Status">
                <select
                  id="prod-stock-alt"
                  {...register("stock_status")}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
                >
                  <option value="in_stock">In Stock</option>
                  <option value="limited">Limited</option>
                  <option value="backorder">Backorder</option>
                  <option value="discontinued">Discontinued</option>
                </select>
              </FormField>
            )}
          </div>

          {canSeeCost && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField id="prod-tax" label="Tax Rate (%)">
                <Input id="prod-tax" type="number" step="0.5" {...register("tax_rate_percent")} />
              </FormField>

              <FormField id="prod-stock" label="Stock Status">
                <select
                  id="prod-stock"
                  {...register("stock_status")}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
                >
                  <option value="in_stock">In Stock</option>
                  <option value="limited">Limited</option>
                  <option value="backorder">Backorder</option>
                  <option value="discontinued">Discontinued</option>
                </select>
              </FormField>
            </div>
          )}

          <FormField id="prod-desc" label="Description" error={errors.description?.message}>
            <textarea
              id="prod-desc"
              {...register("description")}
              rows={2}
              className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
              placeholder="Technical specs, voltage, mounting options..."
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Add to Catalog"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
