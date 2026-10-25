"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  Edit,
  Building2,
  Briefcase,
} from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-display/data-table";
import { Badge, Button } from "@/components/sakani";
import { formatDate } from "@/lib/formatters/formatters";
import { useCompleteTask, useReopenTask, type Task } from "../api";

interface TaskTableProps {
  data: Task[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onEdit: (task: Task) => void;
  isLoading?: boolean;
}

export function TaskTable({
  data,
  total: _total,
  page: _page,
  pageSize: _pageSize,
  onPageChange: _onPageChange,
  onEdit,
  isLoading,
}: TaskTableProps) {
  const completeMutation = useCompleteTask();
  const reopenMutation = useReopenTask();

  const handleToggleComplete = async (task: Task) => {
    if (task.status === "open") {
      try {
        const completed = await completeMutation.mutateAsync({
          taskId: task.id,
          expected_version: task.version,
        });

        // 10-second Undo Toast
        toast.success(`Task "${task.title}" completed`, {
          duration: 10000,
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                await reopenMutation.mutateAsync({
                  taskId: task.id,
                  expected_version: completed.version,
                });
                toast.success(`Task "${task.title}" reopened`);
              } catch (err: any) {
                toast.error(err?.message || "Failed to reopen task");
              }
            },
          },
        });
      } catch (err: any) {
        toast.error(err?.message || "Failed to complete task");
      }
    } else {
      try {
        await reopenMutation.mutateAsync({
          taskId: task.id,
          expected_version: task.version,
        });
        toast.success(`Task "${task.title}" reopened`);
      } catch (err: any) {
        toast.error(err?.message || "Failed to reopen task");
      }
    }
  };

  const columns: ColumnDef<Task>[] = [
    {
      id: "checkbox",
      header: () => <span className="sr-only">Status</span>,
      cell: ({ row }) => {
        const t = row.original;
        const isDone = t.status === "completed";
        return (
          <button
            type="button"
            onClick={() => handleToggleComplete(t)}
            className="flex items-center justify-center p-1 text-[var(--color-fg-muted)] hover:text-[var(--color-primary-600)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)] cursor-pointer"
            title={isDone ? "Reopen task" : "Mark as completed"}
            aria-label={isDone ? `Reopen task: ${t.title}` : `Mark as completed: ${t.title}`}
          >
            {isDone ? (
              <CheckCircle2 className="h-4 w-4 text-[var(--color-success-600)]" />
            ) : (
              <Circle className="h-4 w-4" />
            )}
          </button>
        );
      },
    },
    {
      accessorKey: "title",
      header: "Action Item",
      cell: ({ row }) => {
        const t = row.original;
        const isDone = t.status === "completed";
        return (
          <div className="flex flex-col">
            <span
              className={`font-semibold text-xs ${
                isDone
                  ? "line-through text-[var(--color-fg-muted)] opacity-60"
                  : "text-[var(--color-fg-default)]"
              }`}
            >
              {t.title}
            </span>
            {t.description && (
              <span className="text-[11px] text-[var(--color-fg-muted)] line-clamp-1 mt-0.5">
                {t.description}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "priority",
      header: "Priority",
      cell: ({ row }) => {
        const priority = row.original.priority;
        const variant =
          priority === "high" ? "danger" : priority === "normal" ? "info" : "neutral";
        return (
          <Badge variant={variant} emphasis="subtle">
            {priority}
          </Badge>
        );
      },
    },
    {
      accessorKey: "due_date",
      header: "Due Date",
      cell: ({ row }) => {
        const t = row.original;
        if (!t.due_date) return <span className="text-xs text-[var(--color-fg-muted)]">—</span>;

        return (
          <div className="flex items-center gap-1.5 text-xs">
            {t.is_overdue && (
              <span className="inline-flex items-center gap-1 font-semibold text-[var(--color-danger-600)]">
                <AlertTriangle className="h-3 w-3" />
                Overdue:
              </span>
            )}
            <span className={t.is_overdue ? "font-semibold text-[var(--color-danger-600)]" : "text-[var(--color-fg-muted)]"}>
              {formatDate(t.due_date)}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "account_name",
      header: "Related Account",
      cell: ({ row }) => {
        const t = row.original;
        if (!t.account_id) return <span className="text-xs text-[var(--color-fg-muted)]">—</span>;
        return (
          <Link
            href={`/app/accounts/${t.account_id}`}
            className="text-xs font-semibold text-[var(--color-primary-600)] hover:underline inline-flex items-center gap-1 focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)]"
          >
            <Building2 className="h-3.5 w-3.5 text-[var(--color-fg-muted)]" />
            <span>{t.account_name}</span>
          </Link>
        );
      },
    },
    {
      accessorKey: "opportunity_name",
      header: "Related Deal",
      cell: ({ row }) => {
        const t = row.original;
        if (!t.opportunity_id) return <span className="text-xs text-[var(--color-fg-muted)]">—</span>;
        return (
          <Link
            href={`/app/opportunities/${t.opportunity_id}`}
            className="text-xs font-semibold text-[var(--color-primary-600)] hover:underline inline-flex items-center gap-1 focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)]"
          >
            <Briefcase className="h-3.5 w-3.5 text-[var(--color-fg-muted)]" />
            <span className="truncate max-w-[140px]">{t.opportunity_name}</span>
          </Link>
        );
      },
    },
    {
      accessorKey: "assignee_name",
      header: "Assignee",
      cell: ({ row }) => (
        <span className="text-xs text-[var(--color-fg-muted)]">
          {row.original.assignee_name || "Unassigned"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const t = row.original;
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(t)}
              title="Edit task"
              aria-label={`Edit task: ${t.title}`}
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>
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
      emptyTitle="No tasks found."
      emptyDescription="No operational action items or commitments match this filter."
    />
  );
}
