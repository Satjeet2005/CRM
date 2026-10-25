import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const OUTPUT_DIR = path.resolve(import.meta.dirname, "../../docs/design-mapping/screenshots/contacts-table");
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

  console.log("Starting Contacts Table Conformance Verification...");

  // 1. Desktop Context (1440x900)
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await desktopContext.newPage();

  console.log("Authenticating as Sales Rep...");
  await loginAsSalesRep(page);

  console.log("Navigating to Contacts page...");
  await page.goto("http://localhost:3000/app/contacts", { waitUntil: "networkidle" });
  await page.waitForSelector('table', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Table container locator
  const tableContainer = page.locator('[role="region"][aria-label="Contacts directory table"]');
  await tableContainer.waitFor({ timeout: 5000 });

  console.log("Measuring Contacts Table (Desktop 1440x900)...");
  const desktopMeasurements = await page.evaluate(() => {
    const container = document.querySelector('[role="region"][aria-label="Contacts directory table"]');
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

    // First contact identity elements (Avatar, Name, Title, Badge)
    const avatar = firstTd ? firstTd.querySelector('div.rounded-full') : null;
    const avatarRect = avatar ? avatar.getBoundingClientRect() : null;
    const avatarStyle = avatar ? window.getComputedStyle(avatar) : null;

    const nameSpan = firstTd ? firstTd.querySelector('span.font-semibold') : null;
    const nameStyle = nameSpan ? window.getComputedStyle(nameSpan) : null;

    const titleSpan = firstTd ? firstTd.querySelector('span.text-\\[12px\\]') || firstTd.querySelector('.text-xs') : null;
    const titleStyle = titleSpan ? window.getComputedStyle(titleSpan) : null;

    const primaryBadge = firstTd ? firstTd.querySelector('span[class*="rounded"]') : null;
    const primaryBadgeRect = primaryBadge ? primaryBadge.getBoundingClientRect() : null;
    const primaryBadgeStyle = primaryBadge ? window.getComputedStyle(primaryBadge) : null;

    // Account link
    const accountTd = firstRow ? firstRow.querySelectorAll('td')[1] : null;
    const accountLink = accountTd ? accountTd.querySelector('a') : null;
    const accountLinkStyle = accountLink ? window.getComputedStyle(accountLink) : null;

    // Email cell
    const emailTd = firstRow ? firstRow.querySelectorAll('td')[2] : null;
    const emailLink = emailTd ? emailTd.querySelector('a') : null;
    const emailIcon = emailLink ? emailLink.querySelector('svg') : null;
    const emailIconStyle = emailIcon ? window.getComputedStyle(emailIcon) : null;

    // Phone cell
    const phoneTd = firstRow ? firstRow.querySelectorAll('td')[3] : null;
    const phoneSpan = phoneTd ? phoneTd.querySelector('span') : null;
    const phoneIcon = phoneSpan ? phoneSpan.querySelector('svg') : null;

    // Status badge
    const statusTd = firstRow ? firstRow.querySelectorAll('td')[4] : null;
    const statusBadge = statusTd ? statusTd.querySelector('span[class*="rounded"]') : null;
    const statusBadgeRect = statusBadge ? statusBadge.getBoundingClientRect() : null;
    const statusBadgeStyle = statusBadge ? window.getComputedStyle(statusBadge) : null;

    // Row action buttons
    const actionCell = firstRow ? firstRow.querySelector('td:last-child') : null;
    const actionButtons = actionCell ? Array.from(actionCell.querySelectorAll('button')) : [];
    const editBtn = actionButtons[0] ? actionButtons[0].getBoundingClientRect() : null;
    const editBtnStyle = actionButtons[0] ? window.getComputedStyle(actionButtons[0]) : null;
    const editAria = actionButtons[0] ? actionButtons[0].getAttribute('aria-label') : null;

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
      avatar: {
        width: avatarRect?.width,
        height: avatarRect?.height,
        borderRadius: avatarStyle?.borderRadius,
        backgroundColor: avatarStyle?.backgroundColor,
      },
      identity: {
        name: nameSpan?.textContent?.trim(),
        nameColor: nameStyle?.color,
        nameFontSize: nameStyle?.fontSize,
        nameFontWeight: nameStyle?.fontWeight,
        title: titleSpan?.textContent?.trim(),
        titleColor: titleStyle?.color,
        titleFontSize: titleStyle?.fontSize,
      },
      primaryBadge: primaryBadge ? {
        text: primaryBadge.textContent?.trim(),
        height: primaryBadgeRect?.height,
        fontSize: primaryBadgeStyle?.fontSize,
        backgroundColor: primaryBadgeStyle?.backgroundColor,
        color: primaryBadgeStyle?.color,
      } : null,
      accountLink: {
        text: accountLink?.textContent?.trim(),
        color: accountLinkStyle?.color,
        fontSize: accountLinkStyle?.fontSize,
        fontWeight: accountLinkStyle?.fontWeight,
      },
      emailCell: {
        text: emailLink?.textContent?.trim(),
        iconColor: emailIconStyle?.color,
        hasIcon: !!emailIcon,
      },
      phoneCell: {
        hasIcon: !!phoneIcon,
      },
      statusBadge: {
        text: statusBadge?.textContent?.trim(),
        height: statusBadgeRect?.height,
        fontSize: statusBadgeStyle?.fontSize,
        backgroundColor: statusBadgeStyle?.backgroundColor,
        color: statusBadgeStyle?.color,
      },
      actionButtons: {
        count: actionButtons.length,
        editWidth: editBtn?.width,
        editHeight: editBtn?.height,
        editAria,
        borderRadius: editBtnStyle?.borderRadius,
      },
    };
  });

  report.measurements.desktop = desktopMeasurements;
  console.log("Desktop Measurements:", JSON.stringify(desktopMeasurements, null, 2));

  // Run Axe accessibility check on table
  console.log("Running Axe accessibility check on Contacts table...");
  const desktopAxe = await new AxeBuilder({ page })
    .include('[role="region"][aria-label="Contacts directory table"]')
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

  // Screenshot: Desktop Light
  console.log("Capturing Desktop Light screenshot...");
  const desktopPath = path.join(OUTPUT_DIR, "contacts-table-desktop-1440x900.png");
  await page.screenshot({ path: desktopPath, fullPage: false });
  report.screenshots.push("contacts-table-desktop-1440x900.png");

  // Screenshot: Desktop Dark
  console.log("Switching to Dark mode and capturing screenshot...");
  await page.evaluate(() => {
    document.documentElement.classList.add("dark");
  });
  await page.waitForTimeout(500);

  const darkAxe = await new AxeBuilder({ page })
    .include('[role="region"][aria-label="Contacts directory table"]')
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
  console.log(`Desktop Dark Axe Violations: ${darkAxe.violations.length}`);

  const darkPath = path.join(OUTPUT_DIR, "contacts-table-dark-desktop-1440x900.png");
  await page.screenshot({ path: darkPath, fullPage: false });
  report.screenshots.push("contacts-table-dark-desktop-1440x900.png");

  await desktopContext.close();

  // 2. Tablet Context (1024x768)
  console.log("Measuring Contacts Table (Tablet 1024x768)...");
  const tabletContext = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    deviceScaleFactor: 2,
  });
  const tabletPage = await tabletContext.newPage();
  await loginAsSalesRep(tabletPage);
  await tabletPage.goto("http://localhost:3000/app/contacts", { waitUntil: "networkidle" });
  await tabletPage.waitForSelector('table', { timeout: 15000 });
  await tabletPage.waitForTimeout(1000);

  const tabletAxe = await new AxeBuilder({ page: tabletPage })
    .include('[role="region"][aria-label="Contacts directory table"]')
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

  const tabletPath = path.join(OUTPUT_DIR, "contacts-table-tablet-1024x768.png");
  await tabletPage.screenshot({ path: tabletPath, fullPage: false });
  report.screenshots.push("contacts-table-tablet-1024x768.png");
  await tabletContext.close();

  // 3. Mobile Context (390x844)
  console.log("Measuring Contacts Table (Mobile 390x844)...");
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  const mobilePage = await mobileContext.newPage();
  await loginAsSalesRep(mobilePage);
  await mobilePage.goto("http://localhost:3000/app/contacts", { waitUntil: "networkidle" });
  await mobilePage.waitForSelector('.block.md\\:hidden', { timeout: 15000 });
  await mobilePage.waitForTimeout(1000);

  const mobileMeasurements = await mobilePage.evaluate(() => {
    const mobileContainer = document.querySelector('.block.md\\:hidden');
    const firstCard = mobileContainer ? mobileContainer.querySelector('div.rounded-\\[var\\(--radius-md\\)\\]') : null;
    const cardRect = firstCard ? firstCard.getBoundingClientRect() : null;

    const actionButtons = firstCard ? Array.from(firstCard.querySelectorAll('button')) : [];

    return {
      cardWidth: cardRect?.width,
      hasMobileCards: !!firstCard,
      actionButtonCount: actionButtons.length,
      bodyScrollWidth: document.body.scrollWidth,
      windowInnerWidth: window.innerWidth,
      hasHorizontalOverflow: document.body.scrollWidth > window.innerWidth,
    };
  });

  report.measurements.mobile = mobileMeasurements;
  console.log("Mobile Measurements:", JSON.stringify(mobileMeasurements, null, 2));

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

  const mobilePath = path.join(OUTPUT_DIR, "contacts-table-mobile-390x844.png");
  await mobilePage.screenshot({ path: mobilePath, fullPage: false });
  report.screenshots.push("contacts-table-mobile-390x844.png");
  await mobileContext.close();

  // Save JSON report
  const reportPath = path.join(OUTPUT_DIR, "contacts-table-verification.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Report written to ${reportPath}`);

  await browser.close();
  console.log("Verification run complete!");
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
