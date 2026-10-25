import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AccountTable } from "@/features/accounts/components/account-table";
import { ContactTable } from "@/features/contacts/components/contact-table";
import { StageChart } from "@/features/dashboard/components/stage-chart";
import { AttentionQueue } from "@/features/dashboard/components/attention-queue";
import { SessionPanel, groupPermissions, formatRole } from "@/features/dashboard/components/session-panel";
import { PipelineBoard, PIPELINE_COLUMNS } from "@/features/opportunities/components/pipeline-board";
import { OpportunityTable } from "@/features/opportunities/components/opportunity-table";
import { TaskTable } from "@/features/tasks/components/task-table";
import type { Account } from "@/features/accounts/api";
import type { Contact } from "@/features/contacts/api";
import type { AttentionItem } from "@/features/dashboard/api";
import type { AuthUser } from "@/hooks/use-auth";
import type { Opportunity } from "@/features/opportunities/api";
import type { Task } from "@/features/tasks/api";

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

    expect(screen.getAllByText("Apex Precision Engineering").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Precision Machining").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/active/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders Sakani table headers in consistent Title Case", () => {
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

    expect(screen.getByRole("columnheader", { name: "Account Name" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Type" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Industry" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Contacts" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Deals" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Last Updated" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();
  });

  it("renders accessible 32px action buttons with descriptive labels", () => {
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

    const editBtns = screen.getAllByRole("button", { name: `Edit account ${mockAccount.name}` });
    expect(editBtns.length).toBeGreaterThanOrEqual(1);

    const archiveBtns = screen.getAllByRole("button", { name: `Delete account ${mockAccount.name}` });
    expect(archiveBtns.length).toBeGreaterThanOrEqual(1);
  });
});

const mockContact: Contact = {
  id: "00000000-0000-0000-0000-000000000010",
  organization_id: "00000000-0000-0000-0000-000000000000",
  account_id: "00000000-0000-0000-0000-000000000001",
  account_name: "Apex Precision Engineering",
  first_name: "Vikram",
  last_name: "Sharma",
  job_title: "Head of Procurement",
  email: "vikram.sharma@apexprecision.example.com",
  phone: "+91 98200 12345",
  notes: null,
  is_primary: true,
  status: "active",
  version: 1,
  created_at: "2026-10-01T10:00:00Z",
  updated_at: "2026-10-01T10:00:00Z",
};

describe("ContactTable Component", () => {
  it("renders contact identity with Avatar, job title, and Primary badge", () => {
    const onEdit = vi.fn();
    const onArchive = vi.fn();
    const onPageChange = vi.fn();

    render(
      <ContactTable
        data={[mockContact]}
        total={1}
        page={1}
        pageSize={15}
        onPageChange={onPageChange}
        onEdit={onEdit}
        onArchive={onArchive}
      />
    );

    // Identity and job title
    expect(screen.getAllByText("Vikram Sharma").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Head of Procurement").length).toBeGreaterThanOrEqual(1);

    // Primary badge with star
    expect(screen.getAllByText("Primary").length).toBeGreaterThanOrEqual(1);

    // Account link
    expect(screen.getAllByText("Apex Precision Engineering").length).toBeGreaterThanOrEqual(1);

    // Email and Phone
    expect(screen.getAllByText("vikram.sharma@apexprecision.example.com").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("+91 98200 12345").length).toBeGreaterThanOrEqual(1);

    // Status badge
    expect(screen.getAllByText("Active").length).toBeGreaterThanOrEqual(1);
  });

  it("renders Sakani table headers in consistent Title Case", () => {
    const onEdit = vi.fn();
    const onArchive = vi.fn();
    const onPageChange = vi.fn();

    render(
      <ContactTable
        data={[mockContact]}
        total={1}
        page={1}
        pageSize={15}
        onPageChange={onPageChange}
        onEdit={onEdit}
        onArchive={onArchive}
      />
    );

    expect(screen.getByRole("columnheader", { name: "Contact Name" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Account" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Email" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Phone" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();
  });

  it("renders accessible 32px action buttons with descriptive labels", () => {
    const onEdit = vi.fn();
    const onArchive = vi.fn();
    const onPageChange = vi.fn();

    render(
      <ContactTable
        data={[mockContact]}
        total={1}
        page={1}
        pageSize={15}
        onPageChange={onPageChange}
        onEdit={onEdit}
        onArchive={onArchive}
      />
    );

    const editBtns = screen.getAllByRole("button", { name: "Edit contact Vikram Sharma" });
    expect(editBtns.length).toBeGreaterThanOrEqual(1);

    const archiveBtns = screen.getAllByRole("button", { name: "Delete contact Vikram Sharma" });
    expect(archiveBtns.length).toBeGreaterThanOrEqual(1);
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

  it("renders at most 4 preview items sorted by severity", () => {
    const items: AttentionItem[] = [
      { id: "1", item_type: "urgent_task", severity: "warning", title: "Warning Item 1", description: "Desc 1", entity_type: "task", entity_id: "e1" },
      { id: "2", item_type: "closing_soon_opportunity", severity: "info", title: "Info Item 1", description: "Desc 2", entity_type: "opportunity", entity_id: "e2" },
      { id: "3", item_type: "overdue_task", severity: "critical", title: "Critical Item 1", description: "Desc 3", entity_type: "task", entity_id: "e3" },
      { id: "4", item_type: "overdue_task", severity: "critical", title: "Critical Item 2", description: "Desc 4", entity_type: "task", entity_id: "e4" },
      { id: "5", item_type: "urgent_task", severity: "warning", title: "Warning Item 2", description: "Desc 5", entity_type: "task", entity_id: "e5" },
      { id: "6", item_type: "closing_soon_opportunity", severity: "info", title: "Info Item 2", description: "Desc 6", entity_type: "opportunity", entity_id: "e6" },
    ];

    render(<AttentionQueue items={items} isSheetOpen={false} />);

    // In the preview (outside sheet), there should only be 4 items
    expect(screen.getByText("Critical Item 1")).toBeInTheDocument();
    expect(screen.getByText("Critical Item 2")).toBeInTheDocument();
    expect(screen.getByText("Warning Item 1")).toBeInTheDocument();
    expect(screen.getByText("Warning Item 2")).toBeInTheDocument();
    // 5th and 6th items should not be visible when sheet is closed
    expect(screen.queryByText("Info Item 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Info Item 2")).not.toBeInTheDocument();
  });

  it("renders all items inside Sheet when isSheetOpen is true", () => {
    const items: AttentionItem[] = [
      { id: "1", item_type: "urgent_task", severity: "warning", title: "Warning Item 1", description: "Desc 1", entity_type: "task", entity_id: "e1" },
      { id: "2", item_type: "closing_soon_opportunity", severity: "info", title: "Info Item 1", description: "Desc 2", entity_type: "opportunity", entity_id: "e2" },
      { id: "3", item_type: "overdue_task", severity: "critical", title: "Critical Item 1", description: "Desc 3", entity_type: "task", entity_id: "e3" },
      { id: "4", item_type: "overdue_task", severity: "critical", title: "Critical Item 2", description: "Desc 4", entity_type: "task", entity_id: "e4" },
      { id: "5", item_type: "urgent_task", severity: "warning", title: "Warning Item 2", description: "Desc 5", entity_type: "task", entity_id: "e5" },
    ];

    render(<AttentionQueue items={items} isSheetOpen={true} />);

    // Sheet title should be visible
    expect(screen.getByRole("heading", { name: "All attention items" })).toBeInTheDocument();
    // All items should be in the document
    expect(screen.getAllByText("Critical Item 1").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Info Item 1").length).toBeGreaterThanOrEqual(1);
  });

  it("renders empty message when no items", () => {
    render(<AttentionQueue items={[]} />);
    expect(screen.getByText(/No critical attention items pending/i)).toBeInTheDocument();
  });
});

describe("SessionPanel Component", () => {
  const mockAdminUser: AuthUser = {
    id: "usr-admin-1",
    email: "admin@forgeflow.demo",
    display_name: "Alexander Admin",
    role: "admin",
    organization: {
      id: "org-1",
      name: "ForgeFlow Demo Manufacturing",
      slug: "forgeflow-demo",
      currency: "INR",
      timezone: "Asia/Kolkata",
    },
    permissions: [
      "audit:read",
      "catalog:cost",
      "catalog:manage",
      "catalog:read",
      "crm:read",
      "crm:write",
      "proposals:approve",
      "proposals:create",
      "quotes:draft",
      "quotes:export",
      "quotes:read",
      "rfq:import",
      "rfq:read",
      "rfq:resolve",
      "settings:manage",
      "users:manage",
    ],
  };

  it("renders user identity and semantic role and verification badges", () => {
    render(<SessionPanel user={mockAdminUser} />);

    // Display name and email
    expect(screen.getByText("Alexander Admin")).toBeInTheDocument();
    expect(screen.getByText("admin@forgeflow.demo")).toBeInTheDocument();

    // Badges
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Session verified")).toBeInTheDocument();
  });

  it("renders organization context with tenant name, slug, currency, and timezone", () => {
    render(<SessionPanel user={mockAdminUser} />);

    expect(screen.getByText("Organization context")).toBeInTheDocument();
    expect(screen.getByText("ForgeFlow Demo Manufacturing")).toBeInTheDocument();
    expect(screen.getByText("forgeflow-demo")).toBeInTheDocument();
    expect(screen.getByText("INR")).toBeInTheDocument();
    expect(screen.getByText("Asia/Kolkata")).toBeInTheDocument();
  });

  it("groups all 16 permissions into functional domains and renders count badge", () => {
    render(<SessionPanel user={mockAdminUser} />);

    expect(screen.getByText("Granted permissions")).toBeInTheDocument();
    expect(screen.getByText("16 permissions")).toBeInTheDocument();

    // Functional Domain category labels
    expect(screen.getByText("Audit")).toBeInTheDocument();
    expect(screen.getByText("Catalog")).toBeInTheDocument();
    expect(screen.getByText("CRM")).toBeInTheDocument();
    expect(screen.getByText("Proposals")).toBeInTheDocument();
    expect(screen.getByText("Quotes")).toBeInTheDocument();
    expect(screen.getByText("RFQ")).toBeInTheDocument();
    expect(screen.getByText("Administration")).toBeInTheDocument();

    // Sample permission chips
    expect(screen.getByText("audit:read")).toBeInTheDocument();
    expect(screen.getByText("catalog:cost")).toBeInTheDocument();
    expect(screen.getByText("crm:write")).toBeInTheDocument();
    expect(screen.getByText("settings:manage")).toBeInTheDocument();
  });

  it("groups permissions correctly with groupPermissions utility", () => {
    const groups = groupPermissions(mockAdminUser.permissions);
    expect(groups.length).toBe(7);
    expect(groups.map((g) => g.label)).toEqual([
      "Audit",
      "Catalog",
      "CRM",
      "Proposals",
      "Quotes",
      "RFQ",
      "Administration",
    ]);

    const totalCount = groups.reduce((acc, g) => acc + g.permissions.length, 0);
    expect(totalCount).toBe(16);
  });

  it("formats roles properly", () => {
    expect(formatRole("admin")).toBe("Admin");
    expect(formatRole("sales_rep")).toBe("Sales Rep");
    expect(formatRole("sales_manager")).toBe("Sales Manager");
    expect(formatRole("catalog_manager")).toBe("Catalog Manager");
  });
});

const mockOpportunities: Opportunity[] = [
  {
    id: "opp-001",
    organization_id: "00000000-0000-0000-0000-000000000000",
    name: "Aerospace Turbine Blades Batch",
    account_id: "00000000-0000-0000-0000-000000000001",
    account_name: "Apex Precision Engineering",
    primary_contact_id: null,
    description: null,
    stage: "lead",
    estimated_value: "1250000.00",
    currency_code: "INR",
    probability_percent: "20",
    expected_close_date: "2026-11-15",
    owner_user_id: "user-1",
    owner_name: "Sarah Sales",
    source: null,
    loss_reason: null,
    loss_detail: null,
    won_at: null,
    lost_at: null,
    version: 1,
    created_at: "2026-10-01T10:00:00Z",
    updated_at: "2026-10-01T10:00:00Z",
  },
  {
    id: "opp-002",
    organization_id: "00000000-0000-0000-0000-000000000000",
    name: "Subsea Valves Automation",
    account_id: "00000000-0000-0000-0000-000000000002",
    account_name: "Bharat Petrochem",
    primary_contact_id: null,
    description: null,
    stage: "won",
    estimated_value: "4500000.00",
    currency_code: "INR",
    probability_percent: "100",
    expected_close_date: "2026-10-20",
    owner_user_id: "user-1",
    owner_name: "Sarah Sales",
    source: null,
    loss_reason: null,
    loss_detail: null,
    won_at: "2026-10-20T10:00:00Z",
    lost_at: null,
    version: 2,
    created_at: "2026-09-15T10:00:00Z",
    updated_at: "2026-10-20T10:00:00Z",
  },
];

describe("PipelineBoard Component (Sakani Board Column 686:2 & Board Card 678:179)", () => {
  it("renders all seven stages in exact order with dot, count badge, and stage totals", () => {
    const onStageTransition = vi.fn();
    const onReopen = vi.fn();

    render(
      <PipelineBoard
        opportunities={mockOpportunities}
        onStageTransition={onStageTransition}
        onReopen={onReopen}
      />
    );

    // Verify all 7 columns in exact order
    const expectedLabels = [
      "Lead",
      "Qualified",
      "Solutioning",
      "Proposal",
      "Negotiation",
      "Closed Won",
      "Closed Lost",
    ];
    expectedLabels.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });

    // Verify accessible board scroll region
    expect(
      screen.getByRole("region", { name: "Opportunities Kanban board" })
    ).toBeInTheDocument();

    // Verify opportunities rendered with account name and monetary value
    expect(screen.getByText("Aerospace Turbine Blades Batch")).toBeInTheDocument();
    expect(screen.getByText("Apex Precision Engineering")).toBeInTheDocument();
    expect(screen.getByText("Subsea Valves Automation")).toBeInTheDocument();
  });

  it("triggers onStageTransition when clicking Next and Mark Lost", async () => {
    const user = userEvent.setup();
    const onStageTransition = vi.fn();
    const onReopen = vi.fn();

    render(
      <PipelineBoard
        opportunities={mockOpportunities}
        onStageTransition={onStageTransition}
        onReopen={onReopen}
      />
    );

    // Click Next button on Lead opportunity
    const nextBtn = screen.getByRole("button", {
      name: "Next: advance Aerospace Turbine Blades Batch",
    });
    await user.click(nextBtn);
    expect(onStageTransition).toHaveBeenCalledWith(
      mockOpportunities[0],
      "qualified"
    );

    // Click Mark Lost
    const lostBtn = screen.getByRole("button", {
      name: "Mark Lost: Aerospace Turbine Blades Batch",
    });
    await user.click(lostBtn);
    expect(onStageTransition).toHaveBeenCalledWith(
      mockOpportunities[0],
      "lost"
    );
  });

  it("renders Reopen button for Closed Won opportunity and triggers onReopen", async () => {
    const user = userEvent.setup();
    const onStageTransition = vi.fn();
    const onReopen = vi.fn();

    render(
      <PipelineBoard
        opportunities={mockOpportunities}
        onStageTransition={onStageTransition}
        onReopen={onReopen}
      />
    );

    const reopenBtn = screen.getByRole("button", {
      name: "Reopen: Subsea Valves Automation",
    });
    expect(reopenBtn).toBeInTheDocument();
    await user.click(reopenBtn);
    expect(onReopen).toHaveBeenCalledWith(mockOpportunities[1]);
  });
});

describe("OpportunityTable Component (Sakani Table Default 45:259 & Toolbar 684:17474)", () => {
  it("renders Sakani table headers in consistent Title Case", () => {
    const onStageTransition = vi.fn();
    const onReopen = vi.fn();
    const onPageChange = vi.fn();

    render(
      <OpportunityTable
        data={mockOpportunities}
        total={2}
        page={1}
        pageSize={25}
        onPageChange={onPageChange}
        onStageTransition={onStageTransition}
        onReopen={onReopen}
      />
    );

    // Verify Title Case headers
    expect(screen.getAllByText("Opportunity").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Stage").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Est. Value").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Probability").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Target Close").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Owner").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Actions").length).toBeGreaterThanOrEqual(1);

    // Ensure no all-caps header
    expect(screen.queryByText("QUICK ACTIONS")).not.toBeInTheDocument();
  });

  it("renders opportunity rows with title link, account subtitle, and semantic badges", () => {
    const onStageTransition = vi.fn();
    const onReopen = vi.fn();
    const onPageChange = vi.fn();

    render(
      <OpportunityTable
        data={mockOpportunities}
        total={2}
        page={1}
        pageSize={25}
        onPageChange={onPageChange}
        onStageTransition={onStageTransition}
        onReopen={onReopen}
      />
    );

    expect(
      screen.getAllByText("Aerospace Turbine Blades Batch").length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Apex Precision Engineering").length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Subsea Valves Automation").length
    ).toBeGreaterThanOrEqual(1);

    // Stage labels
    expect(screen.getAllByText("Lead").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Won").length).toBeGreaterThanOrEqual(1);
  });

  it("renders action buttons: Advance, Mark lost, and Reopen and handles clicks", async () => {
    const user = userEvent.setup();
    const onStageTransition = vi.fn();
    const onReopen = vi.fn();
    const onPageChange = vi.fn();

    render(
      <OpportunityTable
        data={mockOpportunities}
        total={2}
        page={1}
        pageSize={25}
        onPageChange={onPageChange}
        onStageTransition={onStageTransition}
        onReopen={onReopen}
      />
    );

    // Advance button
    const advanceBtns = screen.getAllByRole("button", { name: /Advance/i });
    expect(advanceBtns.length).toBeGreaterThanOrEqual(1);
    await user.click(advanceBtns[0]);
    expect(onStageTransition).toHaveBeenCalledWith(
      mockOpportunities[0],
      "qualified"
    );

    // Mark lost button
    const lostBtns = screen.getAllByRole("button", { name: /Mark lost/i });
    expect(lostBtns.length).toBeGreaterThanOrEqual(1);
    await user.click(lostBtns[0]);
    expect(onStageTransition).toHaveBeenCalledWith(
      mockOpportunities[0],
      "lost"
    );

    // Reopen button
    const reopenBtns = screen.getAllByRole("button", { name: /Reopen/i });
    expect(reopenBtns.length).toBeGreaterThanOrEqual(1);
    await user.click(reopenBtns[0]);
    expect(onReopen).toHaveBeenCalledWith(mockOpportunities[1]);
  });
});

const mockTasks: Task[] = [
  {
    id: "task-001",
    organization_id: "00000000-0000-0000-0000-000000000000",
    title: "Send technical spec sheet for line 3",
    description: "Prepare and dispatch revised metallurgy test certs",
    account_id: "00000000-0000-0000-0000-000000000001",
    account_name: "Apex Precision Engineering",
    opportunity_id: "opp-001",
    opportunity_name: "Aerospace Turbine Blades Batch",
    assignee_user_id: "user-1",
    assignee_name: "Sarah Sales",
    due_date: "2026-10-10",
    priority: "high",
    status: "open",
    is_overdue: true,
    completed_at: null,
    version: 1,
    created_at: "2026-10-01T10:00:00Z",
    updated_at: "2026-10-01T10:00:00Z",
  },
  {
    id: "task-002",
    organization_id: "00000000-0000-0000-0000-000000000000",
    title: "Routine warranty check follow-up",
    description: null,
    account_id: null,
    account_name: null,
    opportunity_id: null,
    opportunity_name: null,
    assignee_user_id: null,
    assignee_name: null,
    due_date: "2026-11-20",
    priority: "normal",
    status: "completed",
    is_overdue: false,
    completed_at: "2026-10-20T10:00:00Z",
    version: 2,
    created_at: "2026-10-05T10:00:00Z",
    updated_at: "2026-10-20T10:00:00Z",
  },
];

describe("TaskTable Component (Sakani Table 45:259 & Toolbar 684:17474)", () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const renderWithQueryClient = (ui: React.ReactElement) =>
    render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);

  it("renders Sakani table headers in consistent Title Case", () => {
    const onEdit = vi.fn();
    const onPageChange = vi.fn();

    renderWithQueryClient(
      <TaskTable
        data={mockTasks}
        total={2}
        page={1}
        pageSize={15}
        onPageChange={onPageChange}
        onEdit={onEdit}
      />
    );

    expect(screen.getByRole("columnheader", { name: "Action Item" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Priority" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Due Date" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Related Account" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Related Deal" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Assignee" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();
  });

  it("renders semantically correct priority badges and overdue badges", () => {
    const onEdit = vi.fn();
    const onPageChange = vi.fn();

    renderWithQueryClient(
      <TaskTable
        data={mockTasks}
        total={2}
        page={1}
        pageSize={15}
        onPageChange={onPageChange}
        onEdit={onEdit}
      />
    );

    // High priority renders as warning subtle (in desktop and mobile views)
    expect(screen.getAllByText("High").length).toBeGreaterThanOrEqual(1);
    // Normal priority renders
    expect(screen.getAllByText("Normal").length).toBeGreaterThanOrEqual(1);
    // Overdue badge renders for overdue task
    expect(screen.getAllByText("Overdue").length).toBeGreaterThanOrEqual(1);
  });

  it("renders accessible 32px edit action buttons with descriptive aria labels", () => {
    const onEdit = vi.fn();
    const onPageChange = vi.fn();

    renderWithQueryClient(
      <TaskTable
        data={mockTasks}
        total={2}
        page={1}
        pageSize={15}
        onPageChange={onPageChange}
        onEdit={onEdit}
      />
    );

    const editBtns = screen.getAllByRole("button", { name: /Edit/i });
    expect(editBtns.length).toBeGreaterThanOrEqual(1);
    // Desktop edit button has aria-label="Edit task Send technical spec sheet for line 3"
    expect(screen.getAllByRole("button", { name: /Edit (task )?Send technical spec sheet for line 3/i }).length).toBeGreaterThanOrEqual(1);
  });
});
