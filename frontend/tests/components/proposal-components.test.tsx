import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatMoney } from "@/lib/formatters/formatters";

describe("Proposal Status Badges and Governance Display Components", () => {
  it("renders draft proposal status badge with neutral variant", () => {
    render(<StatusBadge variant="neutral" label="Draft" />);
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("renders pending_review proposal status badge with warning variant", () => {
    render(<StatusBadge variant="warning" label="Pending Review" />);
    expect(screen.getByText("Pending Review")).toBeInTheDocument();
  });

  it("renders approved proposal status badge with success variant", () => {
    render(<StatusBadge variant="success" label="Approved" />);
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("renders committed proposal status badge with info variant", () => {
    render(<StatusBadge variant="info" label="Committed" />);
    expect(screen.getByText("Committed")).toBeInTheDocument();
  });

  it("renders rejected proposal status badge with destructive variant", () => {
    render(<StatusBadge variant="destructive" label="Rejected" />);
    expect(screen.getByText("Rejected")).toBeInTheDocument();
  });

  it("renders stale/cancelled proposal status badge with neutral variant", () => {
    render(<StatusBadge variant="neutral" label="Stale" />);
    expect(screen.getByText("Stale")).toBeInTheDocument();
  });

  it("renders maker-checker violation warning banner", () => {
    render(
      <div
        role="alert"
        data-testid="maker-checker-banner"
        className="rounded border border-amber-500/40 bg-amber-500/10 p-3"
      >
        <span className="font-semibold text-amber-900">Maker-Checker Policy Enforcement</span>
        <p className="text-xs text-amber-800">
          You created this proposal. A different sales manager or administrator must review and approve it.
        </p>
      </div>
    );

    expect(screen.getByTestId("maker-checker-banner")).toBeInTheDocument();
    expect(screen.getByText("Maker-Checker Policy Enforcement")).toBeInTheDocument();
    expect(
      screen.getByText(
        "You created this proposal. A different sales manager or administrator must review and approve it."
      )
    ).toBeInTheDocument();
  });

  it("renders before/after diff summary metrics and currency formatting", () => {
    const baseTotal = "100000.00";
    const proposedTotal = "95000.00";
    const deltaTotal = "-5000.00";

    render(
      <div data-testid="diff-financial-summary">
        <div>
          <span>Base Total:</span>
          <span>{formatMoney(baseTotal, "INR")}</span>
        </div>
        <div>
          <span>Proposed Total:</span>
          <span>{formatMoney(proposedTotal, "INR")}</span>
        </div>
        <div>
          <span>Delta Total:</span>
          <span className="text-rose-600">{formatMoney(deltaTotal, "INR")}</span>
        </div>
      </div>
    );

    expect(screen.getByText("Base Total:")).toBeInTheDocument();
    expect(screen.getByText("Proposed Total:")).toBeInTheDocument();
    expect(screen.getByText("Delta Total:")).toBeInTheDocument();
    expect(screen.getByText(formatMoney(baseTotal, "INR"))).toBeInTheDocument();
    expect(screen.getByText(formatMoney(proposedTotal, "INR"))).toBeInTheDocument();
    expect(screen.getByText(formatMoney(deltaTotal, "INR"))).toBeInTheDocument();
  });

  it("renders line-level change item diff row", () => {
    render(
      <div data-testid="line-diff-row" className="p-3 border rounded">
        <span className="font-semibold">Line #1: Heavy Duty Valve</span>
        <div className="flex gap-4 text-xs">
          <span>Discount: 0.00% &rarr; 8.00%</span>
          <span>Line Total: ₹10,000.00 &rarr; ₹9,200.00</span>
        </div>
      </div>
    );

    expect(screen.getByText("Line #1: Heavy Duty Valve")).toBeInTheDocument();
    expect(screen.getByText("Discount: 0.00% → 8.00%")).toBeInTheDocument();
    expect(screen.getByText("Line Total: ₹10,000.00 → ₹9,200.00")).toBeInTheDocument();
  });
});
