import { expect, type Page } from "@playwright/test";
import { createChaosController } from "../helpers/chaos-controller";
import { getStagingAuthConfig, tenantUrl } from "../helpers/config";
import { assertNoAuthenticatedUIWithoutSession, assertSingleRecoveryInFlight } from "../helpers/runtime-invariants";

export async function runSleepWakeScenario(page: Page) {
  const config = getStagingAuthConfig();
  const chaos = createChaosController(page);

  await page.goto(tenantUrl(config, "dashboard"), { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(new RegExp(`/tenant/${config.clinicSlug}/`));

  await chaos.crashLeaderLease();
  await chaos.freezeMainThread(1_500);
  await page.reload({ waitUntil: "domcontentloaded" });

  await assertSingleRecoveryInFlight(page);
  await assertNoAuthenticatedUIWithoutSession(page);
}
