/**
 * Diffs element geometry between the original page and the port so
 * layout drift is a number, not a guess. Dev aid only.
 *
 *   node scripts/measure.mjs <originalOrigin> <nextOrigin>
 */
import { chromium } from "playwright";

const [ORIGINAL, NEXT] = process.argv.slice(2);
const VIEWPORT = { width: 1600, height: 1000 };

const SEED = `
try {
  localStorage.setItem('isAdmin','true');
  localStorage.setItem('adminUser','JACK');
  localStorage.setItem('cheatExeUsers','{}');
  localStorage.setItem('cheatExeKeyHistory','[]');
  localStorage.setItem('cheatExeAuditLogs','[]');
  localStorage.setItem('cheatExeDevices','[]');
  localStorage.setItem('cheatExeBannedUsers','[]');
} catch(e) {}
`;

/** [label, original selector, port selector] */
const PROBES = [
  ["sidebar", "aside", "aside"],
  ["logo text", ".logo-text", "aside [data-probe=logo]"],
  ["nav label 1", ".nav-label:nth-of-type(1)", "aside [data-probe=group-label]"],
  ["nav link 1", "aside .nav-link", "aside a"],
  ["profile nav", 'aside .nav-link[onclick*="profile"]', 'aside a[href="/profile"]'],
  ["user card", ".user-profile", "aside [data-probe=user-card]"],
  ["header h1", "header h1", "header h1"],
  ["content top", ".content-wrapper", "[data-probe=content]"],
  ["chart card", "#sec-overview .card", "[data-probe=content] > div:first-child > div"],
  ["stats grid", ".stats-grid", "[data-probe=stats]"],
  ["stat card 1", ".stat-card", "[data-probe=stats] > div:first-child"],
];

function box(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(r.x),
      y: Math.round(r.y),
      w: Math.round(r.width),
      h: Math.round(r.height),
    };
  }, selector);
}

const browser = await chromium.launch();

const oldCtx = await browser.newContext({ viewport: VIEWPORT });
await oldCtx.addInitScript(SEED);
const oldPage = await oldCtx.newPage();
await oldPage.goto(`${ORIGINAL}/index.html`, { waitUntil: "domcontentloaded" });
await oldPage.waitForTimeout(2000);

const newCtx = await browser.newContext({ viewport: VIEWPORT });
const newPage = await newCtx.newPage();
await newPage.goto(`${NEXT}/login`, { waitUntil: "domcontentloaded" });
await newPage.evaluate(async () => {
  await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "JACK", password: "22153310" }),
  });
});
await newPage.goto(`${NEXT}/dashboard`, { waitUntil: "domcontentloaded" });
await newPage.waitForTimeout(2000);

console.log("element              original            port                 delta");
console.log("-".repeat(78));
for (const [label, oldSel, newSel] of PROBES) {
  const a = await box(oldPage, oldSel);
  const b = await box(newPage, newSel);
  const fmt = (v) => (v ? `y${String(v.y).padStart(4)} h${String(v.h).padStart(4)} w${String(v.w).padStart(4)}` : "  -- missing --   ");
  const delta = a && b ? `y${b.y - a.y >= 0 ? "+" : ""}${b.y - a.y} h${b.h - a.h >= 0 ? "+" : ""}${b.h - a.h}` : "";
  console.log(`${label.padEnd(20)} ${fmt(a)}  ${fmt(b)}  ${delta}`);
}

await browser.close();
