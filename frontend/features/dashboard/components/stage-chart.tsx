"use client";

import * as React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { formatMoney } from "@/lib/formatters/formatters";
import type { DashboardSummary } from "../api";

interface StageChartProps {
  distribution: DashboardSummary["stage_distribution"];
}

const STAGE_COLORS: Record<string, string> = {
  lead: "var(--color-chart-2)",
  qualified: "var(--color-chart-3)",
  solutioning: "var(--color-chart-1)",
  proposal: "var(--color-chart-4)",
  negotiation: "var(--color-chart-5)",
  won: "var(--color-chart-6)",
  lost: "var(--color-danger-500)",
};

export function StageChart({ distribution }: StageChartProps) {
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

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
    <div className="space-y-4">
      <div className="h-64 w-full" role="region" aria-label="Opportunity Stage Distribution Chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 15, bottom: 25 }}>
            <XAxis
              dataKey="stage"
              stroke="var(--color-fg-muted)"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "var(--color-border-subtle)" }}
            />
            <YAxis
              stroke="var(--color-fg-muted)"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "var(--color-border-subtle)" }}
              tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`}
            />
            <Tooltip
              cursor={{ fill: "var(--color-bg-subtle)", opacity: 0.6 }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-2.5 shadow-md text-xs space-y-1">
                      <p className="font-semibold text-[var(--color-fg-default)]">{data.stage}</p>
                      <p className="text-[var(--color-fg-muted)]">Active Deals: {data.count}</p>
                      <p className="font-bold text-[var(--color-primary-500)]">{formatMoney(data.value, "INR")}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((entry) => (
                <Cell key={`cell-${entry.stageKey}`} fill={STAGE_COLORS[entry.stageKey] || "var(--color-chart-1)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Accessible Text/Table Breakdown */}
      <div className="overflow-x-auto border-t border-[var(--color-border-subtle)] pt-3">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--color-border-subtle)] text-[var(--color-fg-muted)]">
              <th className="py-1.5 font-medium">Stage</th>
              <th className="py-1.5 font-medium text-center">Deals</th>
              <th className="py-1.5 font-medium text-right">Value (INR)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-subtle)]">
            {chartData.map((item) => (
              <tr key={item.stageKey} className="hover:bg-[var(--color-bg-subtle)] transition-colors">
                <td className="py-1.5 font-medium text-[var(--color-fg-default)] flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: STAGE_COLORS[item.stageKey] || "var(--color-chart-1)" }}
                    aria-hidden="true"
                  />
                  <span>{item.stage}</span>
                </td>
                <td className="py-1.5 text-center text-[var(--color-fg-default)]">{item.count}</td>
                <td className="py-1.5 text-right font-mono text-[var(--color-fg-default)]">
                  {formatMoney(item.value, "INR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
