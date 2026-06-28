import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadEnvFiles() {
  for (const filename of [".env.local", ".env.staging.local"]) {
    const path = resolve(process.cwd(), filename);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      process.env[key] ??= rest.join("=").replace(/^["']|["']$/g, "");
    }
  }
}

export function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (value) return value;
  throw new Error(`Missing ${name}. Add it to .env.staging.local or the CI environment.`);
}

export function assertStagingTarget(url, stagingRef, productionRef) {
  if (!stagingRef || stagingRef === productionRef) {
    throw new Error("Refusing to run: staging and production project refs must be different.");
  }
  const host = new URL(url).hostname;
  if (!host.includes(stagingRef) || host.includes(productionRef)) {
    throw new Error(`Refusing to run against non-staging host: ${host}`);
  }
}
