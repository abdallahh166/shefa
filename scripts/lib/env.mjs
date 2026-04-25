import fs from "node:fs";
import path from "node:path";

function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

export function parseEnvFile(content) {
  const parsed = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!key) continue;

    parsed[key] = stripWrappingQuotes(value);
  }

  return parsed;
}

export function loadLocalEnv(
  cwd = process.cwd(),
  files = [".env", ".env.local", ".env.e2e", ".env.e2e.local"],
) {
  const merged = {};
  const loadedFiles = [];

  for (const file of files) {
    const filePath = path.resolve(cwd, file);
    if (!fs.existsSync(filePath)) continue;

    Object.assign(merged, parseEnvFile(fs.readFileSync(filePath, "utf8")));
    loadedFiles.push(filePath);
  }

  for (const [key, value] of Object.entries(merged)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return { values: merged, files: loadedFiles };
}
