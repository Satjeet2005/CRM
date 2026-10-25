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
      {/* Desktop Navigation: Sakani Card Shell with Indicator Variant */}
      <div className="hidden md:block rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-2 shadow-xs space-y-1">
        <div className="px-3 py-1.5 text-[11px] font-semibold tracking-[0.04em] uppercase text-[var(--color-fg-muted)] select-none">
          Settings
        </div>
        <div className="space-y-[2px]">
          {SETTINGS_NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-1.5 text-[14px] leading-5 font-medium transition-colors select-none",
                  "focus-visible:outline-2 focus-visible:outline-[var(--color-primary-500)] focus-visible:outline-offset-1 h-8 w-full",
                  isActive
                    ? "bg-[var(--color-bg-surface)] text-[var(--color-fg-default)] shadow-xs"
                    : "text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-canvas)] hover:text-[var(--color-fg-default)]"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {/* Active Indicator: 3px wide × 20px high canonical saffron pill at left */}
                {isActive && (
                  <span
                    className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-[var(--color-primary-500)]"
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
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Tablet & Mobile Navigation: Clean Responsive Horizontal Pill Bar */}
      <div className="block md:hidden pb-3 border-b border-[var(--color-border-subtle)]">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {SETTINGS_NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-1.5 text-[13px] font-medium leading-[18px] whitespace-nowrap transition-colors min-h-[34px]",
                  isActive
                    ? "bg-[var(--color-bg-canvas)] text-[var(--color-fg-default)] border border-[var(--color-border-subtle)] shadow-2xs font-semibold"
                    : "text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg-default)]"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isActive
                      ? "text-[var(--color-fg-default)]"
                      : "text-[var(--color-fg-muted)]"
                  )}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
