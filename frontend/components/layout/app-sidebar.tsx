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
  onNavigate?: () => void;
}

export function AppSidebar({
  collapsed,
  onToggleCollapse,
  userPermissions = [],
  userRole,
  className,
  onNavigate,
}: AppSidebarProps) {
  const pathname = usePathname();

  // Group items by section: Workspace, Quoting, Administration
  const sections: ("Workspace" | "Quoting" | "Administration")[] = [
    "Workspace",
    "Quoting",
    "Administration",
  ];

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "relative flex flex-col h-full border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-canvas)] text-[var(--color-fg-default)] transition-all duration-200 z-30 select-none",
          collapsed ? "w-[64px]" : "w-[248px]",
          className
        )}
        aria-label="Application Sidebar"
      >
        {/* Brand Wordmark Header (44px min height touch target, 56px / 64px header shell) */}
        <div className="flex h-16 shrink-0 items-center border-b border-[var(--color-border-subtle)] px-3">
          <Link
            href="/app/dashboard"
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 font-bold tracking-tight text-[var(--color-fg-default)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary-500)] rounded-[var(--radius-sm)] min-h-[44px]",
              collapsed ? "w-full justify-center px-0" : "px-1.5"
            )}
            aria-label="ForgeFlow Home"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] text-[var(--color-fg-on-accent)] shadow-xs">
              <Workflow className="h-5 w-5" aria-hidden="true" />
            </div>
            {!collapsed && (
              <span className="text-lg font-semibold tracking-tight text-[var(--color-fg-default)]">
                ForgeFlow
              </span>
            )}
          </Link>
        </div>

        {/* Flexible Scrollable Navigation Region */}
        <div className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden pt-2 pb-4",
          collapsed ? "px-3" : "px-3"
        )}>
          <div className="space-y-4">
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
                <div key={section} className="space-y-0.5">
                  {/* Group Label (Sakani 243:4186: 28px height, 11px/16px 600, 4% tracking, fg/muted contrast-safe) */}
                  {!collapsed && (
                    <div className="h-7 pt-2 px-2.5 pb-1 flex items-center">
                      <span className="text-[11px] font-semibold tracking-[0.04em] uppercase text-[var(--color-fg-muted)]">
                        {section}
                      </span>
                    </div>
                  )}

                  <nav
                    className={cn("space-y-[2px]", collapsed && "flex flex-col items-center")}
                    aria-label={`${section} navigation`}
                  >
                    {visibleItems.map((item) => {
                      // Nested route matching: active if exact match or nested child route (except /app/dashboard)
                      const isActive =
                        item.href === "/app/dashboard"
                          ? pathname === "/app/dashboard"
                          : pathname === item.href || pathname.startsWith(`${item.href}/`);

                      const Icon = item.icon;

                      // Sakani Active Indicator Variant (243:4112) vs Default (243:4094) vs Collapsed (245:7728)
                      const linkContent = (
                        <Link
                          href={item.href}
                          onClick={onNavigate}
                          className={cn(
                            "relative flex items-center rounded-[var(--radius-md)] text-[14px] leading-5 font-medium transition-colors select-none",
                            "focus-visible:outline-2 focus-visible:outline-[var(--color-primary-500)] focus-visible:outline-offset-1",
                            collapsed
                              ? "h-8 w-8 justify-center p-0"
                              : "h-8 px-3 py-1.5 gap-2 w-full",
                            isActive
                              ? "bg-[var(--color-bg-surface)] text-[var(--color-fg-default)] shadow-xs"
                              : "text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-canvas)] hover:text-[var(--color-fg-default)] active:bg-[var(--color-bg-subtle)]"
                          )}
                          aria-current={isActive ? "page" : undefined}
                          aria-label={collapsed ? item.label : undefined}
                        >
                          {/* Active Indicator: 3px wide × 20px high canonical saffron pill at left */}
                          {isActive && (
                            <span
                              className={cn(
                                "absolute rounded-full bg-[var(--color-primary-500)]",
                                collapsed
                                  ? "-left-1 top-1.5 bottom-1.5 w-[3px]"
                                  : "left-0 top-1.5 bottom-1.5 w-[3px]"
                              )}
                              aria-hidden="true"
                            />
                          )}

                          <Icon
                            className={cn(
                              "h-[18px] w-[18px] shrink-0 transition-colors",
                              isActive
                                ? "text-[var(--color-fg-default)]"
                                : "text-[var(--color-fg-muted)] group-hover:text-[var(--color-fg-default)]"
                            )}
                            aria-hidden="true"
                          />

                          {!collapsed && (
                            <span className="truncate text-[14px] leading-5 font-medium">
                              {item.label}
                            </span>
                          )}
                        </Link>
                      );

                      if (collapsed) {
                        return (
                          <div key={item.id} className="py-[1px] flex justify-center w-full">
                            <Tooltip>
                              <TooltipTrigger render={(props) => <div {...props}>{linkContent}</div>} />
                              <TooltipContent side="right">
                                {item.label}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        );
                      }

                      return <div key={item.id}>{linkContent}</div>;
                    })}
                  </nav>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pinned Collapse Toggle at Bottom */}
        <div className="shrink-0 border-t border-[var(--color-border-subtle)] p-3">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex items-center justify-center gap-2 rounded-[var(--radius-md)] text-xs font-medium text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg-default)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary-500)] cursor-pointer transition-colors",
              collapsed ? "h-8 w-8 mx-auto p-0" : "w-full h-8 px-3"
            )}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
