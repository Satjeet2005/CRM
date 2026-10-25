"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { User } from "lucide-react";
import { DataTable } from "@/components/data-display/data-table";
import { Badge } from "@/components/sakani";
import { formatDateTime } from "@/lib/formatters/formatters";
import type { Activity } from "../api";

interface ActivityTableProps {
  data: Activity[];
  isLoading?: boolean;
}

function getBadgeVariant(eventType: string): "neutral" | "accent" | "success" | "warning" | "danger" | "info" {
  if (eventType.includes("archive") || eventType.includes("lost")) return "danger";
  if (eventType.includes("won") || eventType.includes("completed")) return "success";
  if (eventType.includes("reopened") || eventType.includes("pending")) return "warning";
  if (eventType.includes("create")) return "accent";
  return "info";
}

export function ActivityTable({ data, isLoading }: ActivityTableProps) {
  const columns: ColumnDef<Activity>[] = [
    {
      accessorKey: "occurred_at",
      header: "Timestamp",
      cell: ({ row }) => (
        <span className="text-xs font-mono text-[var(--color-fg-muted)]">
          {formatDateTime(row.original.occurred_at)}
        </span>
      ),
    },
    {
      accessorKey: "actor_name",
      header: "Actor",
      cell: ({ row }) => (
        <span className="text-xs font-medium text-[var(--color-fg-default)] flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 text-[var(--color-fg-muted)]" aria-hidden="true" />
          <span>{row.original.actor_name || "System"}</span>
        </span>
      ),
    },
    {
      accessorKey: "entity_type",
      header: "Entity",
      cell: ({ row }) => (
        <span className="font-mono text-xs uppercase px-1.5 py-0.5 rounded-[var(--radius-xs)] bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] text-[var(--color-fg-muted)]">
          {row.original.entity_type}
        </span>
      ),
    },
    {
      accessorKey: "event_type",
      header: "Action Event",
      cell: ({ row }) => {
        const ev = row.original.event_type;
        return (
          <Badge variant={getBadgeVariant(ev)} emphasis="subtle">
            {ev.replace(/_/g, " ")}
          </Badge>
        );
      },
    },
    {
      accessorKey: "summary",
      header: "Summary Description",
      cell: ({ row }) => (
        <span className="text-xs text-[var(--color-fg-default)] font-medium">
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
