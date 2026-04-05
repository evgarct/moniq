import { openSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const repoDir = process.cwd();
const artifactsDir = path.join(repoDir, ".codex-artifacts");
const appLog = path.join(artifactsDir, "preview-app.log");
const storybookLog = path.join(artifactsDir, "preview-storybook.log");
const currentJsonPath = path.join(artifactsDir, "current-previews.json");
const currentMarkdownPath = path.join(artifactsDir, "current-previews.md");
const appPort = 3008;
const storybookPort = 6008;
const appUrl = `http://localhost:${appPort}/en/today`;
const storybookUrl = `http://localhost:${storybookPort}`;

await mkdir(artifactsDir, { recursive: true });

await stopPort(appPort);
await stopPort(storybookPort);

spawnDetached(
  path.join(repoDir, "node_modules", ".bin", "next"),
  ["dev", "--hostname", "0.0.0.0", "--port", String(appPort)],
  appLog,
);

spawnDetached(
  path.join(repoDir, "node_modules", ".bin", "storybook"),
  ["dev", "-p", String(storybookPort), "--host", "0.0.0.0", "--ci"],
  storybookLog,
);

const appStatus = await waitForHttp(appUrl, [200, 307], 60_000);
const storybookStatus = await waitForHttp(storybookUrl, [200], 60_000);

const payload = {
  generatedAt: new Date().toISOString(),
  mode: "live-dev",
  app: {
    url: appUrl,
    status: appStatus,
    log: appLog,
  },
  storybook: {
    url: storybookUrl,
    status: storybookStatus,
    log: storybookLog,
  },
  note: "These preview URLs are stable. Restart the live servers in place instead of allocating new ports.",
};

await writeFile(currentJsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
await writeFile(
  currentMarkdownPath,
  [
    "# Current Previews",
    "",
    `Generated: ${payload.generatedAt}`,
    "",
    `- App: ${payload.app.url} (${payload.app.status})`,
    `- Storybook: ${payload.storybook.url} (${payload.storybook.status})`,
    "",
    payload.note,
    "",
  ].join("\n"),
  "utf8",
);

console.log(JSON.stringify(payload, null, 2));

async function stopPort(port) {
  await run(
    "bash",
    [
      "-lc",
      `if command -v fuser >/dev/null 2>&1; then fuser -k ${port}/tcp >/dev/null 2>&1 || true; else pids=$(lsof -tiTCP:${port} -sTCP:LISTEN 2>/dev/null || true); if [ -n "$pids" ]; then kill $pids || true; fi; fi`,
    ],
    "ignore",
  );

  await sleep(1_000);
}

function spawnDetached(command, args, logPath) {
  const stdout = openSync(logPath, "w");
  const stderr = openSync(logPath, "a");

  const child = spawn(command, args, {
    cwd: repoDir,
    detached: true,
    stdio: ["ignore", stdout, stderr],
    shell: false,
  });

  child.unref();
}

async function run(command, args, stdio = "ignore") {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoDir,
      stdio,
      shell: false,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? "unknown"}`));
    });
    child.on("error", reject);
  });
}

async function waitForHttp(url, allowedStatuses, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        method: "HEAD",
        redirect: "manual",
      });

      if (allowedStatuses.includes(response.status)) {
        return response.status;
      }

      lastError = new Error(`Unexpected status ${response.status} for ${url}`);
    } catch (error) {
      lastError = error;
    }

    await sleep(1_000);
  }

  throw lastError ?? new Error(`Timed out waiting for ${url}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
