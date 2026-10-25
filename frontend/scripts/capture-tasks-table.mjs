import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const OUTPUT_DIR = path.resolve(import.meta.dirname, "../../docs/design-mapping/screenshots/tasks-table");
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

  console.log("Starting Tasks Table Conformance Verification...");

  // 1. Desktop Context (1440x900)
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await desktopContext.newPage();

  console.log("Authenticating as Sales Rep...");
  await loginAsSalesRep(page);

  console.log("Navigating to Tasks page...");
  await page.goto("http://localhost:3000/app/tasks", { waitUntil: "networkidle" });
  await page.waitForSelector('table', { timeout: 15000 });
  await page.waitForTimeout(1000);

  const tableContainer = page.locator('[role="region"][aria-label="Tasks directory table"]');
  await tableContainer.waitFor({ timeout: 5000 });

  console.log("Measuring Tasks Table (Desktop 1440x900)...");
  const desktopMeasurements = await page.evaluate(() => {
    // 1. Tabs
    const tablist = document.querySelector('[role="tablist"]');
    const tabs = tablist ? Array.from(tablist.querySelectorAll('[role="tab"]')) : [];
    const activeTab = tabs.find(t => t.getAttribute('aria-selected') === 'true');
    const activeTabStyle = activeTab ? window.getComputedStyle(activeTab) : null;
    const activeUnderline = activeTab ? activeTab.querySelector('span[aria-hidden="true"].bg-\\[var\\(--color-primary-500\\)\\]') : null;
    const inactiveTab = tabs.find(t => t.getAttribute('aria-selected') !== 'true');
    const inactiveTabStyle = inactiveTab ? window.getComputedStyle(inactiveTab) : null;

    // 2. Toolbar
    const searchInput = document.querySelector('input[placeholder="Search action items..."]');
    const searchInputStyle = searchInput ? window.getComputedStyle(searchInput) : null;
    const searchRect = searchInput ? searchInput.getBoundingClientRect() : null;
    const prioritySelect = document.querySelector('[aria-label="Filter by task priority"]');
    const prioritySelectRect = prioritySelect ? prioritySelect.getBoundingClientRect() : null;

    // 3. Table Container & Shell
    const container = document.querySelector('[role="region"][aria-label="Tasks directory table"]');
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

    // Headers & Alignments
    const thEls = thead ? Array.from(thead.querySelectorAll('th')) : [];
    const headers = thEls.map(th => ({
      text: th.textContent?.trim() || '',
      textAlign: window.getComputedStyle(th).textAlign,
    }));

    // Row heights
    const theadRow = thead ? thead.querySelector('tr') : null;
    const theadRowHeight = theadRow ? theadRow.getBoundingClientRect().height : null;
    const rowHeight = firstRow ? firstRow.getBoundingClientRect().height : null;

    // Cells in first row
    const cells = firstRow ? Array.from(firstRow.querySelectorAll('td')) : [];

    // Completion button
    const completeBtn = cells[0]?.querySelector('button');
    const completeBtnRect = completeBtn?.getBoundingClientRect();
    const completeBtnAria = completeBtn?.getAttribute('aria-label');

    // Title & description cell
    const titleSpan = cells[1]?.querySelector('span.font-semibold');
    const titleStyle = titleSpan ? window.getComputedStyle(titleSpan) : null;
    const descSpan = cells[1]?.querySelector('span.text-\\[12px\\]');
    const descStyle = descSpan ? window.getComputedStyle(descSpan) : null;

    // Priority badge
    const priorityBadge = cells[2]?.querySelector('span.rounded-full');
    const priorityBadgeRect = priorityBadge?.getBoundingClientRect();
    const priorityBadgeStyle = priorityBadge ? window.getComputedStyle(priorityBadge) : null;

    // Due date & Overdue badge
    const overdueBadge = cells[3]?.querySelector('span.rounded-full');
    const overdueBadgeRect = overdueBadge?.getBoundingClientRect();
    const overdueBadgeStyle = overdueBadge ? window.getComputedStyle(overdueBadge) : null;
    const dueDateSpan = cells[3]?.querySelector('span.text-\\[13px\\]');
    const dueDateStyle = dueDateSpan ? window.getComputedStyle(dueDateSpan) : null;

    // Related Account link
    const accountLink = cells[4]?.querySelector('a');
    const accountLinkStyle = accountLink ? window.getComputedStyle(accountLink) : null;
    const accountIcon = accountLink?.querySelector('svg');
    const accountIconRect = accountIcon?.getBoundingClientRect();

    // Related Deal link
    const dealLink = cells[5]?.querySelector('a');
    const dealLinkStyle = dealLink ? window.getComputedStyle(dealLink) : null;
    const dealIcon = dealLink?.querySelector('svg');
    const dealIconRect = dealIcon?.getBoundingClientRect();

    // Assignee
    const assigneeSpan = cells[6]?.querySelector('span');
    const assigneeStyle = assigneeSpan ? window.getComputedStyle(assigneeSpan) : null;

    // Actions button
    const editBtn = cells[7]?.querySelector('button');
    const editBtnRect = editBtn?.getBoundingClientRect();
    const editBtnAria = editBtn?.getAttribute('aria-label');

    return {
      tabs: {
        count: tabs.length,
        activeTab: {
          text: activeTab?.textContent?.trim(),
          fontSize: activeTabStyle?.fontSize,
          fontWeight: activeTabStyle?.fontWeight,
          color: activeTabStyle?.color,
          hasSaffronUnderline: !!activeUnderline,
        },
        inactiveTab: {
          fontSize: inactiveTabStyle?.fontSize,
          fontWeight: inactiveTabStyle?.fontWeight,
          color: inactiveTabStyle?.color,
        },
      },
      toolbar: {
        searchInputHeight: searchRect?.height,
        searchFontSize: searchInputStyle?.fontSize,
        prioritySelectHeight: prioritySelectRect?.height,
      },
      outerShell: {
        borderRadius: outerStyle?.borderRadius,
        border: outerStyle?.border,
      },
      tableHeader: {
        height: theadRowHeight,
        fontFamily: thStyle?.fontFamily,
        fontSize: thStyle?.fontSize,
        fontWeight: thStyle?.fontWeight,
        color: thStyle?.color,
        letterSpacing: thStyle?.letterSpacing,
        headers,
      },
      bodyRow: {
        height: rowHeight,
        padding: tdStyle ? `${tdStyle.paddingTop} ${tdStyle.paddingRight} ${tdStyle.paddingBottom} ${tdStyle.paddingLeft}` : null,
      },
      completionControl: {
        targetWidth: completeBtnRect?.width,
        targetHeight: completeBtnRect?.height,
        ariaLabel: completeBtnAria,
      },
      actionItemCell: {
        titleFontSize: titleStyle?.fontSize,
        titleFontWeight: titleStyle?.fontWeight,
        titleColor: titleStyle?.color,
        descFontSize: descStyle?.fontSize,
        descFontWeight: descStyle?.fontWeight,
        descColor: descStyle?.color,
      },
      priorityBadge: {
        text: priorityBadge?.textContent?.trim(),
        height: priorityBadgeRect?.height,
        backgroundColor: priorityBadgeStyle?.backgroundColor,
        color: priorityBadgeStyle?.color,
        borderRadius: priorityBadgeStyle?.borderRadius,
      },
      dueDatePresentation: {
        hasOverdueBadge: !!overdueBadge,
        overdueBadgeText: overdueBadge?.textContent?.trim(),
        overdueBadgeHeight: overdueBadgeRect?.height,
        overdueBadgeBg: overdueBadgeStyle?.backgroundColor,
        overdueBadgeColor: overdueBadgeStyle?.color,
        dateFontSize: dueDateStyle?.fontSize,
        dateColor: dueDateStyle?.color,
      },
      relatedLinks: {
        accountLinkColor: accountLinkStyle?.color,
        accountIconWidth: accountIconRect?.width,
        accountIconHeight: accountIconRect?.height,
        dealLinkColor: dealLinkStyle?.color,
        dealIconWidth: dealIconRect?.width,
        dealIconHeight: dealIconRect?.height,
      },
      assigneeText: {
        fontSize: assigneeStyle?.fontSize,
        fontWeight: assigneeStyle?.fontWeight,
        color: assigneeStyle?.color,
      },
      actionsControl: {
        targetWidth: editBtnRect?.width,
        targetHeight: editBtnRect?.height,
        ariaLabel: editBtnAria,
      },
    };
  });

  report.measurements.desktop = desktopMeasurements;
  console.log("Desktop Measurements:", JSON.stringify(desktopMeasurements, null, 2));

  // Run Axe accessibility scan
  console.log("Running Axe accessibility scan on Tasks Desktop...");
  const desktopAxe = await new AxeBuilder({ page })
    .include('[role="region"][aria-label="Tasks directory table"]')
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
  console.log(`Desktop Axe Violations: ${desktopAxe.violations.length}`);

  // Screenshot 1: Desktop table crop
  console.log("Capturing desktop table crop screenshot...");
  const desktopTableCropPath = path.join(OUTPUT_DIR, "tasks-table-desktop-1440x900.png");
  await tableContainer.screenshot({ path: desktopTableCropPath });
  report.screenshots.push("tasks-table-desktop-1440x900.png");

  // Screenshot 2: Full desktop page
  console.log("Capturing full desktop page screenshot...");
  const desktopPagePath = path.join(OUTPUT_DIR, "tasks-table-page-desktop-1440x900.png");
  await page.screenshot({ path: desktopPagePath, fullPage: false });
  report.screenshots.push("tasks-table-page-desktop-1440x900.png");

  // 2. Dark Mode Desktop Context (1440x900)
  console.log("Testing Dark Mode Desktop (1440x900)...");
  await page.evaluate(() => {
    document.documentElement.classList.add("dark");
  });
  await page.waitForTimeout(500);

  const darkAxe = await new AxeBuilder({ page })
    .include('[role="region"][aria-label="Tasks directory table"]')
    .analyze();

  report.axeResults.dark = {
    violationsCount: darkAxe.violations.length,
    violations: darkAxe.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      nodes: v.nodes.length,
    })),
  };
  console.log(`Dark Mode Axe Violations: ${darkAxe.violations.length}`);

  const darkScreenshotPath = path.join(OUTPUT_DIR, "tasks-table-dark-desktop-1440x900.png");
  await tableContainer.screenshot({ path: darkScreenshotPath });
  report.screenshots.push("tasks-table-dark-desktop-1440x900.png");

  // Reset dark mode
  await page.evaluate(() => {
    document.documentElement.classList.remove("dark");
  });
  await desktopContext.close();

  // 3. Tablet Context (1024x768)
  console.log("Testing Tablet Viewport (1024x768)...");
  const tabletContext = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    deviceScaleFactor: 2,
  });
  const tabletPage = await tabletContext.newPage();
  await loginAsSalesRep(tabletPage);
  await tabletPage.goto("http://localhost:3000/app/tasks", { waitUntil: "networkidle" });
  await tabletPage.waitForSelector('table', { timeout: 15000 });
  await tabletPage.waitForTimeout(1000);

  const tabletAxe = await new AxeBuilder({ page: tabletPage })
    .include('[role="region"][aria-label="Tasks directory table"]')
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
  console.log(`Tablet Axe Violations: ${tabletAxe.violations.length}`);

  const tabletScreenshotPath = path.join(OUTPUT_DIR, "tasks-table-tablet-1024x768.png");
  await tabletPage.screenshot({ path: tabletScreenshotPath, fullPage: false });
  report.screenshots.push("tasks-table-tablet-1024x768.png");
  await tabletContext.close();

  // 4. Mobile Context (390x844)
  console.log("Testing Mobile Viewport (390x844)...");
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
  });
  const mobilePage = await mobileContext.newPage();
  await loginAsSalesRep(mobilePage);
  await mobilePage.goto("http://localhost:3000/app/tasks", { waitUntil: "networkidle" });
  await mobilePage.waitForTimeout(1500);

  const mobileAxe = await new AxeBuilder({ page: mobilePage })
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
  console.log(`Mobile Axe Violations: ${mobileAxe.violations.length}`);

  const mobileScreenshotPath = path.join(OUTPUT_DIR, "tasks-table-mobile-390x844.png");
  await mobilePage.screenshot({ path: mobileScreenshotPath, fullPage: false });
  report.screenshots.push("tasks-table-mobile-390x844.png");
  await mobileContext.close();

  await browser.close();

  // Save report
  const reportPath = path.join(OUTPUT_DIR, "tasks-table-verification.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Conformance verification complete. Report saved to: ${reportPath}`);
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
