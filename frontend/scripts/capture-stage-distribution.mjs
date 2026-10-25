import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const OUTPUT_DIR = path.resolve(import.meta.dirname, "../../docs/design-mapping/screenshots/opportunity-stage-distribution");
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

  console.log("Starting Opportunity Stage Distribution Conformance Verification...");

  // 1. Desktop Context (1440x900)
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await desktopContext.newPage();

  console.log("Authenticating as Sales Rep...");
  await loginAsSalesRep(page);

  console.log("Waiting for Opportunity Stage Distribution card to load...");
  await page.getByRole("heading", { name: "Opportunity Stage Distribution" }).waitFor({ timeout: 10000 });
  await page.getByRole("region", { name: "Opportunity Stage Distribution Chart" }).waitFor({ timeout: 10000 });
  await page.waitForTimeout(1000);

  // Measure card, header, chart, and table
  console.log("Measuring Opportunity Stage Distribution (Desktop 1440x900)...");
  const desktopMeasurements = await page.evaluate(() => {
    const heading = document.evaluate(
      "//h2[contains(text(), 'Opportunity Stage Distribution')]",
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;
    const card = heading ? heading.closest('div.rounded-\\[var\\(--radius-xl\\)\\]') || heading.parentElement?.parentElement?.parentElement : null;
    const desc = heading?.nextElementSibling;
    const viewAllBtn = card ? card.querySelector('a[href="/app/opportunities"]') : null;
    const chartRegion = card ? card.querySelector('[role="region"][aria-label*="Chart"]') : null;
    const tableRegion = card ? card.querySelector('[role="region"][aria-label*="Breakdown"]') || card.querySelector('table')?.parentElement : null;
    const table = card ? card.querySelector('table') : null;
    const rows = table ? Array.from(table.querySelectorAll('tbody tr')) : [];

    const cardRect = card ? card.getBoundingClientRect() : null;
    const cardStyle = card ? window.getComputedStyle(card) : null;
    const headingStyle = heading ? window.getComputedStyle(heading) : null;
    const descStyle = desc ? window.getComputedStyle(desc) : null;
    const btnStyle = viewAllBtn ? window.getComputedStyle(viewAllBtn) : null;
    const btnRect = viewAllBtn ? viewAllBtn.getBoundingClientRect() : null;
    const chartRect = chartRegion ? chartRegion.getBoundingClientRect() : null;
    const tableRect = tableRegion ? tableRegion.getBoundingClientRect() : null;

    const rowData = rows.map((r) => {
      const cells = r.querySelectorAll('td');
      return {
        stage: cells[0]?.textContent?.trim() || '',
        deals: cells[1]?.textContent?.trim() || '',
        value: cells[2]?.textContent?.trim() || '',
      };
    });

    return {
      card: {
        width: cardRect ? Math.round(cardRect.width * 10) / 10 : 0,
        height: cardRect ? Math.round(cardRect.height * 10) / 10 : 0,
        padding: cardStyle ? cardStyle.padding : '',
        borderRadius: cardStyle ? cardStyle.borderRadius : '',
        borderColor: cardStyle ? cardStyle.borderColor : '',
        backgroundColor: cardStyle ? cardStyle.backgroundColor : '',
      },
      header: {
        title: {
          text: heading?.textContent?.trim(),
          fontFamily: headingStyle?.fontFamily,
          fontSize: headingStyle?.fontSize,
          lineHeight: headingStyle?.lineHeight,
          fontWeight: headingStyle?.fontWeight,
          color: headingStyle?.color,
        },
        description: {
          text: desc?.textContent?.trim(),
          fontFamily: descStyle?.fontFamily,
          fontSize: descStyle?.fontSize,
          lineHeight: descStyle?.lineHeight,
          fontWeight: descStyle?.fontWeight,
          color: descStyle?.color,
        },
        action: {
          text: viewAllBtn?.textContent?.trim(),
          href: viewAllBtn?.getAttribute('href'),
          width: btnRect ? Math.round(btnRect.width * 10) / 10 : 0,
          height: btnRect ? Math.round(btnRect.height * 10) / 10 : 0,
          borderRadius: btnStyle?.borderRadius,
          borderWidth: btnStyle?.borderWidth,
          borderColor: btnStyle?.borderColor,
        },
      },
      columns: {
        chartWidth: chartRect ? Math.round(chartRect.width * 10) / 10 : 0,
        chartHeight: chartRect ? Math.round(chartRect.height * 10) / 10 : 0,
        tableWidth: tableRect ? Math.round(tableRect.width * 10) / 10 : 0,
        tableHeight: tableRect ? Math.round(tableRect.height * 10) / 10 : 0,
        chartSharePct: chartRect && cardRect ? Math.round((chartRect.width / (chartRect.width + (tableRect ? tableRect.width : 0))) * 100) : 0,
        tableSharePct: tableRect && cardRect ? Math.round((tableRect.width / (chartRect.width + tableRect.width)) * 100) : 0,
      },
      tableRows: rowData,
    };
  });

  report.measurements.desktop = desktopMeasurements;

  // Accessibility Check (Light Mode)
  console.log("Running Axe accessibility scan (Light Mode)...");
  const stageCardLocator = page.locator('div.lg\\:col-span-7').first();
  const axeLight = await new AxeBuilder({ page })
    .include('div.lg\\:col-span-7')
    .analyze();

  report.axeResults.light = {
    violations: axeLight.violations,
    violationCount: axeLight.violations.length,
  };
  console.log(`Light Mode Violations: ${axeLight.violations.length}`);

  // Capture Desktop Screenshots
  console.log("Capturing Desktop Screenshots...");
  const desktopFullPng = path.join(OUTPUT_DIR, "stage-distribution-dashboard-desktop-1440x900.png");
  await page.screenshot({ path: desktopFullPng, fullPage: false });
  report.screenshots.push("stage-distribution-dashboard-desktop-1440x900.png");

  const desktopCardPng = path.join(OUTPUT_DIR, "stage-distribution-card-desktop-1440x900.png");
  await stageCardLocator.screenshot({ path: desktopCardPng });
  report.screenshots.push("stage-distribution-card-desktop-1440x900.png");

  // 2. Dark Mode Desktop Context
  console.log("Switching to Dark Mode...");
  await page.evaluate(() => {
    document.documentElement.classList.add("dark");
  });
  await page.waitForTimeout(300);

  const axeDark = await new AxeBuilder({ page })
    .include('div.lg\\:col-span-7')
    .analyze();

  report.axeResults.dark = {
    violations: axeDark.violations,
    violationCount: axeDark.violations.length,
  };
  console.log(`Dark Mode Violations: ${axeDark.violations.length}`);

  const darkCardPng = path.join(OUTPUT_DIR, "stage-distribution-card-dark-desktop-1440x900.png");
  await stageCardLocator.screenshot({ path: darkCardPng });
  report.screenshots.push("stage-distribution-card-dark-desktop-1440x900.png");

  const darkFullPng = path.join(OUTPUT_DIR, "stage-distribution-dashboard-dark-desktop-1440x900.png");
  await page.screenshot({ path: darkFullPng, fullPage: false });
  report.screenshots.push("stage-distribution-dashboard-dark-desktop-1440x900.png");

  await desktopContext.close();

  // 3. Tablet Context (1024x768)
  console.log("Capturing Tablet Context (1024x768)...");
  const tabletContext = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    deviceScaleFactor: 2,
  });
  const tabletPage = await tabletContext.newPage();
  await loginAsSalesRep(tabletPage);
  await tabletPage.getByRole("heading", { name: "Opportunity Stage Distribution" }).waitFor({ timeout: 10000 });
  await tabletPage.waitForTimeout(1000);

  const tabletCardLocator = tabletPage.locator('div.lg\\:col-span-7').first();
  const tabletCardPng = path.join(OUTPUT_DIR, "stage-distribution-card-tablet-1024x768.png");
  await tabletCardLocator.screenshot({ path: tabletCardPng });
  report.screenshots.push("stage-distribution-card-tablet-1024x768.png");

  const tabletFullPng = path.join(OUTPUT_DIR, "stage-distribution-dashboard-tablet-1024x768.png");
  await tabletPage.screenshot({ path: tabletFullPng, fullPage: false });
  report.screenshots.push("stage-distribution-dashboard-tablet-1024x768.png");

  await tabletContext.close();

  // 4. Mobile Context (390x844)
  console.log("Capturing Mobile Context (390x844)...");
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const mobilePage = await mobileContext.newPage();
  await loginAsSalesRep(mobilePage);
  await mobilePage.getByRole("heading", { name: "Opportunity Stage Distribution" }).waitFor({ timeout: 10000 });
  await mobilePage.waitForTimeout(1000);

  const mobileCardLocator = mobilePage.locator('div.lg\\:col-span-7').first();
  const mobileCardPng = path.join(OUTPUT_DIR, "stage-distribution-card-mobile-390x844.png");
  await mobileCardLocator.screenshot({ path: mobileCardPng });
  report.screenshots.push("stage-distribution-card-mobile-390x844.png");

  const mobileFullPng = path.join(OUTPUT_DIR, "stage-distribution-dashboard-mobile-390x844.png");
  await mobilePage.screenshot({ path: mobileFullPng, fullPage: false });
  report.screenshots.push("stage-distribution-dashboard-mobile-390x844.png");

  await mobileContext.close();

  await browser.close();

  // Write Report
  const reportPath = path.join(OUTPUT_DIR, "stage-distribution-verification.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`Saved report to ${reportPath}`);
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
