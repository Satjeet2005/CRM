import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const OUTPUT_DIR = path.resolve(import.meta.dirname, "../../docs/design-mapping/screenshots/opportunities-table");
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

  console.log("Starting Opportunities Table Conformance Verification...");

  // 1. Desktop Context (1440x900)
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await desktopContext.newPage();

  console.log("Authenticating as Sales Rep...");
  await loginAsSalesRep(page);

  console.log("Navigating to Opportunities page and toggling Table view...");
  await page.goto("http://localhost:3000/app/opportunities", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // Toggle Table view
  const tableToggle = page.getByRole("button", { name: "Table" });
  await tableToggle.click();
  await page.waitForSelector('table', { timeout: 15000 });
  await page.waitForTimeout(1000);

  const tableContainer = page.locator('[role="region"][aria-label="Opportunities directory table"]');
  await tableContainer.waitFor({ timeout: 5000 });

  console.log("Measuring Opportunities Table (Desktop 1440x900)...");
  const desktopMeasurements = await page.evaluate(() => {
    const container = document.querySelector('[role="region"][aria-label="Opportunities directory table"]');
    const outerWrapper = container ? container.closest('.hidden.md\\:block') : null;
    const outerStyle = outerWrapper ? window.getComputedStyle(outerWrapper) : null;
    const table = container ? container.querySelector('table') : null;
    const thead = table ? table.querySelector('thead') : null;
    const firstTh = thead ? thead.querySelector('th') : null;
    const thStyle = firstTh ? window.getComputedStyle(firstTh) : null;
    const tbody = table ? table.querySelector('tbody') : null;
    const firstRow = tbody ? tbody.querySelector('tr') : null;
    const firstRowStyle = firstRow ? window.getComputedStyle(firstRow) : null;
    const firstTd = firstRow ? firstRow.querySelector('td') : null;
    const tdStyle = firstTd ? window.getComputedStyle(firstTd) : null;

    // Header titles & alignments
    const thEls = thead ? Array.from(thead.querySelectorAll('th')) : [];
    const headers = thEls.map(th => ({
      text: th.textContent?.trim() || '',
      textAlign: window.getComputedStyle(th).textAlign,
    }));

    // Row heights
    const theadRow = thead ? thead.querySelector('tr') : null;
    const theadRowHeight = theadRow ? theadRow.getBoundingClientRect().height : null;
    const rowHeight = firstRow ? firstRow.getBoundingClientRect().height : null;

    // Opportunity title cell
    const titleLink = firstRow ? firstRow.querySelector('a') : null;
    const titleStyle = titleLink ? window.getComputedStyle(titleLink) : null;
    const accountSpan = firstRow ? firstRow.querySelector('span.text-xs') : null;
    const accountStyle = accountSpan ? window.getComputedStyle(accountSpan) : null;
    const briefcaseIcon = firstRow ? firstRow.querySelector('svg') : null;

    // Stage badge
    const badge = firstRow ? firstRow.querySelector('span.rounded-full') : null;
    const badgeRect = badge ? badge.getBoundingClientRect() : null;
    const badgeStyle = badge ? window.getComputedStyle(badge) : null;

    // Action buttons
    const actionCell = firstRow ? firstRow.querySelector('td:last-child') : null;
    const actionButtons = actionCell ? Array.from(actionCell.querySelectorAll('button')) : [];
    const firstActionRect = actionButtons[0] ? actionButtons[0].getBoundingClientRect() : null;
    const firstActionStyle = actionButtons[0] ? window.getComputedStyle(actionButtons[0]) : null;

    return {
      outerBorderRadius: outerStyle ? outerStyle.borderRadius : null,
      outerBorder: outerStyle ? outerStyle.border : null,
      theadRowHeight,
      rowHeight,
      headerFontFamily: thStyle ? thStyle.fontFamily : null,
      headerFontSize: thStyle ? thStyle.fontSize : null,
      headerFontWeight: thStyle ? thStyle.fontWeight : null,
      headerLetterSpacing: thStyle ? thStyle.letterSpacing : null,
      headerColor: thStyle ? thStyle.color : null,
      headers,
      tdPadding: tdStyle ? `${tdStyle.paddingTop} ${tdStyle.paddingRight} ${tdStyle.paddingBottom} ${tdStyle.paddingLeft}` : null,
      opportunityTitle: {
        fontSize: titleStyle?.fontSize,
        fontWeight: titleStyle?.fontWeight,
        color: titleStyle?.color,
        hasBriefcaseIcon: !!briefcaseIcon,
        accountFontSize: accountStyle?.fontSize,
        accountColor: accountStyle?.color,
      },
      stageBadge: {
        text: badge?.textContent?.trim(),
        height: badgeRect?.height,
        fontSize: badgeStyle?.fontSize,
        backgroundColor: badgeStyle?.backgroundColor,
        color: badgeStyle?.color,
        borderRadius: badgeStyle?.borderRadius,
      },
      actions: {
        count: actionButtons.length,
        buttonHeight: firstActionRect?.height,
        borderRadius: firstActionStyle?.borderRadius,
      },
    };
  });

  report.measurements.desktop = desktopMeasurements;
  console.log("Desktop Measurements:", JSON.stringify(desktopMeasurements, null, 2));

  // Run Axe accessibility scan
  console.log("Running Axe accessibility scan on Opportunities Table...");
  const desktopAxe = await new AxeBuilder({ page })
    .include('[role="region"][aria-label="Opportunities directory table"]')
    .analyze();

  report.axeResults.desktop = {
    violationsCount: desktopAxe.violations.length,
    violations: desktopAxe.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      nodes: v.nodes.length,
    })),
  };
  console.log(`Desktop Axe violations: ${desktopAxe.violations.length}`);

  // Screenshot captures
  console.log("Capturing Desktop 1440x900 screenshots...");
  const desktopPagePath = path.join(OUTPUT_DIR, "opportunities-table-page-desktop-1440x900.png");
  await page.screenshot({ path: desktopPagePath, fullPage: true });
  report.screenshots.push({ name: "desktopPage", path: desktopPagePath });

  const desktopTablePath = path.join(OUTPUT_DIR, "opportunities-table-desktop-1440x900.png");
  const tableSection = page.locator('.mt-4').first();
  await tableSection.screenshot({ path: desktopTablePath });
  report.screenshots.push({ name: "desktopTableCrop", path: desktopTablePath });

  // 2. Desktop Dark Mode Context
  console.log("Applying dark mode...");
  await page.evaluate(() => {
    document.documentElement.classList.add("dark");
  });
  await page.waitForTimeout(500);

  const darkAxe = await new AxeBuilder({ page })
    .include('[role="region"][aria-label="Opportunities directory table"]')
    .analyze();

  report.axeResults.desktopDark = {
    violationsCount: darkAxe.violations.length,
    violations: darkAxe.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      nodes: v.nodes.length,
    })),
  };
  console.log(`Desktop Dark Axe violations: ${darkAxe.violations.length}`);

  const darkTablePath = path.join(OUTPUT_DIR, "opportunities-table-dark-desktop-1440x900.png");
  await tableSection.screenshot({ path: darkTablePath });
  report.screenshots.push({ name: "desktopDarkTableCrop", path: darkTablePath });

  // 3. Tablet Viewport (1024x768)
  console.log("Setting Tablet Viewport (1024x768)...");
  await page.evaluate(() => {
    document.documentElement.classList.remove("dark");
  });
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(500);

  const tabletAxe = await new AxeBuilder({ page })
    .include('[role="region"][aria-label="Opportunities directory table"]')
    .analyze();

  report.axeResults.tablet = {
    violationsCount: tabletAxe.violations.length,
    violations: tabletAxe.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      nodes: v.nodes.length,
    })),
  };
  console.log(`Tablet Axe violations: ${tabletAxe.violations.length}`);

  const tabletTablePath = path.join(OUTPUT_DIR, "opportunities-table-tablet-1024x768.png");
  await tableSection.screenshot({ path: tabletTablePath });
  report.screenshots.push({ name: "tabletTableCrop", path: tabletTablePath });

  // 4. Mobile Viewport (390x844)
  console.log("Setting Mobile Viewport (390x844)...");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);

  const mobileMeasurements = await page.evaluate(() => {
    const mobileContainer = document.querySelector('.block.md\\:hidden');
    const firstCard = mobileContainer ? mobileContainer.querySelector('.rounded-\\[var\\(--radius-md\\)\\]') : null;
    const cardRect = firstCard ? firstCard.getBoundingClientRect() : null;
    const titleLink = firstCard ? firstCard.querySelector('a') : null;
    const badge = firstCard ? firstCard.querySelector('span.rounded-full') : null;
    const detailsGrid = firstCard ? firstCard.querySelector('.grid.grid-cols-2') : null;
    const actionBtn = firstCard ? firstCard.querySelector('button') : null;
    const actionRect = actionBtn ? actionBtn.getBoundingClientRect() : null;

    const hasHorizontalOverflow = document.documentElement.scrollWidth > window.innerWidth;

    return {
      cardWidth: cardRect?.width,
      hasBriefcaseIcon: !!firstCard?.querySelector('svg'),
      titleText: titleLink?.textContent?.trim(),
      badgeText: badge?.textContent?.trim(),
      hasDetailsGrid: !!detailsGrid,
      actionBtnHeight: actionRect?.height,
      hasHorizontalOverflow,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    };
  });

  report.measurements.mobile = mobileMeasurements;
  console.log("Mobile Measurements:", JSON.stringify(mobileMeasurements, null, 2));

  const mobileAxe = await new AxeBuilder({ page })
    .include('.block.md\\:hidden')
    .analyze();

  report.axeResults.mobile = {
    violationsCount: mobileAxe.violations.length,
    violations: mobileAxe.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      nodes: v.nodes.length,
    })),
  };
  console.log(`Mobile Axe violations: ${mobileAxe.violations.length}`);

  const mobileTablePath = path.join(OUTPUT_DIR, "opportunities-table-mobile-390x844.png");
  await tableSection.screenshot({ path: mobileTablePath });
  report.screenshots.push({ name: "mobileTableCrop", path: mobileTablePath });

  // Save report
  const reportPath = path.join(OUTPUT_DIR, "opportunities-table-verification.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Verification report saved to ${reportPath}`);

  await browser.close();
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
