import { defineConfig } from "@playwright/test";
import { loadLocalEnv } from "./scripts/lib/env.mjs";

loadLocalEnv(process.cwd());

const baseURL = process.env.STAGING_BASE_URL ?? process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "tests/staging-auth",
  testMatch: /.*\.(spec|runner)\.ts/,
  timeout: 90_000,
  expect: {
    timeout: 30_000,
  },
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    headless: true,
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: process.env.STAGING_BASE_URL || process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev -- --host 127.0.0.1 --port 4173",
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
