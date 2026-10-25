"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, AlertCircle, HelpCircle, Layers } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card, Button } from "@/components/sakani";
import type { RFQMatchHealthSummary } from "../api";

interface RFQMatchHealthChartProps {
  data?: RFQMatchHealthSummary | null;
}

const STATUS_COLOR_MAP: Record<string, string> = {
  exact_match: "var(--color-chart-6)",
  matched: "var(--color-chart-2)",
  needs_review: "var(--color-chart-1)",
  unmatched: "var(--color-chart-5)",
};

export function RFQMatchHealthChart({ data }: RFQMatchHealthChartProps) {
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);
  const [showTable, setShowTable] = React.useState(false);

  const totalLines = data?.total_lines ?? 0;
  const categories = data?.categories ?? [];

  const chartData = categories.map((cat) => ({
    name: cat.label,
    status: cat.status,
    value: cat.count,
    percentage: cat.percentage,
    color: STATUS_COLOR_MAP[cat.status] || "var(--color-chart-2)",
  }));

  // Non-zero data for chart rendering (Recharts handles empty slices gracefully if value > 0)
  const nonZeroData = chartData.filter((d) => d.value > 0);

  return (
    <Card className="p-5 border-[var(--color-border-default)] flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-[22px] text-[var(--color-fg-default)]">
            RFQ Match Health
          </h3>
          <p className="text-[13px] font-medium leading-[18px] text-[var(--color-fg-muted)] mt-0.5 line-clamp-1">
            Understand catalog-match outcomes across imported RFQ lines.
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
            href="/app/rfqs"
            variant="outline"
            size="sm"
            rightIcon={<ArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" />}
            className="h-7 px-2.5 text-xs font-medium"
          >
            RFQs
          </Button>
        </div>
      </div>

      {/* Main Content: Donut or Tabular Alternative */}
      {showTable ? (
        <div
          className="flex-1 w-full overflow-x-auto focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-sm)]"
          tabIndex={0}
          role="region"
          aria-label="RFQ Match Health Table Alternative"
        >
          <table className="w-full text-left border-collapse text-xs" role="table">
            <thead>
              <tr className="border-b border-[var(--color-border-subtle)] text-[var(--color-fg-muted)] font-medium">
                <th scope="col" className="pb-2">Outcome</th>
                <th scope="col" className="pb-2 text-right">Count</th>
                <th scope="col" className="pb-2 text-right">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {chartData.map((item) => (
                <tr key={item.status} className="transition-colors hover:bg-[var(--color-bg-subtle)]/50">
                  <td className="py-2.5 font-medium text-[var(--color-fg-default)]">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                        aria-hidden="true"
                      />
                      <span>{item.name}</span>
                    </span>
                  </td>
                  <td className="py-2.5 text-right font-medium text-[var(--color-fg-default)] tabular-nums">
                    {item.value}
                  </td>
                  <td className="py-2.5 text-right font-mono text-[var(--color-fg-muted)] tabular-nums">
                    {item.percentage.toFixed(1)}%
                  </td>
                </tr>
              ))}
              <tr className="border-t border-[var(--color-border-default)] font-semibold text-[var(--color-fg-default)]">
                <td className="pt-2.5">Total Lines</td>
                <td className="pt-2.5 text-right tabular-nums">{totalLines}</td>
                <td className="pt-2.5 text-right font-mono">100.0%</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex-1 flex flex-col sm:flex-row items-center gap-4 min-h-[190px]">
          {/* Donut Chart with Center Text */}
          <div
            className="relative h-[180px] w-[180px] shrink-0"
            role="region"
            aria-label="Donut Chart of RFQ match health"
          >
            {!mounted ? (
              <div className="h-full w-full rounded-full border-4 border-dashed border-[var(--color-border-subtle)] animate-pulse" />
            ) : totalLines === 0 ? (
              <div className="h-full w-full rounded-full border border-[var(--color-border-subtle)] flex items-center justify-center text-xs text-[var(--color-fg-muted)]">
                No RFQ lines
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={nonZeroData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={74}
                      cornerRadius={4}
                      paddingAngle={3}
                      stroke="none"
                      isAnimationActive={false}
                      onMouseEnter={(_, i) => setActiveIndex(i)}
                      onMouseLeave={() => setActiveIndex(null)}
                    >
                      {nonZeroData.map((entry, i) => (
                        <Cell
                          key={`cell-${entry.status}`}
                          fill={entry.color}
                          fillOpacity={activeIndex !== null && i !== activeIndex ? 0.45 : 1}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          return (
                            <div className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-2 shadow-xs text-xs space-y-0.5">
                              <p className="font-semibold text-[var(--color-fg-default)]">{item.name}</p>
                              <p className="text-[var(--color-fg-muted)]">
                                {item.value} lines ({item.percentage}%)
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Center text overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                  <span className="text-2xl font-bold leading-tight text-[var(--color-fg-default)] tracking-tight tabular-nums">
                    {totalLines}
                  </span>
                  <span className="text-[10px] font-semibold tracking-wider uppercase text-[var(--color-fg-muted)]">
                    Total Lines
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Accessible Legend Breakdown */}
          <div className="flex-1 w-full space-y-2 py-1">
            {chartData.map((item, idx) => {
              const isHovered = activeIndex !== null && nonZeroData[activeIndex]?.status === item.status;
              return (
                <div
                  key={item.status}
                  className={`flex items-center justify-between text-xs py-1 px-2 rounded-[var(--radius-sm)] transition-colors ${
                    isHovered ? "bg-[var(--color-bg-subtle)] font-medium" : ""
                  }`}
                  onMouseEnter={() => {
                    const matchIdx = nonZeroData.findIndex((d) => d.status === item.status);
                    if (matchIdx !== -1) setActiveIndex(matchIdx);
                  }}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                      aria-hidden="true"
                    />
                    <span className="text-[var(--color-fg-default)] font-medium truncate">
                      {item.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 tabular-nums">
                    <span className="text-[var(--color-fg-default)] font-semibold">
                      {item.value}
                    </span>
                    <span className="text-[11px] text-[var(--color-fg-muted)] font-mono w-10 text-right">
                      {item.percentage.toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer Meta */}
      <div className="pt-3 mt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-[11px] text-[var(--color-fg-muted)]">
        <span>Reviewed: {data?.reviewed_lines ?? 0} committed</span>
        <Link
          href="/app/rfqs"
          className="text-[var(--color-primary-600)] hover:underline inline-flex items-center gap-1 font-medium"
        >
          <span>Open candidate matcher</span>
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
    </Card>
  );
}
