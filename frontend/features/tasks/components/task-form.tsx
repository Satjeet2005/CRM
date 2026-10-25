"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useCreateTask, useUpdateTask, type Task } from "../api";
import { useAccounts } from "@/features/accounts/api";
import { useOpportunities } from "@/features/opportunities/api";

const taskSchema = z.object({
  title: z.string().min(1, "Title is required").max(160),
  description: z.string().max(1000).optional(),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  due_date: z.string().optional(),
  account_id: z.string().uuid().or(z.literal("")).optional(),
  opportunity_id: z.string().uuid().or(z.literal("")).optional(),
});

type TaskFormValues = z.infer<typeof taskSchema>;

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  defaultAccountId?: string;
  defaultOpportunityId?: string;
}

export function TaskDialog({
  open,
  onOpenChange,
  task,
  defaultAccountId,
  defaultOpportunityId,
}: TaskDialogProps) {
  const isEditing = !!task;
  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask(task?.id || "");
  const { data: accountsData } = useAccounts({ page_size: 100 });
  const { data: oppsData } = useOpportunities({ page_size: 100 });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: task?.title || "",
      description: task?.description || "",
      priority: (task?.priority as any) || "normal",
      due_date: task?.due_date || "",
      account_id: task?.account_id || defaultAccountId || "",
      opportunity_id: task?.opportunity_id || defaultOpportunityId || "",
    },
  });

  React.useEffect(() => {
    if (task) {
      reset({
        title: task.title,
        description: task.description || "",
        priority: task.priority as any,
        due_date: task.due_date || "",
        account_id: task.account_id || "",
        opportunity_id: task.opportunity_id || "",
      });
    } else {
      reset({
        title: "",
        description: "",
        priority: "normal",
        due_date: "",
        account_id: defaultAccountId || "",
        opportunity_id: defaultOpportunityId || "",
      });
    }
  }, [task, defaultAccountId, defaultOpportunityId, reset]);

  const onSubmit = async (values: TaskFormValues) => {
    try {
      if (isEditing && task) {
        await updateMutation.mutateAsync({
          title: values.title,
          description: values.description || undefined,
          priority: values.priority,
          due_date: values.due_date || undefined,
          account_id: values.account_id || undefined,
          opportunity_id: values.opportunity_id || undefined,
          expected_version: task.version,
        });
        toast.success(`Task "${values.title}" updated`);
      } else {
        await createMutation.mutateAsync({
          title: values.title,
          description: values.description || undefined,
          priority: values.priority,
          due_date: values.due_date || undefined,
          account_id: values.account_id || undefined,
          opportunity_id: values.opportunity_id || undefined,
        });
        toast.success(`Task "${values.title}" created`);
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save task");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Task" : "New Action Item"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <FormField id="tsk-title" label="Task Title" required error={errors.title?.message}>
            <Input id="tsk-title" {...register("title")} placeholder="e.g. Follow up on technical compliance doc" />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField id="tsk-priority" label="Priority" required>
              <select
                id="tsk-priority"
                {...register("priority")}
                className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </FormField>

            <FormField id="tsk-due" label="Due Date" error={errors.due_date?.message}>
              <Input id="tsk-due" type="date" {...register("due_date")} />
            </FormField>
          </div>

          <FormField id="tsk-acc" label="Related Account" error={errors.account_id?.message}>
            <select
              id="tsk-acc"
              {...register("account_id")}
              className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
            >
              <option value="">None (General)</option>
              {accountsData?.items.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField id="tsk-opp" label="Related Deal / Opportunity" error={errors.opportunity_id?.message}>
            <select
              id="tsk-opp"
              {...register("opportunity_id")}
              className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
            >
              <option value="">None (General)</option>
              {oppsData?.items.map((opp) => (
                <option key={opp.id} value={opp.id}>
                  {opp.name} ({opp.account_name})
                </option>
              ))}
            </select>
          </FormField>

          <FormField id="tsk-desc" label="Notes & Context" error={errors.description?.message}>
            <textarea
              id="tsk-desc"
              {...register("description")}
              rows={2}
              className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
              placeholder="Action items, required attachments, customer requests..."
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
