import { defineConfig } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:5173";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  use: {
    baseURL,
    headless: true,
    trace: "on-first-retry",
  },
  retries: 1,
  reporter: [["list"]],
});
