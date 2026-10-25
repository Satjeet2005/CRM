"use client";

import * as React from "react";
import { History, Filter } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { useActivities } from "@/features/activity/api";
import { ActivityTable } from "@/features/activity/components/activity-table";

export default function ActivityPage() {
  const [entityType, setEntityType] = React.useState<string>("all");
  const [eventType, setEventType] = React.useState<string>("all");

  const { data, isLoading } = useActivities({
    entity_type: entityType !== "all" ? entityType : undefined,
    event_type: eventType !== "all" ? eventType : undefined,
    limit: 100,
  });

  return (
    <PageContainer>
      <PageHeader
        title="Activity & Audit Stream"
        description="Immutable audit trail of record creations, stage transitions, task updates, and catalog events"
        breadcrumbs={[{ label: "Workspace", href: "/app/dashboard" }, { label: "Activity" }]}
      />

      {/* Filter Bar */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <select
          aria-label="Filter by entity type"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
        >
          <option value="all">All Entity Types</option>
          <option value="account">Accounts</option>
          <option value="contact">Contacts</option>
          <option value="opportunity">Opportunities</option>
          <option value="task">Tasks</option>
          <option value="catalog_product">Catalog Products</option>
        </select>

        <select
          aria-label="Filter by event type"
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
        >
          <option value="all">All Event Types</option>
          <option value="stage_change">Stage Changes</option>
          <option value="task_completed">Task Completed</option>
          <option value="task_reopened">Task Reopened</option>
          <option value="account_created">Account Created</option>
          <option value="product_created">Product Created</option>
        </select>
      </div>

      {/* Activity Table */}
      <div className="mt-4">
        <ActivityTable data={data || []} isLoading={isLoading} />
      </div>
    </PageContainer>
  );
}
