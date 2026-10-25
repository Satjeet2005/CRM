import * as React from "react";
import { Dialog as BaseDialog } from "@base-ui/react";
import { X } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const Sheet = BaseDialog.Root;
export const SheetTrigger = BaseDialog.Trigger;
export const SheetClose = BaseDialog.Close;
export const SheetPortal = BaseDialog.Portal;

export function SheetBackdrop({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof BaseDialog.Backdrop>) {
  return (
    <BaseDialog.Backdrop
      className={cn(
        "fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
        className
      )}
      {...props}
    />
  );
}

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-[var(--surface)] p-6 shadow-xl transition ease-in-out data-[ending-style]:duration-200 data-[starting-style]:duration-200 text-[var(--foreground)]",
  {
    variants: {
      side: {
        right:
          "inset-y-0 right-0 h-full w-3/4 border-l border-[var(--border)] sm:max-w-md data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full",
        left:
          "inset-y-0 left-0 h-full w-3/4 border-r border-[var(--border)] sm:max-w-md data-[starting-style]:-translate-x-full data-[ending-style]:-translate-x-full",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
);

interface SheetPopupProps
  extends React.ComponentPropsWithoutRef<typeof BaseDialog.Popup>,
    VariantProps<typeof sheetVariants> {}

export function SheetPopup({
  side = "right",
  className,
  children,
  ...props
}: SheetPopupProps) {
  return (
    <SheetPortal>
      <SheetBackdrop />
      <BaseDialog.Popup
        className={cn(sheetVariants({ side }), className)}
        {...props}
      >
        {children}
        <BaseDialog.Close
          aria-label="Close sheet"
          className="absolute right-4 top-4 rounded-[var(--radius-sm)] p-1 opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-[var(--primary)] text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] cursor-pointer"
        >
          <X className="h-4 w-4" />
        </BaseDialog.Close>
      </BaseDialog.Popup>
    </SheetPortal>
  );
}

export function SheetTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof BaseDialog.Title>) {
  return (
    <BaseDialog.Title
      className={cn("text-lg font-semibold text-[var(--foreground)]", className)}
      {...props}
    />
  );
}

export function SheetDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof BaseDialog.Description>) {
  return (
    <BaseDialog.Description
      className={cn("text-sm text-[var(--muted-foreground)]", className)}
      {...props}
    />
  );
}
