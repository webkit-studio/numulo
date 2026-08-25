import { chromium } from "playwright";
const paths = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  proxy: { server: "http://127.0.0.1:42031", bypass: "127.0.0.1,localhost" },
  args: ["--ignore-certificate-errors"],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();

// Sign in once, server-side action, then reuse the session cookie.
await page.goto("http://127.0.0.1:3400/prihlaseni", { waitUntil: "domcontentloaded" });
await page.fill('input[name="email"]', "test@numulo.local");
await page.fill('input[name="password"]', "numulo-test-1234");
await Promise.all([page.waitForNavigation({ waitUntil: "domcontentloaded" }).catch(() => {}), page.click('button[type="submit"]')]);
await page.waitForTimeout(2500);

for (const p of paths) {
  await page.goto(`http://127.0.0.1:3400${p}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const name = p === "/" ? "home" : p.replace(/\//g, "-").slice(1);
  await page.screenshot({ path: `/tmp/numulo-shots/${name}.png`, fullPage: true });
  console.log(p, "→", page.url());
}
await browser.close();
