import crypto from "node:crypto";
import { expect, test } from "@playwright/test";

import { getClinicConfig, prepareEnglishSession } from "./helpers/clinic";
import {
  clearSuperAdminPrivilegedState,
  createAal2SuperAdminClient,
  expireStepUpGrant,
  generateStableTotp,
  getTenantBySlug,
  issueSuperAdminGrant,
  prepareVerifiedSuperAdminMfa,
  startImpersonationRpc,
  stopImpersonationRpc,
} from "./helpers/privileged";
import { getSuperAdminConfig, hasSuperAdminConfig } from "./helpers/superAdmin";

function getRpcRow<T>(data: T | T[] | null) {
  if (Array.isArray(data)) {
    return data[0] ?? null;
  }

  return data;
}

async function submitSuperAdminLogin(page: Parameters<typeof prepareEnglishSession>[0], email: string, password: string) {
  await prepareEnglishSession(page);
  await page.goto("/login");
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await page.waitForLoadState("networkidle");
}

test.describe.serial("privileged security", () => {
  const superAdminConfig = getSuperAdminConfig();
  const clinicConfig = getClinicConfig();

  test.beforeEach(async () => {
    test.skip(
      !hasSuperAdminConfig(superAdminConfig) || !clinicConfig.clinicSlug,
      "Privileged E2E credentials are not configured",
    );
    await clearSuperAdminPrivilegedState(superAdminConfig);
  });

  test.afterEach(async () => {
    await clearSuperAdminPrivilegedState(superAdminConfig);
  });

  test("enrolls MFA and unlocks privileged routes", async ({ page }) => {
    await submitSuperAdminLogin(page, superAdminConfig.email!, superAdminConfig.password!);

    await expect(page).toHaveURL(/\/security\/privileged$/, { timeout: 30_000 });
    await expect(page.getByTestId("privileged-mfa-start-enrollment")).toBeVisible({ timeout: 30_000 });

    await page.getByTestId("privileged-mfa-start-enrollment").click();
    const secret = (await page.getByTestId("privileged-mfa-secret").innerText()).trim();
    await page.getByTestId("privileged-mfa-enrollment-code").fill(await generateStableTotp(secret));
    await page.getByTestId("privileged-mfa-enrollment-verify").click();

    await expect(page.getByText("Privileged access ready")).toBeVisible({ timeout: 30_000 });
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin$/, { timeout: 30_000 });
    await expect(page.getByTestId("admin-tab-overview")).toBeVisible({ timeout: 30_000 });
  });

  test("blocks an aal1 privileged login until the enrolled factor verifies the session", async ({ page }) => {
    const { factorId, secret } = await prepareVerifiedSuperAdminMfa(superAdminConfig);

    await submitSuperAdminLogin(page, superAdminConfig.email!, superAdminConfig.password!);

    await expect(page).toHaveURL(/\/security\/privileged$/, { timeout: 30_000 });
    await expect(page.getByTestId(`privileged-mfa-session-start-${factorId}`)).toBeVisible({ timeout: 30_000 });

    await page.getByTestId(`privileged-mfa-session-start-${factorId}`).click();
    await page.getByTestId("privileged-mfa-session-code").fill(await generateStableTotp(secret));
    await page.getByTestId("privileged-mfa-session-verify").click();

    await expect(page.getByText("Privileged access ready")).toBeVisible({ timeout: 30_000 });
    await page.goto("/admin");
    await expect(page.getByTestId("admin-tab-overview")).toBeVisible({ timeout: 30_000 });
  });

  test("rejects a sensitive RPC when the step-up grant is missing", async () => {
    const { client } = await createAal2SuperAdminClient(superAdminConfig);
    const tenant = await getTenantBySlug(clinicConfig.clinicSlug!);

    const result = await startImpersonationRpc(client, {
      tenantId: tenant.id,
      requestId: crypto.randomUUID(),
      stepUpGrantId: null,
    });

    expect(result.error?.message).toContain("Valid privileged step-up grant required");
    await client.auth.signOut();
  });

  test("rejects a replayed single-use step-up grant", async () => {
    const { client } = await createAal2SuperAdminClient(superAdminConfig);
    const tenant = await getTenantBySlug(clinicConfig.clinicSlug!);
    const requestId = crypto.randomUUID();
    const grantId = await issueSuperAdminGrant(client, {
      actionKey: "tenant_impersonation_start",
      tenantId: tenant.id,
      resourceId: tenant.id,
      requestId,
    });

    const firstResult = await startImpersonationRpc(client, {
      tenantId: tenant.id,
      requestId,
      stepUpGrantId: grantId,
    });
    expect(firstResult.error).toBeNull();
    expect(getRpcRow(firstResult.data)).toBeTruthy();

    const replayResult = await startImpersonationRpc(client, {
      tenantId: tenant.id,
      requestId: crypto.randomUUID(),
      stepUpGrantId: grantId,
    });
    expect(replayResult.error?.message).toContain("Valid privileged step-up grant required");
    await client.auth.signOut();
  });

  test("rejects an expired step-up grant", async () => {
    const { client } = await createAal2SuperAdminClient(superAdminConfig);
    const tenant = await getTenantBySlug(clinicConfig.clinicSlug!);
    const grantId = await issueSuperAdminGrant(client, {
      actionKey: "tenant_impersonation_start",
      tenantId: tenant.id,
      resourceId: tenant.id,
      requestId: crypto.randomUUID(),
    });

    await expireStepUpGrant(grantId);

    const result = await startImpersonationRpc(client, {
      tenantId: tenant.id,
      requestId: crypto.randomUUID(),
      stepUpGrantId: grantId,
    });

    expect(result.error?.message).toContain("Valid privileged step-up grant required");
    await client.auth.signOut();
  });

  test("allows one active impersonation session per actor and cleanly ends it", async () => {
    const { client } = await createAal2SuperAdminClient(superAdminConfig);
    const tenant = await getTenantBySlug(clinicConfig.clinicSlug!);
    const firstRequestId = crypto.randomUUID();
    const firstGrantId = await issueSuperAdminGrant(client, {
      actionKey: "tenant_impersonation_start",
      tenantId: tenant.id,
      resourceId: tenant.id,
      requestId: firstRequestId,
    });

    const startResult = await startImpersonationRpc(client, {
      tenantId: tenant.id,
      requestId: firstRequestId,
      stepUpGrantId: firstGrantId,
    });
    expect(startResult.error).toBeNull();
    const startedSession = getRpcRow(startResult.data);
    expect(startedSession).toBeTruthy();

    const secondGrantId = await issueSuperAdminGrant(client, {
      actionKey: "tenant_impersonation_start",
      tenantId: tenant.id,
      resourceId: tenant.id,
      requestId: crypto.randomUUID(),
    });
    const secondStartResult = await startImpersonationRpc(client, {
      tenantId: tenant.id,
      requestId: crypto.randomUUID(),
      stepUpGrantId: secondGrantId,
    });
    expect(secondStartResult.error?.message).toContain("Only one active impersonation session is allowed per actor");

    const stopGrantId = await issueSuperAdminGrant(client, {
      actionKey: "tenant_impersonation_end",
      tenantId: tenant.id,
      resourceId: tenant.id,
      requestId: firstRequestId,
    });
    const stopResult = await stopImpersonationRpc(client, {
      requestId: firstRequestId,
      stepUpGrantId: stopGrantId,
    });

    expect(stopResult.error).toBeNull();
    const stoppedSession = getRpcRow(stopResult.data);
    expect(stoppedSession).toBeTruthy();
    expect((stoppedSession as { request_id?: string } | null)?.request_id).toBe(firstRequestId);
    await client.auth.signOut();
  });
});
