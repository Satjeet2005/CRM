import * as React from "react";
import { Separator as BaseSeparator } from "@base-ui/react";
import { cn } from "@/lib/utils";

export function Separator({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentPropsWithoutRef<typeof BaseSeparator> & {
  orientation?: "horizontal" | "vertical";
}) {
  return (
    <BaseSeparator
      className={cn(
        "shrink-0 bg-[var(--border)]",
        orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
        className
      )}
      {...props}
    />
  );
}
