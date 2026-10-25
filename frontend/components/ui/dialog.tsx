import * as React from "react";
import { Dialog as BaseDialog } from "@base-ui/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = BaseDialog.Root;
export const DialogTrigger = BaseDialog.Trigger;
export const DialogPortal = BaseDialog.Portal;
export const DialogClose = BaseDialog.Close;

export function DialogBackdrop({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof BaseDialog.Backdrop>) {
  return (
    <BaseDialog.Backdrop
      className={cn(
        "fixed inset-0 z-50 bg-black/50 backdrop-blur-xs transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
        className
      )}
      {...props}
    />
  );
}

export function DialogPopup({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof BaseDialog.Popup>) {
  return (
    <DialogPortal>
      <DialogBackdrop />
      <BaseDialog.Popup
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg duration-200 rounded-[var(--radius-lg)] text-[var(--foreground)]",
          className
        )}
        {...props}
      >
        {children}
        <BaseDialog.Close
          aria-label="Close dialog"
          className="absolute right-4 top-4 rounded-[var(--radius-sm)] p-1 opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-[var(--primary)] text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] cursor-pointer"
        >
          <X className="h-4 w-4" />
        </BaseDialog.Close>
      </BaseDialog.Popup>
    </DialogPortal>
  );
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof BaseDialog.Title>) {
  return (
    <BaseDialog.Title
      className={cn("text-lg font-semibold leading-none tracking-tight text-[var(--foreground)]", className)}
      {...props}
    />
  );
}

export function DialogDescription({
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

export const DialogContent = DialogPopup;

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 text-left", className)}
      {...props}
    />
  );
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2",
        className
      )}
      {...props}
    />
  );
}
