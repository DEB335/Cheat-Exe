/**
 * Loads every page with a real browser and fails on any console error or
 * page exception. Dev aid -- catches React warnings a curl smoke test
 * cannot see.
 */
import { chromium } from "playwright";

const NEXT = process.argv[2] ?? "http://localhost:3000";
const ROUTES = [
  "/dashboard", "/generator", "/manager", "/owner-history", "/reseller-history",
  "/resellers", "/profile", "/audit-logs", "/devices", "/banned-vault",
];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();

let problems = 0;
const seen = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") seen.push(`${m.type()}: ${m.text().slice(0, 180)}`);
});
page.on("pageerror", (e) => seen.push(`exception: ${String(e).slice(0, 180)}`));

await page.goto(`${NEXT}/login`, { waitUntil: "domcontentloaded" });
await page.evaluate(async () => {
  await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "JACK", password: "22153310" }) });
});

for (const route of ROUTES) {
  seen.length = 0;
  await page.goto(NEXT + route, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  // Ignore noise from the cross-origin YouTube background frame.
  const real = seen.filter((s) => !/youtube|ERR_BLOCKED|Failed to load resource|postMessage|requestAdapter|No available adapters|powerPreference|WebGL|GPU/i.test(s));
  if (real.length) {
    problems += real.length;
    console.log(`  ${route}`);
    for (const r of [...new Set(real)]) console.log(`      ${r}`);
  } else {
    console.log(`  ${route.padEnd(20)} clean`);
  }
}

await browser.close();
console.log(problems === 0 ? "\nNo console errors or warnings." : `\n${problems} problem(s).`);
process.exit(problems === 0 ? 0 : 1);
