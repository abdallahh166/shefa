import { expect, test } from "@playwright/test";
import {
  createAnonClient,
  getStagingAuthConfig,
  signInStagingUser,
  skipWithoutStagingAuth,
} from "./helpers/config";
import { writeIncidentReplayPack } from "./helpers/incident-pack";

function expectDenied(error: { code?: string; message?: string } | null) {
  expect(error, "Expected Supabase request to be denied").toBeTruthy();
  expect([error?.code, error?.message].join(" ")).toMatch(/42501|permission denied|not authorized|forbidden|tenant mismatch|feature .* not enabled/i);
}

test.describe("staging RLS adversarial runtime", () => {
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      await writeIncidentReplayPack(page, testInfo);
    }
  });

  test("tenant-scoped RPCs reject explicit cross-tenant parameters", async () => {
    const config = getStagingAuthConfig();
    skipWithoutStagingAuth(config);
    test.skip(!config.foreignTenantId, "Set STAGING_FOREIGN_TENANT_ID to run cross-tenant RPC tampering probes.");

    const { client } = await signInStagingUser(config.adminEmail, config.adminPassword, config);

    const searchResult = await client.rpc("search_global", {
      _term: "Patient",
      _limit: 10,
      _tenant_id: config.foreignTenantId,
    });
    expectDenied(searchResult.error);

    const billingResult = await client.rpc("get_invoice_summary", {
      _tenant_id: config.foreignTenantId,
    });
    expectDenied(billingResult.error);

    const reportsResult = await client.rpc("get_report_overview", {
      _tenant_id: config.foreignTenantId,
    });
    expectDenied(reportsResult.error);
  });

  test("portal session cannot read foreign patient scope or main-app summaries", async () => {
    const config = getStagingAuthConfig();
    skipWithoutStagingAuth(config);
    test.skip(!config.portalEmail || !config.portalPassword, "Set STAGING_PORTAL_EMAIL and STAGING_PORTAL_PASSWORD.");
    test.skip(!config.foreignPatientId, "Set STAGING_FOREIGN_PATIENT_ID.");

    const { client } = await signInStagingUser(config.portalEmail, config.portalPassword, config);

    const foreignPatient = await client
      .from("patients")
      .select("id, full_name")
      .eq("id", config.foreignPatientId);
    expect(foreignPatient.error).toBeNull();
    expect(foreignPatient.data ?? []).toEqual([]);

    const billingSummary = await client.rpc("get_invoice_summary");
    expectDenied(billingSummary.error);
  });

  test("storage cross-tenant reads and signed URLs are denied", async () => {
    const config = getStagingAuthConfig();
    skipWithoutStagingAuth(config);
    test.skip(!config.storageBucket || !config.storageForeignPath, "Set STAGING_STORAGE_BUCKET and STAGING_STORAGE_FOREIGN_PATH.");

    const { client } = await signInStagingUser(config.adminEmail, config.adminPassword, config);
    const download = await client.storage.from(config.storageBucket).download(config.storageForeignPath);
    expect(download.data).toBeNull();
    expect(download.error).toBeTruthy();

    const signedUrl = await client.storage.from(config.storageBucket).createSignedUrl(config.storageForeignPath, 60);
    expect(signedUrl.data?.signedUrl ?? null).toBeNull();
    expect(signedUrl.error).toBeTruthy();
  });

  test("anonymous callers cannot use privileged RPCs", async () => {
    const config = getStagingAuthConfig();
    skipWithoutStagingAuth(config);

    const anon = createAnonClient(config);
    const result = await anon.rpc("get_invoice_summary");
    expectDenied(result.error);
  });
});
