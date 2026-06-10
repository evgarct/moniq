import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOTS = ["app", "components", "features"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const EXCLUDED_FILE = /\.(stories|test|spec)\.[^.]+$/;

const RULES = [
  {
    name: "Use semantic warm-neutral tokens instead of copied hex values",
    pattern: /#(?:ece8e1|e6e1d9|f3efe9|f8f5f1)\b/gi,
  },
  {
    name: "Use Moniq radius tokens instead of generic Tailwind radii",
    pattern: /\brounded-(?:md|lg|xl|2xl|3xl)\b/g,
  },
  {
    name: "Do not introduce decorative glassmorphism in product UI",
    pattern: /\b(?:backdropFilter|WebkitBackdropFilter)\b|color-mix\([^)\n]*transparent/gi,
  },
];

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolutePath)));
      continue;
    }

    if (
      SOURCE_EXTENSIONS.has(path.extname(entry.name)) &&
      !EXCLUDED_FILE.test(entry.name)
    ) {
      files.push(absolutePath);
    }
  }

  return files;
}

const files = (
  await Promise.all(ROOTS.map((root) => collectFiles(path.resolve(root))))
).flat();
const violations = [];

for (const file of files) {
  const source = await readFile(file, "utf8");
  const lines = source.split(/\r?\n/);

  for (const rule of RULES) {
    for (let index = 0; index < lines.length; index += 1) {
      rule.pattern.lastIndex = 0;
      if (rule.pattern.test(lines[index])) {
        violations.push({
          file: path.relative(process.cwd(), file),
          line: index + 1,
          rule: rule.name,
        });
      }
    }
  }
}

if (violations.length > 0) {
  console.error("Design-system guard failed:\n");
  for (const violation of violations) {
    console.error(
      `- ${violation.file}:${violation.line} ${violation.rule}`,
    );
  }
  process.exit(1);
}

console.log(`Design-system guard passed (${files.length} runtime files checked).`);
