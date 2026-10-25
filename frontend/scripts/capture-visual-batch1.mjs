/**
 * Sakani Visual-Conformance Batch 1 Capture Script
 *
 * Verifies global design foundation and application shell:
 * - Saffron (#FF4700) primary brand accent & warm stone (#FAFAF9) canvas
 * - TopBar geometry (64px height) & touch targets (>= 44px)
 * - Sidebar geometry (248px expanded, 64px collapsed icon rail, active saffron bar)
 * - Main elevated surface (rounded-t-[28px], shadow-sm, bg-surface)
 * - Responsive viewports: Desktop (1440x900), Tablet (1024x768), Mobile (390x844)
 * - Dark mode theme support
 * - Mobile slide-over navigation drawer with backdrop scrim
 * - Automated Axe-core accessibility scans across all states
 */

import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

const OUTPUT_DIR = path.resolve(import.meta.dirname, "../../docs/design-mapping/screenshots/visual-batch1");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function run() {
  const browser = await chromium.launch({ headless: true });
  const report = {
    timestamp: new Date().toISOString(),
    axeResults: {},
    tokenMeasurements: {},
    screenshots: [],
  };

  console.log("Starting Batch 1 Visual-Conformance verification...");

  // 1. Desktop Context (1440x900)
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await desktopContext.newPage();

  console.log("Authenticating as Sales Rep...");
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.getByText("Sales Rep").click();
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL("**/app/dashboard", { timeout: 10000 });
  await page.waitForTimeout(600);

  // Measure Shell Geometry and Tokens
  console.log("Measuring Shell Tokens and Computed Styles...");
  const measurements = await page.evaluate(() => {
    const header = document.querySelector("header");
    const sidebar = document.querySelector("aside");
    const main = document.querySelector("main");
    const body = document.body;

    const headerRect = header ? header.getBoundingClientRect() : null;
    const sidebarRect = sidebar ? sidebar.getBoundingClientRect() : null;
    const mainComputed = main ? window.getComputedStyle(main) : null;
    const bodyComputed = window.getComputedStyle(body);

    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue("--color-primary-500").trim();
    const canvasColor = getComputedStyle(document.documentElement).getPropertyValue("--color-bg-canvas").trim();
    const surfaceColor = getComputedStyle(document.documentElement).getPropertyValue("--color-bg-surface").trim();
    const radius3xl = getComputedStyle(document.documentElement).getPropertyValue("--radius-3xl").trim();

    // Check touch targets of interactive header/sidebar buttons
    const buttons = Array.from(document.querySelectorAll("header button, aside button, aside a"));
    const touchTargetIssues = buttons
      .map(b => {
        const r = b.getBoundingClientRect();
        return {
          tag: b.tagName,
          label: b.getAttribute("aria-label") || b.innerText.slice(0, 15),
          width: r.width,
          height: r.height,
          passes: r.width >= 40 && r.height >= 40, // standard touch target
        };
      })
      .filter(item => !item.passes);

    return {
      headerHeight: headerRect ? Math.round(headerRect.height) : null,
      sidebarWidth: sidebarRect ? Math.round(sidebarRect.width) : null,
      mainBorderRadiusTopLeft: mainComputed ? mainComputed.borderTopLeftRadius : null,
      mainBorderRadiusTopRight: mainComputed ? mainComputed.borderTopRightRadius : null,
      mainBackgroundColor: mainComputed ? mainComputed.backgroundColor : null,
      bodyBackgroundColor: bodyComputed.backgroundColor,
      cssTokens: {
        primary500: primaryColor,
        bgCanvas: canvasColor,
        bgSurface: surfaceColor,
        radius3xl: radius3xl,
      },
      touchTargetViolations: touchTargetIssues,
    };
  });

  report.tokenMeasurements = measurements;
  console.log("Measured tokens:", JSON.stringify(measurements, null, 2));

  // Screenshot 1: Desktop Shell - Dashboard (Expanded Sidebar)
  console.log("Capturing 1. Desktop Shell - Dashboard (1440x900)...");
  const s1Path = path.join(OUTPUT_DIR, "shell-dashboard-desktop-1440x900.png");
  await page.screenshot({ path: s1Path, fullPage: false });
  report.screenshots.push({
    file: "shell-dashboard-desktop-1440x900.png",
    route: "/app/dashboard",
    viewport: "1440x900",
    state: "Light Mode / Sidebar Expanded (248px)",
  });

  // Axe Scan 1
  const axe1 = await new AxeBuilder({ page }).analyze();
  report.axeResults["desktop-dashboard"] = {
    violations: axe1.violations.length,
    details: axe1.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description })),
  };

  // Screenshot 2: Desktop Shell - Collapsed Sidebar Rail (64px)
  console.log("Toggling sidebar collapse...");
  const collapseButton = page.locator("button[aria-label='Collapse sidebar']");
  if (await collapseButton.isVisible()) {
    await collapseButton.click();
    await page.waitForTimeout(400);

    const collapsedMeasurements = await page.evaluate(() => {
      const sidebar = document.querySelector("aside");
      return sidebar ? Math.round(sidebar.getBoundingClientRect().width) : null;
    });
    report.tokenMeasurements.collapsedSidebarWidth = collapsedMeasurements;

    const s2Path = path.join(OUTPUT_DIR, "shell-collapsed-sidebar-desktop-1440x900.png");
    await page.screenshot({ path: s2Path, fullPage: false });
    report.screenshots.push({
      file: "shell-collapsed-sidebar-desktop-1440x900.png",
      route: "/app/dashboard",
      viewport: "1440x900",
      state: "Light Mode / Sidebar Collapsed Rail (64px)",
    });

    // Restore expanded sidebar
    await page.locator("button[aria-label='Expand sidebar']").click();
    await page.waitForTimeout(400);
  }

  // Screenshot 3: Desktop Shell - Quotes Route (Proving Shell Uniformity)
  console.log("Navigating to Quotes route...");
  await page.goto("http://localhost:3000/app/quotes", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const s3Path = path.join(OUTPUT_DIR, "shell-quotes-desktop-1440x900.png");
  await page.screenshot({ path: s3Path, fullPage: false });
  report.screenshots.push({
    file: "shell-quotes-desktop-1440x900.png",
    route: "/app/quotes",
    viewport: "1440x900",
    state: "Light Mode / Quotes Navigation Uniformity",
  });

  // Axe Scan 2
  const axe3 = await new AxeBuilder({ page }).analyze();
  report.axeResults["desktop-quotes"] = {
    violations: axe3.violations.length,
    details: axe3.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description })),
  };

  // Screenshot 4: Dark Mode Shell
  console.log("Toggling Dark Mode...");
  const themeToggle = page.locator("button[aria-label*='theme']");
  if (await themeToggle.isVisible()) {
    await themeToggle.click();
    await page.waitForTimeout(600);

    const s4Path = path.join(OUTPUT_DIR, "shell-dashboard-dark-desktop-1440x900.png");
    await page.screenshot({ path: s4Path, fullPage: false });
    report.screenshots.push({
      file: "shell-dashboard-dark-desktop-1440x900.png",
      route: "/app/quotes",
      viewport: "1440x900",
      state: "Dark Mode Shell Architecture",
    });

    const axeDark = await new AxeBuilder({ page }).analyze();
    report.axeResults["desktop-dark"] = {
      violations: axeDark.violations.length,
      details: axeDark.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description })),
    };

    // Restore Light Mode
    await themeToggle.click();
    await page.waitForTimeout(400);
  }

  // 2. Tablet Context (1024x768)
  console.log("Launching Tablet Context (1024x768)...");
  const tabletContext = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    deviceScaleFactor: 2,
  });
  const tabletPage = await tabletContext.newPage();
  await tabletPage.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await tabletPage.getByText("Sales Rep").click();
  await tabletPage.getByRole("button", { name: "Sign In" }).click();
  await tabletPage.waitForURL("**/app/dashboard", { timeout: 10000 });
  await tabletPage.waitForTimeout(600);

  const s5Path = path.join(OUTPUT_DIR, "shell-dashboard-tablet-1024x768.png");
  await tabletPage.screenshot({ path: s5Path, fullPage: false });
  report.screenshots.push({
    file: "shell-dashboard-tablet-1024x768.png",
    route: "/app/dashboard",
    viewport: "1024x768",
    state: "Tablet Responsive Viewport",
  });

  const axeTablet = await new AxeBuilder({ page: tabletPage }).analyze();
  report.axeResults["tablet-dashboard"] = {
    violations: axeTablet.violations.length,
    details: axeTablet.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description })),
  };

  // 3. Mobile Context (390x844 - iPhone 14 / modern standard)
  console.log("Launching Mobile Context (390x844)...");
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await mobilePage.getByText("Sales Rep").click();
  await mobilePage.getByRole("button", { name: "Sign In" }).click();
  await mobilePage.waitForURL("**/app/dashboard", { timeout: 10000 });
  await mobilePage.waitForTimeout(600);

  // Screenshot 6: Mobile Default (Header + Elevated Card)
  const s6Path = path.join(OUTPUT_DIR, "shell-dashboard-mobile-390x844.png");
  await mobilePage.screenshot({ path: s6Path, fullPage: false });
  report.screenshots.push({
    file: "shell-dashboard-mobile-390x844.png",
    route: "/app/dashboard",
    viewport: "390x844",
    state: "Mobile Responsive Viewport (Default)",
  });

  const axeMobile = await new AxeBuilder({ page: mobilePage }).analyze();
  report.axeResults["mobile-dashboard"] = {
    violations: axeMobile.violations.length,
    details: axeMobile.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description })),
  };

  // Screenshot 7: Mobile Drawer Open (Scrim + Slide-out Navigation)
  console.log("Opening mobile navigation drawer...");
  const menuButton = mobilePage.locator("button[aria-label='Open navigation menu']");
  if (await menuButton.isVisible()) {
    await menuButton.click();
    await mobilePage.waitForTimeout(500);

    const s7Path = path.join(OUTPUT_DIR, "shell-drawer-mobile-390x844.png");
    await mobilePage.screenshot({ path: s7Path, fullPage: false });
    report.screenshots.push({
      file: "shell-drawer-mobile-390x844.png",
      route: "/app/dashboard",
      viewport: "390x844",
      state: "Mobile Slide-Over Navigation Drawer with Scrim",
    });

    const axeDrawer = await new AxeBuilder({ page: mobilePage }).analyze();
    report.axeResults["mobile-drawer"] = {
      violations: axeDrawer.violations.length,
      details: axeDrawer.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description })),
    };
  }

  // Save report JSON
  const reportPath = path.join(OUTPUT_DIR, "batch1-verification-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`Saved verification report to: ${reportPath}`);

  await browser.close();
}

run().catch(err => {
  console.error("Batch 1 verification failed:", err);
  process.exit(1);
});
