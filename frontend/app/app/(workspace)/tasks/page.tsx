"use client";

import * as React from "react";
import { Plus, Search, CheckSquare, AlertTriangle, Clock, ListChecks } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button, Input, Select, Tabs } from "@/components/sakani";
import { useTasks, type Task } from "@/features/tasks/api";
import { TaskTable } from "@/features/tasks/components/task-table";
import { TaskDialog } from "@/features/tasks/components/task-form";

export default function TasksPage() {
  const [tab, setTab] = React.useState<string>("open");
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [priority, setPriority] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const pageSize = 15;

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedTask, setSelectedTask] = React.useState<Task | null>(null);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(handler);
  }, [search]);

  const { data, isLoading } = useTasks({
    search: debouncedSearch || undefined,
    status: tab === "all" ? undefined : tab === "overdue" ? "open" : tab,
    is_overdue: tab === "overdue" ? true : undefined,
    priority: priority !== "all" ? priority : undefined,
    page,
    page_size: pageSize,
  });

  const handleEdit = (task: Task) => {
    setSelectedTask(task);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedTask(null);
    setDialogOpen(true);
  };

  const tabItems = [
    {
      value: "open",
      label: "Pending & Open",
      icon: <Clock className="h-4 w-4" aria-hidden="true" />,
    },
    {
      value: "overdue",
      label: "Overdue",
      icon: <AlertTriangle className="h-4 w-4" aria-hidden="true" />,
    },
    {
      value: "completed",
      label: "Completed",
      icon: <CheckSquare className="h-4 w-4" aria-hidden="true" />,
    },
    {
      value: "all",
      label: "All Tasks",
      icon: <ListChecks className="h-4 w-4" aria-hidden="true" />,
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Tasks & Follow-ups"
        description="Operational action items, technical follow-ups, and customer commitments"
        breadcrumbs={[{ label: "Workspace", href: "/app/dashboard" }, { label: "Tasks" }]}
        actions={
          <Button onClick={handleCreate} className="gap-1.5">
            <Plus className="h-4 w-4" />
            <span>New Task</span>
          </Button>
        }
      />

      {/* Tabs */}
      <div className="mt-6">
        <Tabs
          items={tabItems}
          value={tab}
          onChange={(newTab) => {
            setTab(newTab);
            setPage(1);
          }}
        />
      </div>

      {/* Search & Filters (Toolbar) */}
      <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action items..."
            leadingIcon={<Search className="h-4 w-4 text-[var(--color-fg-muted)]" aria-hidden="true" />}
            className="h-8 text-xs"
          />
        </div>

        <div className="w-40">
          <Select
            value={priority}
            aria-label="Filter by task priority"
            onChange={(val) => {
              setPriority(val);
              setPage(1);
            }}
            size="sm"
            options={[
              { label: "All Priorities", value: "all" },
              { label: "High", value: "high" },
              { label: "Normal", value: "normal" },
              { label: "Low", value: "low" },
            ]}
          />
        </div>
      </div>

      {/* Tasks Table with 16px gap (mt-4) */}
      <div className="mt-4">
        <TaskTable
          data={data?.items || []}
          total={data?.total || 0}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onEdit={handleEdit}
          isLoading={isLoading}
        />
      </div>

      {/* Task Create / Edit Dialog */}
      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={selectedTask}
      />
    </PageContainer>
  );
}
