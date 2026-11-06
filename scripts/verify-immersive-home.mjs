import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const base = (process.env.MONIQ_E2E_APP_URL ?? "http://localhost:3008").replace(/\/$/, "");
const output = resolve(".codex-artifacts/immersive-home");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = [];

async function settled(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function scrollScene(page, scene, extra = 0) {
  await page.evaluate(({ scene, extra }) => {
    const main = document.querySelector("main");
    const target = document.querySelector(`[data-scene="${scene}"]`);
    const header = parseFloat(getComputedStyle(main).getPropertyValue("--exhibit-header"));
    main.style.setProperty("scroll-behavior", "auto", "important");
    main.scrollTo({ top: target.offsetTop - header + extra, behavior: "instant" });
  }, { scene, extra });
  await settled(page);
}

async function checkGeometry(page) {
  const result = await page.evaluate(() => {
    const main = document.querySelector("main");
    const headings = [...main.querySelectorAll("h1,h2")].map(el => ({ text: el.textContent, width: el.scrollWidth, client: el.clientWidth }));
    return { width: main.scrollWidth, client: main.clientWidth, headings };
  });
  assert.ok(result.width <= result.client + 1, `Horizontal page overflow: ${JSON.stringify(result)}`);
  for (const heading of result.headings) assert.ok(heading.width <= heading.client + 1, `Heading overflow: ${JSON.stringify(heading)}`);
}

try {
  for (const [name, viewport, locale, reducedMotion] of [
    ["desktop", { width: 1440, height: 1000 }, "en", "no-preference"],
    ["compact-desktop", { width: 1366, height: 768 }, "en", "no-preference"],
    ["mobile", { width: 390, height: 844 }, "en", "no-preference"],
    ["small-mobile-ru", { width: 360, height: 740 }, "ru", "no-preference"],
    ["tiny-mobile-ru", { width: 320, height: 668 }, "ru", "no-preference"],
    ["wide", { width: 1920, height: 1080 }, "en", "no-preference"],
    ["reduced-motion", { width: 390, height: 844 }, "en", "reduce"],
  ]) {
    const context = await browser.newContext({ viewport, reducedMotion, colorScheme: "light" });
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    console.log(`Checking ${name} (${locale})`);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      if (message.type() !== "error") return;
      const source = message.location().url;
      // These Vercel-hosted endpoints do not exist on local next start.
      // Match the exact optional endpoints, just as the authenticated app smoke does.
      const path = source ? new URL(source).pathname : "";
      if (path === "/_vercel/insights/script.js" || path === "/_vercel/speed-insights/script.js") return;
      errors.push(`${source}: ${message.text()}`);
    });
    const response = await page.goto(`${base}/${locale}`, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200);
    await page.locator("main h1").waitFor();
    assert.equal(await page.locator("[data-scene]").count(), 5);
    await checkGeometry(page);
    const heroAction = page.locator("#opening a[href$='/signup']");
    const box = await heroAction.boundingBox();
    assert.ok(box && box.y >= 0 && box.y + box.height <= viewport.height, "Primary action must be immediately visible");
    assert.equal(await page.locator("header nav a[href$='/login']").count(), 1);
    if (reducedMotion === "reduce") {
      assert.equal(await page.locator("#opening > section").evaluate(el => getComputedStyle(el).position), "relative");
      assert.equal(await page.locator("#perspective figure").first().evaluate(el => getComputedStyle(el).clipPath), "none");
    }
    for (const scene of ["opening", "perspective", "product", "balance", "freedom"]) {
      await scrollScene(page, scene, scene === "perspective" && reducedMotion !== "reduce" ? 180 : 0);
      const image = page.locator(`[data-scene="${scene}"] img`).first();
      if (await image.count()) await image.evaluate(img => img.decode());
      await page.screenshot({ path: resolve(output, `${name}-${scene}.png`) });
    }
    // Reverse scrolling must reproduce the opening composition.
    await scrollScene(page, "opening");
    assert.equal(await page.locator("main").evaluate(el => el.scrollTop), 0);
    await scrollScene(page, "product");
    const product = page.locator("#product");
    const copy = require(`../messages/${locale}.json`).landing.product;
    const savings = product.getByRole("button", { name: copy.savings, exact: true });
    await savings.focus();
    await page.keyboard.press("Enter");
    assert.equal(await savings.getAttribute("aria-pressed"), "true");
    assert.equal(await product.getByText(copy.rows.groceries.title, { exact: true }).count(), 0);
    assert.equal(await product.getByText(copy.rows.journey.title, { exact: true }).count(), 1);
    await product.getByRole("button", { name: copy.daily, exact: true }).click();
    assert.equal(await product.getByText(copy.rows.groceries.title, { exact: true }).count(), 1);
    assert.equal(await product.getByText(copy.rows.journey.title, { exact: true }).count(), 0);
    await product.getByRole("button", { name: copy.all, exact: true }).click();
    assert.equal(await product.locator("li").count(), 5);
    await checkGeometry(page);
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
    const violations = await page.evaluate(async () => (await window.axe.run("main", { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })));
    assert.deepEqual(violations, [], `Accessibility violations (${name})`);
    assert.deepEqual(errors, [], `Browser errors (${name})`);
    report.push({ name, locale, viewport, reducedMotion, scenes: 5, keyboard: "passed", accessibility: "passed", console: "clean" });
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto(`${base}/en`);
  await page.locator("header nav a[href$='/login']").click();
  await page.waitForURL("**/en/login");
  await page.locator("input[type='email']").waitFor();
  await page.goto(`${base}/en`);
  await page.locator("#opening a[href$='/signup']").click();
  await page.waitForURL("**/en/signup");
  await page.locator("input[type='email']").waitFor();
  await page.goto(`${base}/en`);
  await page.locator("header nav a[hreflang='ru']").click();
  await page.waitForURL("**/ru");
  assert.match(await page.locator("h1").innerText(), /цифры/);
  report.push({ authenticationEntries: "login and signup reached real forms", localeNavigation: "passed" });
  await context.close();

  const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const staticPage = await noJs.newPage();
  await staticPage.goto(`${base}/en`);
  assert.equal(await staticPage.locator("[data-scene]").count(), 5);
  assert.equal(await staticPage.locator("#opening > section").evaluate(el => getComputedStyle(el).position), "relative");
  await staticPage.locator("#opening a[href$='/signup']").click();
  await staticPage.waitForURL("**/en/signup");
  report.push({ noJavaScript: "all scenes rendered and signup navigation passed" });
  await noJs.close();
  await writeFile(resolve(output, "verification.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
