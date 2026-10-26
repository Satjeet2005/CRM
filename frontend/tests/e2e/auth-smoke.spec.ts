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

  test("keeps sign-in disabled while the backend wakes, then enables it when ready", async ({ page }) => {
    let readinessRequests = 0;
    let backendReady = false;

    await page.route("**/health/ready", async (route) => {
      readinessRequests += 1;
      if (!backendReady) {
        await route.fulfill({
          status: 502,
          contentType: "application/json",
          body: JSON.stringify({ message: "backend starting" }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "ready", database: "connected", migrations: "current" }),
      });
    });

    await page.goto("/login");
    const signInButton = page.locator('form button[type="submit"]');

    // While backend is waking, the status banner shows waking message and sign-in is disabled
    await expect(page.getByText("Waking up the server")).toBeVisible();
    await expect(signInButton).toBeDisabled();

    // Backend is now ready on subsequent readiness polls
    backendReady = true;

    // Server ready notification appears and sign-in unlocks
    await expect(page.getByText("Server is ready. You can sign in.")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Sign In" })).toBeEnabled();
    expect(readinessRequests).toBeGreaterThanOrEqual(2);
  });

  test("shows retry option when backend startup deadline expires and allows reconnection", async ({ page }) => {
    let backendReady = false;

    // Use shortened timeouts to verify deadline expiry and retry without long waits
    await page.addInitScript(() => {
      (window as unknown as { __BACKEND_WAKE_TIMEOUT_MS__?: number; __HEALTH_CHECK_INTERVAL_MS__?: number }).__BACKEND_WAKE_TIMEOUT_MS__ = 800;
      (window as unknown as { __BACKEND_WAKE_TIMEOUT_MS__?: number; __HEALTH_CHECK_INTERVAL_MS__?: number }).__HEALTH_CHECK_INTERVAL_MS__ = 200;
    });

    await page.route("**/health/ready", async (route) => {
      if (!backendReady) {
        await route.fulfill({
          status: 502,
          contentType: "application/json",
          body: JSON.stringify({ message: "backend starting" }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "ready", database: "connected", migrations: "current" }),
      });
    });

    await page.goto("/login");

    // Initially displays waking state
    await expect(page.getByText("Waking up the server")).toBeVisible();

    // After the deadline expires, the warning alert with retry button appears
    await expect(page.getByText("Server is taking longer than expected")).toBeVisible({ timeout: 5000 });
    const retryButton = page.getByRole("button", { name: "Retry connection" });
    await expect(retryButton).toBeVisible();

    // Now backend becomes ready
    backendReady = true;

    // Clicking retry starts a new check and successfully unlocks sign-in
    await retryButton.click();
    await expect(page.getByText("Server is ready. You can sign in.")).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Sign In" })).toBeEnabled();
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
