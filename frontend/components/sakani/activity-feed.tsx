/**
 * SakaniUI ActivityFeed Primitive for ForgeFlow
 *
 * Sourced from Sakani Design System (https://github.com/samzydd/Sakani-design-system)
 * Copyright (c) 2026 Samuel Okpere
 * Licensed under the MIT License.
 *
 * Adapted for ForgeFlow Enterprise CPQ (Next.js 16 App Router / React 19).
 */

import * as React from "react";
import { Avatar } from "@/components/sakani/avatar";
import { cn } from "@/lib/utils";

export interface ActivityFeedItem {
  id?: string | number;
  actor: string;
  description: React.ReactNode;
  timestamp: string;
  icon?: React.ReactNode;
  avatarSrc?: string;
  avatarAlt?: string;
  badge?: React.ReactNode;
}

export interface ActivityFeedProps extends React.HTMLAttributes<HTMLDivElement> {
  items: ActivityFeedItem[];
  variant?: "default" | "compact";
}

export function ActivityFeedHighlight({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("font-semibold text-[var(--color-fg-default)]", className)}>
      {children}
    </span>
  );
}

export function ActivityFeed({
  items,
  variant = "default",
  className,
  ...props
}: ActivityFeedProps) {
  if (!items || items.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-[var(--color-fg-muted)]">
        No activities to display.
      </div>
    );
  }

  return (
    <div className={cn("relative flow-root", className)} {...props}>
      <ul role="list" className="-mb-8">
        {items.map((item, itemIdx) => {
          const isLast = itemIdx === items.length - 1;
          const actorInitials = item.actor
            ? item.actor
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
            : "FF";

          return (
            <li key={item.id ?? itemIdx} className="relative pb-8">
              {!isLast && (
                <span
                  className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-[var(--color-border-subtle)]"
                  aria-hidden="true"
                />
              )}
              <div className="relative flex items-start space-x-3.5">
                <div className="relative">
                  {item.icon ? (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] text-[var(--color-fg-muted)] shadow-2xs">
                      {item.icon}
                    </div>
                  ) : (
                    <Avatar
                      size="sm"
                      src={item.avatarSrc}
                      alt={item.avatarAlt || item.actor}
                      initials={actorInitials}
                      className="shadow-2xs"
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs">
                    <p className="text-[var(--color-fg-muted)] leading-relaxed">
                      <span className="font-semibold text-[var(--color-fg-default)] mr-1.5">
                        {item.actor}
                      </span>
                      {item.description}
                    </p>
                    <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                      {item.badge}
                      <time
                        dateTime={item.timestamp}
                        className="text-[11px] font-mono text-[var(--color-fg-muted)]"
                      >
                        {item.timestamp}
                      </time>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
