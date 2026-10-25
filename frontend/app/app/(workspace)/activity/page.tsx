"use client";

import * as React from "react";
import { ListFilter, Clock, Table as TableIcon } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Card, Select, Button } from "@/components/sakani";
import { useActivities } from "@/features/activity/api";
import { ActivityTable } from "@/features/activity/components/activity-table";
import { ActivityFeedView } from "@/features/activity/components/activity-feed-view";

const ENTITY_OPTIONS = [
  { label: "All Entity Types", value: "all" },
  { label: "Accounts", value: "account" },
  { label: "Contacts", value: "contact" },
  { label: "Opportunities", value: "opportunity" },
  { label: "Tasks", value: "task" },
  { label: "Catalog Products", value: "catalog_product" },
];

const EVENT_OPTIONS = [
  { label: "All Event Types", value: "all" },
  { label: "Stage Changes", value: "stage_change" },
  { label: "Task Completed", value: "task_completed" },
  { label: "Task Reopened", value: "task_reopened" },
  { label: "Account Created", value: "account_created" },
  { label: "Product Created", value: "product_created" },
];

export default function ActivityPage() {
  const [entityType, setEntityType] = React.useState<string>("all");
  const [eventType, setEventType] = React.useState<string>("all");
  const [viewMode, setViewMode] = React.useState<"timeline" | "table">("timeline");

  const { data, isLoading } = useActivities({
    entity_type: entityType !== "all" ? entityType : undefined,
    event_type: eventType !== "all" ? eventType : undefined,
    page_size: 100,
  });

  const activities = Array.isArray(data) ? data : data?.items ?? [];

  return (
    <PageContainer>
      <PageHeader
        title="Activity & Audit Stream"
        description="Immutable audit trail of record creations, stage transitions, task updates, and catalog events"
        breadcrumbs={[{ label: "Workspace", href: "/app/dashboard" }, { label: "Activity" }]}
      />

      {/* Filter and View Controls Toolbar */}
      <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--color-border-subtle)] pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-48">
            <Select
              aria-label="Filter by entity type"
              value={entityType}
              onChange={setEntityType}
              options={ENTITY_OPTIONS}
              size="sm"
            />
          </div>

          <div className="w-48">
            <Select
              aria-label="Filter by event type"
              value={eventType}
              onChange={setEventType}
              options={EVENT_OPTIONS}
              size="sm"
            />
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-0.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode("timeline")}
            className={`flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
              viewMode === "timeline"
                ? "bg-[var(--color-bg-surface)] text-[var(--color-fg-default)] shadow-xs"
                : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg-default)]"
            }`}
            aria-pressed={viewMode === "timeline"}
          >
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Timeline</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
              viewMode === "table"
                ? "bg-[var(--color-bg-surface)] text-[var(--color-fg-default)] shadow-xs"
                : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg-default)]"
            }`}
            aria-pressed={viewMode === "table"}
          >
            <TableIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Table</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="mt-4">
        {viewMode === "timeline" ? (
          <Card className="p-0 overflow-hidden">
            <div className="border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] px-6 py-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--color-fg-default)] flex items-center gap-2">
                <ListFilter className="h-3.5 w-3.5 text-[var(--color-fg-muted)]" aria-hidden="true" />
                <span>Audit Timeline Feed</span>
              </span>
              <span className="text-[11px] font-mono text-[var(--color-fg-muted)]">
                {isLoading ? "Loading..." : `${activities.length} events logged`}
              </span>
            </div>
            <ActivityFeedView data={activities} isLoading={isLoading} />
          </Card>
        ) : (
          <ActivityTable data={activities} isLoading={isLoading} />
        )}
      </div>
    </PageContainer>
  );
}
