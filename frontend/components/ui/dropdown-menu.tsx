import * as React from "react";
import { Menu as BaseMenu } from "@base-ui/react";
import { cn } from "@/lib/utils";

export const DropdownMenu = BaseMenu.Root;
export const DropdownMenuTrigger = BaseMenu.Trigger;
export const DropdownMenuPortal = BaseMenu.Portal;
export const DropdownMenuSeparator = BaseMenu.Separator;

export function DropdownMenuContent({
  className,
  sideOffset = 4,
  align = "end",
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof BaseMenu.Popup> & {
  sideOffset?: number;
  align?: "start" | "end" | "center";
}) {
  return (
    <BaseMenu.Portal>
      <BaseMenu.Positioner sideOffset={sideOffset} align={align}>
        <BaseMenu.Popup
          className={cn(
            "z-50 min-w-[8rem] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-1 text-[var(--foreground)] shadow-md animate-in fade-in-80",
            className
          )}
          {...props}
        >
          {children}
        </BaseMenu.Popup>
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof BaseMenu.Item>) {
  return (
    <BaseMenu.Item
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-[var(--radius-sm)] px-2 py-1.5 text-sm outline-none transition-colors hover:bg-[var(--surface-muted)] focus:bg-[var(--surface-muted)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50 text-[var(--foreground)]",
        className
      )}
      {...props}
    />
  );
}
