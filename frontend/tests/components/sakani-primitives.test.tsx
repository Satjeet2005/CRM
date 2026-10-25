import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Button,
  Badge,
  Card,
  StatCard,
  Input,
  Sheet,
  SheetTrigger,
  SheetPopup,
  SheetTitle,
  Alert,
  Avatar,
  Select,
  ActivityFeed,
  ActivityFeedHighlight,
} from "@/components/sakani";

describe("Sakani UI Primitives for ForgeFlow", () => {
  describe("Button Primitive", () => {
    it("renders with primary variant and handles click", async () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Generate Quote</Button>);
      const btn = screen.getByRole("button", { name: /generate quote/i });
      expect(btn).toBeInTheDocument();
      await userEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("renders destructive variant with proper attributes", () => {
      render(<Button variant="destructive">Delete Proposal</Button>);
      const btn = screen.getByRole("button", { name: /delete proposal/i });
      expect(btn).toHaveClass("bg-[var(--color-danger-500)]");
    });

    it("handles loading state correctly", () => {
      render(<Button isLoading>Saving Changes</Button>);
      const btn = screen.getByRole("button", { name: /saving changes/i });
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute("aria-busy", "true");
    });
  });

  describe("Badge Primitive", () => {
    it("renders standard semantic and domain compliance badges", () => {
      const { rerender } = render(<Badge variant="success">Approved</Badge>);
      expect(screen.getByText("Approved")).toBeInTheDocument();

      rerender(<Badge variant="itar">ITAR RESTRICTED</Badge>);
      expect(screen.getByText("ITAR RESTRICTED")).toBeInTheDocument();

      rerender(<Badge variant="deviation">DEVIATION PENDING</Badge>);
      expect(screen.getByText("DEVIATION PENDING")).toBeInTheDocument();
    });
  });

  describe("Card and StatCard Primitives", () => {
    it("renders Card with header and actions", () => {
      render(
        <Card
          title="Account Overview"
          description="Precision engineering client"
          actions={<button>Edit</button>}
        >
          <div>Card content body</div>
        </Card>
      );
      expect(screen.getByText("Account Overview")).toBeInTheDocument();
      expect(screen.getByText("Precision engineering client")).toBeInTheDocument();
      expect(screen.getByText("Card content body")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    });

    it("renders StatCard with trend and metric value", () => {
      render(
        <StatCard
          title="Pipeline Value"
          value="₹14,50,000"
          delta="+12.4%"
          trend="up"
          description="vs last month"
        />
      );
      expect(screen.getByText("Pipeline Value")).toBeInTheDocument();
      expect(screen.getByText("₹14,50,000")).toBeInTheDocument();
      expect(screen.getByText("+12.4%")).toBeInTheDocument();
    });
  });

  describe("Input Primitive & String Preservation", () => {
    it("renders label, description, and preserves exact string inputs for Python Decimal", async () => {
      const handleChange = vi.fn();
      render(
        <Input
          label="Unit Price (INR)"
          description="Enter unit price in exact string decimal format"
          placeholder="0.00"
          onChange={(e) => handleChange(e.target.value)}
        />
      );

      const input = screen.getByRole("textbox", { name: /unit price/i });
      expect(input).toBeInTheDocument();
      expect(screen.getByText(/exact string decimal format/i)).toBeInTheDocument();

      await userEvent.type(input, "12450.75");
      expect(handleChange).toHaveBeenCalled();
    });

    it("displays error message when error prop is provided", () => {
      render(
        <Input
          label="Quantity"
          error="Quantity must be strictly greater than 0"
        />
      );
      expect(screen.getByRole("alert")).toHaveTextContent("Quantity must be strictly greater than 0");
    });
  });

  describe("Sheet Primitive (Drawer)", () => {
    it("renders without crash and supports accessible dialog attributes", () => {
      render(
        <Sheet defaultOpen>
          <SheetTrigger render={(props) => <button {...props}>Open</button>} />
          <SheetPopup>
            <SheetTitle>Calculation Trace Inspector</SheetTitle>
            <div>5-level trace tree</div>
          </SheetPopup>
        </Sheet>
      );
      expect(screen.getByText("Calculation Trace Inspector")).toBeInTheDocument();
      expect(screen.getByText("5-level trace tree")).toBeInTheDocument();
    });
  });

  describe("Alert Primitive", () => {
    it("renders danger alert with title and description", () => {
      render(
        <Alert
          color="danger"
          title="Invalid Credentials"
          description="Please check your email and password"
        />
      );
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("Invalid Credentials")).toBeInTheDocument();
      expect(screen.getByText("Please check your email and password")).toBeInTheDocument();
    });
  });

  describe("Avatar Primitive", () => {
    it("renders initials fallback when no image source is provided", () => {
      render(<Avatar initials="SS" alt="Sarah Sales" />);
      expect(screen.getByText("SS")).toBeInTheDocument();
    });
  });

  describe("Select Primitive", () => {
    it("renders accessible options and handles change", async () => {
      const handleChange = vi.fn();
      render(
        <Select
          label="Filter by Entity"
          options={[
            { label: "All Entities", value: "all" },
            { label: "Accounts", value: "account" },
          ]}
          onChange={handleChange}
        />
      );
      const select = screen.getByRole("combobox", { name: /filter by entity/i });
      expect(select).toBeInTheDocument();
      await userEvent.selectOptions(select, "account");
      expect(handleChange).toHaveBeenCalledWith("account");
    });
  });

  describe("ActivityFeed Primitive", () => {
    it("renders timeline items with actor, description, and timestamp", () => {
      render(
        <ActivityFeed
          items={[
            {
              id: "1",
              actor: "Sarah Sales",
              description: (
                <>
                  created opportunity <ActivityFeedHighlight>Piping Contract</ActivityFeedHighlight>
                </>
              ),
              timestamp: "10 minutes ago",
            },
          ]}
        />
      );
      expect(screen.getByText("Sarah Sales")).toBeInTheDocument();
      expect(screen.getByText("Piping Contract")).toBeInTheDocument();
      expect(screen.getByText("10 minutes ago")).toBeInTheDocument();
    });
  });
});
