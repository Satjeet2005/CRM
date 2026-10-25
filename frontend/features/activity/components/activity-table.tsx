"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { History, User } from "lucide-react";
import { DataTable } from "@/components/data-display/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime } from "@/lib/formatters/formatters";
import type { Activity } from "../api";

interface ActivityTableProps {
  data: Activity[];
  isLoading?: boolean;
}

export function ActivityTable({ data, isLoading }: ActivityTableProps) {
  const columns: ColumnDef<Activity>[] = [
    {
      accessorKey: "occurred_at",
      header: "Timestamp",
      cell: ({ row }) => (
        <span className="text-xs font-mono text-[var(--muted-foreground)]">
          {formatDateTime(row.original.occurred_at)}
        </span>
      ),
    },
    {
      accessorKey: "actor_name",
      header: "Actor",
      cell: ({ row }) => (
        <span className="text-xs font-medium text-[var(--foreground)] flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
          <span>{row.original.actor_name || "System"}</span>
        </span>
      ),
    },
    {
      accessorKey: "entity_type",
      header: "Entity",
      cell: ({ row }) => (
        <span className="font-mono text-xs uppercase px-1.5 py-0.5 rounded bg-[var(--surface-muted)] text-[var(--foreground)]">
          {row.original.entity_type}
        </span>
      ),
    },
    {
      accessorKey: "event_type",
      header: "Action Event",
      cell: ({ row }) => {
        const ev = row.original.event_type;
        const variant =
          ev.includes("archive") || ev.includes("lost")
            ? "destructive"
            : ev.includes("won") || ev.includes("completed")
            ? "success"
            : "info";
        return <StatusBadge label={ev} variant={variant} />;
      },
    },
    {
      accessorKey: "summary",
      header: "Summary Description",
      cell: ({ row }) => (
        <span className="text-xs text-[var(--foreground)] font-medium">
          {row.original.summary}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      emptyTitle="No activity records logged."
    />
  );
}
