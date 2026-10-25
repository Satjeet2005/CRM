import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const OUTPUT_DIR = path.resolve(import.meta.dirname, "../../docs/design-mapping/screenshots/attention-required");
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

  console.log("Starting Attention Required Conformance Verification...");

  // 1. Desktop Context (1440x900)
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await desktopContext.newPage();

  console.log("Authenticating as Sales Rep...");
  await loginAsSalesRep(page);

  console.log("Waiting for Attention Required card to load...");
  await page.getByRole("heading", { name: "Attention Required" }).waitFor({ timeout: 10000 });
  await page.waitForTimeout(1000);

  const attentionCardLocator = page.locator('div.lg\\:col-span-5').first();

  // Measure card, header, preview rows, badge alignment
  console.log("Measuring Attention Required (Desktop 1440x900)...");
  const desktopMeasurements = await page.evaluate(() => {
    const heading = document.evaluate(
      "//h2[contains(text(), 'Attention Required')]",
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;
    const card = heading ? heading.closest('div.rounded-\\[var\\(--radius-xl\\)\\]') || heading.parentElement?.parentElement?.parentElement : null;
    const desc = heading?.nextElementSibling;
    const viewAllBtn = card ? card.querySelector('button') : null;
    const rowsContainer = card ? card.querySelector('div.divide-y') : null;
    const rows = rowsContainer ? Array.from(rowsContainer.children) : [];

    const cardRect = card ? card.getBoundingClientRect() : null;
    const cardStyle = card ? window.getComputedStyle(card) : null;
    const headingStyle = heading ? window.getComputedStyle(heading) : null;
    const descStyle = desc ? window.getComputedStyle(desc) : null;
    const btnStyle = viewAllBtn ? window.getComputedStyle(viewAllBtn) : null;
    const btnRect = viewAllBtn ? viewAllBtn.getBoundingClientRect() : null;

    const rowData = rows.map((r, i) => {
      const iconWell = r.querySelector('div.rounded-full');
      const title = r.querySelector('h3');
      const description = r.querySelector('p');
      const badge = r.querySelector('span');
      const action = r.querySelector('a');

      const iconStyle = iconWell ? window.getComputedStyle(iconWell) : null;
      const titleStyle = title ? window.getComputedStyle(title) : null;
      const descRowStyle = description ? window.getComputedStyle(description) : null;
      const badgeStyle = badge ? window.getComputedStyle(badge) : null;
      const badgeRect = badge ? badge.getBoundingClientRect() : null;
      const actionRect = action ? action.getBoundingClientRect() : null;

      return {
        index: i,
        title: {
          text: title?.textContent?.trim() || '',
          fontFamily: titleStyle?.fontFamily,
          fontSize: titleStyle?.fontSize,
          lineHeight: titleStyle?.lineHeight,
          fontWeight: titleStyle?.fontWeight,
          color: titleStyle?.color,
        },
        description: {
          text: description?.textContent?.trim() || '',
          fontFamily: descRowStyle?.fontFamily,
          fontSize: descRowStyle?.fontSize,
          lineHeight: descRowStyle?.lineHeight,
          fontWeight: descRowStyle?.fontWeight,
          color: descRowStyle?.color,
        },
        icon: {
          width: iconWell?.clientWidth,
          height: iconWell?.clientHeight,
          borderRadius: iconStyle?.borderRadius,
          backgroundColor: iconStyle?.backgroundColor,
          borderColor: iconStyle?.borderColor,
        },
        badge: {
          text: badge?.textContent?.trim() || '',
          width: badgeRect ? Math.round(badgeRect.width * 10) / 10 : 0,
          height: badgeRect ? Math.round(badgeRect.height * 10) / 10 : 0,
          leftX: badgeRect ? Math.round(badgeRect.left * 10) / 10 : 0,
          rightX: badgeRect ? Math.round(badgeRect.right * 10) / 10 : 0,
          backgroundColor: badgeStyle?.backgroundColor,
          color: badgeStyle?.color,
          borderRadius: badgeStyle?.borderRadius,
        },
        action: {
          text: action?.textContent?.trim() || '',
          href: action?.getAttribute('href') || '',
          width: actionRect ? Math.round(actionRect.width * 10) / 10 : 0,
          leftX: actionRect ? Math.round(actionRect.left * 10) / 10 : 0,
          rightX: actionRect ? Math.round(actionRect.right * 10) / 10 : 0,
        },
      };
    });

    // Check if badges start/end at consistent coordinates
    const badgeLefts = rowData.map((r) => r.badge.leftX);
    const badgeRights = rowData.map((r) => r.badge.rightX);
    const badgeAligned = badgeLefts.every((l) => Math.abs(l - badgeLefts[0]) < 2) ||
                         badgeRights.every((r) => Math.abs(r - badgeRights[0]) < 2);

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
          width: btnRect ? Math.round(btnRect.width * 10) / 10 : 0,
          height: btnRect ? Math.round(btnRect.height * 10) / 10 : 0,
          borderRadius: btnStyle?.borderRadius,
          borderWidth: btnStyle?.borderWidth,
          borderColor: btnStyle?.borderColor,
        },
      },
      previewRowCount: rows.length,
      badgeAligned,
      rows: rowData,
    };
  });

  report.measurements.desktop = desktopMeasurements;

  // Accessibility Check (Light Mode)
  console.log("Running Axe accessibility scan (Light Mode)...");
  const axeLight = await new AxeBuilder({ page })
    .include('div.lg\\:col-span-5')
    .analyze();

  report.axeResults.light = {
    violations: axeLight.violations,
    violationCount: axeLight.violations.length,
  };
  console.log(`Light Mode Violations: ${axeLight.violations.length}`);

  // Capture Desktop Screenshots
  console.log("Capturing Desktop Screenshots...");
  const desktopFullPng = path.join(OUTPUT_DIR, "attention-required-dashboard-desktop-1440x900.png");
  await page.screenshot({ path: desktopFullPng, fullPage: false });
  report.screenshots.push("attention-required-dashboard-desktop-1440x900.png");

  const desktopCardPng = path.join(OUTPUT_DIR, "attention-required-card-desktop-1440x900.png");
  await attentionCardLocator.screenshot({ path: desktopCardPng });
  report.screenshots.push("attention-required-card-desktop-1440x900.png");

  // Open Sheet View by clicking "View all"
  console.log("Opening 'All attention items' Sheet...");
  const viewAllBtn = attentionCardLocator.getByRole("button", { name: "View all" });
  await viewAllBtn.click();
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 5000 });
  await page.getByRole("heading", { name: "All attention items" }).waitFor({ state: "visible", timeout: 5000 });
  await page.waitForTimeout(500);

  // Measure Sheet
  const sheetMeasurements = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const dialogRect = dialog ? dialog.getBoundingClientRect() : null;
    const body = dialog ? dialog.querySelector('[role="region"][aria-label="All attention items list"]') : null;
    const rows = body ? Array.from(body.children) : [];
    return {
      width: dialogRect ? Math.round(dialogRect.width * 10) / 10 : 0,
      height: dialogRect ? Math.round(dialogRect.height * 10) / 10 : 0,
      totalQueueItems: rows.length,
    };
  });
  report.measurements.sheet = sheetMeasurements;
  console.log(`Sheet opened: ${sheetMeasurements.totalQueueItems} total items in queue`);

  // Accessibility scan on Sheet
  console.log("Running Axe scan on open Sheet...");
  const axeSheet = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .analyze();

  report.axeResults.sheet = {
    violations: axeSheet.violations,
    violationCount: axeSheet.violations.length,
  };
  console.log(`Sheet Violations: ${axeSheet.violations.length}`);

  const sheetPng = path.join(OUTPUT_DIR, "attention-required-sheet-desktop-1440x900.png");
  await page.screenshot({ path: sheetPng, fullPage: false });
  report.screenshots.push("attention-required-sheet-desktop-1440x900.png");

  // Close Sheet
  console.log("Closing Sheet...");
  const closeBtn = page.getByRole("button", { name: /close sheet/i });
  await closeBtn.click();
  await page.getByRole("dialog").waitFor({ state: "detached", timeout: 5000 });
  await page.waitForTimeout(300);

  // 2. Dark Mode Desktop Context
  console.log("Switching to Dark Mode...");
  await page.evaluate(() => {
    document.documentElement.classList.add("dark");
  });
  await page.waitForTimeout(300);

  const axeDark = await new AxeBuilder({ page })
    .include('div.lg\\:col-span-5')
    .analyze();

  report.axeResults.dark = {
    violations: axeDark.violations,
    violationCount: axeDark.violations.length,
  };
  console.log(`Dark Mode Violations: ${axeDark.violations.length}`);

  const darkCardPng = path.join(OUTPUT_DIR, "attention-required-card-dark-desktop-1440x900.png");
  await attentionCardLocator.screenshot({ path: darkCardPng });
  report.screenshots.push("attention-required-card-dark-desktop-1440x900.png");

  const darkFullPng = path.join(OUTPUT_DIR, "attention-required-dashboard-dark-desktop-1440x900.png");
  await page.screenshot({ path: darkFullPng, fullPage: false });
  report.screenshots.push("attention-required-dashboard-dark-desktop-1440x900.png");

  await desktopContext.close();

  // 3. Tablet Context (1024x768)
  console.log("Capturing Tablet Context (1024x768)...");
  const tabletContext = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    deviceScaleFactor: 2,
  });
  const tabletPage = await tabletContext.newPage();
  await loginAsSalesRep(tabletPage);
  await tabletPage.getByRole("heading", { name: "Attention Required" }).waitFor({ timeout: 10000 });
  await tabletPage.waitForTimeout(1000);

  const tabletCardLocator = tabletPage.locator('div.lg\\:col-span-5').first();
  const axeTablet = await new AxeBuilder({ page: tabletPage })
    .include('div.lg\\:col-span-5')
    .analyze();

  report.axeResults.tablet = {
    violations: axeTablet.violations,
    violationCount: axeTablet.violations.length,
  };

  const tabletCardPng = path.join(OUTPUT_DIR, "attention-required-card-tablet-1024x768.png");
  await tabletCardLocator.screenshot({ path: tabletCardPng });
  report.screenshots.push("attention-required-card-tablet-1024x768.png");

  const tabletFullPng = path.join(OUTPUT_DIR, "attention-required-dashboard-tablet-1024x768.png");
  await tabletPage.screenshot({ path: tabletFullPng, fullPage: false });
  report.screenshots.push("attention-required-dashboard-tablet-1024x768.png");

  await tabletContext.close();

  // 4. Mobile Context (390x844)
  console.log("Capturing Mobile Context (390x844)...");
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const mobilePage = await mobileContext.newPage();
  await loginAsSalesRep(mobilePage);
  await mobilePage.getByRole("heading", { name: "Attention Required" }).waitFor({ timeout: 10000 });
  await mobilePage.waitForTimeout(1000);

  const mobileCardLocator = mobilePage.locator('div.lg\\:col-span-5').first();
  const axeMobile = await new AxeBuilder({ page: mobilePage })
    .include('div.lg\\:col-span-5')
    .analyze();

  report.axeResults.mobile = {
    violations: axeMobile.violations,
    violationCount: axeMobile.violations.length,
  };

  const mobileCardPng = path.join(OUTPUT_DIR, "attention-required-card-mobile-390x844.png");
  await mobileCardLocator.screenshot({ path: mobileCardPng });
  report.screenshots.push("attention-required-card-mobile-390x844.png");

  const mobileFullPng = path.join(OUTPUT_DIR, "attention-required-dashboard-mobile-390x844.png");
  await mobilePage.screenshot({ path: mobileFullPng, fullPage: false });
  report.screenshots.push("attention-required-dashboard-mobile-390x844.png");

  await mobileContext.close();

  await browser.close();

  // Write Report
  const reportPath = path.join(OUTPUT_DIR, "attention-required-verification.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`Saved report to ${reportPath}`);
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
