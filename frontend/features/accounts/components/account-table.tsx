"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { Building2, MoreHorizontal, ExternalLink, Archive, Edit } from "lucide-react";
import { DataTable } from "@/components/data-display/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
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
  total,
  page,
  pageSize,
  onPageChange,
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
              className="font-medium text-[var(--primary)] hover:underline flex items-center gap-1.5"
            >
              <Building2 className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
              <span>{acc.name}</span>
            </Link>
            {acc.legal_name && acc.legal_name !== acc.name && (
              <span className="text-xs text-[var(--muted-foreground)]">{acc.legal_name}</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "account_type",
      header: "Type",
      cell: ({ row }) => (
        <span className="capitalize text-xs font-medium text-[var(--foreground)]">
          {row.original.account_type}
        </span>
      ),
    },
    {
      accessorKey: "industry",
      header: "Industry",
      cell: ({ row }) => (
        <span className="text-xs text-[var(--muted-foreground)]">
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
          <StatusBadge
            label={status}
            variant={status === "active" ? "success" : "neutral"}
          />
        );
      },
    },
    {
      accessorKey: "contacts_count",
      header: "Contacts",
      cell: ({ row }) => (
        <span className="text-xs font-mono">{row.original.contacts_count ?? 0}</span>
      ),
    },
    {
      accessorKey: "opportunities_count",
      header: "Deals",
      cell: ({ row }) => (
        <span className="text-xs font-mono">{row.original.opportunities_count ?? 0}</span>
      ),
    },
    {
      accessorKey: "updated_at",
      header: "Last Updated",
      cell: ({ row }) => (
        <span className="text-xs text-[var(--muted-foreground)]">
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
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>
            {acc.status === "active" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onArchive(acc)}
                title="Archive account"
                className="text-[var(--danger)] hover:bg-[var(--danger-soft)]"
              >
                <Archive className="h-3.5 w-3.5" />
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
