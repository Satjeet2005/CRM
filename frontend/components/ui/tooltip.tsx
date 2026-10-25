import * as React from "react";
import { Tooltip as BaseTooltip } from "@base-ui/react";
import { cn } from "@/lib/utils";

export const TooltipProvider = BaseTooltip.Provider;
export const Tooltip = BaseTooltip.Root;
export const TooltipTrigger = BaseTooltip.Trigger;

export function TooltipContent({
  className,
  sideOffset = 4,
  side = "top",
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof BaseTooltip.Popup> & {
  sideOffset?: number;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <BaseTooltip.Portal>
      <BaseTooltip.Positioner sideOffset={sideOffset} side={side}>
        <BaseTooltip.Popup
          className={cn(
            "z-50 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--sidebar)] px-2.5 py-1 text-xs text-[var(--sidebar-foreground)] shadow-md animate-in fade-in-0 zoom-in-95",
            className
          )}
          {...props}
        >
          {children}
          <BaseTooltip.Arrow className="fill-[var(--sidebar)]" />
        </BaseTooltip.Popup>
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  );
}
