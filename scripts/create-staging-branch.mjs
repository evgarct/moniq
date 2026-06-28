import { spawnSync } from "node:child_process";

import { loadEnvFiles, requiredEnv } from "./staging-env.mjs";

loadEnvFiles();

const productionRef = requiredEnv("SUPABASE_PRODUCTION_PROJECT_REF");
const list = spawnSync(
  "supabase",
  ["--experimental", "branches", "list", "--project-ref", productionRef, "--output", "json"],
  { encoding: "utf8", shell: process.platform === "win32" },
);

if (list.status !== 0) {
  process.stderr.write(list.stderr);
  process.exit(list.status ?? 1);
}

const branches = JSON.parse(list.stdout || "null") ?? [];
const existing = branches.find((branch) => branch.name === "staging");
if (existing) {
  console.log(`Staging branch already exists: ${existing.project_ref ?? existing.id}`);
  process.exit(0);
}

const create = spawnSync(
  "supabase",
  [
    "--experimental",
    "branches",
    "create",
    "staging",
    "--persistent",
    "--region",
    "eu-west-1",
    "--size",
    "micro",
    "--project-ref",
    productionRef,
    "--yes",
    "--output",
    "json",
  ],
  { encoding: "utf8", shell: process.platform === "win32" },
);

if (create.status !== 0) {
  process.stderr.write(create.stderr);
  process.exit(create.status ?? 1);
}

console.log(create.stdout.trim());
