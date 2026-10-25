import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const OUTPUT_DIR = path.resolve(import.meta.dirname, "../../docs/design-mapping/screenshots/dashboard-analytics");
const ARTIFACT_DIR = "/home/satjeet/.gemini/antigravity-cli/brain/4cd6df4a-3d9d-43fa-81c5-3be39ca98467/screenshots/dashboard-analytics";

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

async function loginAsAdmin(page) {
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.fill('input[type="email"]', "admin@forgeflow.demo");
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

  console.log("Starting Dashboard Analytics Verification & Accessibility Scan...");

  // Setup storage state
  const setupContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const setupPage = await setupContext.newPage();
  await loginAsAdmin(setupPage);
  const storageState = await setupContext.storageState();
  await setupContext.close();

  const viewports = [
    { id: "desktop", width: 1440, height: 900, dsf: 2, dark: false },
    { id: "dark-desktop", width: 1440, height: 900, dsf: 2, dark: true },
    { id: "tablet", width: 1024, height: 768, dsf: 2, dark: false },
    { id: "mobile", width: 390, height: 844, dsf: 3, dark: false },
  ];

  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dsf,
      storageState,
    });

    const page = await context.newPage();
    await page.goto("http://localhost:3000/app/dashboard", { waitUntil: "networkidle" });
    await page.waitForTimeout(600);

    // Wait for the new section to load
    await page.getByText("Operational Analytics").waitFor({ timeout: 10000 });
    await page.getByText("RFQ Match Health").waitFor({ timeout: 10000 });
    await page.getByText("Quotation Lifecycle").waitFor({ timeout: 10000 });
    await page.getByText("Task Due-Date Load").waitFor({ timeout: 10000 });

    if (vp.dark) {
      await page.evaluate(() => {
        document.documentElement.classList.add("dark");
      });
      await page.waitForTimeout(300);
    }

    // Run Axe scan
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const violations = axe.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      help: v.help,
      nodes: v.nodes.length,
    }));

    report.axeResults[vp.id] = {
      violationsCount: violations.length,
      violations,
    };

    console.log(`[Axe] Viewport: ${vp.id} -> ${violations.length} violations`);
    if (violations.length > 0) {
      console.log(`[Axe Details]`, JSON.stringify(violations, null, 2));
    }

    // 1. Full Page Screenshot
    const fullPageFilename = `dashboard-analytics-fullpage-${vp.id}-${vp.width}x${vp.height}.png`;
    const fullPagePath = path.join(OUTPUT_DIR, fullPageFilename);
    await page.screenshot({ path: fullPagePath, fullPage: true });
    fs.copyFileSync(fullPagePath, path.join(ARTIFACT_DIR, fullPageFilename));
    report.screenshots.push(fullPageFilename);

    // 2. Focused Section Screenshot (Operational Analytics Grid)
    const sectionLocator = page.locator('section[aria-labelledby="operational-analytics-heading"]');
    const sectionFilename = `dashboard-analytics-section-${vp.id}-${vp.width}x${vp.height}.png`;
    const sectionPath = path.join(OUTPUT_DIR, sectionFilename);
    await sectionLocator.screenshot({ path: sectionPath });
    fs.copyFileSync(sectionPath, path.join(ARTIFACT_DIR, sectionFilename));
    report.screenshots.push(sectionFilename);

    if (vp.id === "desktop") {
      // Measurements
      report.measurements.grid = await page.evaluate(() => {
        const grid = document.querySelector('[data-slot="operational-analytics-grid"]');
        const cards = grid ? Array.from(grid.children) : [];
        return {
          gridWidth: grid ? grid.getBoundingClientRect().width : null,
          cardCount: cards.length,
          cardHeights: cards.map((c) => c.getBoundingClientRect().height),
        };
      });

      // Also capture tabular views toggled
      while ((await page.getByRole("button", { name: /switch to table view/i }).count()) > 0) {
        await page.getByRole("button", { name: /switch to table view/i }).first().click();
        await page.waitForTimeout(200);
      }
      await page.waitForTimeout(300);

      const tableSectionFilename = `dashboard-analytics-section-tables-desktop-1440x900.png`;
      const tableSectionPath = path.join(OUTPUT_DIR, tableSectionFilename);
      await sectionLocator.screenshot({ path: tableSectionPath });
      fs.copyFileSync(tableSectionPath, path.join(ARTIFACT_DIR, tableSectionFilename));
      report.screenshots.push(tableSectionFilename);
    }

    await context.close();
  }

  // Save report
  const reportPath = path.join(OUTPUT_DIR, "dashboard-analytics-verification.json");
  const artReportPath = path.join(ARTIFACT_DIR, "dashboard-analytics-verification.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  fs.copyFileSync(reportPath, artReportPath);

  console.log("Verification finished. Report saved to:", reportPath);
  await browser.close();
}

run().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
