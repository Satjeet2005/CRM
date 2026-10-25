"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { Briefcase, ArrowRight, RotateCcw } from "lucide-react";
import { DataTable } from "@/components/data-display/data-table";
import { Badge, Button } from "@/components/sakani";
import { formatDate, formatMoney } from "@/lib/formatters/formatters";
import type { Opportunity } from "../api";

interface OpportunityTableProps {
  data: Opportunity[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onStageTransition: (opp: Opportunity, targetStage: any) => void;
  onReopen: (opp: Opportunity) => void;
  isLoading?: boolean;
}

const NEXT_STAGE_MAP: Record<string, string | null> = {
  lead: "qualified",
  qualified: "solutioning",
  solutioning: "proposal",
  proposal: "negotiation",
  negotiation: "won",
  won: null,
  lost: null,
};

export function OpportunityTable({
  data,
  total: _total,
  page: _page,
  pageSize: _pageSize,
  onPageChange: _onPageChange,
  onStageTransition,
  onReopen,
  isLoading,
}: OpportunityTableProps) {
  const columns: ColumnDef<Opportunity>[] = [
    {
      accessorKey: "name",
      header: "Opportunity",
      cell: ({ row }) => {
        const opp = row.original;
        return (
          <div className="flex flex-col">
            <Link
              href={`/app/opportunities/${opp.id}`}
              className="font-semibold text-xs text-[var(--color-primary-600)] hover:underline inline-flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)]"
            >
              <Briefcase className="h-4 w-4 shrink-0 text-[var(--color-fg-muted)]" aria-hidden="true" />
              <span>{opp.name}</span>
            </Link>
            <span className="text-[11px] text-[var(--color-fg-muted)] pl-5.5">
              Account: {opp.account_name || "—"}
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
        const variant =
          stage === "won"
            ? "success"
            : stage === "lost"
            ? "danger"
            : stage === "negotiation" || stage === "proposal"
            ? "warning"
            : "info";
        return (
          <Badge variant={variant} emphasis="subtle">
            {stage}
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
          <span className="font-semibold text-xs text-[var(--color-fg-default)]">
            {formatMoney(opp.estimated_value, opp.currency_code)}
          </span>
        );
      },
    },
    {
      accessorKey: "probability_percent",
      header: "Probability",
      cell: ({ row }) => {
        const prob = row.original.probability_percent;
        return (
          <span className="text-xs font-mono text-[var(--color-fg-muted)]">
            {prob ? `${Number(prob).toFixed(0)}%` : "—"}
          </span>
        );
      },
    },
    {
      accessorKey: "expected_close_date",
      header: "Target Close",
      cell: ({ row }) => (
        <span className="text-xs text-[var(--color-fg-muted)]">
          {formatDate(row.original.expected_close_date)}
        </span>
      ),
    },
    {
      accessorKey: "owner_name",
      header: "Owner",
      cell: ({ row }) => (
        <span className="text-xs text-[var(--color-fg-muted)]">
          {row.original.owner_name || "Unassigned"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Quick Actions",
      cell: ({ row }) => {
        const opp = row.original;
        const nextStage = NEXT_STAGE_MAP[opp.stage];

        if (opp.stage === "won" || opp.stage === "lost") {
          return (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onReopen(opp)}
              className="gap-1 text-xs"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reopen</span>
            </Button>
          );
        }

        return (
          <div className="flex items-center gap-1.5">
            {nextStage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStageTransition(opp, nextStage)}
                className="gap-1 text-xs"
              >
                <span>Advance</span>
                <ArrowRight className="h-3 w-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onStageTransition(opp, "lost")}
              className="text-xs text-[var(--color-danger-600)] hover:bg-[var(--color-danger-50)]"
            >
              Lost
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
      emptyTitle="No opportunities found."
      emptyDescription="No pipeline deals or quotes match the filter criteria."
    />
  );
}
