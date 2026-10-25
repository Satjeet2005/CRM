import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/components/ui/status-badge";

describe("StatusBadge Component", () => {
  it("renders with label and semantic icon", () => {
    render(<StatusBadge label="Approved" variant="success" />);
    const badge = screen.getByText("Approved");
    expect(badge).toBeInTheDocument();
  });

  it("renders warning variant correctly", () => {
    render(<StatusBadge label="Needs Review" variant="warning" />);
    expect(screen.getByText("Needs Review")).toBeInTheDocument();
  });

  it("renders destructive error variant", () => {
    render(<StatusBadge label="Rejected" variant="destructive" />);
    expect(screen.getByText("Rejected")).toBeInTheDocument();
  });
});
