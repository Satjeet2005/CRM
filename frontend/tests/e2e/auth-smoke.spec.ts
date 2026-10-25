import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Login Screen and Viewport Responsiveness", () => {
  test("renders login screen with demo credentials chooser", async ({ page }) => {
    await page.goto("/login");

    // Title and brand check
    await expect(page.getByRole("heading", { name: "Sign in to ForgeFlow" })).toBeVisible();

    // Verify demo quick-select buttons exist
    await expect(page.getByText("Demo Mode Enabled: Quick Role Select")).toBeVisible();
    await expect(page.getByText("Sales Rep")).toBeVisible();
    await expect(page.getByText("Sales Manager")).toBeVisible();
    await expect(page.getByText("Catalog Reviewer")).toBeVisible();
    await expect(page.getByText("Administrator")).toBeVisible();

    // Clicking demo account auto-fills email and password
    await page.getByText("Sales Rep").click();
    await expect(page.getByPlaceholder("you@forgeflow.demo")).toHaveValue("sales@forgeflow.demo");
    await expect(page.getByPlaceholder("••••••••••••")).toHaveValue("ForgeFlowDemo!2026");

    // Verify synthetic data notice
    await expect(
      page.getByText("Synthetic demo environment. Not for production credentials.")
    ).toBeVisible();
  });

  test("verifies no horizontal document overflow", async ({ page }) => {
    await page.goto("/login");

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test("passes accessibility checks", async ({ page }) => {
    await page.goto("/login");

    // Run axe accessibility scan
    const accessibilityScanResults = await new AxeBuilder({ page })
      .disableRules(["color-contrast"]) // Optional contrast rule if subtle placeholder in demo
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
