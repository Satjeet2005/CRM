import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const OUTPUT_DIR = path.resolve(import.meta.dirname, "../../docs/design-mapping/screenshots/sidebar");
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

  console.log("Starting Sidebar Visual-Conformance Verification...");

  // 1. Desktop Context (1440x900) - Expanded Sidebar
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await desktopContext.newPage();

  console.log("Authenticating as Sales Rep...");
  await loginAsSalesRep(page);
  await page.waitForTimeout(1000);

  const sidebar = page.locator('aside[aria-label="Application Sidebar"]');
  await sidebar.waitFor({ timeout: 5000 });

  console.log("Measuring Expanded Sidebar (Desktop 1440x900)...");
  const expandedMeasurements = await page.evaluate(() => {
    const aside = document.querySelector('aside[aria-label="Application Sidebar"]');
    if (!aside) return null;
    const asideStyle = window.getComputedStyle(aside);
    const asideRect = aside.getBoundingClientRect();

    // Wordmark header
    const header = aside.querySelector('.h-16');
    const headerStyle = header ? window.getComputedStyle(header) : null;
    const headerRect = header ? header.getBoundingClientRect() : null;

    // Group labels
    const groupLabels = Array.from(aside.querySelectorAll('span.uppercase')).map(el => {
      const parent = el.parentElement;
      const parentStyle = parent ? window.getComputedStyle(parent) : null;
      const elStyle = window.getComputedStyle(el);
      return {
        text: el.textContent?.trim(),
        height: parent ? parent.getBoundingClientRect().height : null,
        paddingTop: parentStyle ? parentStyle.paddingTop : null,
        paddingBottom: parentStyle ? parentStyle.paddingBottom : null,
        fontSize: elStyle.fontSize,
        lineHeight: elStyle.lineHeight,
        fontWeight: elStyle.fontWeight,
        letterSpacing: elStyle.letterSpacing,
        color: elStyle.color,
      };
    });

    // Active item (Overview on /app/dashboard)
    const activeItem = aside.querySelector('a[aria-current="page"]');
    const activeItemStyle = activeItem ? window.getComputedStyle(activeItem) : null;
    const activeItemRect = activeItem ? activeItem.getBoundingClientRect() : null;

    // Active indicator
    const activeIndicator = activeItem ? activeItem.querySelector('span[aria-hidden="true"]') : null;
    const activeIndicatorStyle = activeIndicator ? window.getComputedStyle(activeIndicator) : null;
    const activeIndicatorRect = activeIndicator ? activeIndicator.getBoundingClientRect() : null;

    // Inactive item (Accounts)
    const inactiveItem = aside.querySelector('a[href="/app/accounts"]');
    const inactiveItemStyle = inactiveItem ? window.getComputedStyle(inactiveItem) : null;
    const inactiveItemRect = inactiveItem ? inactiveItem.getBoundingClientRect() : null;

    // Settings item
    const settingsItem = aside.querySelector('a[href="/app/settings"]');
    const hasP2Badge = !!aside.querySelector('span.rounded:not([aria-hidden])');

    // Collapse toggle button
    const collapseBtn = aside.querySelector('button[aria-label*="Collapse"]');
    const collapseBtnRect = collapseBtn ? collapseBtn.getBoundingClientRect() : null;
    const collapseBtnStyle = collapseBtn ? window.getComputedStyle(collapseBtn) : null;

    return {
      sidebarWidth: asideRect.width,
      sidebarBackground: asideStyle.backgroundColor,
      borderRight: asideStyle.borderRight,
      headerHeight: headerRect ? headerRect.height : null,
      groupLabels,
      activeItem: {
        text: activeItem?.textContent?.trim(),
        height: activeItemRect?.height,
        backgroundColor: activeItemStyle?.backgroundColor,
        color: activeItemStyle?.color,
        borderRadius: activeItemStyle?.borderRadius,
        paddingLeft: activeItemStyle?.paddingLeft,
        paddingRight: activeItemStyle?.paddingRight,
        hasIndicator: !!activeIndicator,
        indicatorWidth: activeIndicatorRect?.width,
        indicatorHeight: activeIndicatorRect?.height,
        indicatorColor: activeIndicatorStyle?.backgroundColor,
      },
      inactiveItem: {
        text: inactiveItem?.textContent?.trim(),
        height: inactiveItemRect?.height,
        color: inactiveItemStyle?.color,
      },
      settingsNavigable: !!settingsItem,
      settingsHref: settingsItem?.getAttribute('href'),
      hasP2Badge,
      collapseBtn: {
        width: collapseBtnRect?.width,
        height: collapseBtnRect?.height,
      },
    };
  });

  report.measurements.expanded = expandedMeasurements;
  console.log("Expanded Measurements:", JSON.stringify(expandedMeasurements, null, 2));

  // Screenshot 1: Desktop Expanded (1440x900)
  const expandedScreenshotPath = path.join(OUTPUT_DIR, "sidebar-desktop-expanded-1440x900.png");
  await page.screenshot({ path: expandedScreenshotPath, fullPage: false });
  report.screenshots.push("sidebar-desktop-expanded-1440x900.png");
  console.log(`Saved desktop expanded screenshot to ${expandedScreenshotPath}`);

  // Axe Scan Expanded
  console.log("Running Axe accessibility scan on Expanded Sidebar...");
  const axeExpanded = await new AxeBuilder({ page })
    .include('aside[aria-label="Application Sidebar"]')
    .analyze();
  report.axeResults.expanded = {
    violationsCount: axeExpanded.violations.length,
    violations: axeExpanded.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description })),
  };
  console.log(`Expanded Sidebar Axe violations: ${axeExpanded.violations.length}`);

  // 2. Collapse Sidebar & Test Collapsed Rail
  console.log("Toggling sidebar collapse...");
  const collapseButton = page.locator('button[aria-label="Collapse sidebar"]');
  await collapseButton.click();
  await page.waitForTimeout(500);

  console.log("Measuring Collapsed Rail (Desktop 1440x900)...");
  const collapsedMeasurements = await page.evaluate(() => {
    const aside = document.querySelector('aside[aria-label="Application Sidebar"]');
    if (!aside) return null;
    const asideRect = aside.getBoundingClientRect();

    const activeItem = aside.querySelector('a[aria-current="page"]');
    const activeItemRect = activeItem ? activeItem.getBoundingClientRect() : null;
    const activeIndicator = activeItem ? activeItem.querySelector('span[aria-hidden="true"]') : null;

    const navItems = Array.from(aside.querySelectorAll('nav a'));

    return {
      sidebarWidth: asideRect.width,
      activeItemWidth: activeItemRect?.width,
      activeItemHeight: activeItemRect?.height,
      hasActiveIndicator: !!activeIndicator,
      totalNavItems: navItems.length,
    };
  });
  report.measurements.collapsed = collapsedMeasurements;
  console.log("Collapsed Measurements:", JSON.stringify(collapsedMeasurements, null, 2));

  // Screenshot 2: Desktop Collapsed (1440x900)
  const collapsedScreenshotPath = path.join(OUTPUT_DIR, "sidebar-desktop-collapsed-1440x900.png");
  await page.screenshot({ path: collapsedScreenshotPath, fullPage: false });
  report.screenshots.push("sidebar-desktop-collapsed-1440x900.png");
  console.log(`Saved desktop collapsed screenshot to ${collapsedScreenshotPath}`);

  // Axe Scan Collapsed
  console.log("Running Axe accessibility scan on Collapsed Rail...");
  const axeCollapsed = await new AxeBuilder({ page })
    .include('aside[aria-label="Application Sidebar"]')
    .analyze();
  report.axeResults.collapsed = {
    violationsCount: axeCollapsed.violations.length,
    violations: axeCollapsed.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description })),
  };
  console.log(`Collapsed Rail Axe violations: ${axeCollapsed.violations.length}`);

  // Expand back
  await page.locator('button[aria-label="Expand sidebar"]').click();
  await page.waitForTimeout(500);

  // Focus state inspection
  console.log("Testing keyboard focus state...");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const activeFocusItem = page.locator('aside[aria-label="Application Sidebar"] a[aria-current="page"]');
  await activeFocusItem.focus();
  await page.waitForTimeout(300);

  await desktopContext.close();

  // 3. Tablet Context (1024x768)
  console.log("Capturing Tablet viewport (1024x768)...");
  const tabletContext = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    deviceScaleFactor: 2,
  });
  const tabletPage = await tabletContext.newPage();
  await loginAsSalesRep(tabletPage);
  await tabletPage.waitForSelector('aside[aria-label="Application Sidebar"]', { timeout: 15000 });
  await tabletPage.waitForTimeout(800);

  const tabletScreenshotPath = path.join(OUTPUT_DIR, "sidebar-tablet-1024x768.png");
  await tabletPage.screenshot({ path: tabletScreenshotPath, fullPage: false });
  report.screenshots.push("sidebar-tablet-1024x768.png");
  console.log(`Saved tablet screenshot to ${tabletScreenshotPath}`);

  const axeTablet = await new AxeBuilder({ page: tabletPage })
    .include('aside[aria-label="Application Sidebar"]')
    .analyze();
  report.axeResults.tablet = {
    violationsCount: axeTablet.violations.length,
    violations: axeTablet.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description })),
  };
  console.log(`Tablet Axe violations: ${axeTablet.violations.length}`);
  await tabletContext.close();

  // 4. Mobile Context (390x844) - Drawer Open
  console.log("Capturing Mobile viewport (390x844)...");
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
  });
  const mobilePage = await mobileContext.newPage();
  await loginAsSalesRep(mobilePage);
  await mobilePage.waitForTimeout(800);

  // Open mobile drawer
  console.log("Opening mobile drawer...");
  const menuBtn = mobilePage.locator('button[aria-label="Open navigation menu"]');
  await menuBtn.click();
  await mobilePage.waitForSelector('[role="dialog"][aria-label="Navigation drawer"]', { timeout: 5000 });
  await mobilePage.waitForTimeout(500);

  const mobileScreenshotPath = path.join(OUTPUT_DIR, "sidebar-mobile-drawer-390x844.png");
  await mobilePage.screenshot({ path: mobileScreenshotPath, fullPage: false });
  report.screenshots.push("sidebar-mobile-drawer-390x844.png");
  console.log(`Saved mobile drawer screenshot to ${mobileScreenshotPath}`);

  const axeMobile = await new AxeBuilder({ page: mobilePage })
    .include('[role="dialog"][aria-label="Navigation drawer"]')
    .analyze();
  report.axeResults.mobile = {
    violationsCount: axeMobile.violations.length,
    violations: axeMobile.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description })),
  };
  console.log(`Mobile Drawer Axe violations: ${axeMobile.violations.length}`);

  // Test drawer close on navigation
  console.log("Testing drawer close on navigation...");
  const accountsLink = mobilePage.locator('[role="dialog"] a[href="/app/accounts"]');
  await accountsLink.click();
  await mobilePage.waitForURL("**/app/accounts", { timeout: 10000 });
  await mobilePage.waitForTimeout(500);
  const isDrawerVisible = await mobilePage.locator('[role="dialog"][aria-label="Navigation drawer"]').isVisible();
  report.measurements.drawerClosesOnNav = !isDrawerVisible;
  console.log(`Drawer closed after navigation: ${!isDrawerVisible}`);

  await mobileContext.close();

  // Save verification JSON
  const reportPath = path.join(OUTPUT_DIR, "sidebar-verification.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Verification report written to ${reportPath}`);

  await browser.close();
  console.log("Sidebar verification complete!");
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
