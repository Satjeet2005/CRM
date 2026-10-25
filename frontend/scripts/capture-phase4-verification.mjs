/**
 * Phase 4 Visual and Accessibility Verification Capture Script
 *
 * Captures screenshots across Desktop (1440x900), Tablet (1024x768), and Mobile (390x844) for:
 * 1. Industrial Catalog (/app/catalog)
 * 2. RFQ Ingestion Log (/app/rfqs)
 * 3. RFQ Import Wizard (/app/rfqs/new)
 *
 * Runs Axe-core accessibility scans on each view and outputs a verification JSON.
 */

import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const OUTPUT_DIR = path.resolve(process.cwd(), "../docs/design-mapping/screenshots/phase4");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function run() {
  const browser = await chromium.launch({ headless: true });
  const report = {
    timestamp: new Date().toISOString(),
    axeResults: {},
    screenshots: [],
  };

  console.log("Starting Phase 4 verification captures...");

  // Create an authenticated session as Sales Rep
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log("Authenticating as Sales Rep...");
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.getByText("Sales Rep").click();
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL("**/app/dashboard", { timeout: 10000 });
  await page.waitForTimeout(500);

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

  // 1. Industrial Catalog (/app/catalog)
  await captureTriple("catalog", async () => {
    await page.goto("http://localhost:3000/app/catalog", { waitUntil: "networkidle" });
    await page.waitForSelector("table", { timeout: 10000 });
  });

  // 2. RFQ Ingestion Log (/app/rfqs)
  await captureTriple("rfqs", async () => {
    await page.goto("http://localhost:3000/app/rfqs", { waitUntil: "networkidle" });
    await page.waitForSelector("table", { timeout: 10000 });
  });

  // 3. RFQ Import Wizard (/app/rfqs/new)
  await captureTriple("rfqs-new", async () => {
    await page.goto("http://localhost:3000/app/rfqs/new", { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
  });

  await context.close();
  await browser.close();

  // Save JSON report
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "phase4-verification-report.json"),
    JSON.stringify(report, null, 2),
    "utf-8"
  );

  console.log("Phase 4 verification captures complete!");
}

run().catch((err) => {
  console.error("Capture script failed:", err);
  process.exit(1);
});
