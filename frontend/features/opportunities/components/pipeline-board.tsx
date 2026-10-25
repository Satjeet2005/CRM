"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, RotateCcw, Building2, Calendar } from "lucide-react";
import { Button } from "@/components/sakani";
import { formatDate, formatMoney } from "@/lib/formatters/formatters";
import { cn } from "@/lib/utils";
import type { Opportunity } from "../api";

export interface PipelineBoardProps {
  opportunities: Opportunity[];
  onStageTransition: (opp: Opportunity, targetStage: any) => void;
  onReopen: (opp: Opportunity) => void;
}

export interface PipelineColumnDef {
  key: string;
  label: string;
  dotColor: string;
}

export const PIPELINE_COLUMNS: PipelineColumnDef[] = [
  { key: "lead", label: "Lead", dotColor: "#2E90FA" },
  { key: "qualified", label: "Qualified", dotColor: "#1570EF" },
  { key: "solutioning", label: "Solutioning", dotColor: "#7F56D9" },
  { key: "proposal", label: "Proposal", dotColor: "#F79009" },
  { key: "negotiation", label: "Negotiation", dotColor: "#FF4700" },
  { key: "won", label: "Closed Won", dotColor: "#12B76A" },
  { key: "lost", label: "Closed Lost", dotColor: "#F04438" },
];

