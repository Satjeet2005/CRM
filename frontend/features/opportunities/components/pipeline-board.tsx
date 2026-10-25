"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, RotateCcw, Building2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, formatMoney } from "@/lib/formatters/formatters";
import type { Opportunity } from "../api";

interface PipelineBoardProps {
  opportunities: Opportunity[];
  onStageTransition: (opp: Opportunity, targetStage: any) => void;
  onReopen: (opp: Opportunity) => void;
}

const PIPELINE_COLUMNS = [
  { key: "lead", label: "Lead", variant: "info" as const },
  { key: "qualified", label: "Qualified", variant: "info" as const },
  { key: "solutioning", label: "Solutioning", variant: "info" as const },
  { key: "proposal", label: "Proposal", variant: "warning" as const },
  { key: "negotiation", label: "Negotiation", variant: "warning" as const },
  { key: "won", label: "Closed Won", variant: "success" as const },
  { key: "lost", label: "Closed Lost", variant: "destructive" as const },
];

const NEXT_STAGE_MAP: Record<string, string | null> = {
  lead: "qualified",
  qualified: "solutioning",
  solutioning: "proposal",
  proposal: "negotiation",
  negotiation: "won",
  won: null,
  lost: null,
};

export function PipelineBoard({
  opportunities,
  onStageTransition,
  onReopen,
}: PipelineBoardProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 pt-2">
      {PIPELINE_COLUMNS.map((col) => {
        const colOpps = opportunities.filter((o) => o.stage === col.key);
        const colTotal = colOpps.reduce((sum, o) => sum + Number(o.estimated_value || 0), 0);

        return (
          <div
            key={col.key}
            className="flex w-72 shrink-0 flex-col rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-muted)]"
          >
            {/* Column Header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] p-3">
              <div className="flex items-center gap-2">
                <StatusBadge label={col.label} variant={col.variant} />
                <span className="text-xs font-mono font-medium text-[var(--muted-foreground)]">
                  ({colOpps.length})
                </span>
              </div>
              <span className="text-xs font-semibold text-[var(--foreground)]">
                {formatMoney(colTotal, "INR")}
              </span>
            </div>

            {/* Column Cards */}
            <div className="flex flex-1 flex-col gap-2.5 p-2.5 min-h-[350px]">
              {colOpps.length === 0 ? (
                <div className="flex flex-1 items-center justify-center p-4 text-center">
                  <span className="text-xs text-[var(--muted-foreground)] italic">
                    No deals in {col.label}
                  </span>
                </div>
              ) : (
                colOpps.map((opp) => {
                  const nextStage = NEXT_STAGE_MAP[opp.stage];

                  return (
                    <div
                      key={opp.id}
                      className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-2xs space-y-2 hover:border-[var(--primary)] transition-colors"
                    >
                      <Link
                        href={`/app/opportunities/${opp.id}`}
                        className="block font-semibold text-xs text-[var(--foreground)] hover:text-[var(--primary)]"
                      >
                        {opp.name}
                      </Link>

                      <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
                        <Building2 className="h-3 w-3 shrink-0" />
                        <span className="truncate">{opp.account_name || "—"}</span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-[var(--border)] text-xs">
                        <span className="font-bold text-[var(--foreground)]">
                          {formatMoney(opp.estimated_value, opp.currency_code)}
                        </span>
                        {opp.expected_close_date && (
                          <div className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)]">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(opp.expected_close_date)}</span>
                          </div>
                        )}
                      </div>

                      {/* Card Actions */}
                      <div className="flex items-center justify-between pt-1 text-[11px]">
                        {opp.stage === "won" || opp.stage === "lost" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onReopen(opp)}
                            className="h-6 px-2 text-[10px] gap-1"
                          >
                            <RotateCcw className="h-2.5 w-2.5" />
                            <span>Reopen</span>
                          </Button>
                        ) : (
                          <>
                            <button
                              onClick={() => onStageTransition(opp, "lost")}
                              className="text-[10px] text-[var(--danger)] hover:underline"
                            >
                              Mark Lost
                            </button>
                            {nextStage && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onStageTransition(opp, nextStage)}
                                className="h-6 px-2 text-[10px] gap-1"
                              >
                                <span>Next</span>
                                <ArrowRight className="h-2.5 w-2.5" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
