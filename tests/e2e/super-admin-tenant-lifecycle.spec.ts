import { expect, test } from "@playwright/test";

import { getClinicConfig, hasClinicConfig, loginToClinic, submitClinicLogin } from "./helpers/clinic";
import {
  findAdminTableRow,
  getSuperAdminConfig,
  hasSuperAdminConfig,
  loginToSuperAdmin,
  openAdminTab,
} from "./helpers/superAdmin";

test.describe("super admin tenant lifecycle", () => {
  test("suspends and reactivates a clinic without leaving staff locked out", async ({ browser, page, baseURL }) => {
    const superAdminConfig = getSuperAdminConfig();
    const clinicConfig = getClinicConfig();
    test.skip(
      !hasSuperAdminConfig(superAdminConfig) || !hasClinicConfig(clinicConfig),
      "Super admin and clinic E2E credentials are not configured",
    );

    await loginToSuperAdmin(page, superAdminConfig);
    await openAdminTab(page, "clinics");

    let clinicRow = await findAdminTableRow(page, clinicConfig.clinicSlug!, clinicConfig.clinicName ?? clinicConfig.clinicSlug!);
    const reactivateButton = clinicRow.getByRole("button", { name: "Reactivate clinic" });
    if (await reactivateButton.isVisible().catch(() => false)) {
      await reactivateButton.click();

      const baselineDialog = page.getByRole("dialog");
      await expect(baselineDialog).toBeVisible({ timeout: 30_000 });
      await baselineDialog.getByLabel("Reason").fill("E2E baseline reset");
      await baselineDialog.getByRole("button", { name: "Reactivate tenant" }).click();
      await expect(baselineDialog).not.toBeVisible({ timeout: 30_000 });

      clinicRow = await findAdminTableRow(page, clinicConfig.clinicSlug!, clinicConfig.clinicName ?? clinicConfig.clinicSlug!);
    }

    await clinicRow.getByRole("button", { name: "Suspend clinic" }).click();

    const suspendDialog = page.getByRole("dialog");
    await expect(suspendDialog).toBeVisible({ timeout: 30_000 });
    await suspendDialog.getByLabel("Reason").fill("E2E suspension verification");
    await suspendDialog.getByRole("button", { name: "Suspend tenant" }).click();
    await expect(suspendDialog).not.toBeVisible({ timeout: 30_000 });

    const suspendedClinicContext = await browser.newContext({ baseURL });
    const suspendedClinicPage = await suspendedClinicContext.newPage();
    await submitClinicLogin(suspendedClinicPage, clinicConfig);
    await expect(
      suspendedClinicPage
        .getByText(/Clinic Access Blocked|suspended or deactivated/i)
        .first(),
    ).toBeVisible({ timeout: 30_000 });
    await suspendedClinicContext.close();

    const suspendedRow = await findAdminTableRow(page, clinicConfig.clinicSlug!, clinicConfig.clinicName ?? clinicConfig.clinicSlug!);
    await suspendedRow.getByRole("button", { name: "Reactivate clinic" }).click();

    const reactivateDialog = page.getByRole("dialog");
    await expect(reactivateDialog).toBeVisible({ timeout: 30_000 });
    await reactivateDialog.getByLabel("Reason").fill("E2E reactivation verification");
    await reactivateDialog.getByRole("button", { name: "Reactivate tenant" }).click();
    await expect(reactivateDialog).not.toBeVisible({ timeout: 30_000 });

    const reactivatedClinicContext = await browser.newContext({ baseURL });
    const reactivatedClinicPage = await reactivatedClinicContext.newPage();
    await loginToClinic(reactivatedClinicPage, clinicConfig);
    await expect(reactivatedClinicPage).toHaveURL(new RegExp(`/tenant/${clinicConfig.clinicSlug}/dashboard`), {
      timeout: 30_000,
    });
    await expect(reactivatedClinicPage.getByRole("heading", { name: "Dashboard" })).toBeVisible({ timeout: 30_000 });
    await reactivatedClinicContext.close();
  });
});
