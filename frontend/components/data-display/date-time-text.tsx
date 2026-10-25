import * as React from "react";
import { formatDateTime } from "@/lib/formatters/formatters";
import { cn } from "@/lib/utils";

export interface DateTimeTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: string | Date | null | undefined;
  timeZone?: string;
  pattern?: string;
}

export function DateTimeText({
  value,
  timeZone = "Asia/Kolkata",
  pattern = "dd MMM yyyy, HH:mm",
  className,
  ...props
}: DateTimeTextProps) {
  const formatted = formatDateTime(value, timeZone, pattern);
  const isoString = value ? (typeof value === "string" ? value : value.toISOString()) : "";

  return (
    <time
      dateTime={isoString}
      title={isoString}
      className={cn("text-sm text-[var(--muted-foreground)]", className)}
      {...props}
    >
      {formatted}
    </time>
  );
}
