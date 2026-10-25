import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const OUTPUT_DIR = path.resolve(import.meta.dirname, "../../docs/design-mapping/screenshots/accounts-table");
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

  console.log("Starting Accounts Table Conformance Verification...");

  // 1. Desktop Context (1440x900)
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await desktopContext.newPage();

  console.log("Authenticating as Sales Rep...");
  await loginAsSalesRep(page);

  console.log("Navigating to Accounts page...");
  await page.goto("http://localhost:3000/app/accounts", { waitUntil: "networkidle" });
  await page.waitForSelector('table', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Table container locator
  const tableContainer = page.locator('[role="region"][aria-label="Accounts directory table"]');
  await tableContainer.waitFor({ timeout: 5000 });

  console.log("Measuring Accounts Table (Desktop 1440x900)...");
  const desktopMeasurements = await page.evaluate(() => {
    const container = document.querySelector('[role="region"][aria-label="Accounts directory table"]');
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

    // Header titles
    const headers = thead ? Array.from(thead.querySelectorAll('th')).map(th => th.textContent?.trim() || '') : [];

    // Header height and body row height
    const theadRow = thead ? thead.querySelector('tr') : null;
    const theadRowHeight = theadRow ? theadRow.getBoundingClientRect().height : null;
    const rowHeight = firstRow ? firstRow.getBoundingClientRect().height : null;

    // First account name element
    const nameLink = firstRow ? firstRow.querySelector('a') : null;
    const nameStyle = nameLink ? window.getComputedStyle(nameLink) : null;
    const buildingIcon = nameLink ? nameLink.querySelector('svg') : null;

    // Status badge
    const badge = firstRow ? firstRow.querySelector('.rounded-full') || firstRow.querySelector('span[class*="rounded"]') : null;
    const badgeRect = badge ? badge.getBoundingClientRect() : null;
    const badgeStyle = badge ? window.getComputedStyle(badge) : null;

    // Row action buttons
    const actionCell = firstRow ? firstRow.querySelector('td:last-child') : null;
    const actionButtons = actionCell ? Array.from(actionCell.querySelectorAll('button')) : [];
    const editBtn = actionButtons[0] ? actionButtons[0].getBoundingClientRect() : null;
    const editBtnStyle = actionButtons[0] ? window.getComputedStyle(actionButtons[0]) : null;
    const editAria = actionButtons[0] ? actionButtons[0].getAttribute('aria-label') : null;

    // Toolbar elements
    const searchInput = document.querySelector('input[placeholder*="Search by name"]');
    const searchRect = searchInput ? searchInput.getBoundingClientRect() : null;
    const newAccountBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('New Account'));
    const newAccountRect = newAccountBtn ? newAccountBtn.getBoundingClientRect() : null;

    // Pagination footer
    const paginationContainer = document.querySelector('button[aria-label="Previous page"]')?.closest('div.flex');
    const prevBtn = document.querySelector('button[aria-label="Previous page"]');
    const prevRect = prevBtn ? prevBtn.getBoundingClientRect() : null;

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
      bodyFontSize: tdStyle ? tdStyle.fontSize : null,
      bodyFontWeight: tdStyle ? tdStyle.fontWeight : null,
      bodyLineHeight: tdStyle ? tdStyle.lineHeight : null,
      nameColor: nameStyle ? nameStyle.color : null,
      hasBuildingIcon: !!buildingIcon,
      statusBadge: {
        text: badge?.textContent?.trim(),
        height: badgeRect?.height,
        fontSize: badgeStyle?.fontSize,
        backgroundColor: badgeStyle?.backgroundColor,
        color: badgeStyle?.color,
      },
      actionButtons: {
        count: actionButtons.length,
        editWidth: editBtn?.width,
        editHeight: editBtn?.height,
        editAria,
        borderRadius: editBtnStyle?.borderRadius,
      },
      toolbar: {
        searchHeight: searchRect?.height,
        newAccountHeight: newAccountRect?.height,
        prevButtonHeight: prevRect?.height,
      },
    };
  });

  report.measurements.desktop = desktopMeasurements;
  console.log("Desktop Measurements:", JSON.stringify(desktopMeasurements, null, 2));

  // Run Axe accessibility check on table
  console.log("Running Axe accessibility check on Accounts table...");
  const desktopAxe = await new AxeBuilder({ page })
    .include('[role="region"][aria-label="Accounts directory table"]')
    .analyze();

  report.axeResults.desktop = {
    violationsCount: desktopAxe.violations.length,
    violations: desktopAxe.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      helpUrl: v.helpUrl,
      nodes: v.nodes.length,
    })),
  };
  console.log(`Desktop Axe violations: ${desktopAxe.violations.length}`);

  // Capture full desktop page and table crop
  console.log("Capturing Desktop 1440x900 screenshots...");
  const desktopPagePath = path.join(OUTPUT_DIR, "accounts-table-page-desktop-1440x900.png");
  await page.screenshot({ path: desktopPagePath, fullPage: true });
  report.screenshots.push({ name: "desktopPage", path: desktopPagePath });

  const desktopTablePath = path.join(OUTPUT_DIR, "accounts-table-desktop-1440x900.png");
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
    .include('[role="region"][aria-label="Accounts directory table"]')
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

  const darkTablePath = path.join(OUTPUT_DIR, "accounts-table-dark-desktop-1440x900.png");
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
    .include('[role="region"][aria-label="Accounts directory table"]')
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

  const tabletTablePath = path.join(OUTPUT_DIR, "accounts-table-tablet-1024x768.png");
  await tableSection.screenshot({ path: tabletTablePath });
  report.screenshots.push({ name: "tabletTableCrop", path: tabletTablePath });

  // 4. Mobile Viewport (390x844)
  console.log("Setting Mobile Viewport (390x844)...");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);

  // Measure Mobile Stacked Table
  const mobileMeasurements = await page.evaluate(() => {
    const mobileContainer = document.querySelector('.block.md\\:hidden');
    const firstCard = mobileContainer ? mobileContainer.querySelector('.rounded-\\[var\\(--radius-md\\)\\]') : null;
    const cardRect = firstCard ? firstCard.getBoundingClientRect() : null;
    const nameLink = firstCard ? firstCard.querySelector('a') : null;
    const badge = firstCard ? firstCard.querySelector('span[class*="rounded"]') : null;
    const detailsGrid = firstCard ? firstCard.querySelector('.grid.grid-cols-2') : null;
    const editBtn = firstCard ? firstCard.querySelector('button[aria-label^="Edit account"]') : null;
    const editRect = editBtn ? editBtn.getBoundingClientRect() : null;

    // Check document horizontal scroll
    const hasHorizontalOverflow = document.documentElement.scrollWidth > window.innerWidth;

    return {
      cardWidth: cardRect?.width,
      hasBuildingIcon: !!nameLink?.querySelector('svg'),
      nameText: nameLink?.textContent?.trim(),
      badgeText: badge?.textContent?.trim(),
      hasDetailsGrid: !!detailsGrid,
      editBtnHeight: editRect?.height,
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

  const mobileTablePath = path.join(OUTPUT_DIR, "accounts-table-mobile-390x844.png");
  await tableSection.screenshot({ path: mobileTablePath });
  report.screenshots.push({ name: "mobileTableCrop", path: mobileTablePath });

  // Save report
  const reportPath = path.join(OUTPUT_DIR, "accounts-table-verification.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Verification report saved to ${reportPath}`);

  await browser.close();
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
