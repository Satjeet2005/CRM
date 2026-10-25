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
  lead: "var(--info)",
  qualified: "var(--info)",
  solutioning: "var(--primary)",
  proposal: "var(--warning)",
  negotiation: "var(--warning)",
  won: "var(--success)",
  lost: "var(--danger)",
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
    return <div className="h-64 w-full animate-pulse rounded-[var(--radius-md)] bg-[var(--surface-muted)]" />;
  }

  return (
    <div className="space-y-4">
      <div className="h-64 w-full" role="region" aria-label="Opportunity Stage Distribution Chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 20, bottom: 25 }}>
            <XAxis
              dataKey="stage"
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
            />
            <YAxis
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-2.5 shadow-md text-xs">
                      <p className="font-semibold text-[var(--foreground)]">{data.stage}</p>
                      <p className="text-[var(--muted-foreground)]">Deals: {data.count}</p>
                      <p className="font-bold text-[var(--primary)]">{formatMoney(data.value, "INR")}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((entry) => (
                <Cell key={`cell-${entry.stageKey}`} fill={STAGE_COLORS[entry.stageKey] || "var(--primary)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Accessible Text/Table Breakdown */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--muted-foreground)]">
              <th className="py-1.5 font-medium">Stage</th>
              <th className="py-1.5 font-medium text-center">Deals</th>
              <th className="py-1.5 font-medium text-right">Value (INR)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {distribution.map((item) => (
              <tr key={item.stage} className="hover:bg-[var(--surface-muted)]">
                <td className="py-1.5 font-medium capitalize">{item.stage.replace("_", " ")}</td>
                <td className="py-1.5 font-mono text-center">{item.count}</td>
                <td className="py-1.5 font-semibold text-right">{formatMoney(item.total_value, "INR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
