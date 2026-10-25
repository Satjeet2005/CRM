import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InlineErrorProps extends React.HTMLAttributes<HTMLParagraphElement> {
  message?: string | null;
}

export function InlineError({ message, className, ...props }: InlineErrorProps) {
  if (!message) return null;

  return (
    <p
      role="alert"
      className={cn(
        "flex items-center gap-1.5 text-xs font-medium text-[var(--destructive)] mt-1.5",
        className
      )}
      {...props}
    >
      <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}
