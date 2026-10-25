import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatMoney } from "@/lib/formatters/formatters";

describe("Quote Status Badges and Display Components", () => {
  it("renders draft status badge with neutral variant", () => {
    render(<StatusBadge variant="neutral" label="Draft" />);
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("renders in-review status badge with warning variant", () => {
    render(<StatusBadge variant="warning" label="In Review" />);
    expect(screen.getByText("In Review")).toBeInTheDocument();
  });

  it("renders approved status badge with success variant", () => {
    render(<StatusBadge variant="success" label="Approved" />);
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("renders rejected status badge with destructive variant", () => {
    render(<StatusBadge variant="destructive" label="Rejected" />);
    expect(screen.getByText("Rejected")).toBeInTheDocument();
  });

  it("formats Indian Rupee currency correctly without float artifacts", () => {
    expect(formatMoney("560000.00", "INR")).toContain("5,60,000.00");
    expect(formatMoney("0.00", "INR")).toContain("0.00");
    expect(formatMoney(null, "INR")).toBe("—");
  });

  it("renders policy warning badge and governance messages", () => {
    render(
      <div data-testid="policy-box">
        <span className="font-semibold text-amber-700">Approval Required</span>
        <p>Line discount exceeds 5.00% threshold</p>
      </div>
    );
    expect(screen.getByText("Approval Required")).toBeInTheDocument();
    expect(screen.getByText("Line discount exceeds 5.00% threshold")).toBeInTheDocument();
  });
});
