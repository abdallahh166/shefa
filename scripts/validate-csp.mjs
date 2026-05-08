import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const targets = [
  path.join(repoRoot, "vite.config.ts"),
  path.join(repoRoot, "docs", "production-hardening.md"),
  path.join(repoRoot, "docs", "ops", "staging-production-validation.md"),
];

const allowedUnsafeInlineFiles = new Set([
  path.join(repoRoot, "vite.config.ts"),
  path.join(repoRoot, "docs", "production-hardening.md"),
]);

const failures = [];

for (const file of targets) {
  const text = await readFile(file, "utf8");
  const hasWildcardConnect = /connect-src[^;\n]*\*/i.test(text);
  const hasWildcardScript = /script-src[^;\n]*\*/i.test(text);
  const hasUnsafeEval = /'unsafe-eval'/i.test(text);
  const hasUnsafeInline = /'unsafe-inline'/i.test(text);

  if (hasWildcardConnect) failures.push(`${path.relative(repoRoot, file)} uses wildcard connect-src`);
  if (hasWildcardScript) failures.push(`${path.relative(repoRoot, file)} uses wildcard script-src`);
  if (hasUnsafeEval) failures.push(`${path.relative(repoRoot, file)} uses unsafe-eval`);
  if (hasUnsafeInline && !allowedUnsafeInlineFiles.has(file)) {
    failures.push(`${path.relative(repoRoot, file)} introduces unsafe-inline outside the approved style-src exception`);
  }
}

if (failures.length > 0) {
  console.error("CSP validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("CSP validation passed.");
