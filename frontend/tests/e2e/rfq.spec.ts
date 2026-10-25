import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Phase 3 RFQ Ingestion and Line-Item Review Studio E2E", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("Sales Rep: Complete RFQ Ingestion Wizard, Review Studio, and Bulk Acceptance", async ({
    page,
  }) => {
    // 1. Login as Sales Rep
    await page.goto("/login");
    await page.getByText("Sales Rep").click();
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/app\/dashboard/);

    // 2. Navigate to RFQs List
    await page.goto("/app/rfqs");
    await expect(page).toHaveURL(/\/app\/rfqs/);
    await expect(page.getByRole("heading", { name: "Request for Quotations (RFQs)" })).toBeVisible();

    // Verify seeded demo RFQs are rendered
    await page.fill('input[placeholder*="Search RFQ"]', "Turnaround Piping");
    await expect(page.getByText("Turnaround Piping & Valves Batch A")).toBeVisible();
    await page.fill('input[placeholder*="Search RFQ"]', "");

    // 3. Open Import Wizard
    await page.getByRole("button", { name: /Import RFQ/i }).click();
    await expect(page).toHaveURL(/\/app\/rfqs\/new/);
    await expect(page.getByRole("heading", { name: "Import RFQ Spreadsheet" })).toBeVisible();

    // Step 1: Select Context
    await page.selectOption('select:has-text("Select Account...")', { label: "Apex Heavy Engineering Ltd." });
    
    // Wait for opportunities query to resolve and populate select
    const oppSelect = page.locator('select:has-text("Select Opportunity...")');
    await expect(oppSelect).toBeVisible();
    await expect(page.locator('option:has-text("High-Pressure Valve")')).toBeAttached({ timeout: 5000 });
    await oppSelect.selectOption({ index: 1 });

    const runId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const newRfqTitle = `Piping Replacement Package ${runId}`;
    await page.fill('input[placeholder*="Turnaround Piping"]', newRfqTitle);
    await page.fill('input[placeholder*="PO-REQ"]', `PO-REQ-E2E-${runId}`);

    // Upload CSV file via file input with unique content to ensure unique hash
    const sampleCsvContent = `Item Description,Quantity,UOM,Part Number
GI Pipe 15mm Class A,10,mtr,PIPE-001
GI Pipe 20mm Class A,20,mtr,PIPE-003
Brass Ball Valve Screwed 25mm,5,nos,VALV-003
MS Hex Bolt M12x50,100,nos,FAST-${runId}
`;

    await page.locator('input[type="file"]').setInputFiles({
      name: `rfq_e2e_${runId}.csv`,
      mimeType: "text/csv",
      buffer: Buffer.from(sampleCsvContent, "utf-8"),
    });

    // Verify preview summary appeared
    await expect(page.getByText("4 data rows detected")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Valid CSV structure ready for mapping")).toBeVisible();

    // Continue to Mapping
    await page.getByRole("button", { name: /Continue to Mapping/i }).click();

    // Step 2: Mapping configuration
    await expect(page.getByText("Header Mapping Configuration")).toBeVisible();
    await expect(page.getByText("Raw CSV Sample Rows")).toBeVisible();

    // Check duplicate override checkbox
    await page.getByLabel("Allow re-import if this file content hash already exists").check();

    // Ingest & Open Review Studio
    const ingestBtn = page.getByRole("button", { name: /Ingest & Open Review Studio/i });
    await expect(ingestBtn).toBeEnabled();
    await ingestBtn.click();

    // Verify redirected to Review Studio
    await expect(page).toHaveURL(/\/app\/rfqs\/[a-f0-9-]+/, { timeout: 25000 });
    await expect(page.getByText(newRfqTitle)).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Total Lines")).toBeVisible();

    // 4. Test Bulk Accept Exact Matches if button visible
    const bulkButton = page.getByRole("button", { name: /Bulk Accept Exact/i });
    if (await bulkButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await bulkButton.click();
      await expect(page.getByText(/Bulk-accepted/i)).toBeVisible({ timeout: 5000 });
    }

    // 5. Test Line Selection & Inspector Sheet
    // Target the Review button specifically inside the table row
    const rowReviewBtn = page.locator("tbody tr").first().getByRole("button", { name: /^Review/ });
    await expect(rowReviewBtn).toBeVisible({ timeout: 5000 });
    await rowReviewBtn.click();

    // Verify Inspector Sheet opened and loaded line details
    await expect(page.getByText("Parsed Quantity & Dimensions")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/System Candidate Suggestions/i)).toBeVisible({ timeout: 10000 });

    // 6. Accessibility Audit on Review Studio
    const axeResults = await new AxeBuilder({ page })
      .disableRules(["color-contrast", "label-content-name-mismatch"])
      .analyze();
    expect(axeResults.violations).toEqual([]);
  });

  test("Blocking RFQ: Verify Create Quotation is disabled with explicit diagnostics", async ({
    page,
    isMobile,
  }) => {
    // 1. Login as Sales Rep
    await page.goto("/login");
    await page.getByText("Sales Rep").click();
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/app\/dashboard/);

    // 2. Navigate to seeded Blocking RFQ
    await page.goto("/app/rfqs");
    await page.fill('input[placeholder*="Search RFQ"]', "Emergency Plant Shutdown");
    await page.getByText("Emergency Plant Shutdown Requisition").click();

    // 3. Verify in Review Studio
    await expect(page).toHaveURL(/\/app\/rfqs\/[a-f0-9-]+/);
    await expect(page.getByText("Emergency Plant Shutdown Requisition")).toBeVisible();

    // Verify quotation button is disabled
    const createQuoteBtn = page.getByRole("button", { name: /Create Quotation/i });
    await expect(createQuoteBtn).toBeDisabled();

    // Hover parent container to view blocking explanation on desktop/tablet
    if (!isMobile) {
      await page.locator('.group:has-text("Create Quotation")').hover();
      await expect(page.getByText(/Quotation Gate Blocked/i)).toBeVisible();
    }
  });

  test("Catalog Reviewer: Rematch Catalog action is available", async ({ page }) => {
    // 1. Login as Catalog Reviewer
    await page.goto("/login");
    await page.getByText("Catalog Reviewer").click();
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/app\/dashboard/);

    // 2. Open any RFQ
    await page.goto("/app/rfqs");
    await page.fill('input[placeholder*="Search RFQ"]', "Turnaround Piping");
    await page.getByText("Turnaround Piping & Valves Batch A").click();

    // 3. Verify Rematch button is present and accessible
    const rematchBtn = page.getByRole("button", { name: /Rematch/i });
    await expect(rematchBtn).toBeVisible();
  });
});
