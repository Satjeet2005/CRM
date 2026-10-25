/**
 * Exact Sakani vs ForgeFlow KPI Parity Measurement & Capture Script
 */

import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const OUTPUT_DIR = path.resolve(import.meta.dirname, "../../docs/design-mapping/screenshots/kpi-parity");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function run() {
  const browser = await chromium.launch({ headless: true });
  const metrics = {
    timestamp: new Date().toISOString(),
    sakani: {},
    forgeflow: {},
    axeResults: {},
    fontEvidence: {},
  };

  console.log("1. Measuring Sakani Live Demo (http://localhost:5173)...");
  const sakaniContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const sakaniPage = await sakaniContext.newPage();
  await sakaniPage.goto("http://localhost:5173", { waitUntil: "networkidle" });
  await sakaniPage.waitForTimeout(1000);

  // Measure Sakani
  const sakaniData = await sakaniPage.evaluate(() => {
    const kpiRow = document.querySelector("[class*=\"kpiRow\"]");
    const cards = Array.from(document.querySelectorAll("div")).filter(el => {
      const cls = el.className || "";
      return typeof cls === "string" && cls.includes("card") && el.querySelector("[class*=\"card__value\"]");
    });
    const c = cards[0];
    const rect = c.getBoundingClientRect();
    const style = window.getComputedStyle(c);
    const titleEl = c.querySelector("[class*=\"title\"]");
    const valEl = c.querySelector("[class*=\"value\"]");
    const descEl = c.querySelector("[class*=\"description\"]");
    const badgeEl = c.querySelector("[class*=\"badge\"], [class*=\"Badge\"]");

    const titleStyle = window.getComputedStyle(titleEl);
    const valStyle = window.getComputedStyle(valEl);
    const descStyle = descEl ? window.getComputedStyle(descEl) : null;
    const badgeStyle = badgeEl ? window.getComputedStyle(badgeEl) : null;

    return {
      kpiRowRect: kpiRow ? { width: Math.round(kpiRow.getBoundingClientRect().width * 10) / 10, height: Math.round(kpiRow.getBoundingClientRect().height * 10) / 10 } : null,
      card: {
        width: Math.round(rect.width * 10) / 10,
        height: Math.round(rect.height * 10) / 10,
        gap: style.gap,
        padding: `${style.paddingTop} ${style.paddingRight} ${style.paddingBottom} ${style.paddingLeft}`,
        borderRadius: style.borderRadius,
        border: `${style.borderWidth} ${style.borderStyle} ${style.borderColor}`,
        boxShadow: style.boxShadow,
        backgroundColor: style.backgroundColor,
      },
      title: {
        text: titleEl?.textContent?.trim(),
        fontFamily: titleStyle.fontFamily,
        fontSize: titleStyle.fontSize,
        lineHeight: titleStyle.lineHeight,
        fontWeight: titleStyle.fontWeight,
        color: titleStyle.color,
      },
      value: {
        text: valEl?.textContent?.trim(),
        fontFamily: valStyle.fontFamily,
        fontSize: valStyle.fontSize,
        lineHeight: valStyle.lineHeight,
        fontWeight: valStyle.fontWeight,
        letterSpacing: valStyle.letterSpacing,
        color: valStyle.color,
      },
      meta: {
        badgeText: badgeEl?.textContent?.trim(),
        badgeBg: badgeStyle?.backgroundColor,
        badgeColor: badgeStyle?.color,
        descriptionText: descEl?.textContent?.trim(),
        fontSize: descStyle?.fontSize,
        lineHeight: descStyle?.lineHeight,
        color: descStyle?.color,
      },
      fontLoaded: document.fonts.check("14px \"Geist Variable\"") || document.fonts.check("14px Geist"),
    };
  });
  metrics.sakani = sakaniData;

  // Screenshot Sakani
  const sakaniFull = path.join(OUTPUT_DIR, "sakani-dashboard-1440x900.png");
  await sakaniPage.screenshot({ path: sakaniFull });

  const sakaniKpiRow = sakaniPage.locator("[class*=\"kpiRow\"]").first();
  const sakaniRowShot = path.join(OUTPUT_DIR, "sakani-kpi-row-1440x900.png");
  await sakaniKpiRow.screenshot({ path: sakaniRowShot });

  const sakaniCards = sakaniPage.locator("div[class*=\"card\"]:has([class*=\"card__value\"])");
  const sakaniSingleShot = path.join(OUTPUT_DIR, "sakani-individual-statcard.png");
  await sakaniCards.first().screenshot({ path: sakaniSingleShot });
  await sakaniContext.close();

  // 2. Measuring ForgeFlow (http://localhost:3000)
  console.log("2. Measuring ForgeFlow (http://localhost:3000)...");
  const fontRequests = [];
  const ffContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const ffPage = await ffContext.newPage();
  ffPage.on("request", req => {
    if (req.url().includes("geist") || req.url().includes(".woff2")) {
      fontRequests.push(req.url());
    }
  });

  await ffPage.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await ffPage.fill("input[type=\"email\"]", "sales@forgeflow.demo");
  await ffPage.fill("input[type=\"password\"]", "ForgeFlowDemo!2026");
  await ffPage.getByRole("button", { name: /sign in/i }).click();
  await ffPage.waitForURL("**/app/dashboard", { timeout: 15000 });
  await ffPage.locator("[data-slot=\"stat-card\"]").first().waitFor({ timeout: 10000 });
  await ffPage.waitForTimeout(600);

  // Measure ForgeFlow
  const ffData = await ffPage.evaluate(() => {
    const kpiGrid = document.querySelector("[data-slot=\"kpi-grid\"]");
    const cards = Array.from(document.querySelectorAll("[data-slot=\"stat-card\"]"));
    const gridStyle = kpiGrid ? window.getComputedStyle(kpiGrid) : null;
    const gridRect = kpiGrid ? kpiGrid.getBoundingClientRect() : null;

    const cardDetails = cards.map((c, i) => {
      const rect = c.getBoundingClientRect();
      const style = window.getComputedStyle(c);
      const titleEl = c.querySelector("[data-slot=\"stat-card-title\"]");
      const valEl = c.querySelector("[data-slot=\"stat-card-value\"]");
      const actEl = c.querySelector("[data-slot=\"stat-card-action\"]");

      const titleStyle = window.getComputedStyle(titleEl);
      const valStyle = window.getComputedStyle(valEl);
      const actStyle = actEl ? window.getComputedStyle(actEl) : null;

      return {
        index: i,
        width: Math.round(rect.width * 10) / 10,
        height: Math.round(rect.height * 10) / 10,
        gap: style.gap,
        padding: `${style.paddingTop} ${style.paddingRight} ${style.paddingBottom} ${style.paddingLeft}`,
        borderRadius: style.borderRadius,
        border: `${style.borderWidth} ${style.borderStyle} ${style.borderColor}`,
        boxShadow: style.boxShadow,
        backgroundColor: style.backgroundColor,
        title: {
          text: titleEl?.textContent?.trim(),
          fontFamily: titleStyle.fontFamily,
          fontSize: titleStyle.fontSize,
          lineHeight: titleStyle.lineHeight,
          fontWeight: titleStyle.fontWeight,
          color: titleStyle.color,
        },
        value: {
          text: valEl?.textContent?.trim(),
          fontFamily: valStyle.fontFamily,
          fontSize: valStyle.fontSize,
          lineHeight: valStyle.lineHeight,
          fontWeight: valStyle.fontWeight,
          letterSpacing: valStyle.letterSpacing,
          color: valStyle.color,
        },
        meta: {
          text: actEl?.textContent?.trim(),
          fontSize: actStyle?.fontSize,
          lineHeight: actStyle?.lineHeight,
          color: actStyle?.color,
        },
      };
    });

    const fontFaces = Array.from(document.fonts).map(f => ({
      family: f.family,
      status: f.status,
      weight: f.weight,
    }));

    return {
      kpiGridRect: gridRect ? { width: Math.round(gridRect.width * 10) / 10, height: Math.round(gridRect.height * 10) / 10 } : null,
      gridGap: gridStyle?.gap,
      cards: cardDetails,
      fontFaces,
      fontLoaded: document.fonts.check("14px geistSans") || document.fonts.check("14px \"Geist Variable\""),
    };
  });

  metrics.forgeflow = ffData;
  metrics.fontEvidence = {
    fontRequests,
    fontFaces: ffData.fontFaces,
    fontLoaded: ffData.fontLoaded,
  };

  // Screenshots ForgeFlow Desktop
  const ffFull = path.join(OUTPUT_DIR, "forgeflow-dashboard-1440x900.png");
  await ffPage.screenshot({ path: ffFull });

  const ffKpiGrid = ffPage.locator("[data-slot=\"kpi-grid\"]").first();
  const ffRowShot = path.join(OUTPUT_DIR, "forgeflow-kpi-row-1440x900.png");
  await ffKpiGrid.screenshot({ path: ffRowShot });

  const ffCards = ffPage.locator("[data-slot=\"stat-card\"]");
  const ffSingleShot = path.join(OUTPUT_DIR, "forgeflow-individual-statcard.png");
  await ffCards.first().screenshot({ path: ffSingleShot });

  // Axe Accessibility Scan (Desktop Light)
  console.log("Running Axe scan (Light mode)...");
  const axeLight = await new AxeBuilder({ page: ffPage }).analyze();
  metrics.axeResults.desktopLight = {
    violations: axeLight.violations.length,
    details: axeLight.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description })),
  };

  // Dark Mode Test
  console.log("Toggling Dark Mode...");
  const themeBtn = ffPage.locator("button[aria-label*='theme'], button[aria-label*='Theme']");
  if (await themeBtn.isVisible()) {
    await themeBtn.click();
    await ffPage.waitForTimeout(500);

    const darkFull = path.join(OUTPUT_DIR, "forgeflow-dashboard-dark-1440x900.png");
    await ffPage.screenshot({ path: darkFull });

    const darkRow = path.join(OUTPUT_DIR, "forgeflow-kpi-row-dark-1440x900.png");
    await ffKpiGrid.screenshot({ path: darkRow });

    const axeDark = await new AxeBuilder({ page: ffPage }).analyze();
    metrics.axeResults.desktopDark = {
      violations: axeDark.violations.length,
      details: axeDark.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description })),
    };
  }
  await ffContext.close();

  // 3. Tablet (1024x768)
  console.log("3. Capturing Tablet Viewport (1024x768)...");
  const tabletContext = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    deviceScaleFactor: 2,
  });
  const tabletPage = await tabletContext.newPage();
  await tabletPage.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await tabletPage.fill("input[type=\"email\"]", "sales@forgeflow.demo");
  await tabletPage.fill("input[type=\"password\"]", "ForgeFlowDemo!2026");
  await tabletPage.getByRole("button", { name: /sign in/i }).click();
  await tabletPage.waitForURL("**/app/dashboard", { timeout: 15000 });
  await tabletPage.locator("[data-slot=\"stat-card\"]").first().waitFor({ timeout: 10000 });
  await tabletPage.waitForTimeout(500);

  const tabletFull = path.join(OUTPUT_DIR, "forgeflow-dashboard-tablet-1024x768.png");
  await tabletPage.screenshot({ path: tabletFull });

  const tabletGrid = tabletPage.locator("[data-slot=\"kpi-grid\"]").first();
  const tabletRow = path.join(OUTPUT_DIR, "forgeflow-kpi-row-tablet-1024x768.png");
  await tabletGrid.screenshot({ path: tabletRow });
  await tabletContext.close();

  // 4. Mobile (390x844)
  console.log("4. Capturing Mobile Viewport (390x844)...");
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await mobilePage.fill("input[type=\"email\"]", "sales@forgeflow.demo");
  await mobilePage.fill("input[type=\"password\"]", "ForgeFlowDemo!2026");
  await mobilePage.getByRole("button", { name: /sign in/i }).click();
  await mobilePage.waitForURL("**/app/dashboard", { timeout: 15000 });
  await mobilePage.locator("[data-slot=\"stat-card\"]").first().waitFor({ timeout: 10000 });
  await mobilePage.waitForTimeout(500);

  const mobileFull = path.join(OUTPUT_DIR, "forgeflow-dashboard-mobile-390x844.png");
  await mobilePage.screenshot({ path: mobileFull });

  const mobileGrid = mobilePage.locator("[data-slot=\"kpi-grid\"]").first();
  const mobileRow = path.join(OUTPUT_DIR, "forgeflow-kpi-row-mobile-390x844.png");
  await mobileGrid.screenshot({ path: mobileRow });
  await mobileContext.close();

  await browser.close();

  // Write exact metrics json
  const reportPath = path.join(OUTPUT_DIR, "exact-parity-metrics.json");
  fs.writeFileSync(reportPath, JSON.stringify(metrics, null, 2), "utf8");
  console.log(`Saved exact parity metrics to: ${reportPath}`);
}

run().catch(err => {
  console.error("Capture failed:", err);
  process.exit(1);
});
