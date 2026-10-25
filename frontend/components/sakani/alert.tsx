/**
 * SakaniUI Alert Primitive for ForgeFlow
 *
 * Sourced from Sakani Design System (https://github.com/samzydd/Sakani-design-system)
 * Copyright (c) 2026 Samuel Okpere
 * Licensed under the MIT License.
 *
 * Adapted for ForgeFlow Enterprise CPQ (Next.js 16 App Router / React 19).
 */

import * as React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  color?: "info" | "success" | "warning" | "danger" | "neutral";
  title?: string;
  description?: string;
  icon?: React.ReactNode;
}

const COLOR_STYLES: Record<
  NonNullable<AlertProps["color"]>,
  { container: string; icon: string; title: string; desc: string; defaultIcon: React.ReactNode }
> = {
  info: {
    container: "bg-[var(--color-info-bg)] border-[var(--color-info-border)]",
    icon: "text-[var(--color-info-fg)]",
    title: "text-[var(--color-info-fg)]",
    desc: "text-[var(--color-info-fg)]",
    defaultIcon: <Info className="h-4 w-4 shrink-0" aria-hidden="true" />,
  },
  success: {
    container: "bg-[var(--color-success-bg)] border-[var(--color-success-border)]",
    icon: "text-[var(--color-success-fg)]",
    title: "text-[var(--color-success-fg)]",
    desc: "text-[var(--color-success-fg)]",
    defaultIcon: <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />,
  },
  warning: {
    container: "bg-[var(--color-warning-bg)] border-[var(--color-warning-border)]",
    icon: "text-[var(--color-warning-fg)]",
    title: "text-[var(--color-warning-fg)]",
    desc: "text-[var(--color-warning-fg)]",
    defaultIcon: <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />,
  },
  danger: {
    container: "bg-[var(--color-danger-bg)] border-[var(--color-danger-border)]",
    icon: "text-[var(--color-danger-fg)]",
    title: "text-[var(--color-danger-fg)]",
    desc: "text-[var(--color-danger-fg)]",
    defaultIcon: <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />,
  },
  neutral: {
    container: "bg-[var(--color-bg-subtle)] border-[var(--color-border-subtle)]",
    icon: "text-[var(--color-fg-muted)]",
    title: "text-[var(--color-fg-default)]",
    desc: "text-[var(--color-fg-muted)]",
    defaultIcon: <Info className="h-4 w-4 shrink-0" aria-hidden="true" />,
  },
};

export function Alert({
  color = "info",
  title,
  description,
  icon,
  className,
  children,
  role = "alert",
  ...props
}: AlertProps) {
  const styles = COLOR_STYLES[color] || COLOR_STYLES.info;
  const renderedIcon = icon !== undefined ? icon : styles.defaultIcon;

  return (
    <div
      role={role}
      className={cn(
        "flex items-start gap-3 rounded-[var(--radius-lg)] border p-3.5 text-xs transition-colors",
        styles.container,
        className
      )}
      {...props}
    >
      {renderedIcon && <div className={cn("mt-0.5", styles.icon)}>{renderedIcon}</div>}
      <div className="flex-1 space-y-0.5">
        {title && <h4 className={cn("font-semibold text-xs leading-none", styles.title)}>{title}</h4>}
        {description && <p className={cn("text-xs leading-relaxed", styles.desc)}>{description}</p>}
        {children}
      </div>
    </div>
  );
}
