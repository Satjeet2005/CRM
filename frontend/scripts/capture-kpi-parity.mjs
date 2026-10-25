import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const OUTPUT_DIR = path.resolve(import.meta.dirname, "../../docs/design-mapping/screenshots/kpi-parity");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function loginAsSalesRep(page) {
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.fill('input[type="email"]', "sales@forgeflow.demo");
  await page.fill('input[type="password"]', "ForgeFlowDemo!2026");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/app/dashboard", { timeout: 15000 });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const report = {
    timestamp: new Date().toISOString(),
    axeResults: {},
    measurements: {},
    screenshots: [],
  };

  console.log("Starting KPI Card Parity Verification...");

  // 1. Desktop Context (1440x900)
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await desktopContext.newPage();

  console.log("Authenticating as Sales Rep...");
  await loginAsSalesRep(page);

  // Wait for the actual metrics to resolve from the API
  console.log("Waiting for dashboard metrics to load...");
  await page.locator('[data-slot="stat-card"]').first().waitFor({ timeout: 10000 });
  await page.getByText("Total Open Pipeline").waitFor({ timeout: 10000 });
  await page.waitForTimeout(500);

  // Measure KPI Grid and Cards
  console.log("Measuring KPI Grid and StatCards...");
  const measurements = await page.evaluate(() => {
    const grid = document.querySelector('[data-slot="kpi-grid"]') || document.querySelector('.grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-4');
    const cards = Array.from(document.querySelectorAll('[data-slot="stat-card"]'));

    const gridStyle = grid ? window.getComputedStyle(grid) : null;
    const gridRect = grid ? grid.getBoundingClientRect() : null;

    const cardDetails = cards.map((card, idx) => {
      const rect = card.getBoundingClientRect();
      const style = window.getComputedStyle(card);
      const titleEl = card.querySelector('[data-slot="stat-card-title"]');
      const valueEl = card.querySelector('[data-slot="stat-card-value"]');
      const actionEl = card.querySelector('[data-slot="stat-card-action"]');

      const titleStyle = titleEl ? window.getComputedStyle(titleEl) : null;
      const valueStyle = valueEl ? window.getComputedStyle(valueEl) : null;
      const actionStyle = actionEl ? window.getComputedStyle(actionEl) : null;

      return {
        index: idx,
        title: titleEl?.textContent?.trim() || "",
        value: valueEl?.textContent?.trim() || "",
        width: Math.round(rect.width * 10) / 10,
        height: Math.round(rect.height * 10) / 10,
        paddingTop: style.paddingTop,
        paddingRight: style.paddingRight,
        paddingBottom: style.paddingBottom,
        paddingLeft: style.paddingLeft,
        borderRadius: style.borderRadius,
        borderWidth: style.borderWidth,
        borderColor: style.borderColor,
        backgroundColor: style.backgroundColor,
        titleTypography: {
          fontFamily: titleStyle?.fontFamily,
          fontSize: titleStyle?.fontSize,
          lineHeight: titleStyle?.lineHeight,
          fontWeight: titleStyle?.fontWeight,
          color: titleStyle?.color,
        },
        valueTypography: {
          fontFamily: valueStyle?.fontFamily,
          fontSize: valueStyle?.fontSize,
          lineHeight: valueStyle?.lineHeight,
          fontWeight: valueStyle?.fontWeight,
          letterSpacing: valueStyle?.letterSpacing,
          color: valueStyle?.color,
        },
        actionTypography: {
          fontFamily: actionStyle?.fontFamily,
          fontSize: actionStyle?.fontSize,
          lineHeight: actionStyle?.lineHeight,
          color: actionStyle?.color,
        },
      };
    });

    return {
      grid: {
        width: gridRect ? Math.round(gridRect.width * 10) / 10 : 0,
        height: gridRect ? Math.round(gridRect.height * 10) / 10 : 0,
        gap: gridStyle ? gridStyle.gap : "",
        columnGap: gridStyle ? gridStyle.columnGap : "",
        gridTemplateColumns: gridStyle ? gridStyle.gridTemplateColumns : "",
      },
      cards: cardDetails,
    };
  });

  report.measurements.desktop = measurements;
  console.log("Measurements complete:", JSON.stringify(measurements, null, 2));

  // Desktop Screenshots
  const desktopFullShot = path.join(OUTPUT_DIR, "kpi-dashboard-desktop-1440x900.png");
  await page.screenshot({ path: desktopFullShot, fullPage: false });
  report.screenshots.push({ name: "kpi-dashboard-desktop-1440x900", path: desktopFullShot });

  const gridLocator = page.locator('[data-slot="kpi-grid"]').first();
  const desktopStripShot = path.join(OUTPUT_DIR, "kpi-strip-desktop-1440x900.png");
  await gridLocator.screenshot({ path: desktopStripShot });
  report.screenshots.push({ name: "kpi-strip-desktop-1440x900", path: desktopStripShot });

  // Axe scan on desktop
  console.log("Running Axe-core accessibility scan on Desktop (Light mode)...");
  const axeDesktop = await new AxeBuilder({ page }).analyze();
  report.axeResults.desktopLight = {
    violations: axeDesktop.violations.length,
    details: axeDesktop.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      nodes: v.nodes.length,
    })),
  };

  // Dark mode test on Desktop
  console.log("Toggling dark mode...");
  const themeButton = page.locator("button[aria-label*='theme'], button[aria-label*='Theme']");
  if (await themeButton.isVisible()) {
    await themeButton.click();
    await page.waitForTimeout(500);

    const darkFullShot = path.join(OUTPUT_DIR, "kpi-dashboard-dark-desktop-1440x900.png");
    await page.screenshot({ path: darkFullShot, fullPage: false });
    report.screenshots.push({ name: "kpi-dashboard-dark-desktop-1440x900", path: darkFullShot });

    const darkStripShot = path.join(OUTPUT_DIR, "kpi-strip-dark-desktop-1440x900.png");
    await gridLocator.screenshot({ path: darkStripShot });
    report.screenshots.push({ name: "kpi-strip-dark-desktop-1440x900", path: darkStripShot });

    console.log("Running Axe-core accessibility scan on Desktop (Dark mode)...");
    const axeDark = await new AxeBuilder({ page }).analyze();
    report.axeResults.desktopDark = {
      violations: axeDark.violations.length,
      details: axeDark.violations.map(v => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.length,
      })),
    };

    // Toggle back to light
    await themeButton.click();
    await page.waitForTimeout(300);
  }
  await desktopContext.close();

  // 2. Tablet Context (1024x768)
  console.log("Capturing Tablet Viewport (1024x768)...");
  const tabletContext = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    deviceScaleFactor: 2,
  });
  const tabletPage = await tabletContext.newPage();
  await loginAsSalesRep(tabletPage);
  await tabletPage.locator('[data-slot="stat-card"]').first().waitFor({ timeout: 10000 });
  await tabletPage.waitForTimeout(500);

  const tabletFullShot = path.join(OUTPUT_DIR, "kpi-dashboard-tablet-1024x768.png");
  await tabletPage.screenshot({ path: tabletFullShot, fullPage: false });
  report.screenshots.push({ name: "kpi-dashboard-tablet-1024x768", path: tabletFullShot });

  const tabletGrid = tabletPage.locator('[data-slot="kpi-grid"]').first();
  const tabletStripShot = path.join(OUTPUT_DIR, "kpi-strip-tablet-1024x768.png");
  await tabletGrid.screenshot({ path: tabletStripShot });
  report.screenshots.push({ name: "kpi-strip-tablet-1024x768", path: tabletStripShot });
  await tabletContext.close();

  // 3. Mobile Context (390x844)
  console.log("Capturing Mobile Viewport (390x844)...");
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const mobilePage = await mobileContext.newPage();
  await loginAsSalesRep(mobilePage);
  await mobilePage.locator('[data-slot="stat-card"]').first().waitFor({ timeout: 10000 });
  await mobilePage.waitForTimeout(500);

  const mobileFullShot = path.join(OUTPUT_DIR, "kpi-dashboard-mobile-390x844.png");
  await mobilePage.screenshot({ path: mobileFullShot, fullPage: false });
  report.screenshots.push({ name: "kpi-dashboard-mobile-390x844", path: mobileFullShot });

  const mobileGrid = mobilePage.locator('[data-slot="kpi-grid"]').first();
  const mobileStripShot = path.join(OUTPUT_DIR, "kpi-strip-mobile-390x844.png");
  await mobileGrid.screenshot({ path: mobileStripShot });
  report.screenshots.push({ name: "kpi-strip-mobile-390x844", path: mobileStripShot });
  await mobileContext.close();

  // Close browser
  await browser.close();

  const reportPath = path.join(OUTPUT_DIR, "kpi-parity-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`Parity report saved to ${reportPath}`);
}

run().catch(err => {
  console.error("Capture script failed:", err);
  process.exit(1);
});
