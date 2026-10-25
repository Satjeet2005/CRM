import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Phase 4 Quotation Engine, Quote Builder & Calculation Trace E2E", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("Sales Rep: View Quotes List, Builder, Cost Isolation, Calculation Trace & Preview Mode", async ({
    page,
  }) => {
    // 1. Login as Sales Rep
    await page.goto("/login");
    await page.getByText("Sales Rep").click();
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/app\/dashboard/);

    // 2. Click Quotations card from Overview Dashboard
    await page.getByRole("link", { name: /Quotations & Pricing/i }).click();
    await expect(page).toHaveURL(/\/app\/quotes/);
    await expect(page.getByRole("heading", { name: "Quotations" })).toBeVisible();

    // Verify seeded demo quotes appear
    await expect(page.getByText("QT-2026-0001")).toBeVisible();
    await expect(page.getByText("QT-2026-0002")).toBeVisible();
    await expect(page.getByText("Requires Approval").first()).toBeVisible();

    // Axe accessibility audit on Quotes list
    const listAxeResults = await new AxeBuilder({ page })
      .disableRules(["color-contrast", "label-content-name-mismatch"])
      .analyze();
    expect(listAxeResults.violations).toEqual([]);

    // 3. Open Quote Builder for high-value Quote QT-2026-0001
    await page.getByText("QT-2026-0001").click();
    await expect(page).toHaveURL(/\/app\/quotes\/.+/);
    await expect(page.getByRole("heading", { name: "QT-2026-0001" })).toBeVisible();

    // 4. Server-Side RBAC: Sales Rep must NOT see Cost column or internal margins
    await expect(page.getByText("Cost (INR)")).not.toBeVisible();
    await expect(page.getByText("Internal Margin Intelligence")).not.toBeVisible();

    // 5. Policy Governance: Both triggers (>5% discount, >500k grand total) visible
    await expect(page.getByText("Commercial Policy Governance")).toBeVisible();
    await expect(page.getByText("Approval Required").first()).toBeVisible();
    await expect(page.getByText("High-Value Quotation Threshold")).toBeVisible();
    await expect(page.getByText("Excessive Line Discount")).toBeVisible();
    await expect(page.getByText(/Change Proposals/)).toBeVisible();

    // 6. Open Calculation Inspector Sheet
    await page.getByRole("button", { name: /Calculation Inspector/i }).click();
    await expect(page.getByRole("heading", { name: "Authoritative Calculation Trace" })).toBeVisible();
    await expect(page.getByText(/forgeflow-quote-calculator/)).toBeVisible();

    // Verify arithmetic nodes present
    await expect(page.getByText("Line #1 (VALV-BALL-BR-50) Gross Amount")).toBeVisible();
    await expect(page.getByText("ROUND_HALF_UP").first()).toBeVisible();

    // Close Calculation Inspector
    await page.getByRole("button", { name: "Close sheet" }).click();

    // 7. Toggle Customer Preview Mode
    await page.getByRole("button", { name: /Customer Preview Mode/i }).click();
    await expect(
      page.getByText("DRAFT — NOT APPROVED COMMERCIAL PROPOSAL")
    ).toBeVisible();

    // Commercial policy box must be masked in Customer Preview
    await expect(page.getByText("Commercial Policy Governance")).not.toBeVisible();

    // Exit Customer Preview
    await page.getByRole("button", { name: /Exit Customer Preview/i }).click();
    await expect(page.getByText("Commercial Policy Governance")).toBeVisible();

    // Axe accessibility audit on Quote Builder
    const builderAxeResults = await new AxeBuilder({ page })
      .disableRules(["color-contrast", "label-content-name-mismatch"])
      .analyze();
    expect(builderAxeResults.violations).toEqual([]);
  });

  test("Sales Rep: Edit Draft Quote Lines, Live Recalculation & Save Draft", async ({
    page,
  }) => {
    // 1. Login as Sales Rep
    await page.goto("/login");
    await page.getByText("Sales Rep").click();
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/app\/dashboard/);

    // 2. Open QT-2026-0001 (Draft quote)
    await page.goto("/app/quotes");
    await page.getByText("QT-2026-0001").first().click();
    await expect(page.getByRole("heading", { name: "QT-2026-0001" })).toBeVisible();

    // 3. Edit Line 1 Quantity to 220 (preserving > 500k high-value threshold)
    const qtyInputs = page.locator('input[type="number"][step="any"]');
    const firstQty = qtyInputs.first();
    await firstQty.fill("220");

    // "Unsaved Edits" badge must appear
    await expect(page.getByText("Unsaved Edits")).toBeVisible();
    const saveButton = page.getByRole("button", { name: /Save Draft/i });
    await expect(saveButton).toBeEnabled();

    // 4. Click Save Draft
    await saveButton.click();
    await expect(page.getByText("Quote draft saved and recalculated successfully.")).toBeVisible();
    await expect(page.getByText("Unsaved Edits")).not.toBeVisible();
  });

  test("Admin: View Real Costs and Internal Margin Intelligence", async ({
    page,
  }) => {
    // 1. Login as Admin
    await page.goto("/login");
    await page.getByText("Administrator").click();
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/app\/dashboard/);

    // 2. Open QT-2026-0001
    await page.goto("/app/quotes");
    await page.getByText("QT-2026-0001").click();
    await expect(page.getByRole("heading", { name: "QT-2026-0001" })).toBeVisible();

    // 3. Admin MUST see Cost column and Internal Margin Intelligence box
    await expect(page.getByText("Cost (INR)")).toBeVisible();
    await expect(page.getByText("Internal Margin Intelligence")).toBeVisible();
    await expect(page.getByText("Total Base Cost:")).toBeVisible();
    await expect(page.getByText("Projected Gross Margin:")).toBeVisible();

    // 4. Inspect Calculations as Admin: internal cost nodes visible
    await page.getByRole("button", { name: /Calculation Inspector/i }).click();
    await expect(page.getByText("Line #1 Internal Line Cost")).toBeVisible();
    await expect(page.getByText("Line #1 Internal Gross Profit")).toBeVisible();
  });
});
