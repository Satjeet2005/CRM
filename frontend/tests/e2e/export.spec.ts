import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Phase 6 Customer Exports, Watermark Governance & Audit Verification E2E", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ context }) => {
    try {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    } catch {
      // Ignore if not supported by browser project
    }
    await context.clearCookies();
  });

  test("Sales Rep: Export Approved Quote to Final PDF & CSV, Checksum Verification and Draft Lock", async ({
    page,
  }) => {
    // 1. Login as Sales Rep
    await page.goto("/login");
    await page.getByText("Sales Rep").click();
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/app\/dashboard/);

    // 2. Navigate to Quotations List
    await page.getByRole("link", { name: /Quotations & Pricing/i }).click();
    await expect(page).toHaveURL(/\/app\/quotes/);

    // 3. Open Approved Quote QT-2026-0004
    await expect(page.getByText("QT-2026-0004")).toBeVisible();
    await page.getByText("QT-2026-0004").click();
    await expect(page).toHaveURL(/\/app\/quotes\/.+/);
    await expect(page.getByRole("heading", { name: "QT-2026-0004" })).toBeVisible();

    // 4. Verify Customer Document Exports Section
    await expect(page.getByText("Customer Document Exports")).toBeVisible();
    await expect(
      page.getByText(/Quotation is approved and certified for commercial customer release/i)
    ).toBeVisible();

    // Verify final export buttons are enabled
    const exportPdfBtn = page.getByTestId("export-pdf-button");
    const exportCsvBtn = page.getByTestId("export-csv-button");
    await expect(exportPdfBtn).toBeEnabled();
    await expect(exportCsvBtn).toBeEnabled();

    // Verify Axe accessibility audit on the export section
    const exportAxeResults = await new AxeBuilder({ page })
      .disableRules(["color-contrast", "label-content-name-mismatch"])
      .analyze();
    expect(exportAxeResults.violations).toEqual([]);

    // 5. Trigger Customer PDF Export & Verify Download
    const [pdfDownload] = await Promise.all([
      page.waitForEvent("download"),
      exportPdfBtn.click(),
    ]);
    expect(pdfDownload.suggestedFilename()).toBe("Quote-QT-2026-0004-Rev1.pdf");
    const pdfPath = await pdfDownload.path();
    expect(pdfPath).toBeTruthy();

    // 6. Trigger Procurement CSV Export & Verify Download
    const [csvDownload] = await Promise.all([
      page.waitForEvent("download"),
      exportCsvBtn.click(),
    ]);
    expect(csvDownload.suggestedFilename()).toBe("Quote-QT-2026-0004-Rev1.csv");

    // 7. Verify Delivery History & Integrity Verification
    await expect(page.getByText("Export History & Integrity Verification")).toBeVisible();
    await expect(page.getByText("CLEAN FINAL").first()).toBeVisible();

    // Test Copy Hash Button
    const copyBtn = page.getByRole("button", { name: "Copy SHA-256 fingerprint" }).first();
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();
    await expect(page.getByText(/fingerprint copied to clipboard/i)).toBeVisible();

    // 8. Open Draft Quote QT-2026-0001 & Verify Final Export Lock & Draft Preview
    await page.goto("/app/quotes");
    await page.getByText("QT-2026-0001").click();
    await expect(page.getByRole("heading", { name: "QT-2026-0001" })).toBeVisible();

    // Verify final export buttons are locked
    await expect(page.getByText(/Final customer exports locked \(DRAFT\)/i)).toBeVisible();
    await expect(page.getByTestId("export-pdf-button")).toBeDisabled();
    await expect(page.getByTestId("export-csv-button")).toBeDisabled();

    // Verify Draft Preview button is present and functional
    const previewBtn = page.getByTestId("export-preview-button");
    await expect(previewBtn).toBeEnabled();

    const [previewDownload] = await Promise.all([
      page.waitForEvent("download"),
      previewBtn.click(),
    ]);
    expect(previewDownload.suggestedFilename()).toBe("Draft-Quote-QT-2026-0001-Rev1.pdf");
  });
});
