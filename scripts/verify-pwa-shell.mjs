import { chromium } from "playwright";

const appUrl = (process.env.MONIQ_E2E_APP_URL ?? "http://localhost:3008").replace(/\/$/, "");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

try {
  await page.goto(`${appUrl}/en/login`, { waitUntil: "networkidle" });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForLoadState("networkidle");
  const workerState = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const cacheNames = await caches.keys();
    const cachedUrls = (await Promise.all(cacheNames.map(async (name) => {
      const cache = await caches.open(name);
      return (await cache.keys()).map((request) => request.url);
    }))).flat();
    return {
      active: registration.active?.state,
      controlled: Boolean(navigator.serviceWorker.controller),
      hasOfflineFallback: cachedUrls.some((url) => new URL(url).pathname === "/en/offline"),
      hasSqliteWasm: cachedUrls.some((url) => url.endsWith(".wasm") && url.includes("wa-sqlite")),
    };
  });
  if (workerState.active !== "activated" || !workerState.controlled || !workerState.hasOfflineFallback || !workerState.hasSqliteWasm) {
    throw new Error(`Incomplete PWA precache: ${JSON.stringify(workerState)}`);
  }

  const startedAt = performance.now();
  await page.reload({ waitUntil: "domcontentloaded" });
  const warmLaunchMs = Math.round((performance.now() - startedAt) * 100) / 100;
  await context.setOffline(true);
  await page.goto(`${appUrl}/en/login`, { waitUntil: "domcontentloaded" });
  await page.getByText(/Welcome back|Moniq is offline/, { exact: true }).waitFor();

  console.log(`PWA shell verification passed: warm launch ${warmLaunchMs} ms; offline navigation and SQLite WASM cached.`);
} finally {
  await context.setOffline(false);
  await browser.close();
}
