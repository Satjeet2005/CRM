/**
 * SakaniUI Accessible Sheet (Side Drawer) Primitive for ForgeFlow
 *
 * Implements Decision D3 (Option B): Wraps ForgeFlow's accessible Base UI Dialog
 * foundation in canonical Sakani surface, elevation, and border tokens.
 *
 * Sourced from Sakani Design System token geometry.
 * Copyright (c) 2026 Samuel Okpere (Tokens) & ForgeFlow Authors.
 * Licensed under the MIT License.
 */

"use client";

import * as React from "react";
import { Dialog as BaseDialog } from "@base-ui/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = BaseDialog.Root;
export const SheetTrigger = BaseDialog.Trigger;
export const SheetClose = BaseDialog.Close;
export const SheetPortal = BaseDialog.Portal;

export function SheetBackdrop({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof BaseDialog.Backdrop>) {
  return (
    <BaseDialog.Backdrop
      className={cn(
        "fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
        className
      )}
      {...props}
    />
  );
}

export interface SheetPopupProps
  extends React.ComponentPropsWithoutRef<typeof BaseDialog.Popup> {
  side?: "left" | "right";
  size?: "sm" | "md" | "lg" | "xl";
}

export function SheetPopup({
  side = "right",
  size = "md",
  className,
  children,
  ...props
}: SheetPopupProps) {
  const sizeMap = {
    sm: "sm:max-w-sm",
    md: "sm:max-w-md",
    lg: "sm:max-w-xl",
    xl: "sm:max-w-2xl",
  };

  return (
    <SheetPortal>
      <SheetBackdrop />
      <BaseDialog.Popup
        className={cn(
          "fixed z-50 flex flex-col bg-[var(--color-bg-surface)] text-[var(--color-fg-default)] shadow-xl transition-transform duration-220 ease-in-out",
          side === "right"
            ? "inset-y-0 right-0 h-full w-full border-l border-[var(--color-border-subtle)] data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full"
            : "inset-y-0 left-0 h-full w-full border-r border-[var(--color-border-subtle)] data-[starting-style]:-translate-x-full data-[ending-style]:-translate-x-full",
          sizeMap[size],
          className
        )}
        {...props}
      >
        {children}
        <BaseDialog.Close
          aria-label="Close panel"
          className="absolute right-4 top-4 rounded-[var(--radius-sm)] p-1.5 text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg-default)] focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] cursor-pointer transition-colors"
        >
          <X className="h-4 w-4" />
        </BaseDialog.Close>
      </BaseDialog.Popup>
    </SheetPortal>
  );
}

export function SheetHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 border-b border-[var(--color-border-subtle)] p-6 shrink-0",
        className
      )}
      {...props}
    />
  );
}

export function SheetTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof BaseDialog.Title>) {
  return (
    <BaseDialog.Title
      className={cn(
        "text-lg font-semibold tracking-tight text-[var(--color-fg-default)]",
        className
      )}
      {...props}
    />
  );
}

export function SheetDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof BaseDialog.Description>) {
  return (
    <BaseDialog.Description
      className={cn("text-xs text-[var(--color-fg-muted)]", className)}
      {...props}
    />
  );
}

export function SheetBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex-1 overflow-y-auto p-6 space-y-4", className)}
      {...props}
    />
  );
}

export function SheetFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-3 border-t border-[var(--color-border-subtle)] p-4 shrink-0 bg-[var(--color-bg-subtle)]",
        className
      )}
      {...props}
    />
  );
}
