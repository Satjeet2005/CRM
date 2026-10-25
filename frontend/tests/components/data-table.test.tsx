import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-display/data-table";

interface TestRow {
  id: string;
  name: string;
  role: string;
}

const columns: ColumnDef<TestRow>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "role",
    header: "Role",
  },
];

describe("DataTable Component", () => {
  it("renders data rows and headers properly", () => {
    const data: TestRow[] = [
      { id: "1", name: "Sarah Sales", role: "sales_rep" },
      { id: "2", name: "Marcus Manager", role: "sales_manager" },
    ];

    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Role")).toBeInTheDocument();
    expect(screen.getByText("Sarah Sales")).toBeInTheDocument();
    expect(screen.getByText("Marcus Manager")).toBeInTheDocument();
  });

  it("renders empty state when no data is provided", () => {
    render(<DataTable columns={columns} data={[]} emptyTitle="No Accounts" />);
    expect(screen.getByText("No Accounts")).toBeInTheDocument();
  });
});
