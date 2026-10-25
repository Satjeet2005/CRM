"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  RotateCcw,
  Edit,
  Building2,
  Briefcase,
} from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-display/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
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
  total,
  page,
  pageSize,
  onPageChange,
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
            onClick={() => handleToggleComplete(t)}
            className="flex items-center justify-center p-1 text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors"
            title={isDone ? "Reopen task" : "Mark as completed"}
            aria-label={isDone ? `Reopen task: ${t.title}` : `Mark as completed: ${t.title}`}
          >
            {isDone ? (
              <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />
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
              className={`font-medium text-xs text-[var(--foreground)] ${
                isDone ? "line-through text-[var(--muted-foreground)]" : ""
              }`}
            >
              {t.title}
            </span>
            {t.description && (
              <span className="text-[11px] text-[var(--muted-foreground)] line-clamp-1">
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
          priority === "high" ? "destructive" : priority === "normal" ? "info" : "neutral";
        return <StatusBadge label={priority} variant={variant} />;
      },
    },
    {
      accessorKey: "due_date",
      header: "Due Date",
      cell: ({ row }) => {
        const t = row.original;
        if (!t.due_date) return <span className="text-xs text-[var(--muted-foreground)]">—</span>;

        return (
          <div className="flex items-center gap-1.5 text-xs">
            {t.is_overdue && (
              <span className="inline-flex items-center gap-1 font-semibold text-[var(--danger)]">
                <AlertTriangle className="h-3 w-3" />
                Overdue:
              </span>
            )}
            <span className={t.is_overdue ? "font-semibold text-[var(--danger)]" : "text-[var(--muted-foreground)]"}>
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
        if (!t.account_id) return <span className="text-xs text-[var(--muted-foreground)]">—</span>;
        return (
          <Link
            href={`/app/accounts/${t.account_id}`}
            className="text-xs text-[var(--primary)] hover:underline flex items-center gap-1"
          >
            <Building2 className="h-3 w-3 text-[var(--muted-foreground)]" />
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
        if (!t.opportunity_id) return <span className="text-xs text-[var(--muted-foreground)]">—</span>;
        return (
          <Link
            href={`/app/opportunities/${t.opportunity_id}`}
            className="text-xs text-[var(--primary)] hover:underline flex items-center gap-1"
          >
            <Briefcase className="h-3 w-3 text-[var(--muted-foreground)]" />
            <span className="truncate max-w-[140px]">{t.opportunity_name}</span>
          </Link>
        );
      },
    },
    {
      accessorKey: "assignee_name",
      header: "Assignee",
      cell: ({ row }) => (
        <span className="text-xs text-[var(--muted-foreground)]">
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
            <Button variant="ghost" size="sm" onClick={() => onEdit(t)} title="Edit task">
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
    />
  );
}
