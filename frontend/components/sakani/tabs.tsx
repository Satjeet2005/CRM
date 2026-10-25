/**
 * SakaniUI Tabs Primitive for ForgeFlow
 *
 * Sourced from Sakani Design System (https://github.com/samzydd/Sakani-design-system)
 * Copyright (c) 2026 Samuel Okpere
 * Licensed under the MIT License.
 *
 * Adapted for ForgeFlow Enterprise CPQ (Next.js 16 App Router / React 19).
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  bordered?: boolean;
  fill?: boolean;
}

export function Tabs({
  items,
  value,
  defaultValue,
  onChange,
  bordered = true,
  fill = false,
  className,
  ...props
}: TabsProps) {
  const [internalValue, setInternalValue] = React.useState<string>(() => {
    return value ?? defaultValue ?? items[0]?.value ?? "";
  });

  const activeValue = value !== undefined ? value : internalValue;

  const handleSelect = (tabVal: string) => {
    if (value === undefined) {
      setInternalValue(tabVal);
    }
    onChange?.(tabVal);
  };

  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={cn(
        "flex items-center gap-1 overflow-x-auto no-scrollbar",
        bordered && "border-b border-[var(--color-border-subtle)]",
        className
      )}
      {...props}
    >
      {items.map((tab) => {
        const isActive = tab.value === activeValue;
        return (
          <button
            key={tab.value}
            role="tab"
            type="button"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => handleSelect(tab.value)}
            className={cn(
              "relative inline-flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-t-[var(--radius-sm)] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40",
              fill && "flex-1",
              isActive
                ? "text-[var(--color-primary-600)] font-semibold"
                : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg-default)] hover:bg-[var(--color-bg-subtle)]"
            )}
          >
            {tab.icon && <span aria-hidden="true" className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge && <span className="ml-1">{tab.badge}</span>}
            {isActive && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary-500)]"
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
