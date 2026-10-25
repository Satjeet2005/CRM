import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountTable } from "@/features/accounts/components/account-table";
import { StageChart } from "@/features/dashboard/components/stage-chart";
import { AttentionQueue } from "@/features/dashboard/components/attention-queue";
import type { Account } from "@/features/accounts/api";
import type { AttentionItem } from "@/features/dashboard/api";

const mockAccount: Account = {
  id: "00000000-0000-0000-0000-000000000001",
  organization_id: "00000000-0000-0000-0000-000000000000",
  name: "Apex Precision Engineering",
  legal_name: "Apex Precision Engineering Pvt Ltd",
  account_type: "customer",
  industry: "Precision Machining",
  website: "https://apexprecision.example.com",
  phone: "+91 22 2847 9100",
  email: "procurement@apexprecision.example.com",
  billing_address_json: null,
  shipping_address_json: null,
  notes: "High-precision automotive casting components",
  owner_user_id: null,
  owner_name: "Sarah Sales",
  status: "active",
  version: 1,
  created_at: "2026-10-01T10:00:00Z",
  updated_at: "2026-10-01T10:00:00Z",
  contacts_count: 2,
  opportunities_count: 1,
};

describe("AccountTable Component", () => {
  it("renders account rows and actions correctly", () => {
    const onEdit = vi.fn();
    const onArchive = vi.fn();
    const onPageChange = vi.fn();

    render(
      <AccountTable
        data={[mockAccount]}
        total={1}
        page={1}
        pageSize={10}
        onPageChange={onPageChange}
        onEdit={onEdit}
        onArchive={onArchive}
      />
    );

    expect(screen.getByText("Apex Precision Engineering")).toBeInTheDocument();
    expect(screen.getByText("Precision Machining")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
  });
});

describe("StageChart Component", () => {
  it("renders accessible tabular breakdown of pipeline stages", () => {
    const distribution = [
      { stage: "lead", count: 2, total_value: "500000.00" },
      { stage: "qualified", count: 3, total_value: "1200000.00" },
      { stage: "won", count: 1, total_value: "850000.00" },
    ];

    render(<StageChart distribution={distribution} />);

    expect(screen.getByRole("region", { name: /Opportunity Stage Distribution Chart/i })).toBeInTheDocument();
    expect(screen.getByText(/lead/i)).toBeInTheDocument();
    expect(screen.getByText(/qualified/i)).toBeInTheDocument();
    expect(screen.getByText(/won/i)).toBeInTheDocument();
  });
});

describe("AttentionQueue Component", () => {
  it("renders attention items with critical and warning indicators", () => {
    const items: AttentionItem[] = [
      {
        id: "att-1",
        item_type: "overdue_task",
        severity: "critical",
        title: "Overdue Drawing Submission",
        description: "Submit revised drawing for line 3",
        entity_type: "task",
        entity_id: "00000000-0000-0000-0000-000000000002",
        due_date: "2026-10-01",
      },
    ];

    render(<AttentionQueue items={items} />);

    expect(screen.getByText("Overdue Drawing Submission")).toBeInTheDocument();
    expect(screen.getByText("critical")).toBeInTheDocument();
    expect(screen.getByText("View Details")).toBeInTheDocument();
  });

  it("renders empty message when no items", () => {
    render(<AttentionQueue items={[]} />);
    expect(screen.getByText(/No critical attention items pending/i)).toBeInTheDocument();
  });
});
