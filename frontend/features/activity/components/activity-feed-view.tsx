"use client";

import * as React from "react";
import {
  Building2,
  Users,
  Briefcase,
  CheckSquare,
  Boxes,
  FileSpreadsheet,
  Activity as ActivityIcon,
} from "lucide-react";
import { ActivityFeed, Badge, type ActivityFeedItem } from "@/components/sakani";
import { formatDateTime } from "@/lib/formatters/formatters";
import type { Activity } from "../api";

interface ActivityFeedViewProps {
  data: Activity[];
  isLoading?: boolean;
}

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  account: <Building2 className="h-4 w-4" aria-hidden="true" />,
  contact: <Users className="h-4 w-4" aria-hidden="true" />,
  opportunity: <Briefcase className="h-4 w-4" aria-hidden="true" />,
  task: <CheckSquare className="h-4 w-4" aria-hidden="true" />,
  catalog_product: <Boxes className="h-4 w-4" aria-hidden="true" />,
  rfq: <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />,
};

function getBadgeVariant(eventType: string): "neutral" | "accent" | "success" | "warning" | "danger" | "info" {
  if (eventType.includes("archive") || eventType.includes("lost")) return "danger";
  if (eventType.includes("won") || eventType.includes("completed")) return "success";
  if (eventType.includes("reopened") || eventType.includes("pending")) return "warning";
  if (eventType.includes("create")) return "accent";
  return "info";
}

export function ActivityFeedView({ data, isLoading }: ActivityFeedViewProps) {
  if (isLoading) {
    return (
      <div className="space-y-4 p-6 animate-pulse">
        <div className="h-12 w-full rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)]" />
        <div className="h-12 w-full rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)]" />
        <div className="h-12 w-full rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)]" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-[var(--color-fg-muted)]">
        No activity records found matching the selected filters.
      </div>
    );
  }

  const feedItems: ActivityFeedItem[] = data.map((activity) => ({
    id: activity.id,
    actor: activity.actor_name || "System",
    description: (
      <span>
        {activity.summary}
      </span>
    ),
    timestamp: formatDateTime(activity.occurred_at),
    icon: ENTITY_ICONS[activity.entity_type] || <ActivityIcon className="h-4 w-4" aria-hidden="true" />,
    badge: (
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded-[var(--radius-xs)] bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] text-[var(--color-fg-muted)]">
          {activity.entity_type}
        </span>
        <Badge
          variant={getBadgeVariant(activity.event_type)}
          emphasis="subtle"
        >
          {activity.event_type.replace(/_/g, " ")}
        </Badge>
      </div>
    ),
  }));

  return (
    <div className="p-6">
      <ActivityFeed items={feedItems} />
    </div>
  );
}
