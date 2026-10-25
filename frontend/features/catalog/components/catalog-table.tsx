"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Boxes, Tags, Edit, ShieldAlert } from "lucide-react";
import { DataTable } from "@/components/data-display/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/formatters/formatters";
import { useAuth } from "@/hooks/use-auth";
import type { CatalogProduct } from "../api";

interface CatalogTableProps {
  data: CatalogProduct[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onEdit: (product: CatalogProduct) => void;
  onManageAliases: (product: CatalogProduct) => void;
  isLoading?: boolean;
}

export function CatalogTable({
  data,
  total,
  page,
  pageSize,
  onPageChange,
  onEdit,
  onManageAliases,
  isLoading,
}: CatalogTableProps) {
  const { hasPermission } = useAuth();
  const canSeeCost = hasPermission("catalog:cost");
  const canWrite = hasPermission("catalog:manage") || hasPermission("catalog:write");

  const columns: ColumnDef<CatalogProduct>[] = [
    {
      accessorKey: "sku",
      header: "SKU Code",
      cell: ({ row }) => (
        <span className="font-mono text-xs font-semibold text-[var(--foreground)]">
          {row.original.sku}
        </span>
      ),
    },
    {
      accessorKey: "name",
      header: "Product / Description",
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex flex-col">
            <span className="font-medium text-xs text-[var(--foreground)]">{p.name}</span>
            {p.manufacturer && (
              <span className="text-[11px] text-[var(--muted-foreground)]">
                Mfr: {p.manufacturer} {p.manufacturer_part_number ? `(${p.manufacturer_part_number})` : ""}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => (
        <span className="text-xs text-[var(--muted-foreground)]">{row.original.category}</span>
      ),
    },
    {
      accessorKey: "base_unit",
      header: "Unit",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-[var(--muted-foreground)]">
          {row.original.base_unit}
        </span>
      ),
    },
    {
      accessorKey: "sell_price",
      header: "Sell Price",
      cell: ({ row }) => (
        <span className="font-semibold text-xs text-[var(--foreground)]">
          {formatMoney(row.original.sell_price, "INR")}
        </span>
      ),
    },
    ...(canSeeCost
      ? [
          {
            accessorKey: "unit_cost",
            header: "Internal Cost",
            cell: ({ row }: { row: { original: CatalogProduct } }) => {
              const cost = row.original.unit_cost;
              return (
                <span className="font-mono text-xs text-[var(--muted-foreground)]">
                  {cost ? formatMoney(cost, "INR") : "—"}
                </span>
              );
            },
          } as ColumnDef<CatalogProduct>,
        ]
      : []),
    {
      accessorKey: "stock_status",
      header: "Stock",
      cell: ({ row }) => {
        const s = row.original.stock_status;
        const variant =
          s === "in_stock" ? "success" : s === "limited" ? "warning" : "neutral";
        return <StatusBadge label={s.replace("_", " ")} variant={variant} />;
      },
    },
    {
      accessorKey: "aliases",
      header: "Aliases",
      cell: ({ row }) => {
        const p = row.original;
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onManageAliases(p)}
            className="h-6 px-2 text-xs gap-1 text-[var(--primary)]"
            title="Manage matching aliases"
          >
            <Tags className="h-3 w-3" />
            <span>{p.aliases?.length ?? 0}</span>
          </Button>
        );
      },
    },
    ...(canWrite
      ? [
          {
            id: "actions",
            header: "Actions",
            cell: ({ row }: { row: { original: CatalogProduct } }) => {
              const p = row.original;
              return (
                <Button variant="ghost" size="sm" onClick={() => onEdit(p)} title="Edit product">
                  <Edit className="h-3.5 w-3.5" />
                </Button>
              );
            },
          } as ColumnDef<CatalogProduct>,
        ]
      : []),
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      emptyTitle="No catalog products found."
    />
  );
}
