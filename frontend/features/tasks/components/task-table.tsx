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
  CheckCircle2,
  Circle,
  AlertTriangle,
  Edit,
  Building2,
  Briefcase,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Badge, Button } from "@/components/sakani";
import { EmptyState } from "@/components/data-display/empty-state";
import { LoadingSkeleton } from "@/components/data-display/loading-skeleton";
import { formatDate } from "@/lib/formatters/formatters";
import { cn } from "@/lib/utils";
import { useCompleteTask, useReopenTask, type Task } from "../api";

export interface TaskTableProps {
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
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const completeMutation = useCompleteTask();
  const reopenMutation = useReopenTask();

  const handleToggleComplete = React.useCallback(
    async (task: Task) => {
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
    },
    [completeMutation, reopenMutation]
  );

  const columns = React.useMemo<ColumnDef<Task>[]>(
    () => [
      {
        id: "checkbox",
        header: () => <span className="sr-only">Completion</span>,
        cell: ({ row }) => {
          const t = row.original;
          const isDone = t.status === "completed";
          return (
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => handleToggleComplete(t)}
                className="flex items-center justify-center h-8 w-8 text-[var(--color-fg-muted)] hover:text-[var(--color-primary-600)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)] cursor-pointer"
                title={isDone ? `Reopen task ${t.title}` : `Mark task ${t.title} as completed`}
                aria-label={isDone ? `Reopen task ${t.title}` : `Mark task ${t.title} as completed`}
              >
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4 text-[var(--color-success-600)]" aria-hidden="true" />
                ) : (
                  <Circle className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
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
            <div className="flex flex-col min-w-0 justify-center">
              <span
                className={cn(
                  "font-semibold text-[13px] leading-[18px]",
                  isDone
                    ? "line-through text-[var(--color-fg-muted)] opacity-60"
                    : "text-[var(--color-fg-default)]"
                )}
              >
                {t.title}
              </span>
              {t.description && (
                <span className="text-[12px] font-medium leading-[16px] text-[var(--color-fg-muted)] line-clamp-2 mt-0.5">
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
          const priority = row.original.priority?.toLowerCase();
          // High: Warning/Subtle, Normal: Neutral/Subtle, Low: Neutral/Subtle
          const variant =
            priority === "high"
              ? "warning"
              : "neutral";

          const label =
            priority === "high"
              ? "High"
              : priority === "normal"
              ? "Normal"
              : priority === "low"
              ? "Low"
              : row.original.priority || "Normal";

          const isLow = priority === "low";

          return (
            <Badge
              variant={variant}
              emphasis="subtle"
              className={cn(
                "h-5 px-2 py-0.5 text-xs font-medium leading-4 select-none capitalize rounded-full",
                isLow && "opacity-75"
              )}
            >
              {label}
            </Badge>
          );
        },
      },
      {
        accessorKey: "due_date",
        header: "Due Date",
        cell: ({ row }) => {
          const t = row.original;
          if (!t.due_date) return <span className="text-[13px] font-medium leading-[18px] text-[var(--color-fg-muted)]">—</span>;

          const isOverdue = t.is_overdue && t.status !== "completed";

          return (
            <div className="flex flex-col gap-1 items-start">
              {isOverdue && (
                <Badge
                  variant="danger"
                  emphasis="subtle"
                  leftIcon={<AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />}
                  className="h-5 px-2 py-0.5 text-xs font-medium leading-4 w-fit select-none rounded-full"
                >
                  Overdue
                </Badge>
              )}
              <span className="text-[13px] font-medium leading-[18px] text-[var(--color-fg-default)]">
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
          if (!t.account_id) return <span className="text-[13px] font-medium leading-[18px] text-[var(--color-fg-muted)]">—</span>;
          const accountName = t.account_name || "View Account";

          return (
            <Link
              href={`/app/accounts/${t.account_id}`}
              className="text-[13px] font-medium leading-[18px] text-[var(--color-fg-default)] hover:text-[var(--color-primary-600)] hover:underline inline-flex items-start gap-2 focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)]"
              title={accountName}
            >
              <Building2 className="h-4 w-4 shrink-0 text-[var(--color-fg-subtle)] mt-0.5" aria-hidden="true" />
              <span className="line-clamp-2 break-words">{accountName}</span>
            </Link>
          );
        },
      },
      {
        accessorKey: "opportunity_name",
        header: "Related Deal",
        cell: ({ row }) => {
          const t = row.original;
          if (!t.opportunity_id) return <span className="text-[13px] font-medium leading-[18px] text-[var(--color-fg-muted)]">—</span>;
          const dealName = t.opportunity_name || "View Deal";

          return (
            <Link
              href={`/app/opportunities/${t.opportunity_id}`}
              className="text-[13px] font-medium leading-[18px] text-[var(--color-fg-default)] hover:text-[var(--color-primary-600)] hover:underline inline-flex items-start gap-2 focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)]"
              title={dealName}
            >
              <Briefcase className="h-4 w-4 shrink-0 text-[var(--color-fg-subtle)] mt-0.5" aria-hidden="true" />
              <span className="line-clamp-2 break-words">{dealName}</span>
            </Link>
          );
        },
      },
      {
        accessorKey: "assignee_name",
        header: "Assignee",
        cell: ({ row }) => (
          <span className="text-[13px] font-medium leading-[18px] text-[var(--color-fg-muted)]">
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
            <div className="flex items-center justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(t)}
                title={`Edit task ${t.title}`}
                aria-label={`Edit task ${t.title}`}
                className="h-8 w-8 p-0 text-[var(--color-fg-muted)] hover:text-[var(--color-fg-default)] hover:bg-[var(--color-bg-subtle)] focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)] shrink-0"
              >
                <Edit className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          );
        },
      },
    ],
    [onEdit, handleToggleComplete]
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
        title="No tasks found."
        description="No operational action items or commitments match this filter."
      />
    );
  }

  const totalPages = Math.ceil(total / (pageSize || 15)) || 1;

  // Completion: 5%, Action Item: 25%, Priority: 9%, Due Date: 13%, Related Account: 18%, Related Deal: 18%, Assignee: 7%, Actions: 5%
  const columnWidthClasses: Record<string, string> = {
    checkbox: "w-[5%]",
    title: "w-[25%]",
    priority: "w-[9%]",
    due_date: "w-[13%]",
    account_name: "w-[18%]",
    opportunity_name: "w-[18%]",
    assignee_name: "w-[7%]",
    actions: "w-[5%]",
  };

  const isCenteredColumn = (id: string) => id === "checkbox" || id === "actions";

  return (
    <div className="space-y-4">
      {/* 1. Desktop & Tablet: Standard Sakani Table Default (45:259) */}
      <div className="hidden md:block overflow-hidden rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] shadow-xs">
        <div
          className="overflow-x-auto w-full focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)]"
          role="region"
          aria-label="Tasks directory table"
          tabIndex={0}
        >
          <table className="w-full text-left border-collapse table-fixed min-w-[900px]">
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
                  className="min-h-[56px] transition-colors hover:bg-[var(--color-bg-subtle)]/60 bg-[var(--color-bg-surface)]"
                >
                  {row.getVisibleCells().map((cell) => {
                    const colId = cell.column.id;
                    const isCentered = isCenteredColumn(colId);

                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          "px-2.5 py-2.5 text-[13px] font-medium leading-[18px] text-[var(--color-fg-default)] align-middle",
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
          const t = row.original;
          const isDone = t.status === "completed";
          const isOverdue = t.is_overdue && !isDone;
          const priority = t.priority?.toLowerCase();

          return (
            <div
              key={t.id}
              className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-3.5 space-y-3 shadow-xs"
            >
              {/* Header: Complete button + Action Title + Priority badge */}
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => handleToggleComplete(t)}
                    className="mt-0.5 p-1 text-[var(--color-fg-muted)] hover:text-[var(--color-primary-600)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)] shrink-0 cursor-pointer"
                    title={isDone ? `Reopen task ${t.title}` : `Mark task ${t.title} as completed`}
                    aria-label={isDone ? `Reopen task ${t.title}` : `Mark task ${t.title} as completed`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4 text-[var(--color-success-600)]" aria-hidden="true" />
                    ) : (
                      <Circle className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                  <div className="flex flex-col min-w-0">
                    <span
                      className={cn(
                        "font-semibold text-sm leading-5",
                        isDone
                          ? "line-through text-[var(--color-fg-muted)] opacity-60"
                          : "text-[var(--color-fg-default)]"
                      )}
                    >
                      {t.title}
                    </span>
                    {t.description && (
                      <span className="text-xs font-medium text-[var(--color-fg-muted)] mt-0.5 line-clamp-2">
                        {t.description}
                      </span>
                    )}
                  </div>
                </div>
                <Badge
                  variant={priority === "high" ? "warning" : "neutral"}
                  emphasis="subtle"
                  className={cn(
                    "h-5 px-2 py-0.5 text-xs font-medium leading-4 capitalize select-none shrink-0 rounded-full",
                    priority === "low" && "opacity-75"
                  )}
                >
                  {priority === "high" ? "High" : priority === "normal" ? "Normal" : priority === "low" ? "Low" : t.priority}
                </Badge>
              </div>

              {/* Labeled Record Details */}
              <div className="space-y-2 pt-2 border-t border-[var(--color-border-subtle)]/60 text-xs">
                {/* Due date */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[var(--color-fg-muted)]">
                    Due Date
                  </span>
                  <div className="flex items-center gap-1.5">
                    {isOverdue && (
                      <Badge
                        variant="danger"
                        emphasis="subtle"
                        leftIcon={<AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />}
                        className="h-5 px-2 py-0.5 text-xs font-medium leading-4 select-none rounded-full"
                      >
                        Overdue
                      </Badge>
                    )}
                    <span className="text-xs font-medium text-[var(--color-fg-default)]">
                      {t.due_date ? formatDate(t.due_date) : "—"}
                    </span>
                  </div>
                </div>

                {/* Account */}
                {t.account_name && (
                  <div>
                    <span className="text-[11px] font-medium text-[var(--color-fg-muted)] block">
                      Related Account
                    </span>
                    <Link
                      href={`/app/accounts/${t.account_id}`}
                      className="font-medium text-[var(--color-fg-default)] hover:text-[var(--color-primary-600)] hover:underline inline-flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)]"
                    >
                      <Building2 className="h-3.5 w-3.5 text-[var(--color-fg-subtle)] shrink-0" aria-hidden="true" />
                      <span>{t.account_name}</span>
                    </Link>
                  </div>
                )}

                {/* Deal */}
                {t.opportunity_name && (
                  <div>
                    <span className="text-[11px] font-medium text-[var(--color-fg-muted)] block">
                      Related Deal
                    </span>
                    <Link
                      href={`/app/opportunities/${t.opportunity_id}`}
                      className="font-medium text-[var(--color-fg-default)] hover:text-[var(--color-primary-600)] hover:underline inline-flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)]"
                    >
                      <Briefcase className="h-3.5 w-3.5 text-[var(--color-fg-subtle)] shrink-0" aria-hidden="true" />
                      <span>{t.opportunity_name}</span>
                    </Link>
                  </div>
                )}

                {/* Assignee */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[var(--color-fg-muted)]">
                    Assignee
                  </span>
                  <span className="font-medium text-[var(--color-fg-muted)]">
                    {t.assignee_name || "Unassigned"}
                  </span>
                </div>
              </div>

              {/* Mobile Actions Footer */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border-subtle)]/60">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(t)}
                  title={`Edit task ${t.title}`}
                  aria-label={`Edit task ${t.title}`}
                  className="h-8 text-xs px-2.5 gap-1.5 text-[var(--color-fg-muted)] hover:text-[var(--color-fg-default)] hover:bg-[var(--color-bg-subtle)]"
                >
                  <Edit className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Edit</span>
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Sakani 32px Pagination Footer (Figma Data Table + Toolbar 684:17474) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 text-xs text-[var(--color-fg-muted)]">
        <div>
          Showing {total > 0 ? (page - 1) * pageSize + 1 : 0}–
          {Math.min(page * pageSize, total)} of {total} tasks
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
