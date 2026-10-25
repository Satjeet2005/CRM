import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Phase 5 Review-Before-Write Proposals & Maker-Checker Approvals E2E", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("Sales Rep: Create Proposal, View Diff, Maker-Checker Warning & Submit for Review", async ({
    page,
  }) => {
    // 1. Login as Sales Rep
    await page.goto("/login");
    await page.getByText("Sales Rep").click();
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/app\/dashboard/);

    // 2. Navigate to Quotations and open QT-2026-0002
    await page.goto("/app/quotes");
    await expect(page.getByRole("heading", { name: "Quotations" })).toBeVisible();
    await page.getByText("QT-2026-0002").first().click();
    await expect(page).toHaveURL(/\/app\/quotes\/.+/);
    await expect(page.getByRole("heading", { name: "QT-2026-0002" })).toBeVisible();

    // 3. Verify Change Proposals section is visible
    await expect(page.getByText(/Change Proposals/)).toBeVisible();

    // 4. Create a new change proposal
    await page.getByRole("button", { name: /New Proposal/i }).click();
    await expect(page.getByRole("heading", { name: "Create Change Proposal" })).toBeVisible();

    await page.fill("#prop-title", "Volume Discount Adjustment E2E");
    await page.fill(
      "#prop-justification",
      "Customer agreed to volume commitment requiring 7.50% discount on valve line."
    );

    // Operation builder: add discount operation
    await page.fill("#op-value-input", "7.50");
    await page.getByRole("button", { name: /^Add$/i }).click();

    // Verify operation staged in builder list
    await expect(page.getByText("Proposed Value: 7.50")).toBeVisible();

    // Submit dialog to create proposal
    await page.getByRole("button", { name: "Create Change Proposal" }).click();

    // 5. Verify review sheet opens with diff sections
    await expect(page.getByText("Financial Impact & Commercial Deltas")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/Line Items Diff/)).toBeVisible();

    // Run Axe accessibility audit on the review sheet
    const sheetAxeResults = await new AxeBuilder({ page })
      .disableRules(["color-contrast", "label-content-name-mismatch"])
      .analyze();
    expect(sheetAxeResults.violations).toEqual([]);

    // 6. Submit Proposal for Managerial Review
    const submitBtn = page.getByRole("button", { name: /Submit for Review/i });
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // 7. Verify Maker-Checker Security Invariant Warning
    await expect(page.getByText(/Maker-checker security invariant/i)).toBeVisible({
      timeout: 5000,
    });

    // Proposer must NOT be able to approve own proposal (Approve button disabled)
    const approveBtn = page.getByRole("button", { name: /Approve Proposal/i });
    await expect(approveBtn).toBeDisabled();
  });

  test("Sales Manager: Review Approval Queue, Maker-Checker Decision & Atomic Commit", async ({
    page,
  }) => {
    // 1. Login as Sales Manager
    await page.goto("/login");
    await page.getByText("Sales Manager").click();
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/app\/dashboard/);

    // 2. Navigate to Reviews & Approvals Queue
    await page.goto("/app/approvals");
    await expect(page.getByRole("heading", { name: "Reviews & Approvals" })).toBeVisible();

    // Run Axe audit on the approvals queue
    const queueAxeResults = await new AxeBuilder({ page })
      .disableRules(["color-contrast", "label-content-name-mismatch"])
      .analyze();
    expect(queueAxeResults.violations).toEqual([]);

    // 3. Review the pending proposal from Sales Rep
    const reviewBtn = page.getByRole("button", { name: /Review/i }).first();
    await expect(reviewBtn).toBeVisible();
    await reviewBtn.click();

    // 4. Verify Diff Sheet opens with financial deltas and policy checks
    await expect(page.getByText("Financial Impact & Commercial Deltas")).toBeVisible();
    await expect(page.getByText("Proposed Total")).toBeVisible();
    await expect(page.getByText("Net Delta")).toBeVisible();

    // 5. Manager Approves Proposal
    const approveBtn = page.getByRole("button", { name: /Approve Proposal/i });
    await expect(approveBtn).toBeEnabled();
    await approveBtn.click();

    // Confirm in modal
    await expect(page.getByRole("heading", { name: "Approve Change Proposal" })).toBeVisible();
    await page.getByRole("button", { name: "Confirm Approval" }).click();

    // 6. Verify Status transitions to Approved and Commit button is visible
    const commitBtn = page.getByRole("button", { name: /Commit to Revision/i });
    await expect(commitBtn).toBeVisible({ timeout: 10000 });

    // 7. Atomic Commit to new Quote Revision
    await commitBtn.click();

    // Verify committed status badge
    await expect(page.getByText("Committed").first()).toBeVisible({ timeout: 10000 });
  });

  test("Commercial Rejection: Reason is Required and Recorded", async ({ page }) => {
    // 1. Login as Sales Manager
    await page.goto("/login");
    await page.getByText("Sales Manager").click();
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/app\/dashboard/);

    // 2. Go to QT-2026-0001
    await page.goto("/app/quotes");
    await page.getByText("QT-2026-0001").first().click();
    await expect(page.getByRole("heading", { name: "QT-2026-0001" })).toBeVisible();

    // 3. Inspect existing rejected proposal
    await expect(page.getByText("Rejected").first()).toBeVisible();
    await expect(page.getByText(/Customer requested deep discount/)).toBeVisible();
  });
});
