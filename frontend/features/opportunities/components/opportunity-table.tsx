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
  Briefcase,
  ArrowRight,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Badge, Button } from "@/components/sakani";
import { EmptyState } from "@/components/data-display/empty-state";
import { LoadingSkeleton } from "@/components/data-display/loading-skeleton";
import { formatDate, formatMoney } from "@/lib/formatters/formatters";
import { cn } from "@/lib/utils";
import type { Opportunity } from "../api";

export interface OpportunityTableProps {
  data: Opportunity[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onStageTransition: (opp: Opportunity, targetStage: any) => void;
  onReopen: (opp: Opportunity) => void;
  isLoading?: boolean;
}

export const NEXT_STAGE_MAP: Record<string, string | null> = {
  lead: "qualified",
  qualified: "solutioning",
  solutioning: "proposal",
  proposal: "negotiation",
  negotiation: "won",
  won: null,
  lost: null,
};

export const STAGE_LABELS: Record<string, string> = {
  lead: "Lead",
  qualified: "Qualified",
  solutioning: "Solutioning",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

export const STAGE_BADGE_VARIANTS: Record<
  string,
  "info" | "warning" | "success" | "danger" | "neutral"
> = {
  lead: "info",
  qualified: "info",
  solutioning: "info",
  proposal: "warning",
  negotiation: "warning",
  won: "success",
  lost: "danger",
};

export function OpportunityTable({
  data,
  total,
  page,
  pageSize,
  onPageChange,
  onStageTransition,
  onReopen,
  isLoading,
}: OpportunityTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const columns = React.useMemo<ColumnDef<Opportunity>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Opportunity",
        cell: ({ row }) => {
          const opp = row.original;
          return (
            <div className="flex flex-col py-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <Briefcase
                  className="h-4 w-4 shrink-0 text-[var(--color-fg-muted)]"
                  aria-hidden="true"
                />
                <Link
                  href={`/app/opportunities/${opp.id}`}
                  className="font-semibold text-[13px] leading-[18px] text-[var(--color-fg-default)] hover:text-[var(--color-primary-600)] hover:underline truncate focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)]"
                  title={opp.name}
                >
                  {opp.name}
                </Link>
              </div>
              <span className="text-xs font-medium leading-4 text-[var(--color-fg-muted)] pl-6 truncate">
                {opp.account_name || "—"}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "stage",
        header: "Stage",
        cell: ({ row }) => {
          const stage = row.original.stage;
          const variant = STAGE_BADGE_VARIANTS[stage] || "neutral";
          const label = STAGE_LABELS[stage] || stage;

          return (
            <Badge
              variant={variant}
              emphasis="subtle"
              className="h-5 px-2 py-0.5 text-xs font-medium leading-4 rounded-full select-none shrink-0"
            >
              {label}
            </Badge>
          );
        },
      },
      {
        accessorKey: "estimated_value",
        header: "Est. Value",
        cell: ({ row }) => {
          const opp = row.original;
          return (
            <div className="text-right">
              <span className="font-semibold text-[13px] leading-[18px] text-[var(--color-fg-default)] font-mono tabular-nums">
                {formatMoney(opp.estimated_value, opp.currency_code)}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "probability_percent",
        header: "Probability",
        cell: ({ row }) => {
          const prob = row.original.probability_percent;
          return (
            <div className="text-right">
              <span className="text-[13px] font-mono font-medium leading-[18px] text-[var(--color-fg-muted)] tabular-nums">
                {prob ? `${Number(prob).toFixed(0)}%` : "—"}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "expected_close_date",
        header: "Target Close",
        cell: ({ row }) => (
          <span className="text-[13px] font-medium leading-[18px] text-[var(--color-fg-muted)]">
            {formatDate(row.original.expected_close_date)}
          </span>
        ),
      },
      {
        accessorKey: "owner_name",
        header: "Owner",
        cell: ({ row }) => (
          <span className="text-[13px] font-medium leading-[18px] text-[var(--color-fg-muted)] truncate block">
            {row.original.owner_name || "Unassigned"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const opp = row.original;
          const nextStage = NEXT_STAGE_MAP[opp.stage];

          if (opp.stage === "won" || opp.stage === "lost") {
            return (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onReopen(opp)}
                  title={`Reopen ${opp.name}`}
                  className="h-8 px-2.5 text-xs font-medium gap-1.5 rounded-[var(--radius-md)] border-[var(--color-border-default)] hover:bg-[var(--color-bg-subtle)]"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Reopen</span>
                </Button>
              </div>
            );
          }

          return (
            <div className="flex items-center gap-2">
              {nextStage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onStageTransition(opp, nextStage)}
                  title={`Advance ${opp.name} to next stage`}
                  className="h-8 px-2.5 text-xs font-medium gap-1 rounded-[var(--radius-md)] border-[var(--color-border-default)] hover:bg-[var(--color-bg-subtle)]"
                >
                  <span>Advance</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onStageTransition(opp, "lost")}
                title={`Mark ${opp.name} as lost`}
                className="h-8 px-2 text-xs font-medium text-[var(--color-danger-fg)] hover:text-[var(--color-danger-fg)] hover:bg-[var(--color-danger-bg)] rounded-[var(--radius-md)]"
              >
                <span>Mark lost</span>
              </Button>
            </div>
          );
        },
      },
    ],
    [onStageTransition, onReopen]
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
        title="No opportunities found."
        description="No pipeline deals or quotes match the filter criteria."
      />
    );
  }

  const totalPages = Math.ceil(total / (pageSize || 25)) || 1;

  // Proportional column widths
  const columnWidthClasses: Record<string, string> = {
    name: "w-[31%]",
    stage: "w-[9%]",
    estimated_value: "w-[12%]",
    probability_percent: "w-[9%]",
    expected_close_date: "w-[11%]",
    owner_name: "w-[11%]",
    actions: "w-[17%]",
  };

  const isRightAligned = (id: string) =>
    id === "estimated_value" || id === "probability_percent";

  return (
    <div className="space-y-4">
      {/* 1. Desktop & Tablet: Sakani Table Default (45:259) */}
      <div className="hidden md:block overflow-hidden rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] shadow-xs">
        <div
          className="overflow-x-auto w-full focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)]"
          role="region"
          aria-label="Opportunities directory table"
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
                    const rightAligned = isRightAligned(colId);
                    const widthClass = columnWidthClasses[colId] || "";

                    return (
                      <th
                        key={header.id}
                        scope="col"
                        className={cn(
                          "px-2.5 py-0 h-11 text-[11px] font-semibold leading-4 tracking-[0.04em] text-[var(--color-fg-muted)] select-none align-middle",
                          rightAligned ? "text-right" : "text-left",
                          widthClass
                        )}
                      >
                        {header.isPlaceholder ? null : canSort ? (
                          <button
                            type="button"
                            className={cn(
                              "w-full inline-flex items-center gap-1.5 font-semibold text-[11px] leading-4 tracking-[0.04em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg-default)] focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)] cursor-pointer select-none",
                              rightAligned ? "justify-end" : "justify-start"
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
                  className="min-h-[52px] transition-colors hover:bg-[var(--color-bg-subtle)]/60 bg-[var(--color-bg-surface)]"
                >
                  {row.getVisibleCells().map((cell) => {
                    const colId = cell.column.id;
                    const rightAligned = isRightAligned(colId);

                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          "px-2.5 py-2.5 text-[13px] font-medium leading-[18px] text-[var(--color-fg-default)] align-middle",
                          rightAligned ? "text-right" : "text-left"
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
          const opp = row.original;
          const stage = opp.stage;
          const variant = STAGE_BADGE_VARIANTS[stage] || "neutral";
          const label = STAGE_LABELS[stage] || stage;
          const nextStage = NEXT_STAGE_MAP[stage];

          return (
            <div
              key={opp.id}
              className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-3.5 space-y-3 shadow-xs"
            >
              {/* Header: Title link + Stage badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Briefcase
                      className="h-4 w-4 shrink-0 text-[var(--color-fg-muted)]"
                      aria-hidden="true"
                    />
                    <Link
                      href={`/app/opportunities/${opp.id}`}
                      className="font-semibold text-sm leading-5 text-[var(--color-fg-default)] hover:text-[var(--color-primary-600)] hover:underline truncate focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)] min-w-0"
                    >
                      {opp.name}
                    </Link>
                  </div>
                  <span className="text-xs font-medium leading-4 text-[var(--color-fg-muted)] pl-5.5 block truncate">
                    {opp.account_name || "—"}
                  </span>
                </div>
                <Badge
                  variant={variant}
                  emphasis="subtle"
                  className="h-5 px-2 py-0.5 text-xs font-medium leading-4 rounded-full select-none shrink-0"
                >
                  {label}
                </Badge>
              </div>

              {/* Labeled Record Details Grid */}
              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[var(--color-border-subtle)]/60 text-xs">
                <div>
                  <span className="text-[11px] font-medium text-[var(--color-fg-muted)] block">
                    Est. Value
                  </span>
                  <span className="font-semibold text-[13px] leading-[18px] text-[var(--color-fg-default)] font-mono tabular-nums">
                    {formatMoney(opp.estimated_value, opp.currency_code)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-[var(--color-fg-muted)] block">
                    Probability
                  </span>
                  <span className="font-mono font-medium text-[var(--color-fg-default)]">
                    {opp.probability_percent ? `${Number(opp.probability_percent).toFixed(0)}%` : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-[var(--color-fg-muted)] block">
                    Target Close
                  </span>
                  <span className="font-medium text-[var(--color-fg-muted)]">
                    {formatDate(opp.expected_close_date)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-[var(--color-fg-muted)] block">
                    Owner
                  </span>
                  <span className="font-medium text-[var(--color-fg-default)] truncate block">
                    {opp.owner_name || "Unassigned"}
                  </span>
                </div>
              </div>

              {/* Mobile Actions Footer */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border-subtle)]/60">
                {opp.stage === "won" || opp.stage === "lost" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onReopen(opp)}
                    title={`Reopen ${opp.name}`}
                    className="h-8 px-2.5 text-xs font-medium gap-1.5 rounded-[var(--radius-md)] border-[var(--color-border-default)] hover:bg-[var(--color-bg-subtle)]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Reopen</span>
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onStageTransition(opp, "lost")}
                      title={`Mark ${opp.name} as lost`}
                      className="h-8 px-2 text-xs font-medium text-[var(--color-danger-fg)] hover:text-[var(--color-danger-fg)] hover:bg-[var(--color-danger-bg)] rounded-[var(--radius-md)]"
                    >
                      <span>Mark lost</span>
                    </Button>
                    {nextStage && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onStageTransition(opp, nextStage)}
                        title={`Advance ${opp.name} to next stage`}
                        className="h-8 px-2.5 text-xs font-medium gap-1 rounded-[var(--radius-md)] border-[var(--color-border-default)] hover:bg-[var(--color-bg-subtle)]"
                      >
                        <span>Advance</span>
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    )}
                  </>
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
          {Math.min(page * pageSize, total)} of {total} opportunities
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
