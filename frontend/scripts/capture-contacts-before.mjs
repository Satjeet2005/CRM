import { chromium } from "@playwright/test";
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
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await desktopContext.newPage();

  console.log("Authenticating as Sales Rep...");
  await loginAsSalesRep(page);

  console.log("Navigating to Contacts page...");
  await page.goto("http://localhost:3000/app/contacts", { waitUntil: "networkidle" });
  await page.waitForSelector("table", { timeout: 15000 });
  await page.waitForTimeout(1000);

  console.log("Capturing initial desktop screenshot...");
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "contacts-table-desktop-before.png"),
    fullPage: false,
  });

  await browser.close();
  console.log("Before screenshot saved successfully.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
