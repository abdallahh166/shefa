import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "";
if (!dbUrl) {
  console.error("Missing SUPABASE_DB_URL (or DATABASE_URL).");
  console.error("Set it to your remote Postgres connection string before running.");
  process.exit(1);
}

const testsDir = fileURLToPath(new URL("../supabase/tests", import.meta.url));
if (!existsSync(testsDir)) {
  console.error(`Missing tests directory: ${testsDir}`);
  process.exit(1);
}

const versionCheck = spawnSync("psql", ["--version"], { stdio: "ignore" });
if (versionCheck.error) {
  console.error("psql is not available on PATH.");
  console.error("Install the PostgreSQL client tools to run remote DB tests.");
  process.exit(1);
}

const testFiles = readdirSync(testsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

if (testFiles.length === 0) {
  console.error("No SQL test files found in supabase/tests.");
  process.exit(1);
}

for (const file of testFiles) {
  const fullPath = join(testsDir, file);
  console.log(`Running ${file}...`);
  const result = spawnSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-f", fullPath], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("Remote DB tests completed.");
