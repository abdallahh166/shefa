import { expect, test } from "@playwright/test";
import { createChaosController } from "./helpers/chaos-controller";
import {
  attachAdminSession,
  collectBrowserAuthMetrics,
  getStagingAuthConfig,
  skipWithoutStagingAuth,
  tenantUrl,
} from "./helpers/config";
import {
  assertNoAuthenticatedUIWithoutSession,
  assertNoProtectedRequestsInSafeMode,
  assertSingleRecoveryInFlight,
  installAuthMetricRecorder,
} from "./helpers/runtime-invariants";
import { writeIncidentReplayPack } from "./helpers/incident-pack";

test.describe("staging auth lifecycle", () => {
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      await writeIncidentReplayPack(page, testInfo);
    }
  });

  test("recovers once from expired-token request bursts without stale UI", async ({ page }) => {
    const config = getStagingAuthConfig();
    skipWithoutStagingAuth(config);

    await installAuthMetricRecorder(page);
    const metrics = await collectBrowserAuthMetrics(page);
    const chaos = createChaosController(page);
    await chaos.delayRefreshEndpoint(750);
    await attachAdminSession(page, config);

    const tokenResponses: number[] = [];
    page.on("response", (response) => {
      if (response.url().includes("/auth/v1/token")) tokenResponses.push(response.status());
    });

    await page.goto(tenantUrl(config, "dashboard"), { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(new RegExp(`/tenant/${config.clinicSlug}/`));

    await page.evaluate(() => {
      const raw = window.localStorage.getItem("shefaa-auth");
      if (!raw) throw new Error("Missing Supabase session storage");
      const session = JSON.parse(raw);
      session.expires_at = Math.floor(Date.now() / 1000) - 30;
      session.expires_in = -30;
      window.localStorage.setItem("shefaa-auth", JSON.stringify(session));
    });

    await Promise.all([
      page.goto(tenantUrl(config, "patients"), { waitUntil: "domcontentloaded" }),
      page.waitForResponse((response) => response.url().includes("/rest/v1/") || response.url().includes("/auth/v1/token"), {
        timeout: 30_000,
      }).catch(() => undefined),
    ]);
    await page.goto(tenantUrl(config, "appointments"), { waitUntil: "domcontentloaded" });

    await assertSingleRecoveryInFlight(page);
    await assertNoAuthenticatedUIWithoutSession(page);
    await assertNoProtectedRequestsInSafeMode(page);
    expect(metrics.filter((metric) => metric.name === "auth_queue_overflow")).toHaveLength(0);
    expect(tokenResponses.length).toBeLessThanOrEqual(3);
  });

  test("kill switch moves active tabs to safe auth state", async ({ page }) => {
    const config = getStagingAuthConfig();
    skipWithoutStagingAuth(config);
    test.skip(
      process.env.STAGING_EXPECT_AUTH_KILL_SWITCH !== "1",
      "Deploy staging with VITE_AUTH_KILL_SWITCH=1 and set STAGING_EXPECT_AUTH_KILL_SWITCH=1 to validate the live kill switch.",
    );

    await attachAdminSession(page, config);

    await page.goto(tenantUrl(config, "dashboard"), { waitUntil: "domcontentloaded" });
    await expect.poll(
      () => page.evaluate(() => JSON.parse(window.localStorage.getItem("medflow-auth") ?? "{}").state?.authMachineState ?? null),
      { timeout: 30_000 },
    ).toBe("reauth_required");
  });
});
