import { execFileSync } from "node:child_process";

const base = process.env.STORYBOOK_BASE_REF || process.argv[2] || "origin/main";
const diffOutput = execFileSync("git", ["diff", "--name-only", base], { encoding: "utf8" });
const untrackedOutput = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { encoding: "utf8" });
const changed = [...new Set(`${diffOutput}\n${untrackedOutput}`.split(/\r?\n/).filter(Boolean))];
const runtimeUi = changed.filter((path) =>
  /^(app\/.*\.(tsx|css)|components\/.*\.tsx|features\/.*\/components\/.*\.tsx)$/.test(path) &&
  !path.endsWith(".stories.tsx"),
);
const stories = changed.filter((path) => path.endsWith(".stories.tsx"));
const bypass = changed.includes(".storybook/non-visual-change.md");

if (runtimeUi.length > 0 && stories.length === 0 && !bypass) {
  console.error("Storybook-first check failed. Runtime UI changed without a story change:");
  for (const path of runtimeUi) console.error(`- ${path}`);
  console.error("Add or update a focused story. For a genuinely non-visual change, document it in .storybook/non-visual-change.md.");
  process.exit(1);
}

console.log(`Storybook-first check passed (${runtimeUi.length} UI files, ${stories.length} story files).`);
