/**
 * SakaniUI Input & Textarea Primitives for ForgeFlow
 *
 * Sourced from Sakani Design System (https://github.com/samzydd/Sakani-design-system)
 * Copyright (c) 2026 Samuel Okpere
 * Licensed under the MIT License.
 *
 * Adapted for ForgeFlow Enterprise CPQ (Next.js 16 App Router / React 19).
 * Mandatory CPQ Invariant: Form inputs preserve raw string values for Python Decimal calculation.
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  description?: string;
  error?: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, description, error, leadingIcon, trailingIcon, disabled, id, className, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-[var(--color-fg-default)]"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leadingIcon && (
            <div className="absolute left-3 flex items-center text-[var(--color-fg-muted)] pointer-events-none" aria-hidden="true">
              {leadingIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${inputId}-error` : description ? `${inputId}-desc` : undefined}
            className={cn(
              "h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 text-sm text-[var(--color-fg-default)] shadow-xs transition-colors",
              "placeholder:text-[var(--color-neutral-400)]",
              "focus-visible:border-[var(--color-border-focus)] focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)]/20",
              "disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-fg-muted)] disabled:cursor-not-allowed",
              leadingIcon && "pl-9",
              trailingIcon && "pr-9",
              error && "border-[var(--color-danger-500)] focus-visible:border-[var(--color-danger-500)] focus-visible:outline-[var(--color-danger-500)]/20",
              className
            )}
            {...props}
          />
          {trailingIcon && (
            <div className="absolute right-3 flex items-center text-[var(--color-fg-muted)]">
              {trailingIcon}
            </div>
          )}
        </div>
        {description && !error && (
          <p id={`${inputId}-desc`} className="text-xs text-[var(--color-fg-muted)]">
            {description}
          </p>
        )}
        {error && (
          <p id={`${inputId}-error`} className="text-xs font-medium text-[var(--color-danger-500)]" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "SakaniInput";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  description?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, description, error, disabled, id, className, ...props }, ref) => {
    const generatedId = React.useId();
    const textareaId = id || generatedId;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-xs font-semibold text-[var(--color-fg-default)]"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${textareaId}-error` : description ? `${textareaId}-desc` : undefined}
          className={cn(
            "w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-3 text-sm text-[var(--color-fg-default)] shadow-xs transition-colors min-h-[80px]",
            "placeholder:text-[var(--color-neutral-400)]",
            "focus-visible:border-[var(--color-border-focus)] focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)]/20",
            "disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-fg-muted)] disabled:cursor-not-allowed",
            error && "border-[var(--color-danger-500)] focus-visible:border-[var(--color-danger-500)]",
            className
          )}
          {...props}
        />
        {description && !error && (
          <p id={`${textareaId}-desc`} className="text-xs text-[var(--color-fg-muted)]">
            {description}
          </p>
        )}
        {error && (
          <p id={`${textareaId}-error`} className="text-xs font-medium text-[var(--color-danger-500)]" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Textarea.displayName = "SakaniTextarea";
