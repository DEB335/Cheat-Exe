/**
 * Side-by-side screenshots of the original static pages and the Next
 * port, for visual diffing. Not part of the app -- a dev aid.
 *
 *   node scripts/compare.mjs <outDir> <originalOrigin> <nextOrigin>
 */
import { chromium } from "playwright";
import { promises as fs } from "node:fs";

const [outDir, ORIGINAL, NEXT] = process.argv.slice(2);
await fs.mkdir(outDir, { recursive: true });

const VIEWPORT = { width: 1600, height: 1000 };

// Seed the original's localStorage so it renders as a signed-in owner.
const SEED = `
try {
  localStorage.setItem('isAdmin','true');
  localStorage.setItem('adminUser','JACK');
  localStorage.setItem('adminPass','22153310');
  localStorage.setItem('cheatExeUsers','{}');
  localStorage.setItem('cheatExeKeyHistory','[]');
  localStorage.setItem('cheatExeAuditLogs','[]');
  localStorage.setItem('cheatExeDevices','[]');
  localStorage.setItem('cheatExeBannedUsers','[]');
} catch(e) {}
`;

const browser = await chromium.launch();

async function shoot(page, url, file, { click } = {}) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  // Let fonts, canvases and entry animations settle.
  await page.waitForTimeout(2500);
  if (click) {
    for (const selector of click) {
      await page.locator(selector).first().click().catch(() => {});
      await page.waitForTimeout(700);
    }
  }
  await page.screenshot({ path: `${outDir}/${file}`, fullPage: false });
  console.log(`  ${file}`);
}

console.log("Original:");
{
  const context = await browser.newContext({ viewport: VIEWPORT });
  await context.addInitScript(SEED);
  const page = await context.newPage();
  // The original toggles sections in place, so drive it via switchTab().
  await shoot(page, `${ORIGINAL}/index.html`, "old-dashboard.png");
  for (const [tab, name] of [
    ["generator", "generator"],
    ["manager", "manager"],
    ["subusers", "resellers"],
    ["profile", "profile"],
    ["bannedVault", "banned-vault"],
  ]) {
    await page.evaluate((t) => window.switchTab(t), tab);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${outDir}/old-${name}.png` });
    console.log(`  old-${name}.png`);
  }
  await shoot(page, `${ORIGINAL}/login.html`, "old-login.png");
  await context.close();
}

console.log("Next port:");
{
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  await page.goto(`${NEXT}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${outDir}/new-login.png` });
  console.log("  new-login.png");

  await page.evaluate(async () => {
    await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "JACK", password: "22153310" }),
    });
  });

  for (const [route, name] of [
    ["/dashboard", "dashboard"],
    ["/generator", "generator"],
    ["/manager", "manager"],
    ["/resellers", "resellers"],
    ["/profile", "profile"],
    ["/banned-vault", "banned-vault"],
  ]) {
    await shoot(page, `${NEXT}${route}`, `new-${name}.png`);
  }
  await context.close();
}

await browser.close();
console.log("done");
