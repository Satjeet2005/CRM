"use client";

import * as React from "react";
import { Plus, Search, CheckSquare, AlertTriangle, Clock } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTasks, type Task } from "@/features/tasks/api";
import { TaskTable } from "@/features/tasks/components/task-table";
import { TaskDialog } from "@/features/tasks/components/task-form";

export default function TasksPage() {
  const [tab, setTab] = React.useState<"all" | "open" | "overdue" | "completed">("open");
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
      <div className="mt-6 border-b border-[var(--border)] flex items-center gap-6 text-sm font-medium">
        <button
          onClick={() => {
            setTab("open");
            setPage(1);
          }}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            tab === "open"
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Pending & Open</span>
        </button>

        <button
          onClick={() => {
            setTab("overdue");
            setPage(1);
          }}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            tab === "overdue"
              ? "border-[var(--danger)] text-[var(--danger)]"
              : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--danger)]"
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          <span>Overdue</span>
        </button>

        <button
          onClick={() => {
            setTab("completed");
            setPage(1);
          }}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            tab === "completed"
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          }`}
        >
          <CheckSquare className="h-4 w-4" />
          <span>Completed</span>
        </button>

        <button
          onClick={() => {
            setTab("all");
            setPage(1);
          }}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            tab === "all"
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          }`}
        >
          <span>All Tasks</span>
        </button>
      </div>

      {/* Search & Filters */}
      <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--muted-foreground)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action items..."
            className="pl-9"
          />
        </div>

        <select
          value={priority}
          aria-label="Filter by task priority"
          onChange={(e) => {
            setPriority(e.target.value);
            setPage(1);
          }}
          className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
        >
          <option value="all">All Priorities</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Tasks Table */}
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
