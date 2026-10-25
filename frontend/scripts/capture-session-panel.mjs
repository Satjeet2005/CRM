import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const OUTPUT_DIR = path.resolve(import.meta.dirname, "../../docs/design-mapping/screenshots/session-access-panel");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

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

  console.log("Starting Active Session & Permissions Panel Conformance Verification...");

  // 1. Desktop Context (1440x900)
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await desktopContext.newPage();

  console.log("Authenticating as Administrator...");
  await loginAsAdmin(page);

  console.log("Waiting for SessionPanel to load...");
  await page.getByText("Alex Admin").waitFor({ timeout: 10000 });
  await page.getByText("Organization context").waitFor({ timeout: 10000 });
  await page.getByText("Granted permissions").waitFor({ timeout: 10000 });
  await page.waitForTimeout(1000);

  // Find SessionPanel card locator
  const sessionCardLocator = page.locator('[data-slot="session-panel"]');

  console.log("Measuring SessionPanel (Desktop 1440x900)...");
  const desktopMeasurements = await page.evaluate(() => {
    const nameEl = document.evaluate(
      "//h2[contains(text(), 'Alex Admin')]",
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;
    const card = nameEl ? nameEl.closest('div.rounded-\\[var\\(--radius-xl\\)\\]') : null;
    const cardRect = card ? card.getBoundingClientRect() : null;
    const cardStyle = card ? window.getComputedStyle(card) : null;

    // Identity header
    const emailEl = nameEl?.nextElementSibling;
    const iconTile = card ? card.querySelector('div.rounded-\\[var\\(--radius-lg\\)\\]') : null;
    const iconStyle = iconTile ? window.getComputedStyle(iconTile) : null;
    const headerRow = card ? card.querySelector('div.flex-col.sm\\:flex-row') : null;
    const badges = headerRow ? Array.from(headerRow.querySelectorAll('div.flex.flex-wrap.items-center.gap-2 > span')) : [];

    // Columns
    const orgHeading = document.evaluate("//h3[contains(text(), 'Organization context')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    const permHeading = document.evaluate("//h3[contains(text(), 'Granted permissions')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    const orgCol = orgHeading ? orgHeading.closest('div.w-full.lg\\:w-\\[38\\%\\]') || orgHeading.parentElement?.parentElement : null;
    const permCol = permHeading ? permHeading.closest('div.w-full.lg\\:w-\\[62\\%\\]') || permHeading.parentElement?.parentElement : null;
    const orgRect = orgCol ? orgCol.getBoundingClientRect() : null;
    const permRect = permCol ? permCol.getBoundingClientRect() : null;

    // Granted permissions groups
    const permContainer = permCol ? permCol.querySelector('div.grid.grid-cols-1.sm\\:grid-cols-2') : null;
    const groupEls = permContainer ? Array.from(permContainer.children) : [];
    const groupsData = groupEls.map((g) => {
      const labelEl = g.querySelector('span.uppercase') || g.querySelector('span');
      const chips = Array.from(g.querySelectorAll('div.flex.flex-wrap > span'));
      return {
        label: labelEl?.textContent?.trim() || '',
        chips: chips.map((c) => c.textContent?.trim() || ''),
      };
    });

    const totalChips = groupsData.reduce((acc, g) => acc + g.chips.length, 0);

    return {
      card: {
        width: cardRect ? Math.round(cardRect.width * 10) / 10 : 0,
        height: cardRect ? Math.round(cardRect.height * 10) / 10 : 0,
        padding: cardStyle ? cardStyle.padding : '',
        borderRadius: cardStyle ? cardStyle.borderRadius : '',
        borderColor: cardStyle ? cardStyle.borderColor : '',
        backgroundColor: cardStyle ? cardStyle.backgroundColor : '',
      },
      identityHeader: {
        iconTile: {
          width: iconTile ? iconTile.clientWidth : 0,
          height: iconTile ? iconTile.clientHeight : 0,
          borderRadius: iconStyle ? iconStyle.borderRadius : '',
          backgroundColor: iconStyle ? iconStyle.backgroundColor : '',
          borderColor: iconStyle ? iconStyle.borderColor : '',
        },
        displayName: {
          text: nameEl?.textContent?.trim() || '',
          fontSize: nameEl ? window.getComputedStyle(nameEl).fontSize : '',
          fontWeight: nameEl ? window.getComputedStyle(nameEl).fontWeight : '',
          color: nameEl ? window.getComputedStyle(nameEl).color : '',
        },
        email: {
          text: emailEl?.textContent?.trim() || '',
          fontSize: emailEl ? window.getComputedStyle(emailEl).fontSize : '',
          color: emailEl ? window.getComputedStyle(emailEl).color : '',
        },
        badges: badges.map((b) => ({
          text: b.textContent?.trim() || '',
          backgroundColor: window.getComputedStyle(b).backgroundColor,
          color: window.getComputedStyle(b).color,
          borderRadius: window.getComputedStyle(b).borderRadius,
        })),
      },
      columns: {
        orgWidth: orgRect ? Math.round(orgRect.width * 10) / 10 : 0,
        permWidth: permRect ? Math.round(permRect.width * 10) / 10 : 0,
        orgPct: orgRect && permRect ? Math.round((orgRect.width / (orgRect.width + permRect.width)) * 100) : 0,
        permPct: orgRect && permRect ? Math.round((permRect.width / (orgRect.width + permRect.width)) * 100) : 0,
      },
      permissionGroups: {
        groupCount: groupsData.length,
        totalPermissionsCount: totalChips,
        groups: groupsData,
      },
    };
  });

  report.measurements.desktop = desktopMeasurements;

  // Accessibility Check (Light Mode)
  console.log("Running Axe accessibility scan (Light Mode)...");
  const axeLight = await new AxeBuilder({ page })
    .include('[data-slot="session-panel"]')
    .analyze();

  report.axeResults.light = {
    violations: axeLight.violations,
    violationCount: axeLight.violations.length,
  };
  console.log(`Light Mode Violations: ${axeLight.violations.length}`);

  // Capture Desktop Screenshots
  console.log("Capturing Desktop Screenshots...");
  const desktopFullPng = path.join(OUTPUT_DIR, "session-panel-dashboard-desktop-1440x900.png");
  await page.screenshot({ path: desktopFullPng, fullPage: false });
  report.screenshots.push("session-panel-dashboard-desktop-1440x900.png");

  const desktopCardPng = path.join(OUTPUT_DIR, "session-panel-card-desktop-1440x900.png");
  await sessionCardLocator.screenshot({ path: desktopCardPng });
  report.screenshots.push("session-panel-card-desktop-1440x900.png");

  // 2. Dark Mode Desktop Context
  console.log("Switching to Dark Mode...");
  await page.evaluate(() => {
    document.documentElement.classList.add("dark");
  });
  await page.waitForTimeout(300);

  const axeDark = await new AxeBuilder({ page })
    .include('[data-slot="session-panel"]')
    .analyze();

  report.axeResults.dark = {
    violations: axeDark.violations,
    violationCount: axeDark.violations.length,
  };
  console.log(`Dark Mode Violations: ${axeDark.violations.length}`);

  const darkCardPng = path.join(OUTPUT_DIR, "session-panel-card-dark-desktop-1440x900.png");
  await sessionCardLocator.screenshot({ path: darkCardPng });
  report.screenshots.push("session-panel-card-dark-desktop-1440x900.png");

  const darkFullPng = path.join(OUTPUT_DIR, "session-panel-dashboard-dark-desktop-1440x900.png");
  await page.screenshot({ path: darkFullPng, fullPage: false });
  report.screenshots.push("session-panel-dashboard-dark-desktop-1440x900.png");

  await desktopContext.close();

  // 3. Tablet Context (1024x768)
  console.log("Capturing Tablet Context (1024x768)...");
  const tabletContext = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    deviceScaleFactor: 2,
  });
  const tabletPage = await tabletContext.newPage();
  await loginAsAdmin(tabletPage);
  await tabletPage.getByText("Alex Admin").waitFor({ timeout: 10000 });
  await tabletPage.waitForTimeout(1000);

  const tabletCardLocator = tabletPage.locator('[data-slot="session-panel"]');
  const axeTablet = await new AxeBuilder({ page: tabletPage })
    .include('[data-slot="session-panel"]')
    .analyze();

  report.axeResults.tablet = {
    violations: axeTablet.violations,
    violationCount: axeTablet.violations.length,
  };

  const tabletCardPng = path.join(OUTPUT_DIR, "session-panel-card-tablet-1024x768.png");
  await tabletCardLocator.screenshot({ path: tabletCardPng });
  report.screenshots.push("session-panel-card-tablet-1024x768.png");

  const tabletFullPng = path.join(OUTPUT_DIR, "session-panel-dashboard-tablet-1024x768.png");
  await tabletPage.screenshot({ path: tabletFullPng, fullPage: false });
  report.screenshots.push("session-panel-dashboard-tablet-1024x768.png");

  await tabletContext.close();

  // 4. Mobile Context (390x844)
  console.log("Capturing Mobile Context (390x844)...");
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const mobilePage = await mobileContext.newPage();
  await loginAsAdmin(mobilePage);
  await mobilePage.getByText("Alex Admin").waitFor({ timeout: 10000 });
  await mobilePage.waitForTimeout(1000);

  const mobileCardLocator = mobilePage.locator('[data-slot="session-panel"]');
  const axeMobile = await new AxeBuilder({ page: mobilePage })
    .include('[data-slot="session-panel"]')
    .analyze();

  report.axeResults.mobile = {
    violations: axeMobile.violations,
    violationCount: axeMobile.violations.length,
  };

  const mobileCardPng = path.join(OUTPUT_DIR, "session-panel-card-mobile-390x844.png");
  await mobileCardLocator.screenshot({ path: mobileCardPng });
  report.screenshots.push("session-panel-card-mobile-390x844.png");

  const mobileFullPng = path.join(OUTPUT_DIR, "session-panel-dashboard-mobile-390x844.png");
  await mobilePage.screenshot({ path: mobileFullPng, fullPage: false });
  report.screenshots.push("session-panel-dashboard-mobile-390x844.png");

  await mobileContext.close();

  await browser.close();

  // Write Report
  const reportPath = path.join(OUTPUT_DIR, "session-access-panel-verification.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`Saved report to ${reportPath}`);
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
