/**
 * Screenshot the lobby in every visual template.
 *
 * Requires the mock BFF (`pnpm mock-bff`) and a dev server. Usage:
 *   node tests/gui-qa/shot-lobby-templates.mjs [baseUrl] [outDir]
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3311";
const OUT = process.argv[3] ?? "tests/gui-qa/lobby-templates-2026-09-01";
const TEMPLATES = ["classic", "neon", "luxe", "aurora"];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

for (const template of TEMPLATES) {
  for (const [name, viewport] of [
    ["desktop", { width: 1440, height: 900 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
    // The preview dock is dev-only chrome — keep it out of the captures.
    await page.addStyleTag({ content: ".tpl-dock { display: none !important; }" })
      .catch(() => {});
    await page.goto(`${BASE}/lobby?template=${template}`, {
      waitUntil: "networkidle",
    });
    await page.addStyleTag({ content: ".tpl-dock { display: none !important; }" });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${template}-${name}-hero.png` });

    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 0.95));
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/${template}-${name}-rows.png` });
    await page.close();
  }
  console.log(`captured ${template}`);
}

await browser.close();
