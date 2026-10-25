/**
 * SakaniUI Badge Primitive for ForgeFlow
 *
 * Sourced from Sakani Design System (https://github.com/samzydd/Sakani-design-system)
 * Copyright (c) 2026 Samuel Okpere
 * Licensed under the MIT License.
 *
 * Adapted for ForgeFlow Enterprise CPQ (Next.js 16 App Router / React 19).
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "itar"
  | "deviation"
  | "maker_checker";

export type BadgeEmphasis = "subtle" | "solid";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  emphasis?: BadgeEmphasis;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
}

export function Badge({
  variant = "neutral",
  emphasis = "subtle",
  leftIcon,
  rightIcon,
  children,
  className,
  ...props
}: BadgeProps) {
  const stylesMap: Record<BadgeVariant, Record<BadgeEmphasis, string>> = {
    neutral: {
      subtle: "bg-[var(--color-neutral-100)] text-[var(--color-neutral-700)] dark:bg-[var(--color-neutral-800)] dark:text-[var(--color-neutral-300)]",
      solid: "bg-[var(--color-neutral-900)] text-white dark:bg-[var(--color-neutral-100)] dark:text-[var(--color-neutral-900)]",
    },
    accent: {
      subtle: "bg-[var(--color-primary-50)] text-[var(--color-primary-700)] dark:bg-[var(--color-primary-900)]/40 dark:text-[var(--color-primary-300)]",
      solid: "bg-[var(--color-primary-500)] text-white",
    },
    success: {
      subtle: "bg-[var(--color-success-bg)] text-[var(--color-success-fg)] dark:bg-[var(--color-success-bg)] dark:text-[var(--color-success-fg)]",
      solid: "bg-[var(--color-success-500)] text-white",
    },
    warning: {
      subtle: "bg-[var(--color-warning-bg)] text-[var(--color-warning-fg)] dark:bg-[var(--color-warning-bg)] dark:text-[var(--color-warning-fg)]",
      solid: "bg-[var(--color-warning-500)] text-white",
    },
    danger: {
      subtle: "bg-[var(--color-danger-bg)] text-[var(--color-danger-fg)] dark:bg-[var(--color-danger-bg)] dark:text-[var(--color-danger-fg)]",
      solid: "bg-[var(--color-danger-500)] text-white",
    },
    info: {
      subtle: "bg-[var(--color-info-bg)] text-[var(--color-info-fg)] dark:bg-[var(--color-info-bg)] dark:text-[var(--color-info-fg)]",
      solid: "bg-[var(--color-info-500)] text-white",
    },
    // Domain-specific manufacturing compliance badges
    itar: {
      subtle: "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
      solid: "bg-red-700 text-white font-semibold",
    },
    deviation: {
      subtle: "bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
      solid: "bg-amber-600 text-white",
    },
    maker_checker: {
      subtle: "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300",
      solid: "bg-purple-700 text-white",
    },
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-[var(--radius-full)] leading-none select-none",
        stylesMap[variant][emphasis],
        className
      )}
      {...props}
    >
      {leftIcon && <span className="inline-flex shrink-0 items-center" aria-hidden="true">{leftIcon}</span>}
      <span>{children}</span>
      {rightIcon && <span className="inline-flex shrink-0 items-center" aria-hidden="true">{rightIcon}</span>}
    </span>
  );
}
