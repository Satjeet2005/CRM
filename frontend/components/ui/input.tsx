import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.ComponentPropsWithoutRef<"input"> {
  hasError?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, hasError = false, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-[var(--radius-sm)] border bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:cursor-not-allowed disabled:opacity-50",
          hasError
            ? "border-[var(--destructive)] focus-visible:outline-[var(--destructive)]"
            : "border-[var(--border)] focus-visible:outline-[var(--primary)]",
          className
        )}
        ref={ref}
        aria-invalid={hasError ? "true" : undefined}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
