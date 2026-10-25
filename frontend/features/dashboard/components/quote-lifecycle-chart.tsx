"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, Button } from "@/components/sakani";
import type { QuoteLifecycleSummary } from "../api";

interface QuoteLifecycleChartProps {
  data?: QuoteLifecycleSummary | null;
}

const QUOTE_STATUS_COLORS: Record<string, string> = {
  draft: "var(--color-chart-2)",
  pending_approval: "var(--color-chart-1)",
  approved: "var(--color-chart-6)",
  rejected: "var(--color-neutral-400)",
  expired: "var(--color-neutral-300)",
};

export function QuoteLifecycleChart({ data }: QuoteLifecycleChartProps) {
  const [showTable, setShowTable] = React.useState(false);
  const categories = data?.categories ?? [];
  const totalQuotes = data?.total_quotes ?? 0;

  // Max count among categories for relative bar width calculation
  const maxCount = Math.max(1, ...categories.map((c) => c.count));

  return (
    <Card className="p-5 border-[var(--color-border-default)] flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-[22px] text-[var(--color-fg-default)]">
            Quotation Lifecycle
          </h3>
          <p className="text-[13px] font-medium leading-[18px] text-[var(--color-fg-muted)] mt-0.5 line-clamp-1">
            See the current distribution of quotations across commercial review.
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
            href="/app/quotes"
            variant="outline"
            size="sm"
            rightIcon={<ArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" />}
            className="h-7 px-2.5 text-xs font-medium"
          >
            Quotes
          </Button>
        </div>
      </div>

      {/* Main Visualization: Horizontal Bars or Tabular Alternative */}
      {showTable ? (
        <div
          className="flex-1 w-full overflow-x-auto focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-sm)]"
          tabIndex={0}
          role="region"
          aria-label="Quotation Lifecycle Table Alternative"
        >
          <table className="w-full text-left border-collapse text-xs" role="table">
            <thead>
              <tr className="border-b border-[var(--color-border-subtle)] text-[var(--color-fg-muted)] font-medium">
                <th scope="col" className="pb-2">Lifecycle Stage</th>
                <th scope="col" className="pb-2 text-right">Count</th>
                <th scope="col" className="pb-2 text-right">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {categories.map((cat) => {
                const share = totalQuotes > 0 ? (cat.count / totalQuotes) * 100 : 0;
                return (
                  <tr key={cat.status} className="transition-colors hover:bg-[var(--color-bg-subtle)]/50">
                    <td className="py-2.5 font-medium text-[var(--color-fg-default)]">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: QUOTE_STATUS_COLORS[cat.status] || "var(--color-chart-2)" }}
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
                <td className="pt-2.5">Total Quotes</td>
                <td className="pt-2.5 text-right tabular-nums">{totalQuotes}</td>
                <td className="pt-2.5 text-right font-mono">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div
          className="flex-1 space-y-3.5 py-1 min-h-[190px] flex flex-col justify-center"
          role="region"
          aria-label="Quotation Lifecycle Horizontal Bar Chart"
        >
          {categories.map((cat) => {
            const barWidthPercent = cat.count > 0 ? Math.max(12, (cat.count / maxCount) * 100) : 0;
            const color = QUOTE_STATUS_COLORS[cat.status] || "var(--color-chart-2)";
            return (
              <div key={cat.status} className="space-y-1.5 group">
                <div className="flex items-center justify-between text-xs font-medium">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                    <span className="text-[var(--color-fg-default)] truncate">{cat.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 tabular-nums">
                    <span
                      className={`text-xs ${
                        cat.count > 0
                          ? "font-semibold text-[var(--color-fg-default)]"
                          : "text-[var(--color-fg-muted)]"
                      }`}
                    >
                      {cat.count}
                    </span>
                    <span className="text-[11px] text-[var(--color-fg-muted)] font-mono">
                      {cat.count === 1 ? "quote" : "quotes"}
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
                  aria-label={`${cat.label}: ${cat.count} quotes`}
                >
                  <div
                    className="h-full rounded-[var(--radius-full)] transition-all duration-300"
                    style={{
                      width: `${barWidthPercent}%`,
                      backgroundColor: color,
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
        <span>Active pipeline: {totalQuotes} total quotations</span>
        <Link
          href="/app/quotes"
          className="text-[var(--color-primary-600)] hover:underline inline-flex items-center gap-1 font-medium"
        >
          <span>Manage quotes</span>
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
    </Card>
  );
}
