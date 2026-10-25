import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const OUTPUT_DIR = path.resolve(import.meta.dirname, "../../docs/design-mapping/screenshots/settings");
const ARTIFACT_DIR = "/home/satjeet/.gemini/antigravity-cli/brain/4cd6df4a-3d9d-43fa-81c5-3be39ca98467/screenshots/settings";

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

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

  console.log("Starting Settings Conformance Verification & Accessibility Scan...");

  // Setup storage state via login
  const setupContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const setupPage = await setupContext.newPage();
  await loginAsAdmin(setupPage);
  const storageState = await setupContext.storageState();
  await setupContext.close();

  const routes = [
    { name: "overview", path: "http://localhost:3000/app/settings", title: "Overview" },
    { name: "organization", path: "http://localhost:3000/app/settings/organization", title: "Organization" },
    { name: "security", path: "http://localhost:3000/app/settings/security", title: "Security & Access" },
  ];

  const viewports = [
    { id: "desktop", width: 1440, height: 900, dsf: 2, dark: false },
    { id: "dark-desktop", width: 1440, height: 900, dsf: 2, dark: true },
    { id: "tablet", width: 1024, height: 768, dsf: 2, dark: false },
    { id: "mobile", width: 390, height: 844, dsf: 3, dark: false },
  ];

  for (const route of routes) {
    report.axeResults[route.name] = {};
    for (const vp of viewports) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.dsf,
        storageState,
      });

      const page = await context.newPage();
      await page.goto(route.path, { waitUntil: "networkidle" });
      await page.waitForTimeout(600);

      if (vp.dark) {
        await page.evaluate(() => {
          document.documentElement.classList.add("dark");
        });
        await page.waitForTimeout(300);
      }

      // Accessibility scan
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      const violations = axe.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        help: v.help,
        nodes: v.nodes.length,
      }));

      report.axeResults[route.name][vp.id] = {
        violationsCount: violations.length,
        violations,
      };

      if (violations.length > 0) {
        console.log(`[Axe VIOLATIONS] ${route.name} (${vp.id}):`, JSON.stringify(axe.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, html: n.html, failureSummary: n.failureSummary })) })), null, 2));
      }

      // Screenshot capture
      const filename = `settings-${route.name}-${vp.id}-${vp.width}x${vp.height}.png`;
      const outPath = path.join(OUTPUT_DIR, filename);
      const artPath = path.join(ARTIFACT_DIR, filename);

      await page.screenshot({ path: outPath, fullPage: true });
      fs.copyFileSync(outPath, artPath);
      report.screenshots.push(filename);

      if (route.name === "overview" && vp.id === "desktop") {
        // Measure navigation and overview cards
        report.measurements.overview = await page.evaluate(() => {
          const nav = document.querySelector('nav[aria-label="Settings navigation"]');
          const cards = Array.from(document.querySelectorAll('div.rounded-\\[var\\(--radius-xl\\)\\]'));
          return {
            navWidth: nav ? nav.getBoundingClientRect().width : null,
            cardCount: cards.length,
          };
        });
      }

      await context.close();
    }
  }

  // Write verification report
  const reportPath = path.join(OUTPUT_DIR, "settings-verification.json");
  const artReportPath = path.join(ARTIFACT_DIR, "settings-verification.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  fs.copyFileSync(reportPath, artReportPath);

  console.log("Verification finished. Report saved to:", reportPath);
  await browser.close();
}

run().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
