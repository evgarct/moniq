import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

function loadLocalEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (!process.env[key]) {
      process.env[key] = rest.join("=").replace(/^["']|["']$/g, "");
    }
  }
}

function requiredEnv(name, fallbackName) {
  const value = process.env[name] ?? (fallbackName ? process.env[fallbackName] : undefined);
  if (value) return value;
  throw new Error(`Missing ${name}${fallbackName ? ` or ${fallbackName}` : ""}.`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

loadLocalEnv();

async function signIn(page, appUrl, email, password, targetPath) {
  const loginUrl = new URL("/en/login", appUrl);
  loginUrl.searchParams.set("next", targetPath);

  await page.goto(loginUrl.toString(), { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(new RegExp(`${escapeRegExp(targetPath)}(?:[?#].*)?$`), {
    timeout: 20_000,
  });
}

async function selectExpenseCategory(page) {
  await page.getByText("Choose category", { exact: true }).click();
  await page.getByRole("menuitem", { name: /E2E Living/ }).hover();
  await page.getByRole("menuitem", { name: /E2E Groceries/ }).click();
}

async function main() {
  const appUrl = (process.env.MONIQ_E2E_APP_URL ?? "http://localhost:3008").replace(/\/$/, "");
  const email = requiredEnv("MONIQ_E2E_EMAIL", "E2E_USER_EMAIL");
  const password = requiredEnv("MONIQ_E2E_PASSWORD", "E2E_USER_PASSWORD");
  const targetPath = "/en/accounts";
  const marker = `E2E add transaction ${Date.now()}`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const consoleErrors = [];
  const failedRequests = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  page.on("requestfailed", (request) => {
    failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`.trim());
  });

  try {
    await signIn(page, appUrl, email, password, targetPath);
    await page.getByRole("heading", { name: "Balance" }).waitFor({ timeout: 10_000 });
    await page.getByRole("button", { name: "Add transaction" }).first().click();
    await page.getByRole("button", { name: "Save transaction" }).waitFor({ timeout: 10_000 });

    await selectExpenseCategory(page);
    await page.locator("#transaction-line-amount-0").fill("13.37");
    await page.locator("#transaction-note").fill(marker);

    await page.getByRole("button", { name: "Save transaction" }).click();
    await page.getByText(marker, { exact: false }).waitFor({ timeout: 20_000 });

    const blockingFailures = failedRequests.filter((entry) => !entry.includes("__nextjs_original-stack-frames"));
    if (blockingFailures.length > 0) {
      throw new Error(`Failed browser requests while adding a transaction:\n${blockingFailures.join("\n")}`);
    }

    if (consoleErrors.length > 0) {
      throw new Error(`Console errors while adding a transaction:\n${consoleErrors.join("\n")}`);
    }

    console.log(`Add transaction verification passed: ${appUrl}/en/accounts (${marker})`);
  } finally {
    await browser.close();
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
