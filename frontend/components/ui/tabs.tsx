import * as React from "react";
import { Tabs as BaseTabs } from "@base-ui/react";
import { cn } from "@/lib/utils";

export const Tabs = BaseTabs.Root;

export function TabsList({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof BaseTabs.List>) {
  return (
    <BaseTabs.List
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-muted)] p-1 text-[var(--muted-foreground)]",
        className
      )}
      {...props}
    />
  );
}

export function TabsTab({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof BaseTabs.Tab>) {
  return (
    <BaseTabs.Tab
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-2 focus-visible:outline-[var(--primary)] disabled:pointer-events-none disabled:opacity-50 data-[selected]:bg-[var(--surface)] data-[selected]:text-[var(--foreground)] data-[selected]:shadow-2xs cursor-pointer",
        className
      )}
      {...props}
    />
  );
}

export function TabsPanel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof BaseTabs.Panel>) {
  return (
    <BaseTabs.Panel
      className={cn(
        "mt-2 focus-visible:outline-2 focus-visible:outline-[var(--primary)]",
        className
      )}
      {...props}
    />
  );
}
