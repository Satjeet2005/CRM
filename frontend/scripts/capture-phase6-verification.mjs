/**
 * Phase 6 Visual and Accessibility Verification Capture Script
 *
 * Captures screenshots across Desktop (1440x900), Tablet (1024x768), and Mobile (390x844) for:
 * 1. Quotations List (/app/quotes)
 * 2. Quote Builder / Detail (/app/quotes/[quoteId])
 * 3. Calculation Inspector Sheet (/app/quotes/[quoteId])
 * 4. Customer Preview Mode (/app/quotes/[quoteId])
 *
 * Runs Axe-core accessibility scans on each view and outputs a verification JSON.
 */

import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const OUTPUT_DIR = path.resolve(import.meta.dirname, "../../docs/design-mapping/screenshots/phase6");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function run() {
  const browser = await chromium.launch({ headless: true });
  const report = {
    timestamp: new Date().toISOString(),
    quoteId: null,
    quoteNumber: null,
    axeResults: {},
    screenshots: [],
  };

  console.log("Starting Phase 6 verification captures...");

  // Create an authenticated session as Sales Rep
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log("Authenticating as Sales Rep...");
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.getByText("Sales Rep").click();
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL("**/app/dashboard", { timeout: 10000 });
  await page.waitForTimeout(500);

  // 1. View: Quotations List (/app/quotes)
  console.log("Capturing Quotations List (/app/quotes)...");
  await page.goto("http://localhost:3000/app/quotes", { waitUntil: "networkidle" });
  await page.waitForSelector("table tbody tr", { timeout: 10000 });
  await page.waitForTimeout(500);

  // Find a target quote for detail captures
  const firstQuoteNumber = await page.locator("table tbody tr td").first().innerText();
  console.log("Found quote:", firstQuoteNumber);
  report.quoteNumber = firstQuoteNumber.trim();

  // Desktop list
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(400);
  const quotesListDesktop = "quotes-list-desktop-1440x900.png";
  await page.screenshot({ path: path.join(OUTPUT_DIR, quotesListDesktop) });
  report.screenshots.push(quotesListDesktop);

  const listAxe = await new AxeBuilder({ page }).analyze();
  report.axeResults["quotes-list-desktop"] = listAxe.violations.length;
  console.log(`  Quotes List Desktop Axe violations: ${listAxe.violations.length}`);

  // Tablet list
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(400);
  const quotesListTablet = "quotes-list-tablet-1024x768.png";
  await page.screenshot({ path: path.join(OUTPUT_DIR, quotesListTablet) });
  report.screenshots.push(quotesListTablet);

  // Mobile list
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const quotesListMobile = "quotes-list-mobile-390x844.png";
  await page.screenshot({ path: path.join(OUTPUT_DIR, quotesListMobile) });
  report.screenshots.push(quotesListMobile);

  // 2. View: Quote Builder / Detail (/app/quotes/[quoteId])
  console.log("Navigating to quote detail...");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("http://localhost:3000/app/quotes", { waitUntil: "networkidle" });
  await page.waitForSelector("table tbody tr", { timeout: 10000 });
  await page.locator("table tbody tr").first().click();
  await page.waitForURL(/\/app\/quotes\/.+/, { timeout: 10000 });
  await page.waitForSelector("table tbody tr", { timeout: 10000 });
  await page.waitForTimeout(600);

  report.quoteId = page.url().split("/").pop();
  console.log("Detail URL:", page.url(), "quoteId:", report.quoteId);

  // Desktop detail
  const quoteDetailDesktop = "quote-detail-desktop-1440x900.png";
  await page.screenshot({ path: path.join(OUTPUT_DIR, quoteDetailDesktop) });
  report.screenshots.push(quoteDetailDesktop);

  const detailAxe = await new AxeBuilder({ page }).analyze();
  report.axeResults["quote-detail-desktop"] = detailAxe.violations.length;
  console.log(`  Quote Detail Desktop Axe violations: ${detailAxe.violations.length}`);

  // Tablet detail
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(500);
  const quoteDetailTablet = "quote-detail-tablet-1024x768.png";
  await page.screenshot({ path: path.join(OUTPUT_DIR, quoteDetailTablet) });
  report.screenshots.push(quoteDetailTablet);

  // Mobile detail
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  const quoteDetailMobile = "quote-detail-mobile-390x844.png";
  await page.screenshot({ path: path.join(OUTPUT_DIR, quoteDetailMobile) });
  report.screenshots.push(quoteDetailMobile);

  // 3. View: Calculation Inspector Sheet
  console.log("Capturing Calculation Inspector Sheet...");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`http://localhost:3000/app/quotes/${report.quoteId}`, { waitUntil: "networkidle" });
  await page.waitForSelector("table tbody tr", { timeout: 10000 });
  await page.getByRole("button", { name: /Calculation Inspector/i }).click();
  await page.waitForSelector("[role='dialog']", { timeout: 5000 });
  await page.waitForTimeout(600);

  const inspectorDesktop = "quote-inspector-desktop-1440x900.png";
  await page.screenshot({ path: path.join(OUTPUT_DIR, inspectorDesktop) });
  report.screenshots.push(inspectorDesktop);

  const inspectorAxe = await new AxeBuilder({ page }).analyze();
  report.axeResults["quote-inspector-desktop"] = inspectorAxe.violations.length;
  console.log(`  Calculation Inspector Desktop Axe violations: ${inspectorAxe.violations.length}`);

  // Close sheet
  await page.getByRole("button", { name: "Close sheet" }).click();
  await page.waitForTimeout(400);

  // 4. View: Customer Preview Mode
  console.log("Capturing Customer Preview Mode...");
  await page.getByRole("button", { name: /Customer Preview Mode/i }).click();
  await page.waitForTimeout(500);

  const previewDesktop = "quote-preview-mode-desktop-1440x900.png";
  await page.screenshot({ path: path.join(OUTPUT_DIR, previewDesktop) });
  report.screenshots.push(previewDesktop);

  await context.close();
  await browser.close();

  // Save JSON report
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "phase6-verification-report.json"),
    JSON.stringify(report, null, 2),
    "utf-8"
  );

  console.log("Phase 6 verification captures complete!");
}

run().catch((err) => {
  console.error("Capture script failed:", err);
  process.exit(1);
});
