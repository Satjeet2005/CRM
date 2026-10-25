import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsNav } from "@/features/settings/components/settings-nav";
import { OrganizationCard } from "@/features/settings/components/organization-card";
import { SessionCard } from "@/features/settings/components/session-card";
import { PermissionsGrid } from "@/features/settings/components/permissions-grid";
import type { AuthUser } from "@/hooks/use-auth";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/app/settings",
}));

const mockUser: AuthUser = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "admin@forgeflow.demo",
  display_name: "Alex Admin",
  role: "admin",
  organization: {
    id: "00000000-0000-0000-0000-000000000000",
    name: "ForgeFlow Demo Manufacturing",
    slug: "forgeflow-demo",
    currency: "INR",
    timezone: "Asia/Kolkata",
  },
  permissions: [
    "audit:read",
    "catalog:read",
    "catalog:write",
    "crm:read",
    "crm:write",
    "proposals:read",
    "proposals:write",
    "quotes:approve",
    "quotes:read",
    "quotes:write",
    "rfq:approve",
    "rfq:read",
    "rfq:write",
    "settings:read",
    "users:read",
    "users:write",
  ],
};

describe("SettingsNav Component", () => {
  it("renders all 3 functional destinations with accessible links", () => {
    render(<SettingsNav />);

    const nav = screen.getByRole("navigation", { name: /settings navigation/i });
    expect(nav).toBeInTheDocument();

    const overviewLinks = screen.getAllByRole("link", { name: /overview/i });
    expect(overviewLinks.length).toBeGreaterThanOrEqual(1);
    expect(overviewLinks[0]).toHaveAttribute("href", "/app/settings");

    const orgLinks = screen.getAllByRole("link", { name: /organization/i });
    expect(orgLinks.length).toBeGreaterThanOrEqual(1);
    expect(orgLinks[0]).toHaveAttribute("href", "/app/settings/organization");

    const secLinks = screen.getAllByRole("link", { name: /security & access/i });
    expect(secLinks.length).toBeGreaterThanOrEqual(1);
    expect(secLinks[0]).toHaveAttribute("href", "/app/settings/security");
  });
});

describe("OrganizationCard Component", () => {
  it("renders organization metadata and governance notice correctly", () => {
    render(<OrganizationCard organization={mockUser.organization} />);

    expect(screen.getAllByText("ForgeFlow Demo Manufacturing").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("forgeflow-demo").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Organization Name")).toBeInTheDocument();
    expect(screen.getByText(/INR/)).toBeInTheDocument();
    expect(screen.getByText(/Asia\/Kolkata/)).toBeInTheDocument();
    expect(screen.getByText("Enterprise Tenant Governance")).toBeInTheDocument();
  });
});

describe("SessionCard Component", () => {
  it("renders user identity, badges, and functional sign out button", async () => {
    const user = userEvent.setup();
    const handleLogout = vi.fn();
    render(<SessionCard user={mockUser} onLogout={handleLogout} />);

    expect(screen.getByText("Alex Admin")).toBeInTheDocument();
    expect(screen.getByText("admin@forgeflow.demo")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Session verified")).toBeInTheDocument();

    const signOutBtn = screen.getByRole("button", { name: /sign out/i });
    expect(signOutBtn).toBeInTheDocument();

    await user.click(signOutBtn);
    expect(handleLogout).toHaveBeenCalledTimes(1);
  });
});

describe("PermissionsGrid Component", () => {
  it("renders all 16 permissions grouped across domains", () => {
    render(<PermissionsGrid permissions={mockUser.permissions} />);

    expect(screen.getByText("Granted Permissions")).toBeInTheDocument();
    expect(screen.getByText("16 permissions")).toBeInTheDocument();

    // Check domain section headers
    expect(screen.getByText("Administration")).toBeInTheDocument();
    expect(screen.getByText("Audit")).toBeInTheDocument();
    expect(screen.getByText("Catalog")).toBeInTheDocument();
    expect(screen.getByText("CRM")).toBeInTheDocument();
    expect(screen.getByText("Proposals")).toBeInTheDocument();
    expect(screen.getByText("Quotes")).toBeInTheDocument();
    expect(screen.getByText("RFQ")).toBeInTheDocument();

    // Verify all 16 permission chips
    mockUser.permissions.forEach((perm) => {
      expect(screen.getByText(perm)).toBeInTheDocument();
    });
  });
});
