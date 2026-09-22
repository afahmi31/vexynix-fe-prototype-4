/** Screenshot the template preview dock, open. */
import { chromium } from "@playwright/test";

const OUT = "tests/gui-qa/lobby-templates-2026-09-01";
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1200, height: 900 },
  deviceScaleFactor: 2,
});
await page.goto("http://localhost:3311/lobby?template=luxe", {
  waitUntil: "networkidle",
});
await page.click(".tpl-dock-toggle");
await page.waitForTimeout(600);
await page.locator(".tpl-dock").screenshot({ path: `${OUT}/preview-dock.png` });
await browser.close();
