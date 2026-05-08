import { expect, test } from "@playwright/test";
import {
  attachSession,
  createServiceRoleClient,
  getStagingAuthConfig,
  signInStagingUser,
  skipWithoutStagingAuth,
  tenantUrl,
} from "./helpers/config";
import { writeIncidentReplayPack } from "./helpers/incident-pack";

test.describe("staging remote session revocation", () => {
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      await writeIncidentReplayPack(page, testInfo);
    }
  });

  test("revoked session becomes deterministic reauth_required without request replay storm", async ({ page }) => {
    const config = getStagingAuthConfig();
    skipWithoutStagingAuth(config);
    test.skip(!config.serviceRoleKey, "Set STAGING_SUPABASE_SERVICE_ROLE_KEY to revoke staging sessions.");

    const { session } = await signInStagingUser(config.adminEmail, config.adminPassword, config);
    await attachSession(page, session);
    await page.goto(tenantUrl(config, "dashboard"), { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(new RegExp(`/tenant/${config.clinicSlug}/`));

    const admin = createServiceRoleClient(config);
    const revoke = await admin.auth.admin.signOut(session.access_token);
    expect(revoke.error).toBeNull();

    await page.goto(tenantUrl(config, "patients"), { waitUntil: "domcontentloaded" });
    await expect.poll(
      () => page.evaluate(() => JSON.parse(window.localStorage.getItem("medflow-auth") ?? "{}").state?.authMachineState ?? null),
      { timeout: 45_000 },
    ).toBe("reauth_required");
  });
});
