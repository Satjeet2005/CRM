import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "fs";
import path from "path";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const OUTPUT_DIR = path.resolve("../docs/design-mapping/screenshots");

async function run() {
  console.log(`Starting Phase 1 verification against ${BASE_URL}...`);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // 1. Visit Login and Authenticate as Sales Rep
  console.log("Navigating to /login...");
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });

  console.log("Clicking Sales Rep demo button...");
  await page.getByText("Sales Rep").click();
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL("**/app/dashboard", { timeout: 15000 });
  console.log("Successfully logged in and reached /app/dashboard!");
  await page.waitForTimeout(1000);

  // 2. Desktop 1440x900 (Expanded Sidebar - 248px)
  console.log("Capturing Desktop 1440x900 (Expanded Sidebar)...");
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "desktop-1440x900-expanded.png"),
    fullPage: false,
  });

  // Run Axe accessibility on desktop light
  console.log("Running Axe accessibility audit on Desktop Light...");
  const axeDesktop = await new AxeBuilder({ page }).analyze();
  console.log(`Desktop Axe violations: ${axeDesktop.violations.length}`);
  if (axeDesktop.violations.length > 0) {
    console.log("Desktop violations details:", JSON.stringify(axeDesktop.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.map(n => n.html) })), null, 2));
  }

  // 3. Desktop Collapsed Sidebar (64px)
  console.log("Collapsing sidebar...");
  const collapseBtn = page.getByRole("button", { name: /collapse sidebar/i });
  await collapseBtn.click();
  await page.waitForTimeout(400);

  console.log("Capturing Desktop 1440x900 (Collapsed Sidebar 64px)...");
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "desktop-1440x900-collapsed.png"),
    fullPage: false,
  });

  // Re-expand sidebar
  const expandBtn = page.getByRole("button", { name: /expand sidebar/i });
  await expandBtn.click();
  await page.waitForTimeout(400);

  // 4. Desktop Dark Mode
  let axeDark = null;
  console.log("Toggling Dark Mode...");
  const themeBtn = page.getByRole("button", { name: /switch to dark theme/i });
  if (await themeBtn.isVisible()) {
    await themeBtn.click();
    await page.waitForTimeout(400);

    console.log("Capturing Desktop Dark Mode...");
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "desktop-1440x900-dark.png"),
      fullPage: false,
    });

    axeDark = await new AxeBuilder({ page }).analyze();
    console.log(`Desktop Dark Mode Axe violations: ${axeDark.violations.length}`);
    if (axeDark.violations.length > 0) {
      console.log("Dark Mode violations details:", JSON.stringify(axeDark.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.map(n => n.html) })), null, 2));
    }

    // Switch back to light theme
    const lightBtn = page.getByRole("button", { name: /switch to light theme/i });
    if (await lightBtn.isVisible()) {
      await lightBtn.click();
      await page.waitForTimeout(400);
    }
  }

  // 5. Tablet 1024x768
  console.log("Resizing viewport to Tablet (1024x768)...");
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(500);

  console.log("Capturing Tablet 1024x768...");
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "tablet-1024x768.png"),
    fullPage: false,
  });

  // 6. Mobile 390x844
  console.log("Resizing viewport to Mobile (390x844)...");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);

  console.log("Capturing Mobile 390x844...");
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "mobile-390x844.png"),
    fullPage: false,
  });

  // 7. Mobile Open Slide-Over Drawer
  console.log("Opening mobile slide-over navigation drawer...");
  const hamburgerBtn = page.getByRole("button", { name: /open navigation menu/i });
  await hamburgerBtn.click();
  await page.waitForTimeout(500);

  console.log("Capturing Mobile Slide-Over Drawer Open...");
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "mobile-drawer-open.png"),
    fullPage: false,
  });

  const axeMobile = await new AxeBuilder({ page }).analyze();
  console.log(`Mobile Drawer Axe violations: ${axeMobile.violations.length}`);
  if (axeMobile.violations.length > 0) {
    console.log("Mobile Drawer violations details:", JSON.stringify(axeMobile.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.map(n => n.html) })), null, 2));
  }

  // Summary Report
  const report = {
    timestamp: new Date().toISOString(),
    axeResults: {
      desktopLightViolations: axeDesktop.violations.length,
      desktopDarkViolations: axeDark?.violations?.length ?? 0,
      mobileDrawerViolations: axeMobile.violations.length,
      details: {
        desktopLight: axeDesktop.violations,
        desktopDark: axeDark?.violations ?? [],
        mobileDrawer: axeMobile.violations,
      },
    },
    screenshotsCaptured: [
      "desktop-1440x900-expanded.png",
      "desktop-1440x900-collapsed.png",
      "desktop-1440x900-dark.png",
      "tablet-1024x768.png",
      "mobile-390x844.png",
      "mobile-drawer-open.png",
    ],
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "verification-report.json"),
    JSON.stringify(report, null, 2)
  );

  console.log("Phase 1 verification completed successfully!");
  console.log(`Report written to ${path.join(OUTPUT_DIR, "verification-report.json")}`);

  await browser.close();
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
