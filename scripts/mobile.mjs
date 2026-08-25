import { chromium } from "playwright";
const [out, NEXT] = process.argv.slice(2);
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await c.newPage();
await p.goto(`${NEXT}/login`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(2000);
await p.screenshot({ path: `${out}/m-login.png` });
await p.evaluate(async () => {
  await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "JACK", password: "22153310" }) });
});
for (const [r, n] of [["/dashboard","dashboard"],["/generator","generator"],["/devices","devices"]]) {
  await p.goto(`${NEXT}${r}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2000);
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(`${n}: horizontal overflow = ${overflow}px`);
  await p.screenshot({ path: `${out}/m-${n}.png` });
}
// drawer open
await p.locator('button[aria-label="Open navigation"]').click();
await p.waitForTimeout(800);
await p.screenshot({ path: `${out}/m-drawer.png` });
await b.close();
