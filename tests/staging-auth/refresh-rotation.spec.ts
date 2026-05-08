import { expect, test } from "@playwright/test";
import { createChaosController } from "./helpers/chaos-controller";
import { attachAdminSession, getStagingAuthConfig, skipWithoutStagingAuth, tenantUrl } from "./helpers/config";
import { assertSingleRecoveryInFlight, installAuthMetricRecorder } from "./helpers/runtime-invariants";
import { writeIncidentReplayPack } from "./helpers/incident-pack";

test.describe("staging refresh-token rotation", () => {
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      await writeIncidentReplayPack(page, testInfo);
    }
  });

  test("near-expiry session refreshes with bounded token rotation", async ({ page }) => {
    const config = getStagingAuthConfig();
    skipWithoutStagingAuth(config);

    await installAuthMetricRecorder(page);
    const chaos = createChaosController(page);
    await chaos.delayRefreshEndpoint(500);
    const session = await attachAdminSession(page, config);

    await page.evaluate((nearExpirySession) => {
      window.localStorage.setItem("shefaa-auth", JSON.stringify({
        ...nearExpirySession,
        expires_at: Math.floor(Date.now() / 1000) + 2,
        expires_in: 2,
      }));
    }, session);

    const tokenRequests: number[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/auth/v1/token")) tokenRequests.push(Date.now());
    });

    for (const path of ["dashboard", "patients", "appointments", "billing"]) {
      await page.goto(tenantUrl(config, path), { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(new RegExp(`/tenant/${config.clinicSlug}/`));
    }

    await page.waitForTimeout(5_000);
    await assertSingleRecoveryInFlight(page);
    expect(tokenRequests.length).toBeLessThanOrEqual(3);
  });
});
