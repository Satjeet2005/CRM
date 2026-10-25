import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center text-xs", className)}>
      <ol className="flex items-center gap-1.5 text-[var(--color-fg-muted)]">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={index} className="flex items-center gap-1.5">
              {index > 0 && (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-40 text-[var(--color-fg-muted)]" aria-hidden="true" />
              )}
              {isLast || !item.href ? (
                <span
                  className={cn(
                    "font-medium truncate max-w-[200px]",
                    isLast ? "text-[var(--color-fg-default)] font-semibold" : "text-[var(--color-fg-muted)]"
                  )}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="hover:text-[var(--color-fg-default)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)]"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
