"use client";

import * as React from "react";
import { Plus, Search, LayoutGrid, ListFilter, RotateCcw } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOpportunities, type Opportunity } from "@/features/opportunities/api";
import { OpportunityTable } from "@/features/opportunities/components/opportunity-table";
import { PipelineBoard } from "@/features/opportunities/components/pipeline-board";
import { OpportunityDialog } from "@/features/opportunities/components/opportunity-form";
import { StageTransitionDialog } from "@/features/opportunities/components/stage-transition-dialog";
import { ReopenDialog } from "@/features/opportunities/components/reopen-dialog";

export default function OpportunitiesPage() {
  const [viewMode, setViewMode] = React.useState<"pipeline" | "table">("pipeline");
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [stageFilter, setStageFilter] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const pageSize = 25;

  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [selectedOpp, setSelectedOpp] = React.useState<Opportunity | null>(null);
  const [stageTransitionTarget, setStageTransitionTarget] = React.useState<any>(null);
  const [reopenOpp, setReopenOpp] = React.useState<Opportunity | null>(null);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(handler);
  }, [search]);

  const { data, isLoading } = useOpportunities({
    search: debouncedSearch || undefined,
    stage: stageFilter !== "all" ? stageFilter : undefined,
    page,
    page_size: viewMode === "pipeline" ? 100 : pageSize,
  });

  const handleStageTransition = (opp: Opportunity, targetStage: any) => {
    setSelectedOpp(opp);
    setStageTransitionTarget(targetStage);
  };

  const handleReopen = (opp: Opportunity) => {
    setReopenOpp(opp);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Opportunities & Pipeline"
        description="Track high-value industrial sales opportunities across structured qualification stages"
        breadcrumbs={[{ label: "Workspace", href: "/app/dashboard" }, { label: "Opportunities" }]}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] p-0.5">
              <button
                onClick={() => setViewMode("pipeline")}
                className={`flex items-center gap-1 rounded-[var(--radius-sm)] px-2.5 py-1 text-xs font-medium transition-colors ${
                  viewMode === "pipeline"
                    ? "bg-[var(--surface)] text-[var(--foreground)] shadow-2xs"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
                title="Pipeline Kanban view"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Pipeline</span>
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1 rounded-[var(--radius-sm)] px-2.5 py-1 text-xs font-medium transition-colors ${
                  viewMode === "table"
                    ? "bg-[var(--surface)] text-[var(--foreground)] shadow-2xs"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
                title="Table List view"
              >
                <ListFilter className="h-3.5 w-3.5" />
                <span>Table</span>
              </button>
            </div>

            <Button onClick={() => setCreateDialogOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              <span>New Opportunity</span>
            </Button>
          </div>
        }
      />

      {/* Search & Stage Filter */}
      <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--muted-foreground)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deals by title..."
            className="pl-9"
          />
        </div>

        {viewMode === "table" && (
          <select
            value={stageFilter}
            aria-label="Filter by deal stage"
            onChange={(e) => {
              setStageFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
          >
            <option value="all">All Stages</option>
            <option value="lead">Lead</option>
            <option value="qualified">Qualified</option>
            <option value="solutioning">Solutioning</option>
            <option value="proposal">Proposal</option>
            <option value="negotiation">Negotiation</option>
            <option value="won">Closed Won</option>
            <option value="lost">Closed Lost</option>
          </select>
        )}
      </div>

      {/* Main View: Pipeline vs Table */}
      <div className="mt-4">
        {viewMode === "pipeline" ? (
          <PipelineBoard
            opportunities={data?.items || []}
            onStageTransition={handleStageTransition}
            onReopen={handleReopen}
          />
        ) : (
          <OpportunityTable
            data={data?.items || []}
            total={data?.total || 0}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onStageTransition={handleStageTransition}
            onReopen={handleReopen}
            isLoading={isLoading}
          />
        )}
      </div>

      {/* Create Opportunity Dialog */}
      <OpportunityDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      {/* Stage Transition Dialog */}
      {selectedOpp && stageTransitionTarget && (
        <StageTransitionDialog
          open={!!stageTransitionTarget}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedOpp(null);
              setStageTransitionTarget(null);
            }
          }}
          opportunity={selectedOpp}
          targetStage={stageTransitionTarget}
        />
      )}

      {/* Reopen Dialog */}
      {reopenOpp && (
        <ReopenDialog
          open={!!reopenOpp}
          onOpenChange={(open) => {
            if (!open) setReopenOpp(null);
          }}
          opportunity={reopenOpp}
        />
      )}
    </PageContainer>
  );
}
