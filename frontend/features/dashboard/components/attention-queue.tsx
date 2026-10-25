"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Clock, ArrowRight, FileSpreadsheet, TrendingUp } from "lucide-react";
import {
  Badge,
  Sheet,
  SheetPopup,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
} from "@/components/sakani";
import type { AttentionItem } from "../api";

export interface AttentionQueueProps {
  items: AttentionItem[];
  isSheetOpen?: boolean;
  onSheetOpenChange?: (open: boolean) => void;
}

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export function AttentionQueue({
  items,
  isSheetOpen,
  onSheetOpenChange,
}: AttentionQueueProps) {
  const [internalSheetOpen, setInternalSheetOpen] = React.useState(false);
  const sheetOpen = isSheetOpen !== undefined ? isSheetOpen : internalSheetOpen;
  const setSheetOpen = onSheetOpenChange || setInternalSheetOpen;

  const sortedItems = React.useMemo(() => {
    return [...items].sort((a, b) => {
      const wA = SEVERITY_WEIGHT[a.severity] ?? 3;
      const wB = SEVERITY_WEIGHT[b.severity] ?? 3;
      if (wA !== wB) return wA - wB;
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      return 0;
    });
  }, [items]);

  const previewItems = React.useMemo(() => sortedItems.slice(0, 4), [sortedItems]);

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
    if (item.entity_type === "rfq") return item.entity_id ? `/app/rfqs/${item.entity_id}` : "/app/rfqs";
    return "/app/dashboard";
  };

  const getSeverityBadgeVariant = (severity: string): "danger" | "warning" | "info" => {
    if (severity === "critical") return "danger";
    if (severity === "warning") return "warning";
    return "info";
  };

  const renderIcon = (item: AttentionItem) => {
    if (item.severity === "critical") {
      return (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-danger-bg)] text-[var(--color-danger-fg)] border border-[var(--color-danger-border)]">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        </div>
      );
    }
    if (item.entity_type === "rfq") {
      return (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-warning-bg)] text-[var(--color-warning-fg)] border border-[var(--color-warning-border)]">
          <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
        </div>
      );
    }
    if (item.entity_type === "opportunity") {
      return (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-info-bg)] text-[var(--color-info-fg)] border border-[var(--color-info-border)]">
          <TrendingUp className="h-4 w-4" aria-hidden="true" />
        </div>
      );
    }
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-warning-bg)] text-[var(--color-warning-fg)] border border-[var(--color-warning-border)]">
        <Clock className="h-4 w-4" aria-hidden="true" />
      </div>
    );
  };

  const renderRow = (item: AttentionItem) => {
    const badgeVariant = getSeverityBadgeVariant(item.severity);

    return (
      <div
        key={item.id}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2.5 px-3 hover:bg-[var(--color-bg-subtle)]/50 transition-colors"
      >
        {/* Leading icon (32px) + Content (min-w-0 flex-1) */}
        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
          {renderIcon(item)}
          <div className="min-w-0 flex-1 flex flex-col justify-center">
            <h3 className="text-sm font-semibold leading-5 text-[var(--color-fg-default)] truncate">
              {item.title}
            </h3>
            <p className="text-[13px] font-medium leading-[18px] text-[var(--color-fg-muted)] truncate">
              {item.description}
            </p>
          </div>
        </div>

        {/* Severity Badge (consistent 80px column) + Action (consistent 96px column) */}
        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-11 sm:pl-0">
          <div className="w-20 shrink-0 flex items-center justify-center sm:justify-end">
            <Badge
              variant={badgeVariant}
              emphasis="subtle"
              className="w-[72px] justify-center text-center capitalize"
            >
              {item.severity}
            </Badge>
          </div>

          <div className="w-24 shrink-0 flex items-center justify-end">
            <Link
              href={getItemLink(item)}
              onClick={() => setSheetOpen(false)}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary-600)] hover:underline shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)]"
            >
              <span>View Details</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* 4 Preview Entries with subtle 1px row dividers */}
      <div className="divide-y divide-[var(--color-border-subtle)]">
        {previewItems.map((item) => renderRow(item))}
      </div>

      {/* Complete Mixed Queue Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetPopup size="lg">
          <SheetHeader>
            <SheetTitle>All attention items</SheetTitle>
            <SheetDescription>
              Complete prioritized queue of overdue tasks, urgent items, closing opportunities, and RFQ reviews.
            </SheetDescription>
          </SheetHeader>
          <SheetBody aria-label="All attention items list" className="p-4 divide-y divide-[var(--color-border-subtle)] space-y-0">
            {sortedItems.map((item) => renderRow(item))}
          </SheetBody>
        </SheetPopup>
      </Sheet>
    </>
  );
}
