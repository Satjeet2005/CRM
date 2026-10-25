import * as React from "react";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/layout/breadcrumbs";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-b border-[var(--color-border-subtle)] pb-5 md:flex-row md:items-center md:justify-between",
        className
      )}
    >
      <div className="space-y-1">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumbs items={breadcrumbs} className="mb-2" />
        )}
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-fg-default)] md:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-[var(--color-fg-muted)]">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
    </div>
  );
}
