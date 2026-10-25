import * as React from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ErrorStateProps {
  title?: string;
  message?: string;
  requestId?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message = "An error occurred while loading this data. Please try again.",
  requestId,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--radius-md)] border border-[var(--destructive)]/20 bg-[var(--destructive-soft)] p-8 text-center text-[var(--foreground)]",
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--destructive)]/10 text-[var(--destructive)]">
        <AlertCircle className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-[var(--destructive)]">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-[var(--muted-foreground)]">{message}</p>
      {requestId && (
        <p className="mt-2 text-xs font-mono text-[var(--muted-foreground)]">
          Trace ID: {requestId}
        </p>
      )}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-6">
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Retry
        </Button>
      )}
    </div>
  );
}
