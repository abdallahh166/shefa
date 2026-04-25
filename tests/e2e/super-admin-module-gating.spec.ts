import { expect, test } from "@playwright/test";

import { getClinicConfig, hasClinicConfig, loginToClinic } from "./helpers/clinic";
import {
  findAdminTableRow,
  getSuperAdminConfig,
  hasSuperAdminConfig,
  loginToSuperAdmin,
  openAdminTab,
} from "./helpers/superAdmin";

function extractPlanCode(text: string) {
  const match = text.match(/\b(free|starter|pro|enterprise)\b/i);
  return match?.[1]?.toLowerCase() ?? null;
}

test.describe("super admin module gating", () => {
  test("disables reports for a tenant and blocks direct clinic access", async ({ browser, page, baseURL }) => {
    const superAdminConfig = getSuperAdminConfig();
    const clinicConfig = getClinicConfig();
    test.skip(
      !hasSuperAdminConfig(superAdminConfig) || !hasClinicConfig(clinicConfig),
      "Super admin and clinic E2E credentials are not configured",
    );

    await loginToSuperAdmin(page, superAdminConfig);
    await openAdminTab(page, "subscriptions");

    const subscriptionRow = await findAdminTableRow(
      page,
      clinicConfig.clinicName ?? clinicConfig.clinicSlug!,
      clinicConfig.clinicName ?? clinicConfig.clinicSlug!,
    );
    const planCode = extractPlanCode(await subscriptionRow.innerText());
    test.skip(planCode === "free" || !planCode, "Reports gating E2E requires a paid clinic plan");

    await openAdminTab(page, "clinics");
    const clinicRow = await findAdminTableRow(page, clinicConfig.clinicSlug!);
    await clinicRow.getByRole("button", { name: "Manage modules" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 30_000 });

    const reportsSwitch = dialog.getByTestId("tenant-module-toggle-advanced_reports");
    await expect(reportsSwitch).toBeVisible({ timeout: 30_000 });
    await expect(reportsSwitch).toBeEnabled({ timeout: 30_000 });

    const originalEnabled = (await reportsSwitch.getAttribute("aria-checked")) === "true";

    try {
      if (!originalEnabled) {
        await reportsSwitch.click();
        await expect(reportsSwitch).toBeEnabled({ timeout: 30_000 });
        await expect(reportsSwitch).toHaveAttribute("aria-checked", "true");
      }

      await reportsSwitch.click();
      await expect(reportsSwitch).toHaveAttribute("aria-checked", "false");

      const clinicContext = await browser.newContext({ baseURL });
      const clinicPage = await clinicContext.newPage();
      await loginToClinic(clinicPage, clinicConfig);
      await clinicPage.goto(`/tenant/${clinicConfig.clinicSlug}/reports`);

      await expect(clinicPage.getByText("Feature Unavailable")).toBeVisible({ timeout: 30_000 });
      await clinicContext.close();
    } finally {
      const currentEnabled = (await reportsSwitch.getAttribute("aria-checked")) === "true";
      if (currentEnabled !== originalEnabled) {
        await expect(reportsSwitch).toBeEnabled({ timeout: 30_000 });
        await reportsSwitch.click();
        await expect(reportsSwitch).toHaveAttribute("aria-checked", originalEnabled ? "true" : "false");
      }
    }
  });
});
