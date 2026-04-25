import { defineConfig } from "@playwright/test";
import { loadLocalEnv } from "./scripts/lib/env.mjs";

loadLocalEnv(process.cwd());
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL,
    headless: true,
    trace: "on-first-retry",
  },
  retries: 1,
  reporter: [["list"]],
      webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev -- --host 127.0.0.1 --port 4173",
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
