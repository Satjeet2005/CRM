"use client";

import * as React from "react";
import Link from "next/link";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  Building2,
  Archive,
  Edit,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Badge, Button } from "@/components/sakani";
import { EmptyState } from "@/components/data-display/empty-state";
import { LoadingSkeleton } from "@/components/data-display/loading-skeleton";
import { formatDate } from "@/lib/formatters/formatters";
import { cn } from "@/lib/utils";
import type { Account } from "../api";

export interface AccountTableProps {
  data: Account[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onEdit: (account: Account) => void;
  onArchive: (account: Account) => void;
  isLoading?: boolean;
}

export function AccountTable({
  data,
  total,
  page,
  pageSize,
  onPageChange,
  onEdit,
  onArchive,
  isLoading,
}: AccountTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const columns = React.useMemo<ColumnDef<Account>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Account Name",
        cell: ({ row }) => {
          const acc = row.original;
          return (
            <div className="flex items-center gap-2 min-w-0">
              <Link
                href={`/app/accounts/${acc.id}`}
                className="font-semibold text-[13px] leading-[18px] text-[var(--color-primary-600)] hover:underline inline-flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)] min-w-0"
                title={
                  acc.legal_name && acc.legal_name !== acc.name
                    ? `${acc.name} (${acc.legal_name})`
                    : acc.name
                }
              >
                <Building2
                  className="h-4 w-4 shrink-0 text-[var(--color-fg-muted)]"
                  aria-hidden="true"
                />
                <span className="truncate">{acc.name}</span>
              </Link>
            </div>
          );
        },
      },
      {
        accessorKey: "account_type",
        header: "Type",
        cell: ({ row }) => (
          <span className="capitalize text-[13px] font-medium leading-[18px] text-[var(--color-fg-default)]">
            {row.original.account_type}
          </span>
        ),
      },
      {
        accessorKey: "industry",
        header: "Industry",
        cell: ({ row }) => (
          <span className="text-[13px] font-medium leading-[18px] text-[var(--color-fg-muted)] truncate block">
            {row.original.industry || "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.original.status;
          const isArchived = status === "archived";
          return (
            <Badge
              variant={isArchived ? "neutral" : "success"}
              emphasis="subtle"
              className="h-5 px-2 py-0.5 text-xs font-medium leading-4 capitalize select-none"
            >
              {status === "active" ? "Active" : status === "archived" ? "Archived" : status}
            </Badge>
          );
        },
      },
      {
        accessorKey: "contacts_count",
        header: "Contacts",
        cell: ({ row }) => (
          <div className="text-center">
            <span className="text-[13px] font-mono font-medium leading-[18px] text-[var(--color-fg-default)]">
              {row.original.contacts_count ?? 0}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "opportunities_count",
        header: "Deals",
        cell: ({ row }) => (
          <div className="text-center">
            <span className="text-[13px] font-mono font-medium leading-[18px] text-[var(--color-fg-default)]">
              {row.original.opportunities_count ?? 0}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "updated_at",
        header: "Last Updated",
        cell: ({ row }) => (
          <span className="text-[13px] font-medium leading-[18px] text-[var(--color-fg-muted)]">
            {formatDate(row.original.updated_at)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const acc = row.original;
          return (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(acc)}
                title="Edit account"
                aria-label={`Edit account ${acc.name}`}
                className="h-8 w-8 p-0 text-[var(--color-fg-muted)] hover:text-[var(--color-fg-default)] hover:bg-[var(--color-bg-subtle)] focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)] shrink-0"
              >
                <Edit className="h-4 w-4" aria-hidden="true" />
              </Button>
              {acc.status === "active" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onArchive(acc)}
                  title="Delete account"
                  aria-label={`Delete account ${acc.name}`}
                  className="h-8 w-8 p-0 text-[var(--color-danger-fg)] hover:text-[var(--color-danger-fg)] hover:bg-[var(--color-danger-bg)] focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)] shrink-0"
                >
                  <Archive className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [onEdit, onArchive]
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (isLoading) {
    return <LoadingSkeleton rows={5} />;
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title="No accounts found."
        description="There are no accounts matching your search or active filters."
      />
    );
  }

  const totalPages = Math.ceil(total / (pageSize || 15)) || 1;

  // Recommended desktop column widths
  const columnWidthClasses: Record<string, string> = {
    name: "w-[32%]",
    account_type: "w-[10%]",
    industry: "w-[14%]",
    status: "w-[9%]",
    contacts_count: "w-[6%]",
    opportunities_count: "w-[6%]",
    updated_at: "w-[12%]",
    actions: "w-[11%]",
  };

  const isCenteredColumn = (id: string) =>
    id === "contacts_count" || id === "opportunities_count" || id === "actions";

  return (
    <div className="space-y-4">
      {/* 1. Desktop & Tablet: Standard Sakani Table Default (45:259) */}
      <div className="hidden md:block overflow-hidden rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] shadow-xs">
        <div
          className="overflow-x-auto w-full focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)]"
          role="region"
          aria-label="Accounts directory table"
          tabIndex={0}
        >
          <table className="w-full text-left border-collapse table-fixed">
            <thead className="bg-[var(--color-bg-canvas)] border-b border-[var(--color-border-subtle)]">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="h-11 min-h-[44px]">
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const isSorted = header.column.getIsSorted();
                    const colId = header.column.id;
                    const isCentered = isCenteredColumn(colId);
                    const widthClass = columnWidthClasses[colId] || "";

                    return (
                      <th
                        key={header.id}
                        scope="col"
                        className={cn(
                          "px-2.5 py-0 h-11 text-[11px] font-semibold leading-4 tracking-[0.04em] text-[var(--color-fg-muted)] select-none align-middle",
                          isCentered ? "text-center" : "text-left",
                          widthClass
                        )}
                      >
                        {header.isPlaceholder ? null : canSort ? (
                          <button
                            type="button"
                            className={cn(
                              "w-full inline-flex items-center gap-1.5 font-semibold text-[11px] leading-4 tracking-[0.04em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg-default)] focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)] cursor-pointer select-none",
                              isCentered ? "justify-center" : "justify-start"
                            )}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            <span>
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                            </span>
                            {isSorted === "asc" && (
                              <ChevronUp
                                className="h-3.5 w-3.5 text-[var(--color-primary-500)]"
                                aria-hidden="true"
                              />
                            )}
                            {isSorted === "desc" && (
                              <ChevronDown
                                className="h-3.5 w-3.5 text-[var(--color-primary-500)]"
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        ) : (
                          <span>
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                          </span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="h-11 min-h-[44px] transition-colors hover:bg-[var(--color-bg-subtle)]/60 bg-[var(--color-bg-surface)]"
                >
                  {row.getVisibleCells().map((cell) => {
                    const colId = cell.column.id;
                    const isCentered = isCenteredColumn(colId);

                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          "px-2.5 py-0 h-11 text-[13px] font-medium leading-[18px] text-[var(--color-fg-default)] align-middle",
                          isCentered ? "text-center" : "text-left"
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Mobile: Stacked Record Cards (Sakani 1269:563) */}
      <div className="block md:hidden space-y-3">
        {table.getRowModel().rows.map((row) => {
          const acc = row.original;
          const isArchived = acc.status === "archived";

          return (
            <div
              key={acc.id}
              className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-3.5 space-y-3 shadow-xs"
            >
              {/* Header: Name link + Status badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/app/accounts/${acc.id}`}
                    className="font-semibold text-sm leading-5 text-[var(--color-primary-600)] hover:underline inline-flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)] min-w-0"
                  >
                    <Building2
                      className="h-4 w-4 shrink-0 text-[var(--color-fg-muted)]"
                      aria-hidden="true"
                    />
                    <span className="truncate">{acc.name}</span>
                  </Link>
                </div>
                <Badge
                  variant={isArchived ? "neutral" : "success"}
                  emphasis="subtle"
                  className="h-5 px-2 py-0.5 text-xs font-medium leading-4 capitalize select-none shrink-0"
                >
                  {acc.status === "active" ? "Active" : acc.status === "archived" ? "Archived" : acc.status}
                </Badge>
              </div>

              {/* Labeled Record Details Grid */}
              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[var(--color-border-subtle)]/60 text-xs">
                <div>
                  <span className="text-[11px] font-medium text-[var(--color-fg-muted)] block">
                    Type
                  </span>
                  <span className="capitalize font-medium text-[var(--color-fg-default)]">
                    {acc.account_type}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-[var(--color-fg-muted)] block">
                    Industry
                  </span>
                  <span className="font-medium text-[var(--color-fg-default)] truncate block">
                    {acc.industry || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-[var(--color-fg-muted)] block">
                    Contacts
                  </span>
                  <span className="font-mono font-medium text-[var(--color-fg-default)]">
                    {acc.contacts_count ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-[var(--color-fg-muted)] block">
                    Deals
                  </span>
                  <span className="font-mono font-medium text-[var(--color-fg-default)]">
                    {acc.opportunities_count ?? 0}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-[11px] font-medium text-[var(--color-fg-muted)] block">
                    Last Updated
                  </span>
                  <span className="font-medium text-[var(--color-fg-muted)]">
                    {formatDate(acc.updated_at)}
                  </span>
                </div>
              </div>

              {/* Mobile Actions Footer */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border-subtle)]/60">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(acc)}
                  title="Edit account"
                  aria-label={`Edit account ${acc.name}`}
                  className="h-8 text-xs px-2.5 gap-1.5 text-[var(--color-fg-muted)] hover:text-[var(--color-fg-default)] hover:bg-[var(--color-bg-subtle)]"
                >
                  <Edit className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Edit</span>
                </Button>
                {acc.status === "active" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onArchive(acc)}
                    title="Archive account"
                    aria-label={`Archive account ${acc.name}`}
                    className="h-8 text-xs px-2.5 gap-1.5 text-[var(--color-danger-fg)] hover:text-[var(--color-danger-fg)] hover:bg-[var(--color-danger-bg)]"
                  >
                    <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Archive</span>
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Sakani 32px Pagination Footer (Figma Data Table + Toolbar 684:17474) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 text-xs text-[var(--color-fg-muted)]">
        <div>
          Showing {total > 0 ? (page - 1) * pageSize + 1 : 0}–
          {Math.min(page * pageSize, total)} of {total} accounts
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs px-2.5 gap-1"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Previous</span>
          </Button>
          <span className="px-2 text-xs font-medium text-[var(--color-fg-default)]">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs px-2.5 gap-1"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
          >
            <span>Next</span>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
