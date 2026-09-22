/**
 * Production-mode check: the preview dock is hidden by default and revealed by
 * a ?template= visit, which then persists for the rest of the tab session.
 */
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://localhost:3312";
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

const dockCount = async () => page.locator(".tpl-dock").count();

await page.goto(`${BASE}/lobby`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
console.log("plain /lobby            -> dock:", await dockCount(), "(expect 0)");

await page.goto(`${BASE}/lobby?template=luxe`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
console.log("?template=luxe          -> dock:", await dockCount(), "(expect 1)");
console.log("  data-portal-template  =",
  await page.getAttribute("html", "data-portal-template"));

await page.goto(`${BASE}/lobby`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
console.log("back to plain /lobby    -> dock:", await dockCount(), "(expect 1, same tab)");
console.log("  data-portal-template  =",
  await page.getAttribute("html", "data-portal-template"));

const fresh = await browser.newContext();
const p2 = await fresh.newPage();
await p2.goto(`${BASE}/lobby`, { waitUntil: "networkidle" });
await p2.waitForTimeout(800);
console.log("fresh tab /lobby        -> dock:", await p2.locator(".tpl-dock").count(), "(expect 0)");
console.log("  data-portal-template  =",
  await p2.getAttribute("html", "data-portal-template"));

await browser.close();
