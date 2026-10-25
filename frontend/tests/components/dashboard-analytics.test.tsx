import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RFQMatchHealthChart } from "@/features/dashboard/components/rfq-match-health-chart";
import { QuoteLifecycleChart } from "@/features/dashboard/components/quote-lifecycle-chart";
import { TaskDueLoadChart } from "@/features/dashboard/components/task-due-load-chart";
import { StageChart, STAGE_COLOR_MAP } from "@/features/dashboard/components/stage-chart";
import type { RFQMatchHealthSummary, QuoteLifecycleSummary, TaskDueLoadSummary, DashboardSummary } from "@/features/dashboard/api";

const mockRFQHealth: RFQMatchHealthSummary = {
  total_lines: 117,
  reviewed_lines: 66,
  categories: [
    { status: "exact_match", label: "Exact Match", count: 20, percentage: 17.1 },
    { status: "matched", label: "Accepted Match", count: 66, percentage: 56.4 },
    { status: "needs_review", label: "Needs Review", count: 28, percentage: 23.9 },
    { status: "unmatched", label: "Unmatched", count: 3, percentage: 2.6 },
  ],
};

const mockQuoteLifecycle: QuoteLifecycleSummary = {
  total_quotes: 4,
  categories: [
    { status: "draft", label: "Draft", count: 1 },
    { status: "pending_approval", label: "In Review / Pending", count: 1 },
    { status: "approved", label: "Approved", count: 2 },
    { status: "rejected", label: "Rejected", count: 0 },
    { status: "expired", label: "Expired", count: 0 },
  ],
};

const mockTaskDueLoad: TaskDueLoadSummary = {
  total_open_tasks: 11,
  categories: [
    { bucket: "overdue", label: "Overdue", count: 4, is_urgent: true },
    { bucket: "due_today", label: "Due Today", count: 1, is_urgent: true },
    { bucket: "due_this_week", label: "Next 7 Days", count: 6, is_urgent: false },
    { bucket: "due_later", label: "Later", count: 0, is_urgent: false },
  ],
};

const mockStageDistribution: DashboardSummary["stage_distribution"] = [
  { stage: "lead", count: 5, total_value: "500000.00" },
  { stage: "qualified", count: 4, total_value: "800000.00" },
  { stage: "solutioning", count: 3, total_value: "1200000.00" },
  { stage: "proposal", count: 2, total_value: "1500000.00" },
  { stage: "negotiation", count: 1, total_value: "600000.00" },
  { stage: "won", count: 2, total_value: "2000000.00" },
  { stage: "lost", count: 1, total_value: "300000.00" },
];

