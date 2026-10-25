"use client";

import * as React from "react";
import Link from "next/link";
import {
  Briefcase,
  Building2,
  Calendar,
  DollarSign,
  User,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  History,
  CheckSquare,
} from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingSkeleton } from "@/components/data-display/loading-skeleton";
import { EmptyState } from "@/components/data-display/empty-state";
import { formatDate, formatDateTime, formatMoney } from "@/lib/formatters/formatters";
import {
  useOpportunity,
  useOpportunityTimeline,
  type Opportunity,
} from "@/features/opportunities/api";
import { useTasks } from "@/features/tasks/api";
import { StageTransitionDialog } from "@/features/opportunities/components/stage-transition-dialog";
import { ReopenDialog } from "@/features/opportunities/components/reopen-dialog";

const STAGES = ["lead", "qualified", "solutioning", "proposal", "negotiation", "won", "lost"];
const NEXT_STAGE_MAP: Record<string, string | null> = {
  lead: "qualified",
  qualified: "solutioning",
  solutioning: "proposal",
  proposal: "negotiation",
  negotiation: "won",
  won: null,
  lost: null,
};

export default function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const resolvedParams = React.use(params);
  const opportunityId = resolvedParams.opportunityId;

  const { data: opp, isLoading: oppLoading } = useOpportunity(opportunityId);
  const { data: timelineData } = useOpportunityTimeline(opportunityId);
  const { data: tasksData } = useTasks({ opportunity_id: opportunityId });

  const [stageTransitionTarget, setStageTransitionTarget] = React.useState<any>(null);
  const [reopenOpen, setReopenOpen] = React.useState(false);

  if (oppLoading) {
    return (
      <PageContainer>
        <div className="py-8 space-y-4">
          <LoadingSkeleton rows={5} />
        </div>
      </PageContainer>
    );
  }

  if (!opp) {
    return (
      <PageContainer>
        <EmptyState
          title="Opportunity Not Found"
          description="The requested deal does not exist or has been removed."
          action={
            <Link href="/app/opportunities">
              <Button variant="outline">Back to Opportunities</Button>
            </Link>
          }
        />
      </PageContainer>
    );
  }

  const nextStage = NEXT_STAGE_MAP[opp.stage];
  const isTerminal = opp.stage === "won" || opp.stage === "lost";

  return (
    <PageContainer>
      <div className="mb-4">
        <Link
          href="/app/opportunities"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Opportunities</span>
        </Link>
      </div>

      <PageHeader
        title={opp.name}
        description={`Account: ${opp.account_name || "—"}`}
        breadcrumbs={[
          { label: "Workspace", href: "/app/dashboard" },
          { label: "Opportunities", href: "/app/opportunities" },
          { label: opp.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {isTerminal ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReopenOpen(true)}
                className="gap-1.5"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reopen to Qualified</span>
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStageTransitionTarget("lost")}
                  className="gap-1.5 text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                >
                  <XCircle className="h-4 w-4" />
                  <span>Mark Lost</span>
                </Button>
                {nextStage && (
                  <Button
                    size="sm"
                    onClick={() => setStageTransitionTarget(nextStage)}
                    className="gap-1.5"
                  >
                    <span>Advance to {nextStage}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          </div>
        }
      />

      {/* Stage Progression Stepper */}
      <div className="mt-6 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-3 block">
          Deal Progression
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {["lead", "qualified", "solutioning", "proposal", "negotiation"].map((step, idx) => {
            const isCurrent = opp.stage === step;
            const stepOrder = ["lead", "qualified", "solutioning", "proposal", "negotiation", "won"];
            const isPassed =
              opp.stage === "won" ||
              (stepOrder.indexOf(opp.stage) > idx && opp.stage !== "lost");

            return (
              <div key={step} className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                    isCurrent
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : isPassed
                      ? "bg-[var(--success-soft)] text-[var(--success)]"
                      : "bg-[var(--surface-muted)] text-[var(--muted-foreground)]"
                  }`}
                >
                  {isPassed && <CheckCircle2 className="h-3.5 w-3.5" />}
                  <span>{step}</span>
                </div>
                {idx < 4 && <ArrowRight className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />}
              </div>
            );
          })}

          <div className="ml-auto flex items-center gap-2">
            {opp.stage === "won" && (
              <StatusBadge label="Closed Won" variant="success" className="px-3 py-1 text-xs" />
            )}
            {opp.stage === "lost" && (
              <StatusBadge label="Closed Lost" variant="destructive" className="px-3 py-1 text-xs" />
            )}
          </div>
        </div>
      </div>

      {/* Opportunity Details Grid */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Deal Financials Card */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs space-y-4">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Deal Summary</h3>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-[var(--muted-foreground)] block">Estimated Value:</span>
              <span className="text-xl font-bold text-[var(--foreground)]">
                {formatMoney(opp.estimated_value, opp.currency_code)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border)]">
              <div>
                <span className="text-[var(--muted-foreground)] block">Win Confidence:</span>
                <span className="font-semibold text-[var(--foreground)]">
                  {opp.probability_percent ? `${Number(opp.probability_percent).toFixed(0)}%` : "—"}
                </span>
              </div>

              <div>
                <span className="text-[var(--muted-foreground)] block">Target Close:</span>
                <span className="font-semibold text-[var(--foreground)]">
                  {formatDate(opp.expected_close_date)}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-[var(--border)]">
              <span className="text-[var(--muted-foreground)] block">Account:</span>
              <Link
                href={`/app/accounts/${opp.account_id}`}
                className="font-medium text-[var(--primary)] hover:underline flex items-center gap-1 mt-0.5"
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>{opp.account_name}</span>
              </Link>
            </div>

            <div>
              <span className="text-[var(--muted-foreground)] block">Owner:</span>
              <span className="font-medium text-[var(--foreground)] mt-0.5 block">
                {opp.owner_name || "Unassigned"}
              </span>
            </div>
          </div>
        </div>

        {/* Scope and Context Card */}
        <div className="md:col-span-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs space-y-4">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Scope & Requirements</h3>

          <div className="rounded-[var(--radius-sm)] bg-[var(--surface-muted)] p-4 text-xs text-[var(--foreground)] min-h-[100px]">
            {opp.description || "No specific scope notes recorded for this opportunity."}
          </div>

          {/* Win/Loss Details */}
          {opp.stage === "lost" && (
            <div className="rounded-[var(--radius-md)] border border-[var(--danger)]/30 bg-[var(--danger-soft)] p-3 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-[var(--danger)]">
                <XCircle className="h-4 w-4" />
                <span>Closed Lost Reason: {opp.loss_reason}</span>
              </div>
              {opp.loss_detail && (
                <p className="text-[var(--foreground)] pl-5">{opp.loss_detail}</p>
              )}
            </div>
          )}

          {opp.stage === "won" && (
            <div className="rounded-[var(--radius-md)] border border-[var(--success)]/30 bg-[var(--success-soft)] p-3 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-[var(--success)]">
                <CheckCircle2 className="h-4 w-4" />
                <span>Closed Won (Phase 2 Override Verified)</span>
              </div>
            </div>
          )}

          {/* Associated Tasks Preview */}
          <div className="pt-2 border-t border-[var(--border)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[var(--foreground)] flex items-center gap-1.5">
                <CheckSquare className="h-4 w-4 text-[var(--muted-foreground)]" />
                <span>Related Action Items ({tasksData?.total ?? 0})</span>
              </span>
              <Link href="/app/tasks" className="text-xs text-[var(--primary)] hover:underline">
                View All Tasks
              </Link>
            </div>

            {tasksData?.items && tasksData.items.length > 0 ? (
              <div className="divide-y divide-[var(--border)] text-xs">
                {tasksData.items.map((t) => (
                  <div key={t.id} className="py-2 flex items-center justify-between">
                    <span className="font-medium text-[var(--foreground)]">{t.title}</span>
                    <StatusBadge
                      label={t.status}
                      variant={t.status === "completed" ? "success" : "warning"}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--muted-foreground)] italic">
                No tasks linked to this opportunity yet.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="mt-6 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
        <h3 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2 mb-4">
          <History className="h-4 w-4 text-[var(--primary)]" />
          <span>Opportunity Audit Trail</span>
        </h3>

        {timelineData && timelineData.length > 0 ? (
          <div className="space-y-3">
            {timelineData.map((act) => (
              <div
                key={act.id}
                className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-xs"
              >
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[var(--foreground)]">{act.summary}</span>
                    <span className="text-[var(--muted-foreground)]">{formatDateTime(act.occurred_at)}</span>
                  </div>
                  <span className="text-[10px] text-[var(--muted-foreground)]">
                    Event: <span className="font-mono">{act.event_type}</span> by {act.actor_name || "System"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--muted-foreground)] italic">
            No audit records for this opportunity yet.
          </p>
        )}
      </div>

      {/* Stage Transition Dialog */}
      {stageTransitionTarget && (
        <StageTransitionDialog
          open={!!stageTransitionTarget}
          onOpenChange={(open) => {
            if (!open) setStageTransitionTarget(null);
          }}
          opportunity={opp}
          targetStage={stageTransitionTarget}
        />
      )}

      {/* Reopen Dialog */}
      <ReopenDialog
        open={reopenOpen}
        onOpenChange={setReopenOpen}
        opportunity={opp}
      />
    </PageContainer>
  );
}
