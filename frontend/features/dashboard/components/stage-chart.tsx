"use client";

import * as React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { formatMoney } from "@/lib/formatters/formatters";
import type { DashboardSummary } from "../api";

interface StageChartProps {
  distribution: DashboardSummary["stage_distribution"];
}

function formatCompactLakh(v: number): string {
  if (v === 0) return "₹0";
  const inLakhs = v / 100000;
  if (Number.isInteger(inLakhs)) {
    return `₹${inLakhs}L`;
  }
  return `₹${inLakhs.toFixed(1)}L`;
}

export function StageChart({ distribution }: StageChartProps) {
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const chartData = distribution.map((item) => ({
    stage: item.stage.charAt(0).toUpperCase() + item.stage.slice(1).replace("_", " "),
    stageKey: item.stage,
    count: item.count,
    value: Number(item.total_value),
  }));

  if (!mounted) {
    return <div className="h-64 w-full animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-bg-subtle)]" />;
  }

  return (
    <div className="flex flex-col lg:flex-row gap-5 items-start">
      {/* Chart Column (~58% on desktop) */}
      <div
        className="w-full lg:w-[58%] min-w-0"
        role="region"
        aria-label="Opportunity Stage Distribution Chart"
      >
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {isMobile ? (
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 4, bottom: 8 }}
              >
                <CartesianGrid
                  horizontal={false}
                  stroke="var(--color-border-subtle)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  type="number"
                  stroke="var(--color-fg-subtle)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "var(--color-border-subtle)" }}
                  tickFormatter={formatCompactLakh}
                />
                <YAxis
                  type="category"
                  dataKey="stage"
                  stroke="var(--color-fg-subtle)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  width={80}
                />
                <Tooltip
                  cursor={{ fill: "var(--color-bg-subtle)", opacity: 0.5 }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-2.5 shadow-xs text-xs space-y-1">
                          <p className="font-semibold text-[var(--color-fg-default)]">{data.stage}</p>
                          <p className="text-[var(--color-fg-muted)]">Active Deals: {data.count}</p>
                          <p className="font-mono font-medium text-[var(--color-fg-default)]">
                            {formatMoney(data.value, "INR")}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="value"
                  fill="var(--color-chart-2)"
                  radius={[0, 6, 6, 0]}
                  maxBarSize={20}
                />
              </BarChart>
            ) : (
              <BarChart
                data={chartData}
                margin={{ top: 12, right: 12, left: -10, bottom: 12 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="var(--color-border-subtle)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="stage"
                  stroke="var(--color-fg-subtle)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "var(--color-border-subtle)" }}
                />
                <YAxis
                  stroke="var(--color-fg-subtle)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatCompactLakh}
                  width={44}
                />
                <Tooltip
                  cursor={{ fill: "var(--color-bg-subtle)", opacity: 0.5 }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-2.5 shadow-xs text-xs space-y-1">
                          <p className="font-semibold text-[var(--color-fg-default)]">{data.stage}</p>
                          <p className="text-[var(--color-fg-muted)]">Active Deals: {data.count}</p>
                          <p className="font-mono font-medium text-[var(--color-fg-default)]">
                            {formatMoney(data.value, "INR")}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="value"
                  fill="var(--color-chart-2)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stage Breakdown Table Column (~42% on desktop) */}
      <div
        className="w-full lg:w-[42%] min-w-0 border-t lg:border-t-0 lg:border-l border-[var(--color-border-subtle)] pt-4 lg:pt-0 lg:pl-5"
      >
        <div
          className="w-full overflow-x-auto focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-sm)]"
          tabIndex={0}
          role="region"
          aria-label="Opportunity Stage Breakdown"
        >
          <table className="w-full text-left border-collapse" role="table">
            <thead>
              <tr className="border-b border-[var(--color-border-subtle)]">
                <th
                  scope="col"
                  className="pb-2 text-xs font-medium leading-4 text-[var(--color-fg-muted)]"
                >
                  Stage
                </th>
                <th
                  scope="col"
                  className="pb-2 text-xs font-medium leading-4 text-[var(--color-fg-muted)] text-right pr-3"
                >
                  Deals
                </th>
                <th
                  scope="col"
                  className="pb-2 text-xs font-medium leading-4 text-[var(--color-fg-muted)] text-right"
                >
                  Value (INR)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {chartData.map((item) => (
                <tr key={item.stageKey} className="transition-colors">
                  <td className="py-2 text-[13px] font-medium leading-[18px] text-[var(--color-fg-default)]">
                    {item.stage}
                  </td>
                  <td className="py-2 text-right pr-3 text-[13px] font-medium leading-[18px] text-[var(--color-fg-default)] tabular-nums">
                    {item.count}
                  </td>
                  <td className="py-2 text-right text-[13px] font-medium leading-[18px] text-[var(--color-fg-default)] tabular-nums font-mono">
                    {formatMoney(item.value, "INR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
