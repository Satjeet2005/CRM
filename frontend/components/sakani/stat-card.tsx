/**
 * Sakani StatCard (Executive KPI Tile) Primitive for ForgeFlow
 *
 * Sourced directly from Sakani Design System (https://github.com/samzydd/Sakani-design-system)
 * Copyright (c) 2026 Samuel Okpere. Licensed under the MIT License.
 *
 * Canonical Sakani CRM KPI card anatomy:
 * - Surface: var(--color-bg-surface) (#FFFFFF)
 * - Stroke: Figma outside align: box-shadow: 0 0 0 1px var(--color-border-subtle) (#E7E5E1)
 * - Corner Radius: 16px (var(--radius-xl))
 * - Padding: 12px (var(--space-12))
 * - Gap: 8px (var(--space-8)) between head, value, and meta
 * - Head (Title): Geist Sans, 14px, 20px line-height, weight 500, var(--color-fg-muted)
 * - Value (Metric): Geist Sans, 30px, line-height 1.1 (33px), weight 600, letter-spacing -0.02em, var(--color-fg-default)
 * - Meta (Supporting Row): 12px typography, 16px line-height, 6px gap
 * - Resulting natural height: ~109px (12 + 20 + 8 + 33 + 8 + 16 + 12 = 109px)
 */

import * as React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/sakani/badge";
import { cn } from "@/lib/utils";

export type StatCardTrend = "up" | "down" | "flat";

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: React.ReactNode;
  description?: React.ReactNode;
  delta?: string;
  trend?: StatCardTrend;
  badgeVariant?: BadgeVariant;
  action?: React.ReactNode;
  valueClassName?: string;
}

export function StatCard({
  title,
  value,
  description,
  delta,
  trend = "up",
  badgeVariant,
  action,
  valueClassName,
  className,
  ...props
}: StatCardProps) {
  const trendConfig = {
    up: {
      variant: "success" as const,
      icon: <TrendingUp className="h-3 w-3" />,
    },
    down: {
      variant: "danger" as const,
      icon: <TrendingDown className="h-3 w-3" />,
    },
    flat: {
      variant: "neutral" as const,
      icon: <Minus className="h-3 w-3" />,
    },
  };

  return (
    <div
      data-slot="stat-card"
      className={cn(
        "flex flex-col gap-2 p-3 bg-[var(--color-bg-surface)] rounded-[var(--radius-xl)] shadow-[0_0_0_1px_var(--color-border-subtle)] min-w-0 transition-colors font-sans",
        className
      )}
      {...props}
    >
      {/* 1. Metric Label (14px, 20px line-height, weight 500, Sakani muted) */}
      <div className="flex items-center gap-2 min-w-0">
        <span
          data-slot="stat-card-title"
          className="flex-1 text-sm font-medium leading-5 text-[var(--color-fg-muted)] truncate"
        >
          {title}
        </span>
      </div>

      {/* 2. Metric Value (30px, line-height 1.1, weight 600, tracking -0.02em) */}
      <div
        data-slot="stat-card-value"
        className={cn(
          "text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] text-[var(--color-fg-default)] tabular-nums truncate",
          valueClassName
        )}
      >
        {value}
      </div>

      {/* 3. Supporting Row (compact 12px, 16px line-height, 6px gap) */}
      {(delta || description || action) && (
        <div
          data-slot="stat-card-action"
          className="flex items-center gap-1.5 text-xs leading-4 min-w-0"
        >
          {delta && (
            <Badge
              variant={badgeVariant ?? trendConfig[trend].variant}
              emphasis="subtle"
              leftIcon={trendConfig[trend].icon}
              className="text-[11px] px-2 py-0.5 rounded-full"
            >
              {delta}
            </Badge>
          )}
          {description && (
            <span className="text-[var(--color-fg-muted)] truncate">{description}</span>
          )}
          {action && (
            <div className="truncate">{action}</div>
          )}
        </div>
      )}
    </div>
  );
}
