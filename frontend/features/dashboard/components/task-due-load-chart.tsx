"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, AlertTriangle, Clock, CalendarDays, CheckCircle2 } from "lucide-react";
import { Card, Button } from "@/components/sakani";
import type { TaskDueLoadSummary } from "../api";

interface TaskDueLoadChartProps {
  data?: TaskDueLoadSummary | null;
}

const BUCKET_CONFIG: Record<
  string,
  { color: string; trackColor?: string; icon: React.ComponentType<{ className?: string }> }
> = {
  overdue: {
    color: "var(--color-danger-fg)",
    icon: AlertTriangle,
  },
  due_today: {
    color: "var(--color-chart-1)",
    icon: Clock,
  },
  due_this_week: {
    color: "var(--color-chart-2)",
    icon: CalendarDays,
  },
  due_later: {
    color: "var(--color-neutral-400)",
    icon: CheckCircle2,
  },
};

export function TaskDueLoadChart({ data }: TaskDueLoadChartProps) {
  const [showTable, setShowTable] = React.useState(false);
  const categories = data?.categories ?? [];
  const totalOpenTasks = data?.total_open_tasks ?? 0;

  const maxCount = Math.max(1, ...categories.map((c) => c.count));

  return (
    <Card className="p-5 border-[var(--color-border-default)] flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-[22px] text-[var(--color-fg-default)]">
            Task Due-Date Load
          </h3>
          <p className="text-[13px] font-medium leading-[18px] text-[var(--color-fg-muted)] mt-0.5 line-clamp-1">
            Plan follow-ups by due date across open tasks.
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowTable(!showTable)}
            className="px-2 py-1 text-xs font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-fg-default)] rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-subtle)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)]"
            aria-label={showTable ? "Switch to Chart view" : "Switch to Table view"}
          >
            {showTable ? "Chart" : "Table"}
          </button>
          <Button
            href="/app/tasks"
            variant="outline"
            size="sm"
            rightIcon={<ArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" />}
            className="h-7 px-2.5 text-xs font-medium"
          >
            Tasks
          </Button>
        </div>
      </div>

      {/* Main Visualization: Horizontal Bars or Tabular Alternative */}
      {showTable ? (
        <div
          className="flex-1 w-full overflow-x-auto focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-sm)]"
          tabIndex={0}
          role="region"
          aria-label="Task Due-Date Load Table Alternative"
        >
          <table className="w-full text-left border-collapse text-xs" role="table">
            <thead>
              <tr className="border-b border-[var(--color-border-subtle)] text-[var(--color-fg-muted)] font-medium">
                <th scope="col" className="pb-2">Urgency Horizon</th>
                <th scope="col" className="pb-2 text-right">Open Tasks</th>
                <th scope="col" className="pb-2 text-right">Load Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {categories.map((cat) => {
                const conf = BUCKET_CONFIG[cat.bucket] || { color: "var(--color-chart-2)" };
                const share = totalOpenTasks > 0 ? (cat.count / totalOpenTasks) * 100 : 0;
                return (
                  <tr key={cat.bucket} className="transition-colors hover:bg-[var(--color-bg-subtle)]/50">
                    <td className="py-2.5 font-medium text-[var(--color-fg-default)]">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: conf.color }}
                          aria-hidden="true"
                        />
                        <span>{cat.label}</span>
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-medium text-[var(--color-fg-default)] tabular-nums">
                      {cat.count}
                    </td>
                    <td className="py-2.5 text-right font-mono text-[var(--color-fg-muted)] tabular-nums">
                      {share.toFixed(0)}%
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-[var(--color-border-default)] font-semibold text-[var(--color-fg-default)]">
                <td className="pt-2.5">Total Open Tasks</td>
                <td className="pt-2.5 text-right tabular-nums">{totalOpenTasks}</td>
                <td className="pt-2.5 text-right font-mono">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div
          className="flex-1 space-y-3.5 py-1 min-h-[190px] flex flex-col justify-center"
          role="region"
          aria-label="Task Due-Date Load Horizontal Bar Chart"
        >
          {categories.map((cat) => {
            const conf = BUCKET_CONFIG[cat.bucket] || { color: "var(--color-chart-2)" };
            const barWidthPercent = cat.count > 0 ? Math.max(12, (cat.count / maxCount) * 100) : 0;
            return (
              <div key={cat.bucket} className="space-y-1.5 group">
                <div className="flex items-center justify-between text-xs font-medium">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: conf.color }}
                      aria-hidden="true"
                    />
                    <span className="text-[var(--color-fg-default)] truncate">{cat.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 tabular-nums">
                    <span
                      className={`text-xs ${
                        cat.is_urgent && cat.count > 0
                          ? "font-bold text-[var(--color-danger-fg)]"
                          : cat.count > 0
                          ? "font-semibold text-[var(--color-fg-default)]"
                          : "text-[var(--color-fg-muted)]"
                      }`}
                    >
                      {cat.count}
                    </span>
                    <span className="text-[11px] text-[var(--color-fg-muted)] font-mono">
                      {cat.count === 1 ? "task" : "tasks"}
                    </span>
                  </div>
                </div>

                {/* Bar Track + Bar Fill */}
                <div
                  className="h-2 w-full rounded-[var(--radius-full)] bg-[var(--color-bg-subtle)] overflow-hidden"
                  role="progressbar"
                  aria-valuenow={cat.count}
                  aria-valuemin={0}
                  aria-valuemax={maxCount}
                  aria-label={`${cat.label}: ${cat.count} open tasks`}
                >
                  <div
                    className="h-full rounded-[var(--radius-full)] transition-all duration-300"
                    style={{
                      width: `${barWidthPercent}%`,
                      backgroundColor: conf.color,
                      opacity: cat.count > 0 ? 1 : 0.2,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Meta */}
      <div className="pt-3 mt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-[11px] text-[var(--color-fg-muted)]">
        <span>Workload: {totalOpenTasks} open commitments</span>
        <Link
          href="/app/tasks"
          className="text-[var(--color-primary-600)] hover:underline inline-flex items-center gap-1 font-medium"
        >
          <span>Open follow-ups</span>
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
    </Card>
  );
}
