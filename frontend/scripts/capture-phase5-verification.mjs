/**
 * Phase 5 Visual and Accessibility Verification Capture Script
 *
 * Captures screenshots across Desktop (1440x900), Tablet (1024x768), and Mobile (390x844) for:
 * 1. RFQ Review Studio main view (/app/rfqs/[rfqId])
 * 2. RFQ Candidate Matcher Drawer open (/app/rfqs/[rfqId])
 *
 * Runs Axe-core accessibility scans on each view and outputs a verification JSON.
 */

import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const OUTPUT_DIR = path.resolve(import.meta.dirname, "../../docs/design-mapping/screenshots/phase5");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function run() {
  const browser = await chromium.launch({ headless: true });
  const report = {
    timestamp: new Date().toISOString(),
    rfqId: "5cd5beb5-5f7d-4a7d-af00-5bc8829c3833",
    rfqNumber: "RFQ-2026-0001",
    rfqTitle: "Turnaround Piping & Valves Batch A",
    axeResults: {},
    screenshots: [],
  };

  console.log("Starting Phase 5 verification captures...");

  // Create an authenticated session as Sales Rep
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log("Authenticating as Sales Rep...");
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.getByText("Sales Rep").click();
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL("**/app/dashboard", { timeout: 10000 });
  await page.waitForTimeout(500);

  const targetUrl = `http://localhost:3000/app/rfqs/${report.rfqId}`;
  console.log("Navigating to flagship RFQ Review Studio:", targetUrl);

  // View 1: RFQ Review Studio (Main View)
  console.log("Capturing RFQ Review Studio (Main View)...");
  
  // Desktop
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(targetUrl, { waitUntil: "networkidle" });
  await page.waitForSelector("table tbody tr", { timeout: 10000 });
  await page.waitForTimeout(600);
  const desktopMain = "rfq-studio-desktop-1440x900.png";
  await page.screenshot({ path: path.join(OUTPUT_DIR, desktopMain) });
  report.screenshots.push(desktopMain);

  const desktopMainAxe = await new AxeBuilder({ page }).analyze();
  report.axeResults["rfq-studio-desktop"] = desktopMainAxe.violations.length;
  console.log(`  RFQ Studio Desktop Axe violations: ${desktopMainAxe.violations.length}`);
  if (desktopMainAxe.violations.length > 0) {
    console.error("Violations in Studio Desktop:", JSON.stringify(desktopMainAxe.violations, null, 2));
  }

  // Tablet
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(500);
  const tabletMain = "rfq-studio-tablet-1024x768.png";
  await page.screenshot({ path: path.join(OUTPUT_DIR, tabletMain) });
  report.screenshots.push(tabletMain);

  // Mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  const mobileMain = "rfq-studio-mobile-390x844.png";
  await page.screenshot({ path: path.join(OUTPUT_DIR, mobileMain) });
  report.screenshots.push(mobileMain);

  // View 2: RFQ Review Studio with Candidate Matcher Drawer Open
  console.log("Capturing RFQ Candidate Matcher Drawer Open...");
  
  // Desktop drawer
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(targetUrl, { waitUntil: "networkidle" });
  await page.waitForSelector("table tbody tr", { timeout: 10000 });
  const reviewBtn = page.locator("table tbody tr").first().getByRole("button", { name: /^Review/ });
  await reviewBtn.click();
  await page.waitForSelector("[role='dialog']", { timeout: 5000 });
  await page.waitForTimeout(600);

  const desktopDrawer = "rfq-drawer-desktop-1440x900.png";
  await page.screenshot({ path: path.join(OUTPUT_DIR, desktopDrawer) });
  report.screenshots.push(desktopDrawer);

  const desktopDrawerAxe = await new AxeBuilder({ page }).analyze();
  report.axeResults["rfq-drawer-desktop"] = desktopDrawerAxe.violations.length;
  console.log(`  RFQ Drawer Desktop Axe violations: ${desktopDrawerAxe.violations.length}`);
  if (desktopDrawerAxe.violations.length > 0) {
    console.error("Violations in Drawer Desktop:", JSON.stringify(desktopDrawerAxe.violations, null, 2));
  }

  // Tablet drawer
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(500);
  const tabletDrawer = "rfq-drawer-tablet-1024x768.png";
  await page.screenshot({ path: path.join(OUTPUT_DIR, tabletDrawer) });
  report.screenshots.push(tabletDrawer);

  // Mobile drawer
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  const mobileDrawer = "rfq-drawer-mobile-390x844.png";
  await page.screenshot({ path: path.join(OUTPUT_DIR, mobileDrawer) });
  report.screenshots.push(mobileDrawer);

  await context.close();
  await browser.close();

  // Save JSON report
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "phase5-verification-report.json"),
    JSON.stringify(report, null, 2),
    "utf-8"
  );

  console.log("Phase 5 verification captures complete!");
}

run().catch((err) => {
  console.error("Capture script failed:", err);
  process.exit(1);
});
