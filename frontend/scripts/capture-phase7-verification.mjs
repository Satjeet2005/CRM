/**
 * Phase 7 Visual and Accessibility Verification Capture Script
 *
 * Captures screenshots across Desktop (1440x900), Tablet (1024x768), and Mobile (390x844) for:
 * 1. Approvals Queue (/app/approvals) - Sales Manager
 * 2. Proposal Review Sheet - Diff, Financial Impact, Policy Snapshot
 * 3. Approve Proposal Confirmation Dialog
 * 4. Reject Proposal Dialog with Rejection Reason Validation
 * 5. Maker-Checker Security Invariant Warning (Proposer perspective)
 * 6. Approvals Queue Read-Only Notice (Sales Rep perspective)
 *
 * Runs Axe-core accessibility scans on each view and outputs a verification JSON.
 */

import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const OUTPUT_DIR = path.resolve(import.meta.dirname, "../../docs/design-mapping/screenshots/phase7");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function run() {
  const browser = await chromium.launch({ headless: true });
  const report = {
    timestamp: new Date().toISOString(),
    axeResults: {},
    screenshots: [],
  };

  console.log("Starting Phase 7 verification captures...");

  // Context for Sales Manager
  const managerContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const managerPage = await managerContext.newPage();

  console.log("1. Authenticating as Sales Manager...");
  await managerPage.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await managerPage.getByText("Sales Manager").click();
  await managerPage.getByRole("button", { name: "Sign In" }).click();
  await managerPage.waitForURL("**/app/dashboard", { timeout: 10000 });
  await managerPage.waitForTimeout(500);

  // 1. Approvals Queue (/app/approvals)
  console.log("2. Capturing Approvals Queue (/app/approvals)...");
  await managerPage.goto("http://localhost:3000/app/approvals", { waitUntil: "networkidle" });
  await managerPage.waitForSelector("table tbody tr", { timeout: 10000 });
  await managerPage.waitForTimeout(600);

  // Desktop
  await managerPage.setViewportSize({ width: 1440, height: 900 });
  await managerPage.waitForTimeout(400);
  const queueDesktop = "approvals-queue-desktop-1440x900.png";
  await managerPage.screenshot({ path: path.join(OUTPUT_DIR, queueDesktop) });
  report.screenshots.push(queueDesktop);

  const queueAxe = await new AxeBuilder({ page: managerPage })
    .disableRules(["color-contrast", "label-content-name-mismatch"])
    .analyze();
  report.axeResults["approvals-queue-desktop"] = queueAxe.violations.length;
  console.log(`  Approvals Queue Desktop Axe violations: ${queueAxe.violations.length}`);

  // Tablet
  await managerPage.setViewportSize({ width: 1024, height: 768 });
  await managerPage.waitForTimeout(400);
  const queueTablet = "approvals-queue-tablet-1024x768.png";
  await managerPage.screenshot({ path: path.join(OUTPUT_DIR, queueTablet) });
  report.screenshots.push(queueTablet);

  // Mobile
  await managerPage.setViewportSize({ width: 390, height: 844 });
  await managerPage.waitForTimeout(400);
  const queueMobile = "approvals-queue-mobile-390x844.png";
  await managerPage.screenshot({ path: path.join(OUTPUT_DIR, queueMobile) });
  report.screenshots.push(queueMobile);

  // Reset viewport to desktop
  await managerPage.setViewportSize({ width: 1440, height: 900 });
  await managerPage.waitForTimeout(400);

  // 2. Open Proposal Review Sheet from Approvals Queue
  console.log("3. Opening Proposal Review Sheet...");
  const reviewBtn = managerPage.getByRole("button", { name: /Review/i }).first();
  await reviewBtn.click();
  await managerPage.waitForSelector("[data-slot='sheet-popup'], div[role='dialog']", { timeout: 10000 });
  await managerPage.getByText("Financial Impact & Commercial Deltas").waitFor({ timeout: 10000 });
  await managerPage.waitForTimeout(600);

  // Desktop Review Sheet
  const sheetDesktop = "proposal-review-sheet-desktop-1440x900.png";
  await managerPage.screenshot({ path: path.join(OUTPUT_DIR, sheetDesktop) });
  report.screenshots.push(sheetDesktop);

  const sheetAxe = await new AxeBuilder({ page: managerPage })
    .disableRules(["color-contrast", "label-content-name-mismatch"])
    .analyze();
  report.axeResults["proposal-review-sheet-desktop"] = sheetAxe.violations.length;
  console.log(`  Proposal Review Sheet Desktop Axe violations: ${sheetAxe.violations.length}`);

  // Tablet Review Sheet
  await managerPage.setViewportSize({ width: 1024, height: 768 });
  await managerPage.waitForTimeout(400);
  const sheetTablet = "proposal-review-sheet-tablet-1024x768.png";
  await managerPage.screenshot({ path: path.join(OUTPUT_DIR, sheetTablet) });
  report.screenshots.push(sheetTablet);

  // Mobile Review Sheet
  await managerPage.setViewportSize({ width: 390, height: 844 });
  await managerPage.waitForTimeout(400);
  const sheetMobile = "proposal-review-sheet-mobile-390x844.png";
  await managerPage.screenshot({ path: path.join(OUTPUT_DIR, sheetMobile) });
  report.screenshots.push(sheetMobile);

  // Reset viewport to desktop
  await managerPage.setViewportSize({ width: 1440, height: 900 });
  await managerPage.waitForTimeout(400);

  // 3. Open Reject Proposal Dialog and trigger validation
  console.log("4. Testing Reject Proposal Modal Dialog & Validation...");
  const rejectBtn = managerPage.getByRole("button", { name: /Reject/i }).first();
  if (await rejectBtn.isVisible()) {
    await rejectBtn.click();
    await managerPage.waitForTimeout(500);
    // Click Confirm Rejection without filling reason to trigger validation error
    const confirmRejectBtn = managerPage.getByRole("button", { name: "Confirm Rejection" });
    if (await confirmRejectBtn.isVisible()) {
      await confirmRejectBtn.click();
      await managerPage.waitForTimeout(300);
    }
    const rejectModalImg = "proposal-reject-dialog-desktop.png";
    await managerPage.screenshot({ path: path.join(OUTPUT_DIR, rejectModalImg) });
    report.screenshots.push(rejectModalImg);

    const rejectAxe = await new AxeBuilder({ page: managerPage })
      .disableRules(["color-contrast", "label-content-name-mismatch"])
      .analyze();
    report.axeResults["proposal-reject-dialog"] = rejectAxe.violations.length;
    console.log(`  Reject Dialog Axe violations: ${rejectAxe.violations.length}`);

    // Cancel out of reject modal
    const cancelBtn = managerPage.getByRole("button", { name: "Cancel" });
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
      await managerPage.waitForTimeout(400);
    }
  }

  // 4. Open Approve Proposal Dialog
  console.log("5. Testing Approve Proposal Modal Dialog...");
  const approveBtn = managerPage.getByRole("button", { name: /Approve Proposal/i });
  if (await approveBtn.isVisible() && await approveBtn.isEnabled()) {
    await approveBtn.click();
    await managerPage.waitForTimeout(500);
    const approveModalImg = "proposal-approve-dialog-desktop.png";
    await managerPage.screenshot({ path: path.join(OUTPUT_DIR, approveModalImg) });
    report.screenshots.push(approveModalImg);

    const approveAxe = await new AxeBuilder({ page: managerPage })
      .disableRules(["color-contrast", "label-content-name-mismatch"])
      .analyze();
    report.axeResults["proposal-approve-dialog"] = approveAxe.violations.length;
    console.log(`  Approve Dialog Axe violations: ${approveAxe.violations.length}`);

    // Cancel out
    const cancelApproveBtn = managerPage.getByRole("button", { name: "Cancel" });
    if (await cancelApproveBtn.isVisible()) {
      await cancelApproveBtn.click();
      await managerPage.waitForTimeout(400);
    }
  }

  await managerContext.close();

  // 5. Context for Sales Rep: Maker-Checker Invariant & Read-Only Approvals Notice
  console.log("6. Authenticating as Sales Rep (Proposer role)...");
  const repContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const repPage = await repContext.newPage();

  await repPage.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await repPage.getByText("Sales Rep").click();
  await repPage.getByRole("button", { name: "Sign In" }).click();
  await repPage.waitForURL("**/app/dashboard", { timeout: 10000 });
  await repPage.waitForTimeout(500);

  // Navigate to /app/approvals as Sales Rep to capture Read-Only Notice
  console.log("7. Capturing Approvals Queue Read-Only Notice as Sales Rep...");
  await repPage.goto("http://localhost:3000/app/approvals", { waitUntil: "networkidle" });
  await repPage.waitForTimeout(800);
  const repQueueImg = "approvals-queue-sales-rep-notice-desktop.png";
  await repPage.screenshot({ path: path.join(OUTPUT_DIR, repQueueImg) });
  report.screenshots.push(repQueueImg);

  // Navigate to QT-2026-0002 to create and inspect Maker-Checker Invariant
  console.log("8. Verifying Maker-Checker Security Invariant as Proposer...");
  await repPage.goto("http://localhost:3000/app/quotes", { waitUntil: "networkidle" });
  await repPage.getByText("QT-2026-0002").first().click();
  await repPage.waitForURL(/\/app\/quotes\/.+/, { timeout: 10000 });
  await repPage.waitForTimeout(600);

  // Open existing or create new proposal
  const newPropBtn = repPage.getByRole("button", { name: /New Proposal/i });
  if (await newPropBtn.isVisible()) {
    await newPropBtn.click();
    await repPage.waitForTimeout(500);
    await repPage.fill("#prop-title", "Security Check Verification Proposal");
    await repPage.fill("#prop-justification", "Maker-checker invariant audit verification proposal.");
    await repPage.fill("#op-value-input", "5.00");
    await repPage.getByRole("button", { name: /^Add$/i }).click();
    await repPage.waitForTimeout(300);
    await repPage.getByRole("button", { name: "Create Change Proposal" }).click();
    await repPage.waitForTimeout(800);

    // Submit for review
    const submitBtn = repPage.getByRole("button", { name: /Submit for Review/i });
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await repPage.waitForTimeout(800);
    }
  }

  // Capture Maker-Checker Warning Sheet
  const makerCheckerImg = "proposal-maker-checker-warning-desktop.png";
  await repPage.screenshot({ path: path.join(OUTPUT_DIR, makerCheckerImg) });
  report.screenshots.push(makerCheckerImg);

  const mcAxe = await new AxeBuilder({ page: repPage })
    .disableRules(["color-contrast", "label-content-name-mismatch"])
    .analyze();
  report.axeResults["proposal-maker-checker-sheet"] = mcAxe.violations.length;
  console.log(`  Maker-Checker Sheet Axe violations: ${mcAxe.violations.length}`);

  await repContext.close();
  await browser.close();

  // Write report
  const reportPath = path.join(OUTPUT_DIR, "phase7-verification-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nPhase 7 Verification complete! Captured ${report.screenshots.length} screenshots. Report written to ${reportPath}`);
}

run().catch((err) => {
  console.error("Verification script failed:", err);
  process.exit(1);
});
