import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const OUTPUT_DIR = path.resolve(import.meta.dirname, "../../docs/design-mapping/screenshots/opportunities-kanban");
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

  console.log("Starting Opportunities Kanban Conformance Verification...");

  // 1. Desktop Context (1440x900)
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await desktopContext.newPage();

  console.log("Authenticating as Sales Rep...");
  await loginAsSalesRep(page);

  console.log("Navigating to Opportunities page...");
  await page.goto("http://localhost:3000/app/opportunities", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-slot="kanban-column"]', { timeout: 15000 });
  await page.waitForTimeout(1000);

  const boardRegion = page.locator('[role="region"][aria-label="Opportunities Kanban board"]');
  await boardRegion.waitFor({ timeout: 5000 });

  console.log("Measuring Opportunities Kanban (Desktop 1440x900)...");
  const desktopMeasurements = await page.evaluate(() => {
    const board = document.querySelector('[role="region"][aria-label="Opportunities Kanban board"]');
    const columns = Array.from(document.querySelectorAll('[data-slot="kanban-column"]'));
    const firstCol = columns[0];
    const firstColStyle = firstCol ? window.getComputedStyle(firstCol) : null;
    const firstColRect = firstCol ? firstCol.getBoundingClientRect() : null;

    // Header measurements
    const header = firstCol ? firstCol.querySelector('.h-8') : null;
    const headerRect = header ? header.getBoundingClientRect() : null;
    const dot = header ? header.querySelector('.rounded-full:first-child') : null;
    const dotRect = dot ? dot.getBoundingClientRect() : null;
    const stageTitle = header ? header.querySelector('span.text-sm') : null;
    const stageTitleStyle = stageTitle ? window.getComputedStyle(stageTitle) : null;
    const countBadge = header ? header.querySelector('span.rounded-full:last-child, span.rounded-full') : null;
    const countBadgeRect = countBadge ? countBadge.getBoundingClientRect() : null;
    const countBadgeStyle = countBadge ? window.getComputedStyle(countBadge) : null;

    // Card measurements
    const firstCard = document.querySelector('[data-slot="kanban-card"]');
    const cardRect = firstCard ? firstCard.getBoundingClientRect() : null;
    const cardStyle = firstCard ? window.getComputedStyle(firstCard) : null;
    const titleLink = firstCard ? firstCard.querySelector('a') : null;
    const titleStyle = titleLink ? window.getComputedStyle(titleLink) : null;
    const accountRow = firstCard ? firstCard.querySelector('.text-\\[13px\\]') : null;
    const accountStyle = accountRow ? window.getComputedStyle(accountRow) : null;
    const buildingIcon = accountRow ? accountRow.querySelector('svg') : null;
    const valueRow = firstCard ? firstCard.querySelector('.tabular-nums') : null;
    const valueStyle = valueRow ? window.getComputedStyle(valueRow) : null;

    // Actions
    const actionRow = firstCard ? firstCard.querySelector('.border-t') : null;
    const actionButtons = actionRow ? Array.from(actionRow.querySelectorAll('button')) : [];

    // All stages audit
    const stagesData = columns.map(col => {
      const h = col.querySelector('.h-8');
      const name = h?.querySelector('span.text-sm')?.textContent?.trim();
      const count = h?.querySelector('span.rounded-full:last-child')?.textContent?.trim();
      const total = h?.querySelector('span.tabular-nums')?.textContent?.trim();
      const cardCount = col.querySelectorAll('[data-slot="kanban-card"]').length;
      return { name, count, total, cardCount };
    });

    return {
      columnsCount: columns.length,
      columnWidth: firstColRect?.width,
      columnHeight: firstColRect?.height,
      columnBorderRadius: firstColStyle?.borderRadius,
      columnPadding: `${firstColStyle?.paddingTop} ${firstColStyle?.paddingRight} ${firstColStyle?.paddingBottom} ${firstColStyle?.paddingLeft}`,
      columnBackground: firstColStyle?.backgroundColor,
      header: {
        height: headerRect?.height,
        dotWidth: dotRect?.width,
        dotHeight: dotRect?.height,
        titleFontSize: stageTitleStyle?.fontSize,
        titleFontWeight: stageTitleStyle?.fontWeight,
        titleLineHeight: stageTitleStyle?.lineHeight,
        countBadgeHeight: countBadgeRect?.height,
        countBadgeFontSize: countBadgeStyle?.fontSize,
        countBadgeBackground: countBadgeStyle?.backgroundColor,
      },
      card: {
        width: cardRect?.width,
        height: cardRect?.height,
        borderRadius: cardStyle?.borderRadius,
        padding: `${cardStyle?.paddingTop} ${cardStyle?.paddingRight} ${cardStyle?.paddingBottom} ${cardStyle?.paddingLeft}`,
        backgroundColor: cardStyle?.backgroundColor,
        titleFontSize: titleStyle?.fontSize,
        titleFontWeight: titleStyle?.fontWeight,
        accountFontSize: accountStyle?.fontSize,
        hasBuildingIcon: !!buildingIcon,
        valueFontSize: valueStyle?.fontSize,
        valueFontWeight: valueStyle?.fontWeight,
        actionCount: actionButtons.length,
      },
      stages: stagesData,
    };
  });

  report.measurements.desktop = desktopMeasurements;
  console.log("Desktop Measurements:", JSON.stringify(desktopMeasurements, null, 2));

  // Run Axe accessibility scan
  console.log("Running Axe accessibility scan on Opportunities Kanban...");
  const desktopAxe = await new AxeBuilder({ page })
    .include('[role="region"][aria-label="Opportunities Kanban board"]')
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
  console.log("Capturing Desktop screenshots...");
  const pageScreenshotPath = path.join(OUTPUT_DIR, "opportunities-kanban-page-desktop-1440x900.png");
  await page.screenshot({ path: pageScreenshotPath, fullPage: true });
  report.screenshots.push({ name: "desktopPage", path: pageScreenshotPath });

  const boardScreenshotPath = path.join(OUTPUT_DIR, "opportunities-kanban-desktop-1440x900.png");
  await boardRegion.screenshot({ path: boardScreenshotPath });
  report.screenshots.push({ name: "desktopBoardCrop", path: boardScreenshotPath });

  // Card close-up & Hover state
  const firstCardLocator = page.locator('[data-slot="kanban-card"]').first();
  if (await firstCardLocator.count() > 0) {
    const cardScreenshotPath = path.join(OUTPUT_DIR, "opportunities-card-desktop-1440x900.png");
    await firstCardLocator.screenshot({ path: cardScreenshotPath });
    report.screenshots.push({ name: "cardCloseUp", path: cardScreenshotPath });

    console.log("Capturing Hover state...");
    await firstCardLocator.hover();
    await page.waitForTimeout(300);
    const cardHoverPath = path.join(OUTPUT_DIR, "opportunities-card-hover-desktop-1440x900.png");
    await firstCardLocator.screenshot({ path: cardHoverPath });
    report.screenshots.push({ name: "cardHover", path: cardHoverPath });
  }

  // Drop Target state capture (simulate dragover)
  console.log("Simulating Drop Target state...");
  await page.evaluate(() => {
    const targetCol = document.querySelector('[data-stage="qualified"]');
    if (targetCol) {
      targetCol.classList.add("border-2", "border-dashed", "border-[var(--color-primary-400)]", "bg-[var(--color-primary-50)]/40");
    }
  });
  await page.waitForTimeout(300);
  const targetColLocator = page.locator('[data-stage="qualified"]');
  const dropTargetPath = path.join(OUTPUT_DIR, "opportunities-drop-target-desktop-1440x900.png");
  await targetColLocator.screenshot({ path: dropTargetPath });
  report.screenshots.push({ name: "dropTarget", path: dropTargetPath });

  // Reset simulation
  await page.evaluate(() => {
    const targetCol = document.querySelector('[data-stage="qualified"]');
    if (targetCol) {
      targetCol.classList.remove("border-2", "border-dashed", "border-[var(--color-primary-400)]", "bg-[var(--color-primary-50)]/40");
    }
  });

  // 2. Desktop Dark Mode Context
  console.log("Applying dark mode...");
  await page.evaluate(() => {
    document.documentElement.classList.add("dark");
  });
  await page.waitForTimeout(500);

  const darkAxe = await new AxeBuilder({ page })
    .include('[role="region"][aria-label="Opportunities Kanban board"]')
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

  const darkBoardPath = path.join(OUTPUT_DIR, "opportunities-kanban-dark-desktop-1440x900.png");
  await boardRegion.screenshot({ path: darkBoardPath });
  report.screenshots.push({ name: "desktopDarkBoard", path: darkBoardPath });

  // 3. Tablet Viewport (1024x768)
  console.log("Setting Tablet Viewport (1024x768)...");
  await page.evaluate(() => {
    document.documentElement.classList.remove("dark");
  });
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(500);

  const tabletAxe = await new AxeBuilder({ page })
    .include('[role="region"][aria-label="Opportunities Kanban board"]')
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

  const tabletBoardPath = path.join(OUTPUT_DIR, "opportunities-kanban-tablet-1024x768.png");
  await boardRegion.screenshot({ path: tabletBoardPath });
  report.screenshots.push({ name: "tabletBoard", path: tabletBoardPath });

  // 4. Mobile Viewport (390x844)
  console.log("Setting Mobile Viewport (390x844)...");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);

  const mobileMeasurements = await page.evaluate(() => {
    const hasHorizontalOverflow = document.documentElement.scrollWidth > window.innerWidth;
    const board = document.querySelector('[role="region"][aria-label="Opportunities Kanban board"]');
    const cols = Array.from(document.querySelectorAll('[data-slot="kanban-column"]'));
    return {
      hasHorizontalOverflow,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      columnsRendered: cols.length,
      firstColWidth: cols[0]?.getBoundingClientRect().width,
    };
  });
  report.measurements.mobile = mobileMeasurements;
  console.log("Mobile Measurements:", JSON.stringify(mobileMeasurements, null, 2));

  const mobileAxe = await new AxeBuilder({ page })
    .include('[role="region"][aria-label="Opportunities Kanban board"]')
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

  const mobileBoardPath = path.join(OUTPUT_DIR, "opportunities-kanban-mobile-390x844.png");
  await boardRegion.screenshot({ path: mobileBoardPath });
  report.screenshots.push({ name: "mobileBoard", path: mobileBoardPath });

  // Save report
  const reportPath = path.join(OUTPUT_DIR, "opportunities-kanban-verification.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Verification report saved to ${reportPath}`);

  await browser.close();
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
