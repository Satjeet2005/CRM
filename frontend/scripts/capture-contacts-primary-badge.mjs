import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const OUTPUT_DIR = path.resolve(import.meta.dirname, "../../docs/design-mapping/screenshots/contacts-primary-badge");
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

  console.log("Starting Contacts Primary Badge Conformance Verification...");

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

  // Measure desktop primary contact badges and non-primary contact rows
  console.log("Measuring Primary Contact Badges (Desktop 1440x900)...");
  const desktopMeasurements = await page.evaluate(() => {
    const table = document.querySelector('[role="region"][aria-label="Contacts directory table"] table');
    const tbody = table ? table.querySelector('tbody') : null;
    const rows = tbody ? Array.from(tbody.querySelectorAll('tr')) : [];

    // Find primary rows and non-primary rows
    const primaryRows = [];
    const nonPrimaryRows = [];

    rows.forEach((r, idx) => {
      const firstTd = r.querySelector('td');
      const badge = firstTd ? firstTd.querySelector('span[class*="rounded"]') : null;
      const isPrimary = badge && badge.textContent?.includes("Primary");
      const nameSpan = firstTd ? firstTd.querySelector('span.font-semibold') : null;
      const titleSpan = firstTd ? firstTd.querySelector('span.text-\\[12px\\]') || firstTd.querySelector('.text-xs') : null;

      const starSvg = badge ? badge.querySelector('svg') : null;
      const starComputed = starSvg ? window.getComputedStyle(starSvg) : null;
      const badgeComputed = badge ? window.getComputedStyle(badge) : null;
      const badgeRect = badge ? badge.getBoundingClientRect() : null;

      const info = {
        rowIndex: idx,
        name: nameSpan?.textContent?.trim(),
        title: titleSpan?.textContent?.trim(),
        hasPrimaryBadge: !!isPrimary,
        badgeLeft: badgeRect?.left,
        badgeRight: badgeRect?.right,
        badgeWidth: badgeRect?.width,
        badgeHeight: badgeRect?.height,
        backgroundColor: badgeComputed?.backgroundColor,
        textColor: badgeComputed?.color,
        fontSize: badgeComputed?.fontSize,
        fontWeight: badgeComputed?.fontWeight,
        starFill: starComputed?.fill,
        starColor: starComputed?.color,
        starWidth: starSvg ? starSvg.getBoundingClientRect().width : null,
      };

      if (isPrimary) {
        primaryRows.push(info);
      } else {
        nonPrimaryRows.push(info);
      }
    });

    return {
      totalRows: rows.length,
      primaryRowsCount: primaryRows.length,
      nonPrimaryRowsCount: nonPrimaryRows.length,
      primaryRows,
      firstNonPrimary: nonPrimaryRows[0] || null,
      // Alignment consistency check across all primary badges:
      // In fixed grid `grid-template-columns: minmax(0, 1fr) 76px` with justify-end, all badge rights should match identically
      allBadgeRightsMatch: primaryRows.every(r => Math.abs(r.badgeRight - primaryRows[0].badgeRight) < 1),
    };
  });

  report.measurements.desktop = desktopMeasurements;
  console.log("Desktop Primary Badge Measurements:", JSON.stringify(desktopMeasurements, null, 2));

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

  // Screenshot: Desktop Full Light
  console.log("Capturing Desktop Light screenshot...");
  const desktopPath = path.join(OUTPUT_DIR, "contacts-primary-badge-desktop-1440x900.png");
  await page.screenshot({ path: desktopPath, fullPage: false });
  report.screenshots.push("contacts-primary-badge-desktop-1440x900.png");

  // Screenshot: Desktop Close-up Crop of Table Identity Column
  console.log("Capturing Desktop Close-up Crop...");
  const tableLocator = page.locator('[role="region"][aria-label="Contacts directory table"] table');
  const cropPath = path.join(OUTPUT_DIR, "contacts-primary-badge-desktop-closeup.png");
  await tableLocator.screenshot({ path: cropPath });
  report.screenshots.push("contacts-primary-badge-desktop-closeup.png");

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

  const darkPath = path.join(OUTPUT_DIR, "contacts-primary-badge-dark-desktop-1440x900.png");
  await page.screenshot({ path: darkPath, fullPage: false });
  report.screenshots.push("contacts-primary-badge-dark-desktop-1440x900.png");

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

  const tabletPath = path.join(OUTPUT_DIR, "contacts-primary-badge-tablet-1024x768.png");
  await tabletPage.screenshot({ path: tabletPath, fullPage: false });
  report.screenshots.push("contacts-primary-badge-tablet-1024x768.png");
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

  const mobilePath = path.join(OUTPUT_DIR, "contacts-primary-badge-mobile-390x844.png");
  await mobilePage.screenshot({ path: mobilePath, fullPage: false });
  report.screenshots.push("contacts-primary-badge-mobile-390x844.png");
  await mobileContext.close();

  // Save JSON report
  const reportPath = path.join(OUTPUT_DIR, "contacts-primary-badge-verification.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Report written to ${reportPath}`);

  await browser.close();
  console.log("Primary badge verification run complete!");
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
