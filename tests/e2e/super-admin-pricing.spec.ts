import { expect, test } from "@playwright/test";

import {
  getTenantSubscriptionBySlug,
  getSuperAdminConfig,
  hasSuperAdminConfig,
  loginToSuperAdmin,
  openAdminTab,
  updatePricingPlanViaApi,
} from "./helpers/superAdmin";
import { getClinicConfig, hasClinicConfig } from "./helpers/clinic";

test.describe("super admin pricing", () => {
  test("updates a live pricing plan and syncs subscription-facing values", async ({ page }) => {
    test.setTimeout(180_000);
    const superAdminConfig = getSuperAdminConfig();
    const clinicConfig = getClinicConfig();
    test.skip(
      !hasSuperAdminConfig(superAdminConfig) || !hasClinicConfig(clinicConfig),
      "Super admin and clinic E2E credentials are not configured",
    );

    await loginToSuperAdmin(page, superAdminConfig);
    const planCode = "starter";
    const targetFieldId = "pricing-plan-monthly";
    const originalSubscription = await getTenantSubscriptionBySlug(superAdminConfig, clinicConfig.clinicSlug!);

    await openAdminTab(page, "pricing");
    await page.getByTestId(`admin-pricing-edit-${planCode}`).click();

    const dialog = page.getByRole("dialog");
    const field = dialog.locator(`#${targetFieldId}`);
    await expect(field).toBeVisible({ timeout: 30_000 });

    const originalFieldValue = await field.inputValue();
    const nextFieldValue = String(Number(originalFieldValue || 0) + 7);

    try {
      await field.fill(nextFieldValue);
      await expect(field).toHaveValue(nextFieldValue, { timeout: 30_000 });
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible({ timeout: 30_000 });

      await updatePricingPlanViaApi(superAdminConfig, planCode as "starter", {
        monthly_price: Number(nextFieldValue),
      });

      await page.goto("/pricing");
      await expect(page.getByTestId(`pricing-card-${planCode}`)).toContainText(nextFieldValue, { timeout: 30_000 });

      await expect
        .poll(async () => {
          const updatedSubscription = await getTenantSubscriptionBySlug(superAdminConfig, clinicConfig.clinicSlug!);
          return Number(updatedSubscription.amount);
        }, { timeout: 30_000 })
        .toBe(Number(nextFieldValue));
    } finally {
      await updatePricingPlanViaApi(superAdminConfig, planCode as "starter", {
        monthly_price: Number(originalFieldValue),
      });

      await expect
        .poll(async () => {
          const restoredSubscription = await getTenantSubscriptionBySlug(superAdminConfig, clinicConfig.clinicSlug!);
          return Number(restoredSubscription.amount);
        }, { timeout: 30_000 })
        .toBe(Number(originalSubscription.amount));
    }
  });
});
