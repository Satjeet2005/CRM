/**
 * SakaniUI Select Primitive for ForgeFlow
 *
 * Sourced from Sakani Design System (https://github.com/samzydd/Sakani-design-system)
 * Copyright (c) 2026 Samuel Okpere
 * Licensed under the MIT License.
 *
 * Adapted for ForgeFlow Enterprise CPQ (Next.js 16 App Router / React 19).
 */

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size" | "onChange"> {
  label?: string;
  description?: string;
  error?: string;
  size?: "sm" | "md" | "lg";
  placeholder?: string;
  options: SelectOption[];
  onChange?: (value: string) => void;
}

const SIZE_STYLES: Record<NonNullable<SelectProps["size"]>, string> = {
  sm: "h-8 text-xs py-1 pl-3 pr-8",
  md: "h-9.5 text-xs py-1.5 pl-3.5 pr-9",
  lg: "h-11 text-sm py-2 pl-4 pr-10",
};

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      description,
      error,
      size = "md",
      placeholder,
      options,
      value,
      defaultValue,
      onChange,
      disabled,
      id,
      className,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const selectId = id || generatedId;

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange?.(e.target.value);
    };

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-medium text-[var(--color-fg-default)]"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            value={value}
            defaultValue={defaultValue}
            onChange={handleChange}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${selectId}-error` : description ? `${selectId}-desc` : undefined}
            className={cn(
              "w-full appearance-none rounded-[var(--radius-md)] border bg-[var(--color-bg-surface)] text-[var(--color-fg-default)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
              error
                ? "border-[var(--color-danger-border)] focus-visible:outline-[var(--color-danger-500)]"
                : "border-[var(--color-border-default)] hover:border-[var(--color-border-strong)]",
              SIZE_STYLES[size],
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-[var(--color-fg-muted)]">
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </div>
        </div>
        {description && !error && (
          <p id={`${selectId}-desc`} className="text-[11px] text-[var(--color-fg-muted)]">
            {description}
          </p>
        )}
        {error && (
          <p id={`${selectId}-error`} className="text-[11px] text-[var(--color-danger-fg)]">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";
