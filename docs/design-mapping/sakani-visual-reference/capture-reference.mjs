/**
 * Script to capture visual baseline screenshots for Sakani Visual-Conformance Audit.
 * Captures both the ground-truth Sakani CRM demo (http://localhost:5173)
 * and the corresponding ForgeFlow screens (http://localhost:3000)
 * at Desktop (1440x900), Tablet (1024x768), and Mobile (390x844).
 */

import { chromium } from "@playwright/test";
import * as path from "node:path";
import * as fs from "node:fs";

const OUTPUT_DIR = path.resolve("docs/design-mapping/sakani-visual-reference/screenshots");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function run() {
  const browser = await chromium.launch({ headless: true });

  console.log("1. Capturing Sakani CRM reference screens (http://localhost:5173)...");
  const sakaniContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const sakaniPage = await sakaniContext.newPage();

  // Sakani Dashboard Desktop
  await sakaniPage.goto("http://localhost:5173/", { waitUntil: "networkidle" });
  await sakaniPage.waitForTimeout(600);
  await sakaniPage.screenshot({ path: path.join(OUTPUT_DIR, "sakani-dashboard-desktop-1440x900.png") });
  console.log("  Captured sakani-dashboard-desktop-1440x900.png");

  // Sakani Dashboard Tablet
  await sakaniPage.setViewportSize({ width: 1024, height: 768 });
  await sakaniPage.waitForTimeout(500);
  await sakaniPage.screenshot({ path: path.join(OUTPUT_DIR, "sakani-dashboard-tablet-1024x768.png") });
  console.log("  Captured sakani-dashboard-tablet-1024x768.png");

  // Sakani Dashboard Mobile
  await sakaniPage.setViewportSize({ width: 390, height: 844 });
  await sakaniPage.waitForTimeout(500);
  await sakaniPage.screenshot({ path: path.join(OUTPUT_DIR, "sakani-dashboard-mobile-390x844.png") });
  console.log("  Captured sakani-dashboard-mobile-390x844.png");

  // Sakani Sales Analytics Desktop
  await sakaniPage.setViewportSize({ width: 1440, height: 900 });
  await sakaniPage.goto("http://localhost:5173/", { waitUntil: "networkidle" });
  await sakaniPage.getByRole("button", { name: /Sales/ }).click();
  await sakaniPage.waitForTimeout(600);
  await sakaniPage.screenshot({ path: path.join(OUTPUT_DIR, "sakani-sales-desktop-1440x900.png") });
  console.log("  Captured sakani-sales-desktop-1440x900.png");

  // Sakani Customers Desktop
  await sakaniPage.getByRole("button", { name: /Customers/ }).click();
  await sakaniPage.waitForTimeout(600);
  await sakaniPage.screenshot({ path: path.join(OUTPUT_DIR, "sakani-customers-desktop-1440x900.png") });
  console.log("  Captured sakani-customers-desktop-1440x900.png");

  await sakaniContext.close();

  console.log("2. Capturing ForgeFlow corresponding screens (http://localhost:3000)...");
  const ffContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const ffPage = await ffContext.newPage();

  // Login as Sales Rep
  await ffPage.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await ffPage.getByText("Sales Rep").click();
  await ffPage.getByRole("button", { name: "Sign In" }).click();
  await ffPage.waitForURL("**/app/dashboard", { timeout: 10000 });
  await ffPage.waitForTimeout(600);

  // ForgeFlow Dashboard Desktop
  await ffPage.screenshot({ path: path.join(OUTPUT_DIR, "forgeflow-dashboard-desktop-1440x900.png") });
  console.log("  Captured forgeflow-dashboard-desktop-1440x900.png");

  // ForgeFlow Dashboard Tablet
  await ffPage.setViewportSize({ width: 1024, height: 768 });
  await ffPage.waitForTimeout(500);
  await ffPage.screenshot({ path: path.join(OUTPUT_DIR, "forgeflow-dashboard-tablet-1024x768.png") });
  console.log("  Captured forgeflow-dashboard-tablet-1024x768.png");

  // ForgeFlow Dashboard Mobile
  await ffPage.setViewportSize({ width: 390, height: 844 });
  await ffPage.waitForTimeout(500);
  await ffPage.screenshot({ path: path.join(OUTPUT_DIR, "forgeflow-dashboard-mobile-390x844.png") });
  console.log("  Captured forgeflow-dashboard-mobile-390x844.png");

  // Reset to Desktop
  await ffPage.setViewportSize({ width: 1440, height: 900 });

  // ForgeFlow Activity
  await ffPage.goto("http://localhost:3000/app/activity", { waitUntil: "networkidle" });
  await ffPage.waitForTimeout(500);
  await ffPage.screenshot({ path: path.join(OUTPUT_DIR, "forgeflow-activity-desktop-1440x900.png") });
  console.log("  Captured forgeflow-activity-desktop-1440x900.png");

  // ForgeFlow Accounts (Customers equivalent)
  await ffPage.goto("http://localhost:3000/app/accounts", { waitUntil: "networkidle" });
  await ffPage.waitForTimeout(500);
  await ffPage.screenshot({ path: path.join(OUTPUT_DIR, "forgeflow-accounts-desktop-1440x900.png") });
  console.log("  Captured forgeflow-accounts-desktop-1440x900.png");

  // ForgeFlow Opportunities (Sales pipeline equivalent)
  await ffPage.goto("http://localhost:3000/app/opportunities", { waitUntil: "networkidle" });
  await ffPage.waitForTimeout(500);
  await ffPage.screenshot({ path: path.join(OUTPUT_DIR, "forgeflow-opportunities-desktop-1440x900.png") });
  console.log("  Captured forgeflow-opportunities-desktop-1440x900.png");

  // ForgeFlow Quotes List
  await ffPage.goto("http://localhost:3000/app/quotes", { waitUntil: "networkidle" });
  await ffPage.waitForTimeout(500);
  await ffPage.screenshot({ path: path.join(OUTPUT_DIR, "forgeflow-quotes-desktop-1440x900.png") });
  console.log("  Captured forgeflow-quotes-desktop-1440x900.png");

  // ForgeFlow RFQs List
  await ffPage.goto("http://localhost:3000/app/rfqs", { waitUntil: "networkidle" });
  await ffPage.waitForTimeout(500);
  await ffPage.screenshot({ path: path.join(OUTPUT_DIR, "forgeflow-rfqs-desktop-1440x900.png") });
  console.log("  Captured forgeflow-rfqs-desktop-1440x900.png");

  // Switch to Sales Manager for Approvals
  await ffContext.close();

  const mgrContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const mgrPage = await mgrContext.newPage();
  await mgrPage.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await mgrPage.getByText("Sales Manager").click();
  await mgrPage.getByRole("button", { name: "Sign In" }).click();
  await mgrPage.waitForURL("**/app/dashboard", { timeout: 10000 });
  await mgrPage.waitForTimeout(500);

  // ForgeFlow Approvals
  await mgrPage.goto("http://localhost:3000/app/approvals", { waitUntil: "networkidle" });
  await mgrPage.waitForTimeout(500);
  await mgrPage.screenshot({ path: path.join(OUTPUT_DIR, "forgeflow-approvals-desktop-1440x900.png") });
  console.log("  Captured forgeflow-approvals-desktop-1440x900.png");

  await mgrContext.close();
  await browser.close();

  console.log("\nAll reference screenshots captured successfully in:", OUTPUT_DIR);
}

run().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
