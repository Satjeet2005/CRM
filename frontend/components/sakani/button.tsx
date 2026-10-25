/**
 * SakaniUI Button Primitive for ForgeFlow
 *
 * Sourced from Sakani Design System (https://github.com/samzydd/Sakani-design-system)
 * Copyright (c) 2026 Samuel Okpere
 * Licensed under the MIT License.
 *
 * Adapted for ForgeFlow Enterprise CPQ (Next.js 16 App Router / React 19).
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive";

export type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isLoading?: boolean;
  href?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      leftIcon,
      rightIcon,
      isLoading = false,
      disabled,
      href,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    const variantStyles: Record<ButtonVariant, string> = {
      primary:
        "bg-[var(--color-primary-500)] text-white hover:bg-[var(--color-primary-600)] active:bg-[var(--color-primary-700)] shadow-xs border border-transparent",
      secondary:
        "bg-[var(--color-bg-surface)] text-[var(--color-fg-default)] border border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-subtle)] hover:border-[var(--color-border-default)] shadow-xs",
      outline:
        "bg-transparent text-[var(--color-fg-default)] border border-[var(--color-border-default)] hover:bg-[var(--color-bg-subtle)]",
      ghost:
        "bg-transparent text-[var(--color-fg-default)] border border-transparent hover:bg-[var(--color-bg-subtle)]",
      destructive:
        "bg-[var(--color-danger-500)] text-white hover:bg-[var(--color-danger-600)] active:bg-[var(--color-danger-700)] shadow-xs border border-transparent",
    };

    const sizeStyles: Record<ButtonSize, string> = {
      sm: "h-8 px-3 text-xs gap-1.5 rounded-[var(--radius-md)]",
      md: "h-10 px-4 text-sm gap-2 rounded-[var(--radius-md)]",
      lg: "h-11 px-5 text-base gap-2.5 rounded-[var(--radius-md)]",
      icon: "h-9 w-9 p-0 rounded-[var(--radius-md)]",
    };

    if (href) {
      return (
        <Link
          href={href}
          className={cn(
            "inline-flex items-center justify-center font-medium select-none cursor-pointer whitespace-nowrap",
            "transition-all duration-150 ease-out active:scale-[0.98]",
            "focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] focus-visible:outline-offset-2",
            variantStyles[variant],
            sizeStyles[size],
            className
          )}
        >
          {leftIcon && <span className="inline-flex shrink-0 items-center">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="inline-flex shrink-0 items-center">{rightIcon}</span>}
        </Link>
      );
    }

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-busy={isLoading}
        className={cn(
          "inline-flex items-center justify-center font-medium select-none cursor-pointer whitespace-nowrap",
          "transition-all duration-150 ease-out active:scale-[0.98]",
          "focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] focus-visible:outline-offset-2",
          "disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
        ) : (
          leftIcon && <span className="inline-flex shrink-0 items-center">{leftIcon}</span>
        )}
        {children}
        {!isLoading && rightIcon && (
          <span className="inline-flex shrink-0 items-center">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = "SakaniButton";
