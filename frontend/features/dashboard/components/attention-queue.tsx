"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Clock, ArrowRight } from "lucide-react";
import { Badge } from "@/components/sakani";
import { formatDate } from "@/lib/formatters/formatters";
import type { AttentionItem } from "../api";

interface AttentionQueueProps {
  items: AttentionItem[];
}

export function AttentionQueue({ items }: AttentionQueueProps) {
  if (!items || items.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] p-6 text-center text-xs text-[var(--color-fg-muted)]">
        No critical attention items pending. All tasks and deal actions are on track.
      </div>
    );
  }

  const getItemLink = (item: AttentionItem) => {
    if (item.entity_type === "task") return "/app/tasks";
    if (item.entity_type === "opportunity") return `/app/opportunities/${item.entity_id}`;
    if (item.entity_type === "account") return `/app/accounts/${item.entity_id}`;
    return "/app/dashboard";
  };

  return (
    <div className="divide-y divide-[var(--color-border-subtle)] rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] overflow-hidden">
      {items.map((item) => {
        const isCritical = item.severity === "critical";
        return (
          <div
            key={item.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 hover:bg-[var(--color-bg-subtle)] transition-colors"
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  isCritical
                    ? "bg-[var(--color-danger-bg)] text-[var(--color-danger-fg)]"
                    : "bg-[var(--color-warning-bg)] text-[var(--color-warning-fg)]"
                }`}
              >
                {isCritical ? (
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Clock className="h-4 w-4" aria-hidden="true" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold text-[var(--color-fg-default)]">{item.title}</h3>
                  <Badge
                    variant={isCritical ? "danger" : "warning"}
                    emphasis="subtle"
                  >
                    {item.severity}
                  </Badge>
                </div>
                <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">{item.description}</p>
                {item.due_date && (
                  <span className="text-[11px] font-mono text-[var(--color-danger-fg)] mt-1 block">
                    Target: {formatDate(item.due_date)}
                  </span>
                )}
              </div>
            </div>

            <Link
              href={getItemLink(item)}
              className="inline-flex items-center gap-1 self-start sm:self-center text-xs font-medium text-[var(--color-primary-600)] hover:underline shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)]"
            >
              <span>View Details</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        );
      })}
    </div>
  );
}
