"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, ShieldCheck, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SettingsNavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
}

export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  {
    id: "overview",
    label: "Overview",
    href: "/app/settings",
    icon: LayoutDashboard,
    description: "Workspace summary and configuration links",
  },
  {
    id: "organization",
    label: "Organization",
    href: "/app/settings/organization",
    icon: Building2,
    description: "Tenant context, currency, and timezone",
  },
  {
    id: "security",
    label: "Security & Access",
    href: "/app/settings/security",
    icon: ShieldCheck,
    description: "Session identity and granted permissions",
  },
];

interface SettingsNavProps {
  className?: string;
}

export function SettingsNav({ className }: SettingsNavProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Settings navigation"
      className={cn("w-full md:w-60 shrink-0", className)}
    >
      {/* Desktop Navigation: Compact Vertical Column (Card shell) */}
      <div className="hidden md:block rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-2 shadow-xs space-y-1">
        <div className="px-3 py-2 text-[11px] font-semibold tracking-wider uppercase text-[var(--color-fg-muted)] select-none">
          Settings
        </div>
        <div className="space-y-0.5">
          {SETTINGS_NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-[13px] font-medium leading-[18px] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] min-h-[40px]",
                  isActive
                    ? "bg-[var(--color-primary-50)] text-[var(--color-primary-700)] font-semibold shadow-2xs border-l-2 border-[var(--color-primary-500)] dark:bg-[var(--color-primary-950)]/40 dark:text-[var(--color-primary-300)]"
                    : "text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg-default)]"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    isActive
                      ? "text-[var(--color-primary-500)]"
                      : "text-[var(--color-fg-muted)] group-hover:text-[var(--color-fg-default)]"
                  )}
                  aria-hidden="true"
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Tablet & Mobile Navigation: Responsive Horizontal Bar */}
      <div className="block md:hidden pb-3 border-b border-[var(--color-border-subtle)]">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {SETTINGS_NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium whitespace-nowrap rounded-[var(--radius-full)] border transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] min-h-[36px]",
                  isActive
                    ? "border-[var(--color-primary-500)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)] font-semibold dark:bg-[var(--color-primary-950)]/40 dark:text-[var(--color-primary-300)]"
                    : "border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg-default)] hover:bg-[var(--color-bg-subtle)]"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
