import { expect, test } from "@playwright/test";
import {
  getPortalConfig,
  hasPortalInviteConfig,
  hasPortalScopeProbeConfig,
  requestPortalMagicLink,
  probePortalPatientScope,
} from "./helpers/portal";
import { prepareEnglishSession } from "./helpers/clinic";

test.describe("portal auth and scope", () => {
  test("allows invited portal login requests and blocks uninvited emails", async ({ page }) => {
    const config = getPortalConfig();

    test.skip(
      !hasPortalInviteConfig(config),
      "Set E2E_PORTAL_EMAIL and E2E_PORTAL_CLINIC_SLUG (or E2E_CLINIC_SLUG) to run portal invite coverage.",
    );

    await prepareEnglishSession(page);
    await page.goto(`/portal/${config.clinicSlug}/appointments`);
    await expect(page).toHaveURL(new RegExp(`/portal/${config.clinicSlug}/login$`));

    await requestPortalMagicLink(page, config, config.email);
    await expect(page.getByTestId("portal-login-success")).toContainText("Check your email");

    await requestPortalMagicLink(page, config, config.uninvitedEmail);
    await expect(page.getByTestId("portal-login-error")).toContainText("No portal invite found");
  });

  test("shows the authenticated portal user only their own patient scope", async ({ page }) => {
    const config = getPortalConfig();

    test.skip(
      !hasPortalScopeProbeConfig(config),
      "Set portal session credentials plus admin credentials (or E2E_PORTAL_FOREIGN_PATIENT_ID) to run scope coverage.",
    );

    await prepareEnglishSession(page);
    await page.goto(`/portal/${config.clinicSlug}/login`);
    await expect(page.getByTestId("portal-login-page")).toBeVisible();

    const scope = await probePortalPatientScope(config);
    expect(scope.ownPatientRows).toHaveLength(1);
    expect(scope.ownPatientRows[0]?.id).toBe(scope.ownPatientId);
    expect(scope.foreignPatientRows).toEqual([]);
  });
});
