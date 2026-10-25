"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Clock, ArrowRight, ExternalLink } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/formatters/formatters";
import type { AttentionItem } from "../api";

interface AttentionQueueProps {
  items: AttentionItem[];
}

export function AttentionQueue({ items }: AttentionQueueProps) {
  if (!items || items.length === 0) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] p-6 text-center text-xs text-[var(--muted-foreground)]">
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
    <div className="divide-y divide-[var(--border)] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]">
      {items.map((item) => {
        const isCritical = item.severity === "critical";
        return (
          <div
            key={item.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 hover:bg-[var(--surface-muted)] transition-colors"
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  isCritical
                    ? "bg-[var(--danger-soft)] text-[var(--danger)]"
                    : "bg-[var(--warning-soft)] text-[var(--warning)]"
                }`}
              >
                {isCritical ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <Clock className="h-4 w-4" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold text-[var(--foreground)]">{item.title}</h3>
                  <StatusBadge
                    label={item.severity}
                    variant={isCritical ? "destructive" : "warning"}
                  />
                </div>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{item.description}</p>
                {item.due_date && (
                  <span className="text-[11px] font-mono text-[var(--danger)] mt-1 block">
                    Target: {formatDate(item.due_date)}
                  </span>
                )}
              </div>
            </div>

            <Link
              href={getItemLink(item)}
              className="inline-flex items-center gap-1 self-start sm:self-center text-xs font-medium text-[var(--primary)] hover:underline shrink-0"
            >
              <span>View Details</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        );
      })}
    </div>
  );
}
