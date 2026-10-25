import * as React from "react";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";

export interface UnsavedChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmDiscard: () => void;
}

export function UnsavedChangesDialog({
  open,
  onOpenChange,
  onConfirmDiscard,
}: UnsavedChangesDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Discard unsaved changes?"
      description="You have unsaved form edits. If you leave now, your changes will be discarded."
      confirmLabel="Discard Changes"
      cancelLabel="Keep Editing"
      variant="destructive"
      onConfirm={onConfirmDiscard}
    />
  );
}
