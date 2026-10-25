/**
 * Phase 3 Visual and Accessibility Verification Capture Script
 *
 * Captures screenshots across Desktop (1440x900), Tablet (1024x768), and Mobile (390x844) for:
 * 1. Accounts list (/app/accounts)
 * 2. Account detail (/app/accounts/[id])
 * 3. Contacts directory (/app/contacts)
 * 4. Opportunities pipeline (/app/opportunities)
 * 5. Opportunities table (/app/opportunities?view=table)
 * 6. Tasks & follow-ups (/app/tasks)
 *
 * Runs Axe-core accessibility scans on each view and outputs a verification JSON.
 */

import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const OUTPUT_DIR = path.resolve(process.cwd(), "../docs/design-mapping/screenshots/phase3");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function run() {
  const browser = await chromium.launch({ headless: true });
  const report = {
    timestamp: new Date().toISOString(),
    axeResults: {},
    screenshots: [],
  };

  console.log("Starting Phase 3 verification captures...");

  // Create an authenticated session as Sales Rep
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log("Authenticating as Sales Rep...");
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.getByText("Sales Rep").click();
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL("**/app/dashboard", { timeout: 10000 });
  await page.waitForTimeout(500);

  // Helper for capturing 3 viewports
  async function captureTriple(slug, navigateFn) {
    console.log(`Capturing view: ${slug}...`);

    // Desktop
    await page.setViewportSize({ width: 1440, height: 900 });
    await navigateFn();
    await page.waitForTimeout(500);
    const desktopFilename = `${slug}-desktop-1440x900.png`;
    await page.screenshot({ path: path.join(OUTPUT_DIR, desktopFilename) });
    report.screenshots.push(desktopFilename);

    // Axe desktop
    const desktopAxe = await new AxeBuilder({ page }).analyze();
    report.axeResults[`${slug}-desktop`] = desktopAxe.violations.length;
    console.log(`  [${slug}] Desktop Axe violations: ${desktopAxe.violations.length}`);

    // Tablet
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(400);
    const tabletFilename = `${slug}-tablet-1024x768.png`;
    await page.screenshot({ path: path.join(OUTPUT_DIR, tabletFilename) });
    report.screenshots.push(tabletFilename);

    // Mobile
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    const mobileFilename = `${slug}-mobile-390x844.png`;
    await page.screenshot({ path: path.join(OUTPUT_DIR, mobileFilename) });
    report.screenshots.push(mobileFilename);
  }

  // 1. Accounts list
  await captureTriple("accounts", async () => {
    await page.goto("http://localhost:3000/app/accounts", { waitUntil: "networkidle" });
    await page.waitForSelector("table", { timeout: 10000 });
  });

  // Get account detail link
  const firstAccountLink = await page.locator("table tbody tr a").first().getAttribute("href");
  const detailUrl = firstAccountLink ? `http://localhost:3000${firstAccountLink}` : "http://localhost:3000/app/accounts";
  console.log(`Target account detail URL: ${detailUrl}`);

  // 2. Account detail
  await captureTriple("account-detail", async () => {
    await page.goto(detailUrl, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
  });

  // 3. Contacts
  await captureTriple("contacts", async () => {
    await page.goto("http://localhost:3000/app/contacts", { waitUntil: "networkidle" });
    await page.waitForSelector("table", { timeout: 10000 });
  });

  // 4. Opportunities Pipeline
  await captureTriple("opportunities-pipeline", async () => {
    await page.goto("http://localhost:3000/app/opportunities", { waitUntil: "networkidle" });
    // Click Pipeline view button if not active
    const pipelineBtn = page.getByRole("button", { name: "Pipeline" });
    if (await pipelineBtn.isVisible()) {
      await pipelineBtn.click();
    }
    await page.waitForTimeout(500);
  });

  // 5. Opportunities Table
  await captureTriple("opportunities-table", async () => {
    await page.goto("http://localhost:3000/app/opportunities", { waitUntil: "networkidle" });
    const tableBtn = page.getByRole("button", { name: "Table" });
    await tableBtn.click();
    await page.waitForSelector("table", { timeout: 10000 });
    await page.waitForTimeout(400);
  });

  // 6. Tasks
  await captureTriple("tasks", async () => {
    await page.goto("http://localhost:3000/app/tasks", { waitUntil: "networkidle" });
    await page.waitForSelector("table", { timeout: 10000 });
  });

  await context.close();
  await browser.close();

  // Save JSON report
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "phase3-verification-report.json"),
    JSON.stringify(report, null, 2),
    "utf-8"
  );

  console.log("Phase 3 verification captures complete!");
}

run().catch((err) => {
  console.error("Capture script failed:", err);
  process.exit(1);
});
