import * as React from "react";
import { AlertDialog as BaseAlertDialog } from "@base-ui/react";
import { cn } from "@/lib/utils";

export const AlertDialog = BaseAlertDialog.Root;
export const AlertDialogTrigger = BaseAlertDialog.Trigger;
export const AlertDialogPortal = BaseAlertDialog.Portal;
export const AlertDialogClose = BaseAlertDialog.Close;

export function AlertDialogBackdrop({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof BaseAlertDialog.Backdrop>) {
  return (
    <BaseAlertDialog.Backdrop
      className={cn(
        "fixed inset-0 z-50 bg-black/50 backdrop-blur-xs transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
        className
      )}
      {...props}
    />
  );
}

export function AlertDialogPopup({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof BaseAlertDialog.Popup>) {
  return (
    <AlertDialogPortal>
      <AlertDialogBackdrop />
      <BaseAlertDialog.Popup
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg duration-200 rounded-[var(--radius-lg)] text-[var(--foreground)]",
          className
        )}
        {...props}
      >
        {children}
      </BaseAlertDialog.Popup>
    </AlertDialogPortal>
  );
}

export function AlertDialogTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof BaseAlertDialog.Title>) {
  return (
    <BaseAlertDialog.Title
      className={cn("text-lg font-semibold text-[var(--foreground)]", className)}
      {...props}
    />
  );
}

export function AlertDialogDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof BaseAlertDialog.Description>) {
  return (
    <BaseAlertDialog.Description
      className={cn("text-sm text-[var(--muted-foreground)]", className)}
      {...props}
    />
  );
}