describe("RFQMatchHealthChart Component", () => {
  it("renders panel header, center metric, and all canonical categories without double counting", () => {
    render(<RFQMatchHealthChart data={mockRFQHealth} />);

    expect(screen.getByText("RFQ Match Health")).toBeInTheDocument();
    expect(screen.getByText(/catalog-match outcomes/i)).toBeInTheDocument();

    // Center metric
    expect(screen.getByText("117")).toBeInTheDocument();
    expect(screen.getByText("Total Lines")).toBeInTheDocument();

    // Categories
    expect(screen.getByText("Exact Match")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();

    expect(screen.getByText("Accepted Match")).toBeInTheDocument();
    expect(screen.getByText("66")).toBeInTheDocument();

    expect(screen.getByText("Needs Review")).toBeInTheDocument();
    expect(screen.getByText("28")).toBeInTheDocument();

    expect(screen.getByText("Unmatched")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();

    // Check sum
    const sum = mockRFQHealth.categories.reduce((acc, c) => acc + c.count, 0);
    expect(sum).toBe(mockRFQHealth.total_lines);
  });

  it("toggles between chart and accessible tabular alternative view", async () => {
    const user = userEvent.setup();
    render(<RFQMatchHealthChart data={mockRFQHealth} />);

    const toggleBtn = screen.getByRole("button", { name: /switch to table view/i });
    expect(toggleBtn).toBeInTheDocument();

    await user.click(toggleBtn);

    // Tabular alternative now visible
    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Outcome" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Count" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Share" })).toBeInTheDocument();

    // Switch back to Chart
    const chartBtn = screen.getByRole("button", { name: /switch to chart view/i });
    await user.click(chartBtn);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("handles empty / zero-line state gracefully", () => {
    render(<RFQMatchHealthChart data={{ total_lines: 0, reviewed_lines: 0, categories: [] }} />);

    expect(screen.getByText("RFQ Match Health")).toBeInTheDocument();
    expect(screen.getByText("No RFQ lines")).toBeInTheDocument();
  });
});

describe("QuoteLifecycleChart Component", () => {
  it("renders all canonical quote statuses, exact counts, and handles zero counts cleanly", () => {
    render(<QuoteLifecycleChart data={mockQuoteLifecycle} />);

    expect(screen.getByText("Quotation Lifecycle")).toBeInTheDocument();
    expect(screen.getByText(/current distribution of quotations/i)).toBeInTheDocument();

    // Check statuses
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("In Review / Pending")).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText("Expired")).toBeInTheDocument();

    // Check counts
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("quote").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getAllByText("quotes").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(2); // Rejected and Expired

    // Footer
    expect(screen.getByText(/4 total quotations/i)).toBeInTheDocument();
  });

  it("toggles accessible table alternative view", async () => {
    const user = userEvent.setup();
    render(<QuoteLifecycleChart data={mockQuoteLifecycle} />);

    const toggleBtn = screen.getByRole("button", { name: /switch to table view/i });
    await user.click(toggleBtn);

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Lifecycle Stage" })).toBeInTheDocument();
  });

  it("handles empty / zero-quote state gracefully", () => {
    render(<QuoteLifecycleChart data={{ total_quotes: 0, categories: [] }} />);
    expect(screen.getByText("Quotation Lifecycle")).toBeInTheDocument();
    expect(screen.getByText(/0 total quotations/i)).toBeInTheDocument();
  });
});

describe("TaskDueLoadChart Component", () => {
  it("renders mutually exclusive date buckets, urgent semantic markers, and exact counts", () => {
    render(<TaskDueLoadChart data={mockTaskDueLoad} />);

    expect(screen.getByText("Task Due-Date Load")).toBeInTheDocument();
    expect(screen.getByText(/plan follow-ups by due date/i)).toBeInTheDocument();

    // Buckets
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();

    expect(screen.getByText("Due Today")).toBeInTheDocument();
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText("Next 7 Days")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();

    expect(screen.getByText("Later")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();

    expect(screen.getAllByText("tasks").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("task")).toBeInTheDocument();

    // Sum check
    const sum = mockTaskDueLoad.categories.reduce((acc, c) => acc + c.count, 0);
    expect(sum).toBe(mockTaskDueLoad.total_open_tasks);

    // Footer
    expect(screen.getByText(/11 open commitments/i)).toBeInTheDocument();
  });

  it("toggles accessible table view", async () => {
    const user = userEvent.setup();
    render(<TaskDueLoadChart data={mockTaskDueLoad} />);

    const toggleBtn = screen.getByRole("button", { name: /switch to table view/i });
    await user.click(toggleBtn);

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Urgency Horizon" })).toBeInTheDocument();
  });

  it("handles empty task load gracefully", () => {
    render(<TaskDueLoadChart data={{ total_open_tasks: 0, categories: [] }} />);
    expect(screen.getByText("Task Due-Date Load")).toBeInTheDocument();
    expect(screen.getByText(/0 open commitments/i)).toBeInTheDocument();
  });
});

describe("StageChart Component Polish", () => {
  it("maps stages to canonical Sakani chart progression with colored swatches", () => {
    render(<StageChart distribution={mockStageDistribution} />);

    expect(screen.getByText("Lead")).toBeInTheDocument();
    expect(screen.getByText("Qualified")).toBeInTheDocument();
    expect(screen.getByText("Solutioning")).toBeInTheDocument();
    expect(screen.getByText("Proposal")).toBeInTheDocument();
    expect(screen.getByText("Negotiation")).toBeInTheDocument();
    expect(screen.getByText("Won")).toBeInTheDocument();
    expect(screen.getByText("Lost")).toBeInTheDocument();

    // Verify STAGE_COLOR_MAP
    expect(STAGE_COLOR_MAP.lead).toBe("var(--color-chart-2)");
    expect(STAGE_COLOR_MAP.qualified).toBe("var(--color-chart-3)");
    expect(STAGE_COLOR_MAP.solutioning).toBe("var(--color-chart-1)");
    expect(STAGE_COLOR_MAP.proposal).toBe("var(--color-chart-4)");
    expect(STAGE_COLOR_MAP.negotiation).toBe("var(--color-chart-5)");
    expect(STAGE_COLOR_MAP.won).toBe("var(--color-chart-6)");
    expect(STAGE_COLOR_MAP.lost).toBe("var(--color-danger-fg)");
  });
});
