import { expect, type Page } from "@playwright/test";
import { attachAdminSession, getStagingAuthConfig, tenantUrl } from "../helpers/config";
import {
  assertNoAuthenticatedUIWithoutSession,
  assertNoProtectedRequestsInSafeMode,
  assertSingleRecoveryInFlight,
} from "../helpers/runtime-invariants";

export async function runChurnScenario(page: Page, iterations: number) {
  const config = getStagingAuthConfig();
  await attachAdminSession(page, config);

  const paths = ["dashboard", "patients", "appointments", "billing", "reports"];
  for (let i = 0; i < iterations; i += 1) {
    const path = paths[i % paths.length];
    await page.goto(tenantUrl(config, path), { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(new RegExp(`/tenant/${config.clinicSlug}/`));
    await assertNoAuthenticatedUIWithoutSession(page);
    await assertNoProtectedRequestsInSafeMode(page);
    await assertSingleRecoveryInFlight(page);
  }
}
