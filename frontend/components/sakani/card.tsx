/**
 * SakaniUI Card & StatCard Primitives for ForgeFlow
 *
 * Sourced from Sakani Design System (https://github.com/samzydd/Sakani-design-system)
 * Copyright (c) 2026 Samuel Okpere
 * Licensed under the MIT License.
 *
 * Adapted for ForgeFlow Enterprise CPQ (Next.js 16 App Router / React 19).
 */

import * as React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Badge } from "@/components/sakani/badge";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  interactive?: boolean;
}

export function Card({
  title,
  description,
  actions,
  interactive = false,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-xl)] bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] p-5 shadow-xs transition-shadow duration-200",
        interactive && "hover:shadow-md hover:border-[var(--color-border-default)] cursor-pointer",
        className
      )}
      {...props}
    >
      {(title || description || actions) && (
        <div className="flex items-start justify-between gap-4 pb-4">
          <div>
            {title && (
              <h3 className="text-base font-semibold text-[var(--color-fg-default)] tracking-tight">
                {title}
              </h3>
            )}
            {description && (
              <p className="mt-0.5 text-xs text-[var(--color-fg-muted)]">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string;
  description?: string;
  delta?: string;
  trend?: "up" | "down" | "flat";
  icon?: React.ReactNode;
}

export function StatCard({
  title,
  value,
  description,
  delta,
  trend = "flat",
  icon,
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
      className={cn(
        "rounded-[var(--radius-xl)] bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] p-5 shadow-xs flex flex-col justify-between",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[var(--color-fg-muted)] uppercase tracking-wider">
          {title}
        </span>
        {icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)] text-[var(--color-fg-muted)]">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3">
        <div className="text-2xl font-bold tracking-tight text-[var(--color-fg-default)] tabular-nums">
          {value}
        </div>

        {(delta || description) && (
          <div className="mt-2 flex items-center gap-2 text-xs">
            {delta && (
              <Badge
                variant={trendConfig[trend].variant}
                emphasis="subtle"
                leftIcon={trendConfig[trend].icon}
              >
                {delta}
              </Badge>
            )}
            {description && (
              <span className="text-[var(--color-fg-muted)] truncate">{description}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
