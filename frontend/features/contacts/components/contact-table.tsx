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
  Mail,
  Phone,
  Edit,
  Archive,
  Star,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Badge, Button, Avatar } from "@/components/sakani";
import { EmptyState } from "@/components/data-display/empty-state";
import { LoadingSkeleton } from "@/components/data-display/loading-skeleton";
import { cn } from "@/lib/utils";
import type { Contact } from "../api";

export interface ContactTableProps {
  data: Contact[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onEdit: (contact: Contact) => void;
  onArchive: (contact: Contact) => void;
  isLoading?: boolean;
}

export function ContactTable({
  data,
  total,
  page,
  pageSize,
  onPageChange,
  onEdit,
  onArchive,
  isLoading,
}: ContactTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const columns = React.useMemo<ColumnDef<Contact>[]>(
    () => [
      {
        accessorKey: "first_name",
        header: "Contact Name",
        cell: ({ row }) => {
          const c = row.original;
          const fullName = `${c.first_name} ${c.last_name}`;
          const initials = `${c.first_name[0] ?? ""}${c.last_name ? c.last_name[0] : ""}`;

          return (
            <div className="flex items-center gap-2 min-w-0">
              <Avatar
                size="sm"
                initials={initials}
                className="h-6 w-6 text-[10px] shrink-0 bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] text-[var(--color-fg-default)]"
              />
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                {/* Line 1: 2-column fixed grid for stable Primary badge placement */}
                <div className="grid grid-cols-[minmax(0,1fr)_76px] items-center gap-1.5 min-w-0">
                  <span className="font-semibold text-[13px] leading-[18px] text-[var(--color-fg-default)] truncate min-w-0">
                    {fullName}
                  </span>
                  <div className="flex justify-end items-center">
                    {c.is_primary ? (
                      <Badge
                        variant="accent"
                        emphasis="subtle"
                        leftIcon={<Star className="h-3 w-3 fill-[var(--color-primary-500)] text-[var(--color-primary-500)] shrink-0" aria-hidden="true" />}
                        className="h-5 px-2 py-0.5 text-xs font-medium leading-4 shrink-0 bg-[var(--color-neutral-100)] text-[var(--color-neutral-900)] dark:bg-[var(--color-neutral-800)] dark:text-[var(--color-neutral-100)] gap-1 select-none"
                      >
                        Primary
                      </Badge>
                    ) : null}
                  </div>
                </div>
                {/* Line 2: Job title */}
                <span className="text-[12px] font-medium leading-[16px] text-[var(--color-fg-muted)] truncate block">
                  {c.job_title || "Team Member"}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "account_name",
        header: "Account",
        cell: ({ row }) => {
          const c = row.original;
          const accountName = c.account_name || "View Account";

          return (
            <Link
              href={`/app/accounts/${c.account_id}`}
              className="text-[13px] font-medium leading-[18px] text-[var(--color-fg-default)] hover:text-[var(--color-primary-600)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)] truncate block"
              title={accountName}
            >
              {accountName}
            </Link>
          );
        },
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => {
          const email = row.original.email;
          if (!email) return <span className="text-[13px] font-medium leading-[18px] text-[var(--color-fg-muted)]">—</span>;

          return (
            <a
              href={`mailto:${email}`}
              className="text-[13px] font-medium leading-[18px] text-[var(--color-fg-default)] hover:text-[var(--color-primary-600)] hover:underline inline-flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)] max-w-full"
              title={email}
            >
              <Mail className="h-3.5 w-3.5 shrink-0 text-[var(--color-fg-subtle)]" aria-hidden="true" />
              <span className="truncate whitespace-nowrap">{email}</span>
            </a>
          );
        },
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ row }) => {
          const phone = row.original.phone;
          if (!phone) return <span className="text-[13px] font-medium leading-[18px] text-[var(--color-fg-muted)]">—</span>;

          return (
            <span className="text-[13px] font-medium leading-[18px] text-[var(--color-fg-default)] inline-flex items-center gap-2 max-w-full">
              <Phone className="h-3.5 w-3.5 shrink-0 text-[var(--color-fg-subtle)]" aria-hidden="true" />
              <span className="truncate whitespace-nowrap">{phone}</span>
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.original.status;
          const isActive = status === "active";

          return (
            <Badge
              variant={isActive ? "success" : "neutral"}
              emphasis="subtle"
              className="h-5 px-2 py-0.5 text-xs font-medium leading-4 capitalize select-none"
            >
              {isActive ? "Active" : status}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const c = row.original;
          const fullName = `${c.first_name} ${c.last_name}`;

          return (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(c)}
                title={`Edit contact ${fullName}`}
                aria-label={`Edit contact ${fullName}`}
                className="h-8 w-8 p-0 text-[var(--color-fg-muted)] hover:text-[var(--color-fg-default)] hover:bg-[var(--color-bg-subtle)] focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)] shrink-0"
              >
                <Edit className="h-4 w-4" aria-hidden="true" />
              </Button>
              {c.status === "active" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onArchive(c)}
                  title={`Delete contact ${fullName}`}
                  aria-label={`Delete contact ${fullName}`}
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
        title="No contacts found."
        description="No procurement agents or contacts match the search criteria."
      />
    );
  }

  const totalPages = Math.ceil(total / (pageSize || 15)) || 1;

  // Recommended desktop column proportions:
  // Contact Name: 24%, Account: 24%, Email: 23%, Phone: 13%, Status: 8%, Actions: 8%
  const columnWidthClasses: Record<string, string> = {
    first_name: "w-[24%]",
    account_name: "w-[24%]",
    email: "w-[23%]",
    phone: "w-[13%]",
    status: "w-[8%]",
    actions: "w-[8%]",
  };

  const isCenteredColumn = (id: string) => id === "actions";

  return (
    <div className="space-y-4">
      {/* 1. Desktop & Tablet: Standard Sakani Table Default (45:259) */}
      <div className="hidden md:block overflow-hidden rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] shadow-xs">
        <div
          className="overflow-x-auto w-full focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)]"
          role="region"
          aria-label="Contacts directory table"
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
                  className="min-h-[44px] transition-colors hover:bg-[var(--color-bg-subtle)]/60 bg-[var(--color-bg-surface)]"
                >
                  {row.getVisibleCells().map((cell) => {
                    const colId = cell.column.id;
                    const isCentered = isCenteredColumn(colId);

                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          "px-2.5 py-1.5 text-[13px] font-medium leading-[18px] text-[var(--color-fg-default)] align-middle",
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
          const c = row.original;
          const fullName = `${c.first_name} ${c.last_name}`;
          const initials = `${c.first_name[0] ?? ""}${c.last_name ? c.last_name[0] : ""}`;
          const isActive = c.status === "active";

          return (
            <div
              key={c.id}
              className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-3.5 space-y-3 shadow-xs"
            >
              {/* Header: Avatar + Contact Name + Primary Badge + Status Badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <Avatar
                    size="sm"
                    initials={initials}
                    className="h-8 w-8 text-xs shrink-0 bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] text-[var(--color-fg-default)]"
                  />
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <span className="font-semibold text-sm leading-5 text-[var(--color-fg-default)] truncate min-w-0">
                        {fullName}
                      </span>
                      {c.is_primary && (
                        <Badge
                          variant="accent"
                          emphasis="subtle"
                          leftIcon={<Star className="h-3 w-3 fill-[var(--color-primary-500)] text-[var(--color-primary-500)] shrink-0" aria-hidden="true" />}
                          className="h-5 px-2 py-0.5 text-xs font-medium leading-4 shrink-0 bg-[var(--color-neutral-100)] text-[var(--color-neutral-900)] dark:bg-[var(--color-neutral-800)] dark:text-[var(--color-neutral-100)] gap-1 select-none"
                        >
                          Primary
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs font-medium text-[var(--color-fg-muted)] truncate block">
                      {c.job_title || "Team Member"}
                    </span>
                  </div>
                </div>
                <Badge
                  variant={isActive ? "success" : "neutral"}
                  emphasis="subtle"
                  className="h-5 px-2 py-0.5 text-xs font-medium leading-4 capitalize select-none shrink-0"
                >
                  {isActive ? "Active" : c.status}
                </Badge>
              </div>

              {/* Labeled Record Details */}
              <div className="space-y-2 pt-2 border-t border-[var(--color-border-subtle)]/60 text-xs">
                <div>
                  <span className="text-[11px] font-medium text-[var(--color-fg-muted)] block">
                    Account
                  </span>
                  <Link
                    href={`/app/accounts/${c.account_id}`}
                    className="font-medium text-[var(--color-fg-default)] hover:text-[var(--color-primary-600)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)] truncate block"
                  >
                    {c.account_name || "View Account"}
                  </Link>
                </div>
                {c.email && (
                  <div>
                    <span className="text-[11px] font-medium text-[var(--color-fg-muted)] block">
                      Email
                    </span>
                    <a
                      href={`mailto:${c.email}`}
                      className="font-medium text-[var(--color-fg-default)] hover:text-[var(--color-primary-600)] hover:underline inline-flex items-center gap-1.5"
                    >
                      <Mail className="h-3.5 w-3.5 text-[var(--color-fg-subtle)] shrink-0" aria-hidden="true" />
                      <span className="truncate">{c.email}</span>
                    </a>
                  </div>
                )}
                {c.phone && (
                  <div>
                    <span className="text-[11px] font-medium text-[var(--color-fg-muted)] block">
                      Phone
                    </span>
                    <span className="font-medium text-[var(--color-fg-default)] inline-flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-[var(--color-fg-subtle)] shrink-0" aria-hidden="true" />
                      <span>{c.phone}</span>
                    </span>
                  </div>
                )}
              </div>

              {/* Mobile Actions Footer */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border-subtle)]/60">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(c)}
                  title={`Edit contact ${fullName}`}
                  aria-label={`Edit ${fullName}`}
                  className="h-8 text-xs px-2.5 gap-1.5 text-[var(--color-fg-muted)] hover:text-[var(--color-fg-default)] hover:bg-[var(--color-bg-subtle)]"
                >
                  <Edit className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Edit</span>
                </Button>
                {c.status === "active" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onArchive(c)}
                    title={`Archive contact ${fullName}`}
                    aria-label={`Archive ${fullName}`}
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
          {Math.min(page * pageSize, total)} of {total} contacts
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