export const NEXT_STAGE_MAP: Record<string, string | null> = {
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
  const [draggedOppId, setDraggedOppId] = React.useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = React.useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, opp: Opportunity) => {
    e.dataTransfer.setData("text/plain", opp.id);
    e.dataTransfer.effectAllowed = "move";
    setDraggedOppId(opp.id);
  };

  const handleDragEnd = () => {
    setDraggedOppId(null);
    setDragOverStage(null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, stageKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverStage !== stageKey) {
      setDragOverStage(stageKey);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragOverStage(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetStage: string) => {
    e.preventDefault();
    const oppId = e.dataTransfer.getData("text/plain") || draggedOppId;
    setDragOverStage(null);
    setDraggedOppId(null);

    if (!oppId) return;
    const opp = opportunities.find((o) => o.id === oppId);
    if (opp && opp.stage !== targetStage) {
      onStageTransition(opp, targetStage);
    }
  };

  return (
    <div
      className="sakani-kanban-scroll flex gap-4 overflow-x-auto pb-4 pt-1 px-0.5 focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-lg)]"
      role="region"
      aria-label="Opportunities Kanban board"
      tabIndex={0}
    >
      {PIPELINE_COLUMNS.map((col) => {
        const colOpps = opportunities.filter((o) => o.stage === col.key);
        const colTotal = colOpps.reduce(
          (sum, o) => sum + Number(o.estimated_value || 0),
          0
        );
        const isDropTarget = dragOverStage === col.key;

        return (
          <div
            key={col.key}
            onDragOver={(e) => handleDragOver(e, col.key)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.key)}
            className={cn(
              "flex w-[352px] min-w-[352px] shrink-0 flex-col rounded-[var(--radius-lg)] border p-3 gap-2.5 transition-all duration-150 min-h-[480px]",
              isDropTarget
                ? "border-2 border-dashed border-[var(--color-primary-400)] bg-[var(--color-primary-50)]/40 dark:bg-[var(--color-neutral-800)]/60 ring-2 ring-[var(--color-primary-500)]/20"
                : "border-[var(--color-border-subtle)] bg-[var(--color-bg-canvas)] shadow-xs"
            )}
            data-slot="kanban-column"
            data-stage={col.key}
          >
            {/* Stage Column Header (Sakani Board Column 686:2) */}
            <div className="flex items-center justify-between h-8 select-none">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: col.dotColor }}
                  aria-hidden="true"
                />
                <span className="text-sm font-semibold leading-5 text-[var(--color-fg-default)] truncate">
                  {col.label}
                </span>
                <span className="px-2 py-0.5 text-xs font-medium leading-4 rounded-full bg-[var(--color-bg-subtle)] text-[var(--color-fg-muted)] shrink-0">
                  {colOpps.length}
                </span>
              </div>
              <span className="text-xs font-mono font-medium text-[var(--color-fg-muted)] tabular-nums shrink-0 ml-2">
                {formatMoney(colTotal, "INR")}
              </span>
            </div>

            {/* Column Cards (Board Card Default 678:179) */}
            <div className="flex flex-1 flex-col gap-2.5 min-h-[220px]">
              {colOpps.length === 0 ? (
                <div className="flex flex-1 items-center justify-center p-4 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]/40 text-center min-h-[140px]">
                  <span className="text-xs text-[var(--color-fg-muted)] italic select-none">
                    No deals in {col.label}
                  </span>
                </div>
              ) : (
                colOpps.map((opp) => {
                  const nextStage = NEXT_STAGE_MAP[opp.stage];
                  const isDragging = draggedOppId === opp.id;

                  return (
                    <div
                      key={opp.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, opp)}
                      onDragEnd={handleDragEnd}
                      data-slot="kanban-card"
                      className={cn(
                        "group rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-3 space-y-2 shadow-xs transition-all duration-150 cursor-grab active:cursor-grabbing",
                        "hover:border-[var(--color-border-default)] hover:shadow-sm",
                        isDragging &&
                          "opacity-40 scale-[0.98] ring-2 ring-[var(--color-primary-500)] shadow-md"
                      )}
                    >
                      {/* 1. Opportunity Title */}
                      <Link
                        href={`/app/opportunities/${opp.id}`}
                        className="block font-semibold text-sm leading-5 text-[var(--color-fg-default)] hover:text-[var(--color-primary-600)] transition-colors line-clamp-2 focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)]"
                        title={opp.name}
                      >
                        {opp.name}
                      </Link>

                      {/* 2. Account / Customer */}
                      <div className="flex items-center gap-2 text-[13px] font-medium leading-[18px] text-[var(--color-fg-muted)] min-w-0">
                        <Building2
                          className="h-3.5 w-3.5 shrink-0 text-[var(--color-fg-muted)]"
                          aria-hidden="true"
                        />
                        <span className="truncate">{opp.account_name || "—"}</span>
                      </div>

                      {/* 3. Value and Close Date */}
                      <div className="flex items-center justify-between gap-2 pt-0.5 text-xs">
                        <span className="font-semibold text-[13px] leading-[18px] text-[var(--color-fg-default)] font-mono tabular-nums">
                          {formatMoney(opp.estimated_value, opp.currency_code)}
                        </span>
                        {opp.expected_close_date && (
                          <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-fg-muted)] shrink-0">
                            <Calendar
                              className="h-3.5 w-3.5 shrink-0 text-[var(--color-fg-muted)]"
                              aria-hidden="true"
                            />
                            <span>{formatDate(opp.expected_close_date)}</span>
                          </div>
                        )}
                      </div>

                      {/* 4. Action Footer */}
                      <div className="flex items-center justify-between pt-2 mt-1 border-t border-[var(--color-border-subtle)] text-xs">
                        {opp.stage === "won" || opp.stage === "lost" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onReopen(opp)}
                            aria-label={`Reopen: ${opp.name}`}
                            className="h-8 px-2.5 text-xs font-medium gap-1.5 text-[var(--color-fg-muted)] hover:text-[var(--color-fg-default)] hover:bg-[var(--color-bg-subtle)] rounded-[var(--radius-md)]"
                          >
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Reopen</span>
                          </Button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => onStageTransition(opp, "lost")}
                              aria-label={`Mark Lost: ${opp.name}`}
                              className="text-xs font-medium text-[var(--color-danger-fg)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)] py-1 px-0.5"
                            >
                              Mark Lost
                            </button>
                            {nextStage && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onStageTransition(opp, nextStage)}
                                aria-label={`Next: advance ${opp.name}`}
                                className="h-8 px-2.5 text-xs font-medium gap-1 rounded-[var(--radius-md)] border-[var(--color-border-default)] hover:bg-[var(--color-bg-subtle)] ml-auto"
                              >
                                <span>Next</span>
                                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
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
      {/* End Spacer */}
      <div className="w-1 shrink-0" aria-hidden="true" />
    </div>
  );
}
