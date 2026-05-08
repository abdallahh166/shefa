import { expect, test } from "@playwright/test";
import { attachAdminSession, getStagingAuthConfig, signInStagingUser, skipWithoutStagingAuth, tenantUrl } from "./helpers/config";
import {
  assertNoAuthenticatedUIWithoutSession,
  assertNoCrossPrincipalCache,
  installAuthMetricRecorder,
  readRuntimeInvariantReport,
} from "./helpers/runtime-invariants";
import { writeIncidentReplayPack } from "./helpers/incident-pack";

test.describe("staging tenant and principal switching", () => {
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      await writeIncidentReplayPack(page, testInfo);
    }
  });

  test("principal change clears previous scoped cache and does not reuse stale query state", async ({ page }) => {
    const config = getStagingAuthConfig();
    skipWithoutStagingAuth(config);
    test.skip(
      !config.secondaryAdminEmail || !config.secondaryAdminPassword || !config.secondaryClinicSlug,
      "Set STAGING_SECONDARY_ADMIN_EMAIL, STAGING_SECONDARY_ADMIN_PASSWORD, and STAGING_SECONDARY_CLINIC_SLUG.",
    );

    await installAuthMetricRecorder(page);
    await attachAdminSession(page, config);
    await page.goto(tenantUrl(config, "patients"), { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(new RegExp(`/tenant/${config.clinicSlug}/`));

    const initial = await readRuntimeInvariantReport(page);
    test.skip(!initial.appUserId || !initial.appTenantId, "Primary staging user did not hydrate tenant auth state.");

    await page.evaluate(({ tenantId, userId }) => {
      window.localStorage.setItem(`shefaa-cache:${tenantId}:${userId}:patients`, "stale-primary");
      window.localStorage.setItem(`lang:${tenantId}:${userId}`, "en");
    }, { tenantId: initial.appTenantId, userId: initial.appUserId });

    const secondary = await signInStagingUser(config.secondaryAdminEmail!, config.secondaryAdminPassword!, config);
    await page.evaluate(({ key, value }) => {
      window.localStorage.setItem(key, value);
    }, { key: "shefaa-auth", value: JSON.stringify(secondary.session) });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.goto(`/tenant/${config.secondaryClinicSlug}/dashboard`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(new RegExp(`/tenant/${config.secondaryClinicSlug}/`));

    await assertNoCrossPrincipalCache(page);
    await assertNoAuthenticatedUIWithoutSession(page);
  });
});
