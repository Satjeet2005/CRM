"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Workflow,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { NAVIGATION_REGISTRY } from "@/features/navigation/feature-registry";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  userPermissions?: string[];
  userRole?: string | null;
  className?: string;
}

export function AppSidebar({
  collapsed,
  onToggleCollapse,
  userPermissions = [],
  userRole,
  className,
}: AppSidebarProps) {
  const pathname = usePathname();

  // Group items by section
  const sections: ("Workspace" | "Quoting" | "Administration")[] = [
    "Workspace",
    "Quoting",
    "Administration",
  ];

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "relative flex flex-col border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] text-[var(--color-fg-default)] transition-all duration-200 z-30",
          collapsed ? "w-[64px]" : "w-[248px]",
          className
        )}
      >
        {/* Brand Wordmark Header */}
        <div className="flex h-16 items-center border-b border-[var(--color-border-subtle)] px-4">
          <Link
            href="/app/dashboard"
            className="flex items-center gap-2.5 font-bold tracking-tight text-[var(--color-fg-default)] focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-sm)]"
            aria-label="ForgeFlow Home"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] text-white shadow-xs">
              <Workflow className="h-5 w-5" aria-hidden="true" />
            </div>
            {!collapsed && (
              <span className="text-lg font-semibold tracking-tight text-[var(--color-fg-default)]">
                ForgeFlow
              </span>
            )}
          </Link>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {sections.map((section) => {
            const items = NAVIGATION_REGISTRY.filter((item) => item.section === section);

            // Filter out items that explicitly require a permission the user lacks
            const visibleItems = items.filter((item) => {
              if (item.requiredPermission && !userPermissions.includes(item.requiredPermission)) {
                if (userRole !== "admin") return false;
              }
              return true;
            });

            if (visibleItems.length === 0) return null;

            return (
              <div key={section} className="space-y-1">
                {!collapsed && (
                  <h4 className="px-3 text-[11px] font-semibold tracking-wider uppercase text-[var(--color-fg-muted)]">
                    {section}
                  </h4>
                )}
                <nav className="space-y-0.5" aria-label={`${section} navigation`}>
                  {visibleItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    if (!item.enabled) {
                      if (collapsed) return null;
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between rounded-[var(--radius-md)] px-3 py-2 text-xs font-medium text-[var(--color-fg-muted)]/50 cursor-not-allowed select-none"
                          title={`Available in Phase ${item.phase}`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon className="h-4 w-4 shrink-0 opacity-40" aria-hidden="true" />
                            <span>{item.label}</span>
                          </div>
                          <span className="rounded bg-[var(--color-bg-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--color-fg-muted)]">
                            P{item.phase}
                          </span>
                        </div>
                      );
                    }

                    const linkContent = (
                      <Link
                        href={item.href}
                        className={cn(
                          "group flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)]",
                          isActive
                            ? "bg-[var(--color-primary-50)] text-[var(--color-primary-700)] dark:bg-[var(--color-primary-900)]/30 dark:text-[var(--color-primary-300)] font-semibold shadow-2xs border-l-2 border-[var(--color-primary-500)]"
                            : "text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg-default)]"
                        )}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0 transition-colors",
                            isActive ? "text-[var(--color-primary-500)]" : "text-[var(--color-fg-muted)] group-hover:text-[var(--color-fg-default)]"
                          )}
                          aria-hidden="true"
                        />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    );

                    if (collapsed) {
                      return (
                        <Tooltip key={item.id}>
                          <TooltipTrigger render={(props) => <div {...props}>{linkContent}</div>} />
                          <TooltipContent side="right">
                            {item.label}
                          </TooltipContent>
                        </Tooltip>
                      );
                    }

                    return <div key={item.id}>{linkContent}</div>;
                  })}
                </nav>
              </div>
            );
          })}
        </div>

        {/* Collapse toggle at bottom */}
        <div className="border-t border-[var(--color-border-subtle)] p-3">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] p-2 text-xs font-medium text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg-default)] focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] cursor-pointer transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
