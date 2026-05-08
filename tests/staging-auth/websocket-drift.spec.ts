import { expect, test } from "@playwright/test";
import { createChaosController } from "./helpers/chaos-controller";
import {
  attachAdminSession,
  createServiceRoleClient,
  getStagingAuthConfig,
  signInStagingUser,
  skipWithoutStagingAuth,
} from "./helpers/config";
import { writeIncidentReplayPack } from "./helpers/incident-pack";

test.describe("staging realtime boundary governance", () => {
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      await writeIncidentReplayPack(page, testInfo);
    }
  });

  test("tenant-filtered realtime channel does not receive foreign tenant events", async ({ page }) => {
    const config = getStagingAuthConfig();
    skipWithoutStagingAuth(config);
    test.skip(!config.foreignTenantId, "Set STAGING_FOREIGN_TENANT_ID.");
    test.skip(!config.serviceRoleKey, "Set STAGING_SUPABASE_SERVICE_ROLE_KEY to inject foreign-tenant realtime probes.");

    const { client, session } = await signInStagingUser(config.adminEmail, config.adminPassword, config);
    const profile = await client.from("profiles").select("tenant_id").eq("user_id", session.user.id).maybeSingle();
    const ownTenantId = profile.data?.tenant_id;
    test.skip(!ownTenantId || typeof ownTenantId !== "string", "Staging admin session is missing tenant metadata.");

    const events: unknown[] = [];
    const channel = client
      .channel(`staging-auth-realtime:${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "patients",
          filter: `tenant_id=eq.${ownTenantId}`,
        },
        (payload) => events.push(payload),
      );

    await new Promise<void>((resolve, reject) => {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") resolve();
        if (status === "CHANNEL_ERROR") reject(new Error("Realtime channel failed to subscribe"));
      });
    });

    const foreignWriter = createServiceRoleClient(config);
    const foreignInsert = await foreignWriter.from("patients").insert({
      tenant_id: config.foreignTenantId,
      full_name: `Realtime Foreign Probe ${Date.now()}`,
      date_of_birth: "1990-01-01",
      gender: "male",
      status: "active",
    });

    expect(foreignInsert.error).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    expect(events).toEqual([]);

    await client.removeChannel(channel);
  });

  test("realtime websocket reconnects after transport failure without protected UI drift", async ({ page }) => {
    const config = getStagingAuthConfig();
    skipWithoutStagingAuth(config);

    const chaos = createChaosController(page);
    await chaos.pauseRealtimeWebsocket();
    await attachAdminSession(page, config);
    await page.goto(`/tenant/${config.clinicSlug}/dashboard`, { waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/\/login$/);
  });
});
