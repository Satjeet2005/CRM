"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { Building2, Archive, Edit } from "lucide-react";
import { DataTable } from "@/components/data-display/data-table";
import { Badge, Button } from "@/components/sakani";
import { formatDate } from "@/lib/formatters/formatters";
import type { Account } from "../api";

interface AccountTableProps {
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
  total: _total,
  page: _page,
  pageSize: _pageSize,
  onPageChange: _onPageChange,
  onEdit,
  onArchive,
  isLoading,
}: AccountTableProps) {
  const columns: ColumnDef<Account>[] = [
    {
      accessorKey: "name",
      header: "Account Name",
      cell: ({ row }) => {
        const acc = row.original;
        return (
          <div className="flex flex-col">
            <Link
              href={`/app/accounts/${acc.id}`}
              className="font-semibold text-[var(--color-primary-600)] hover:underline inline-flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)]"
            >
              <Building2 className="h-4 w-4 shrink-0 text-[var(--color-fg-muted)]" aria-hidden="true" />
              <span>{acc.name}</span>
            </Link>
            {acc.legal_name && acc.legal_name !== acc.name && (
              <span className="text-[11px] text-[var(--color-fg-muted)] pl-5.5">{acc.legal_name}</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "account_type",
      header: "Type",
      cell: ({ row }) => (
        <span className="capitalize text-xs font-medium text-[var(--color-fg-default)]">
          {row.original.account_type}
        </span>
      ),
    },
    {
      accessorKey: "industry",
      header: "Industry",
      cell: ({ row }) => (
        <span className="text-xs text-[var(--color-fg-muted)]">
          {row.original.industry || "—"}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <Badge
            variant={status === "active" ? "success" : "neutral"}
            emphasis="subtle"
          >
            {status}
          </Badge>
        );
      },
    },
    {
      accessorKey: "contacts_count",
      header: "Contacts",
      cell: ({ row }) => (
        <span className="text-xs font-mono text-[var(--color-fg-default)]">{row.original.contacts_count ?? 0}</span>
      ),
    },
    {
      accessorKey: "opportunities_count",
      header: "Deals",
      cell: ({ row }) => (
        <span className="text-xs font-mono text-[var(--color-fg-default)]">{row.original.opportunities_count ?? 0}</span>
      ),
    },
    {
      accessorKey: "updated_at",
      header: "Last Updated",
      cell: ({ row }) => (
        <span className="text-xs text-[var(--color-fg-muted)]">
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
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(acc)}
              title="Edit account"
              aria-label={`Edit ${acc.name}`}
            >
              <Edit className="h-3.5 w-3.5 text-[var(--color-fg-muted)]" aria-hidden="true" />
            </Button>
            {acc.status === "active" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onArchive(acc)}
                title="Archive account"
                aria-label={`Archive ${acc.name}`}
                className="text-[var(--color-danger-fg)] hover:bg-[var(--color-danger-bg)]"
              >
                <Archive className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      emptyTitle="No accounts found."
    />
  );
}
