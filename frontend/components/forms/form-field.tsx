import * as React from "react";
import { InlineError } from "@/components/forms/inline-error";
import { cn } from "@/lib/utils";

export interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  id: string;
  label: string;
  required?: boolean;
  description?: string;
  error?: string | null;
  children: React.ReactNode;
}

export function FormField({
  id,
  label,
  required = false,
  description,
  error,
  children,
  className,
  ...props
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)} {...props}>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-[var(--foreground)]"
      >
        {label}
        {required && <span className="ml-1 text-[var(--destructive)]">*</span>}
      </label>
      {description && (
        <p className="text-xs text-[var(--muted-foreground)]">{description}</p>
      )}
      {children}
      <InlineError message={error} />
    </div>
  );
}
