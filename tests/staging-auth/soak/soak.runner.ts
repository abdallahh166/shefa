import { expect, test } from "@playwright/test";
import { collectBrowserAuthMetrics, getStagingAuthConfig, skipWithoutStagingAuth } from "../helpers/config";
import { writeIncidentReplayPack } from "../helpers/incident-pack";
import { installAuthMetricRecorder } from "../helpers/runtime-invariants";
import { runChurnScenario } from "./churn.scenario";
import { runSleepWakeScenario } from "./sleepwake.scenario";

test.describe("staging auth soak runner", () => {
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      await writeIncidentReplayPack(page, testInfo);
    }
  });

  test("runs prolonged auth churn without queue overflow or stale-principal signals", async ({ page }) => {
    const config = getStagingAuthConfig();
    skipWithoutStagingAuth(config);
    test.skip(
      process.env.STAGING_AUTH_SOAK === "1" ? false : true,
      "Set STAGING_AUTH_SOAK=1 for the long-running staging soak.",
    );

    await installAuthMetricRecorder(page);
    const metrics = await collectBrowserAuthMetrics(page);
    const started = Date.now();
    const durationMs = Number(process.env.STAGING_AUTH_SOAK_MS ?? 12 * 60 * 60 * 1000);
    const maxIterations = Number(process.env.STAGING_AUTH_SOAK_MAX_ITERATIONS ?? 10_000);
    let iterations = 0;

    while (Date.now() - started < durationMs && iterations < maxIterations) {
      await runChurnScenario(page, 5);
      await runSleepWakeScenario(page);
      iterations += 1;
    }

    expect(iterations).toBeGreaterThan(0);
    expect(metrics.filter((metric) => metric.name === "auth_queue_overflow")).toHaveLength(0);
    expect(metrics.filter((metric) => metric.name === "session_drift_detected")).toHaveLength(0);
    expect(metrics.filter((metric) => metric.name === "auth_refresh_storm_detected")).toHaveLength(0);
  });
});
