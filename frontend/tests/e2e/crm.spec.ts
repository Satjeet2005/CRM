import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Phase 2 Core CRM & Industrial Catalog E2E Workflows", () => {
  test.beforeEach(async ({ page, context }) => {
    // Start with fresh session at login
    await context.clearCookies();
    await page.goto("/login");
  });

  test("Sales Rep: login, dashboard metrics, account creation, pipeline view, task complete/undo", async ({
    page,
  }) => {
    // 1. Login as Sales Rep using quick role chooser
    await page.getByText("Sales Rep").click();
    await page.getByRole("button", { name: /sign in/i }).click();

    // 2. Verify Dashboard loaded with real metrics
    await expect(page).toHaveURL(/\/app\/dashboard/);
    await expect(page.getByRole("heading", { name: "Operations Overview" })).toBeVisible();
    await expect(page.getByText("Total Open Pipeline")).toBeVisible();
    await expect(page.getByText("Open Deals")).toBeVisible();
    await expect(page.getByText("Active Accounts")).toBeVisible();
    await expect(page.getByText("Overdue Tasks", { exact: true })).toBeVisible();

    // Verify Work queues section
    await expect(page.getByRole("heading", { name: "Work queues" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Review RFQs/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /View quotations/i })).toBeVisible();

    // Verify Attention Queue
    await expect(page.getByRole("heading", { name: "Attention Required" })).toBeVisible();

    // 3. Accounts page & creation
    await page.goto("/app/accounts");
    await expect(page).toHaveURL(/\/app\/accounts/);
    await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();

    // Verify seeded accounts are rendered
    await page.fill('input[placeholder*="Search by name"]', "Bharat Petrochem");
    await expect(page.locator('a:visible', { hasText: "Bharat Petrochem Equipment Corp." })).toBeVisible();
    await page.fill('input[placeholder*="Search by name"]', "");

    // Create a new account
    await page.getByRole("button", { name: "New Account" }).click();
    const uniqueAccountName = `Zeta Robotics Automation ${Date.now()}`;
    await page.fill("#acc-name", uniqueAccountName);
    await page.fill("#acc-industry", "Industrial Robotics");
    await page.fill("#acc-email", "procurement@zetarobotics.example");
    await page.getByRole("button", { name: "Create Account" }).click();

    // Verify account appears in list
    await expect(page.locator('a:visible', { hasText: uniqueAccountName })).toBeVisible({ timeout: 5000 });

    // 4. Opportunities page & pipeline toggle
    await page.goto("/app/opportunities");
    await expect(page).toHaveURL(/\/app\/opportunities/);
    await expect(page.getByRole("heading", { name: "Opportunities & Pipeline" })).toBeVisible();

    // Verify Pipeline board columns
    await expect(page.getByText("Closed Won", { exact: true })).toBeVisible();
    await expect(page.getByText("Closed Lost", { exact: true })).toBeVisible();

    // Toggle to Table view
    await page.getByRole("button", { name: "Table" }).click();
    await expect(page.getByRole("button", { name: "Advance" }).first()).toBeVisible();

    // Toggle back to Pipeline view
    await page.getByRole("button", { name: "Pipeline" }).click();

    // 5. Tasks page & complete / undo workflow
    await page.goto("/app/tasks");
    await expect(page).toHaveURL(/\/app\/tasks/);
    await expect(page.getByRole("heading", { name: "Tasks & Follow-ups" })).toBeVisible();

    // Complete first open task
    const completeBtn = page.getByRole("button", { name: /as completed/i }).first();
    await completeBtn.click();

    // Verify 10-second Undo toast appears
    const undoToast = page.getByText(/Task .* completed/);
    await expect(undoToast).toBeVisible();

    const undoButton = page.getByRole("button", { name: "Undo" });
    await expect(undoButton).toBeVisible();
    await undoButton.click();

    // Verify reopened confirmation toast
    await expect(page.getByText(/Task .* reopened/)).toBeVisible();
  });

  test("RBAC Unit Cost Isolation: Sales Rep vs Catalog Manager", async ({ page }) => {
    // 1. Login as Sales Rep
    await page.getByText("Sales Rep").click();
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/app\/dashboard/);

    // Go to catalog
    await page.goto("/app/catalog");
    await expect(page).toHaveURL(/\/app\/catalog/);
    await expect(page.getByRole("heading", { name: "Industrial Product Catalog" })).toBeVisible();

    // Verify Sales View banner
    await expect(page.getByText(/Sales View Active/)).toBeVisible();

    // Verify Internal Cost header is NOT present
    await expect(page.getByRole("columnheader", { name: "Internal Cost" })).not.toBeVisible();

    // 2. Sign out and login as Catalog Reviewer
    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByText("Catalog Reviewer").click();
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/app\/dashboard/);

    // Go to catalog
    await page.goto("/app/catalog");
    await expect(page).toHaveURL(/\/app\/catalog/);

    // Verify Internal Cost header IS present for Catalog Reviewer
    await expect(page.getByRole("columnheader", { name: "Internal Cost" })).toBeVisible();

    // Verify New Product button is visible for Catalog Reviewer
    await expect(page.getByRole("button", { name: "New Product" })).toBeVisible();
  });

  test("Accessibility (Axe-core) across Phase 2 pages", async ({ page }) => {
    // Login as sales manager to have view of all modules
    await page.getByText("Sales Manager").click();
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/app\/dashboard/);

    const pagesToScan = [
      "/app/dashboard",
      "/app/accounts",
      "/app/contacts",
      "/app/opportunities",
      "/app/tasks",
      "/app/catalog",
      "/app/activity",
    ];

    for (const path of pagesToScan) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const results = await new AxeBuilder({ page })
        .disableRules(["color-contrast", "label-content-name-mismatch"])
        .analyze();

      expect(
        results.violations,
        `Accessibility violations found on ${path}`
      ).toEqual([]);
    }
  });
});
