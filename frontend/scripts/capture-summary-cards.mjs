import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const OUTPUT_DIR = path.resolve(import.meta.dirname, "../../docs/design-mapping/screenshots/visual-summary-cards");
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

  console.log("Starting Workflow Summary Cards Conformance Verification...");

  // 1. Desktop Context (1440x900)
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await desktopContext.newPage();

  console.log("Authenticating as Sales Rep...");
  await loginAsSalesRep(page);

  // Wait for dashboard and summary cards
  console.log("Waiting for workflow summary cards to load...");
  await page.locator('[data-slot="workflow-summary-grid"]').waitFor({ timeout: 10000 });
  await page.getByText("RFQ Review Queue").waitFor({ timeout: 10000 });
  await page.getByText("Quotations & Pricing").waitFor({ timeout: 10000 });
  await page.waitForTimeout(500);

  // Measure summary cards
  console.log("Measuring Workflow Summary Cards (Desktop 1440x900)...");
  const desktopMeasurements = await page.evaluate(() => {
    const grid = document.querySelector('[data-slot="workflow-summary-grid"]');
    const cards = Array.from(document.querySelectorAll('[data-slot="workflow-summary-card"]'));

    function getCardData(card, type) {
      if (!card) return null;
      const rect = card.getBoundingClientRect();
      const style = window.getComputedStyle(card);
      const iconBox = card.querySelector('div:first-child');
      const iconSvg = iconBox ? iconBox.querySelector('svg') : null;
      const textCol = card.querySelector('div.flex-1');
      const titleEl = textCol ? textCol.children[0] : null;
      const descEl = textCol ? textCol.children[1] : null;
      const badge = card.querySelector('span.rounded-full') || card.querySelector('span[class*="rounded"]');

      const iconBoxStyle = iconBox ? window.getComputedStyle(iconBox) : null;
      const iconBoxRect = iconBox ? iconBox.getBoundingClientRect() : null;
      const iconSvgRect = iconSvg ? iconSvg.getBoundingClientRect() : null;
      const titleStyle = titleEl ? window.getComputedStyle(titleEl) : null;
      const descStyle = descEl ? window.getComputedStyle(descEl) : null;
      const badgeStyle = badge ? window.getComputedStyle(badge) : null;
      const badgeRect = badge ? badge.getBoundingClientRect() : null;

      return {
        type,
        href: card.getAttribute('href'),
        width: Math.round(rect.width * 10) / 10,
        height: Math.round(rect.height * 10) / 10,
        paddingTop: style.paddingTop,
        paddingRight: style.paddingRight,
        paddingBottom: style.paddingBottom,
        paddingLeft: style.paddingLeft,
        borderRadius: style.borderRadius,
        borderWidth: style.borderWidth,
        borderColor: style.borderColor,
        backgroundColor: style.backgroundColor,
        columnGap: style.gap || style.columnGap,
        iconBox: {
          width: iconBoxRect ? Math.round(iconBoxRect.width * 10) / 10 : 0,
          height: iconBoxRect ? Math.round(iconBoxRect.height * 10) / 10 : 0,
          borderRadius: iconBoxStyle?.borderRadius,
          padding: iconBoxStyle?.padding,
          backgroundColor: iconBoxStyle?.backgroundColor,
          borderColor: iconBoxStyle?.borderColor,
          borderWidth: iconBoxStyle?.borderWidth,
          color: iconBoxStyle?.color,
          svgWidth: iconSvgRect ? Math.round(iconSvgRect.width * 10) / 10 : 0,
          svgHeight: iconSvgRect ? Math.round(iconSvgRect.height * 10) / 10 : 0,
        },
        title: {
          text: titleEl?.textContent?.trim() || '',
          fontFamily: titleStyle?.fontFamily,
          fontSize: titleStyle?.fontSize,
          lineHeight: titleStyle?.lineHeight,
          fontWeight: titleStyle?.fontWeight,
          color: titleStyle?.color,
        },
        description: {
          text: descEl?.textContent?.trim() || '',
          fontFamily: descStyle?.fontFamily,
          fontSize: descStyle?.fontSize,
          lineHeight: descStyle?.lineHeight,
          fontWeight: descStyle?.fontWeight,
          color: descStyle?.color,
        },
        badge: {
          text: badge?.textContent?.trim() || '',
          width: badgeRect ? Math.round(badgeRect.width * 10) / 10 : 0,
          height: badgeRect ? Math.round(badgeRect.height * 10) / 10 : 0,
          fontFamily: badgeStyle?.fontFamily,
          fontSize: badgeStyle?.fontSize,
          fontWeight: badgeStyle?.fontWeight,
          backgroundColor: badgeStyle?.backgroundColor,
          color: badgeStyle?.color,
          borderRadius: badgeStyle?.borderRadius,
        },
      };
    }

    return {
      container: {
        gap: grid ? window.getComputedStyle(grid).gap : null,
        gridTemplateColumns: grid ? window.getComputedStyle(grid).gridTemplateColumns : null,
      },
      cards: [
        getCardData(cards[0], "rfq-review-queue"),
        getCardData(cards[1], "quotations-pricing"),
      ],
    };
  });

  report.measurements.desktop = desktopMeasurements;

  // Accessibility Check (Light Mode)
  console.log("Running Axe accessibility scan (Light Mode)...");
  const axeLight = await new AxeBuilder({ page })
    .include('[data-slot="workflow-summary-grid"]')
    .analyze();

  report.axeResults.light = {
    violations: axeLight.violations,
    violationCount: axeLight.violations.length,
  };
  console.log(`Light Mode Violations: ${axeLight.violations.length}`);

  // Capture Desktop Screenshots
  console.log("Capturing Desktop Screenshots...");
  const desktopFullPng = path.join(OUTPUT_DIR, "summary-cards-dashboard-desktop-1440x900.png");
  await page.screenshot({ path: desktopFullPng, fullPage: false });
  report.screenshots.push("summary-cards-dashboard-desktop-1440x900.png");

  const summaryGrid = page.locator('[data-slot="workflow-summary-grid"]').first();
  const desktopStripPng = path.join(OUTPUT_DIR, "summary-cards-strip-desktop-1440x900.png");
  await summaryGrid.screenshot({ path: desktopStripPng });
  report.screenshots.push("summary-cards-strip-desktop-1440x900.png");

  // Capture Individual Card Screenshots
  const rfqLink = page.locator('[data-slot="workflow-summary-card"]').first();
  const rfqCardPng = path.join(OUTPUT_DIR, "card-rfq-review-desktop.png");
  await rfqLink.screenshot({ path: rfqCardPng });
  report.screenshots.push("card-rfq-review-desktop.png");

  const quotesLink = page.locator('[data-slot="workflow-summary-card"]').nth(1);
  const quotesCardPng = path.join(OUTPUT_DIR, "card-quotes-desktop.png");
  await quotesLink.screenshot({ path: quotesCardPng });
  report.screenshots.push("card-quotes-desktop.png");

  // 2. Dark Mode Desktop Context
  console.log("Switching to Dark Mode...");
  await page.evaluate(() => {
    document.documentElement.classList.add("dark");
  });
  await page.waitForTimeout(300);

  const axeDark = await new AxeBuilder({ page })
    .include('[data-slot="workflow-summary-grid"]')
    .analyze();

  report.axeResults.dark = {
    violations: axeDark.violations,
    violationCount: axeDark.violations.length,
  };
  console.log(`Dark Mode Violations: ${axeDark.violations.length}`);

  const darkStripPng = path.join(OUTPUT_DIR, "summary-cards-strip-dark-desktop-1440x900.png");
  await summaryGrid.screenshot({ path: darkStripPng });
  report.screenshots.push("summary-cards-strip-dark-desktop-1440x900.png");

  const darkFullPng = path.join(OUTPUT_DIR, "summary-cards-dashboard-dark-desktop-1440x900.png");
  await page.screenshot({ path: darkFullPng, fullPage: false });
  report.screenshots.push("summary-cards-dashboard-dark-desktop-1440x900.png");

  await desktopContext.close();

  // 3. Tablet Context (1024x768)
  console.log("Capturing Tablet Context (1024x768)...");
  const tabletContext = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    deviceScaleFactor: 2,
  });
  const tabletPage = await tabletContext.newPage();
  await loginAsSalesRep(tabletPage);
  await tabletPage.locator('[data-slot="workflow-summary-grid"]').waitFor({ timeout: 10000 });
  await tabletPage.waitForTimeout(500);

  const tabletGrid = tabletPage.locator('[data-slot="workflow-summary-grid"]').first();
  const tabletStripPng = path.join(OUTPUT_DIR, "summary-cards-strip-tablet-1024x768.png");
  await tabletGrid.screenshot({ path: tabletStripPng });
  report.screenshots.push("summary-cards-strip-tablet-1024x768.png");

  const tabletFullPng = path.join(OUTPUT_DIR, "summary-cards-dashboard-tablet-1024x768.png");
  await tabletPage.screenshot({ path: tabletFullPng, fullPage: false });
  report.screenshots.push("summary-cards-dashboard-tablet-1024x768.png");

  await tabletContext.close();

  // 4. Mobile Context (390x844)
  console.log("Capturing Mobile Context (390x844)...");
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const mobilePage = await mobileContext.newPage();
  await loginAsSalesRep(mobilePage);
  await mobilePage.locator('[data-slot="workflow-summary-grid"]').waitFor({ timeout: 10000 });
  await mobilePage.waitForTimeout(500);

  const mobileGrid = mobilePage.locator('[data-slot="workflow-summary-grid"]').first();
  const mobileStripPng = path.join(OUTPUT_DIR, "summary-cards-strip-mobile-390x844.png");
  await mobileGrid.screenshot({ path: mobileStripPng });
  report.screenshots.push("summary-cards-strip-mobile-390x844.png");

  const mobileFullPng = path.join(OUTPUT_DIR, "summary-cards-dashboard-mobile-390x844.png");
  await mobilePage.screenshot({ path: mobileFullPng, fullPage: false });
  report.screenshots.push("summary-cards-dashboard-mobile-390x844.png");

  await mobileContext.close();

  await browser.close();

  // Write Report
  const reportPath = path.join(OUTPUT_DIR, "summary-cards-verification.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`Saved report to ${reportPath}`);
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
