"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, RotateCcw, Building2, Calendar } from "lucide-react";
import { Badge, Button, Card } from "@/components/sakani";
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
  { key: "lost", label: "Closed Lost", variant: "danger" as const },
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
            className="flex w-72 shrink-0 flex-col rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)]"
          >
            {/* Column Header */}
            <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] p-3 bg-[var(--color-bg-surface)] rounded-t-[var(--radius-lg)]">
              <div className="flex items-center gap-2">
                <Badge variant={col.variant} emphasis="subtle">
                  {col.label}
                </Badge>
                <span className="text-xs font-mono font-medium text-[var(--color-fg-muted)]">
                  ({colOpps.length})
                </span>
              </div>
              <span className="text-xs font-semibold text-[var(--color-fg-default)]">
                {formatMoney(colTotal, "INR")}
              </span>
            </div>

            {/* Column Cards */}
            <div className="flex flex-1 flex-col gap-2.5 p-2.5 min-h-[350px]">
              {colOpps.length === 0 ? (
                <div className="flex flex-1 items-center justify-center p-4 text-center">
                  <span className="text-xs text-[var(--color-fg-muted)] italic">
                    No deals in {col.label}
                  </span>
                </div>
              ) : (
                colOpps.map((opp) => {
                  const nextStage = NEXT_STAGE_MAP[opp.stage];

                  return (
                    <Card
                      key={opp.id}
                      className="p-3 space-y-2 hover:border-[var(--color-border-focus)] transition-colors shadow-2xs"
                    >
                      <Link
                        href={`/app/opportunities/${opp.id}`}
                        className="block font-semibold text-xs text-[var(--color-fg-default)] hover:text-[var(--color-primary-600)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)]"
                      >
                        {opp.name}
                      </Link>

                      <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-fg-muted)]">
                        <Building2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">{opp.account_name || "—"}</span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-[var(--color-border-subtle)] text-xs">
                        <span className="font-bold text-[var(--color-fg-default)]">
                          {formatMoney(opp.estimated_value, opp.currency_code)}
                        </span>
                        {opp.expected_close_date && (
                          <div className="flex items-center gap-1 text-[10px] text-[var(--color-fg-muted)]">
                            <Calendar className="h-3 w-3" aria-hidden="true" />
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
                              type="button"
                              onClick={() => onStageTransition(opp, "lost")}
                              className="text-[10px] text-[var(--color-danger-600)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)]"
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
                    </Card>
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
