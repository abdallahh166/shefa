import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Page, TestInfo } from "@playwright/test";
import { readRuntimeInvariantReport } from "./runtime-invariants";

export async function writeIncidentReplayPack(
  page: Page,
  testInfo: TestInfo,
  context: Record<string, unknown> = {},
) {
  const outputDir = testInfo.outputPath("incident-replay-pack");
  await mkdir(outputDir, { recursive: true });

  const [invariants, browserState, url, events] = await Promise.all([
    readRuntimeInvariantReport(page).catch((error) => ({ error: error instanceof Error ? error.message : String(error) })),
    page.evaluate(() => ({
      appAuth: window.localStorage.getItem("medflow-auth"),
      supabaseSessionPresent: Boolean(window.localStorage.getItem("shefaa-auth")),
      leaderLease: window.localStorage.getItem("shefaa_auth_leader_lease"),
      location: window.location.href,
    })).catch((error) => ({ error: error instanceof Error ? error.message : String(error) })),
    Promise.resolve(page.url()),
    page.evaluate(() => {
      const w = window as unknown as { __SHEFAA_STAGING_AUTH_EVENTS__?: Array<{ name: string; at: number }> };
      return w.__SHEFAA_STAGING_AUTH_EVENTS__ ?? [];
    }).catch(() => []),
  ]);

  const pack = {
    capturedAt: new Date().toISOString(),
    test: testInfo.titlePath(),
    status: testInfo.status,
    url,
    context,
    invariants,
    browserState,
    events,
  };

  const filePath = path.join(outputDir, "auth-incident-replay-pack.json");
  await writeFile(filePath, JSON.stringify(pack, null, 2), "utf8");
  await testInfo.attach("auth-incident-replay-pack", {
    path: filePath,
    contentType: "application/json",
  });
}
