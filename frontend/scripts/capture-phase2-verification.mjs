/**
 * Phase 2 Visual and Accessibility Verification Capture Script
 *
 * Captures screenshots for /login, /app/dashboard, and /app/activity across:
 * - Desktop (1440x900)
 * - Tablet (1024x768)
 * - Mobile (390x844)
 *
 * Runs Axe-core accessibility scans on each view and outputs a verification JSON.
 */

import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const OUTPUT_DIR = path.resolve(process.cwd(), "../docs/design-mapping/screenshots/phase2");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function run() {
  const browser = await chromium.launch({ headless: true });
  const report = {
    timestamp: new Date().toISOString(),
    axeResults: {},
    screenshots: [],
  };

  console.log("Starting Phase 2 verification captures...");

  // 1. LOGIN SCREEN CAPTURES
  console.log("Capturing /login across viewports...");
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(OUTPUT_DIR, "login-desktop-1440x900.png") });
    report.screenshots.push("login-desktop-1440x900.png");

    // Axe on login desktop
    const loginAxe = await new AxeBuilder({ page }).analyze();
    report.axeResults["loginDesktop"] = loginAxe.violations.length;
    console.log(`Login Desktop Axe violations: ${loginAxe.violations.length}`);

    // Tablet
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "login-tablet-1024x768.png") });
    report.screenshots.push("login-tablet-1024x768.png");

    // Mobile
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "login-mobile-390x844.png") });
    report.screenshots.push("login-mobile-390x844.png");

    const loginMobileAxe = await new AxeBuilder({ page }).analyze();
    report.axeResults["loginMobile"] = loginMobileAxe.violations.length;
    console.log(`Login Mobile Axe violations: ${loginMobileAxe.violations.length}`);
    await context.close();
  }

  // 2. DASHBOARD SCREEN CAPTURES (Authenticated)
  console.log("Capturing /app/dashboard across viewports...");
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
    await page.getByText("Sales Rep").click();
    await page.getByRole("button", { name: "Sign In" }).click();
    await page.waitForURL("**/app/dashboard", { timeout: 10000 });
    await page.waitForTimeout(1000); // Allow charts to animate

    // Desktop
    await page.screenshot({ path: path.join(OUTPUT_DIR, "dashboard-desktop-1440x900.png") });
    report.screenshots.push("dashboard-desktop-1440x900.png");

    const dashAxe = await new AxeBuilder({ page }).analyze();
    report.axeResults["dashboardDesktop"] = dashAxe.violations.length;
    console.log(`Dashboard Desktop Axe violations: ${dashAxe.violations.length}`);

    // Tablet
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "dashboard-tablet-1024x768.png") });
    report.screenshots.push("dashboard-tablet-1024x768.png");

    // Mobile
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "dashboard-mobile-390x844.png") });
    report.screenshots.push("dashboard-mobile-390x844.png");

    const dashMobileAxe = await new AxeBuilder({ page }).analyze();
    report.axeResults["dashboardMobile"] = dashMobileAxe.violations.length;
    console.log(`Dashboard Mobile Axe violations: ${dashMobileAxe.violations.length}`);
    await context.close();
  }

  // 3. ACTIVITY SCREEN CAPTURES (Authenticated)
  console.log("Capturing /app/activity across viewports...");
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
    await page.getByText("Sales Rep").click();
    await page.getByRole("button", { name: "Sign In" }).click();
    await page.waitForURL("**/app/dashboard", { timeout: 10000 });

    await page.goto("http://localhost:3000/app/activity", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    // Desktop Timeline
    await page.screenshot({ path: path.join(OUTPUT_DIR, "activity-desktop-timeline-1440x900.png") });
    report.screenshots.push("activity-desktop-timeline-1440x900.png");

    const actAxe = await new AxeBuilder({ page }).analyze();
    report.axeResults["activityDesktop"] = actAxe.violations.length;
    console.log(`Activity Desktop Axe violations: ${actAxe.violations.length}`);

    // Switch to Table view
    await page.getByRole("button", { name: "Table" }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "activity-desktop-table-1440x900.png") });
    report.screenshots.push("activity-desktop-table-1440x900.png");

    // Switch back to timeline for responsive views
    await page.getByRole("button", { name: "Timeline" }).click();
    await page.waitForTimeout(300);

    // Tablet
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "activity-tablet-1024x768.png") });
    report.screenshots.push("activity-tablet-1024x768.png");

    // Mobile
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "activity-mobile-390x844.png") });
    report.screenshots.push("activity-mobile-390x844.png");

    const actMobileAxe = await new AxeBuilder({ page }).analyze();
    report.axeResults["activityMobile"] = actMobileAxe.violations.length;
    console.log(`Activity Mobile Axe violations: ${actMobileAxe.violations.length}`);
    await context.close();
  }

  await browser.close();

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "phase2-verification-report.json"),
    JSON.stringify(report, null, 2)
  );

  console.log("Phase 2 verification script completed successfully!");
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
