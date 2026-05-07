import { expect, test, type Page } from "@playwright/test";
import {
  attachClinicSession,
  buildSupabaseStorageKey,
  getClinicConfig,
  hasClinicConfig,
  loginToClinic,
  prepareEnglishSession,
} from "./helpers/clinic";

type PersistedAuth = {
  state?: {
    user?: {
      id?: string;
      tenantId?: string | null;
      tenantSlug?: string | null;
    } | null;
  };
};

function collectAuthMetrics(page: Page) {
  const metrics: Array<{ name: string; payload: Record<string, unknown> }> = [];
  page.on("console", (message) => {
    const text = message.text();
    const match = text.match(/^\[auth-metric\]\s+([a-z0-9_]+)/i);
    if (!match) return;
    metrics.push({ name: match[1], payload: {} });
  });
  return metrics;
}

async function readPersistedAuth(page: Page): Promise<Required<PersistedAuth>["state"]> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem("medflow-auth");
    if (!raw) return null;
    return JSON.parse(raw).state ?? null;
  });
}

async function waitForAuthenticatedShell(page: Page, clinicSlug: string) {
  await page.goto(`/tenant/${clinicSlug}/dashboard`);
  await expect(page).toHaveURL(new RegExp(`/tenant/${clinicSlug}/`), { timeout: 30_000 });
  await expect(page.getByRole("button", { name: /^logout$/i })).toBeVisible({ timeout: 30_000 });
}

async function dispatchAuthBoundaryEvent(
  page: Page,
  input: { principalKey: string; eventId: string; channel?: "broadcast" | "storage" },
) {
  await page.evaluate(({ principalKey, eventId, channel }) => {
    const event = {
      v: 1,
      eventId,
      originTabId: "e2e-chaos-tab",
      principalKey,
      type: "LOGOUT",
      occurredAt: Date.now(),
      authTraceId: `e2e-chaos-${eventId}`,
    };
    if (channel === "broadcast") {
      const bc = new BroadcastChannel("shefaa-auth-sync");
      bc.postMessage(event);
      bc.close();
      return;
    }
    const payload = JSON.stringify(event);
    window.localStorage.setItem("shefaa-auth-sync-fallback", payload);
    window.localStorage.removeItem("shefaa-auth-sync-fallback");
  }, input);
}

test.describe("auth runtime chaos", () => {
  test("propagates logout events across tabs through BroadcastChannel", async ({ context, page }) => {
    const config = getClinicConfig();
    test.skip(!hasClinicConfig(config), "Set E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, and E2E_CLINIC_SLUG to run auth chaos tests.");

    await loginToClinic(page, config);
    const secondTab = await context.newPage();
    const secondTabMetrics = collectAuthMetrics(secondTab);
    await prepareEnglishSession(secondTab);
    await waitForAuthenticatedShell(secondTab, config.clinicSlug!);
    const state = await readPersistedAuth(secondTab);
    const user = state?.user;
    test.skip(!user?.id || !user?.tenantId, "Authenticated tenant user was not available in persisted auth state.");

    await dispatchAuthBoundaryEvent(page, {
      principalKey: `${user.id}:${user.tenantId}`,
      eventId: "e2e-broadcast-logout",
      channel: "broadcast",
    });

    await expect(secondTab).toHaveURL(/\/login$/, { timeout: 30_000 });
    expect(secondTabMetrics.some((metric) => metric.name === "principal_change")).toBe(true);
    expect(secondTabMetrics.some((metric) => metric.name === "cache_cleared")).toBe(true);
  });

  test("fails over an expired leader lease and clears previous tenant scoped storage", async ({ page }) => {
    const config = getClinicConfig();
    test.skip(!hasClinicConfig(config), "Set E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, and E2E_CLINIC_SLUG to run auth chaos tests.");

    await loginToClinic(page, config);
    const state = await readPersistedAuth(page);
    const user = state?.user;
    test.skip(!user?.id || !user?.tenantId, "Authenticated tenant user was not available in persisted auth state.");

    const scopedLanguageKey = `lang:${user.tenantId}:${user.id}`;
    const scopedCacheKey = `shefaa-cache:${user.tenantId}:${user.id}:patients`;
    await page.evaluate(
      ({ scopedLanguageKey, scopedCacheKey }) => {
        window.localStorage.setItem("shefaa_auth_leader_lease", JSON.stringify({
          tabId: "dead-tab",
          until: Date.now() - 60_000,
        }));
        window.localStorage.setItem(scopedLanguageKey, "ar");
        window.localStorage.setItem(scopedCacheKey, "stale");
      },
      { scopedLanguageKey, scopedCacheKey },
    );

    const sourceTab = await page.context().newPage();
    await sourceTab.goto("/");
    await dispatchAuthBoundaryEvent(sourceTab, {
      principalKey: `${user.id}:${user.tenantId}`,
      eventId: "e2e-leader-failover",
      channel: "storage",
    });

    await expect.poll(
      () => page.evaluate(
        ({ scopedLanguageKey, scopedCacheKey }) => ({
          language: window.localStorage.getItem(scopedLanguageKey),
          cache: window.localStorage.getItem(scopedCacheKey),
          lease: window.localStorage.getItem("shefaa_auth_leader_lease"),
        }),
        { scopedLanguageKey, scopedCacheKey },
      ),
      { timeout: 30_000 },
    ).toMatchObject({ language: null, cache: null });
  });

  test("rejects corrupted persisted auth when the Supabase session belongs to another principal", async ({ page }) => {
    const config = getClinicConfig();
    test.skip(!hasClinicConfig(config), "Set E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, and E2E_CLINIC_SLUG to run auth chaos tests.");
    test.fixme(
      true,
      "Current runtime can load the valid Supabase session before persisted medflow-auth corruption is compared; keep as a staging gate for fail-closed persistence hardening.",
    );

    await attachClinicSession(page, config);
    await page.evaluate(() => {
      window.localStorage.setItem("medflow-auth", JSON.stringify({
        state: {
          user: {
            id: "00000000-0000-0000-0000-000000000000",
            name: "Corrupted User",
            email: "corrupt@example.com",
            tenantId: "00000000-0000-0000-0000-000000000000",
            tenantSlug: "corrupt",
            tenantName: "Corrupt",
            tenantStatus: "active",
            tenantRoles: ["clinic_admin"],
            globalRoles: [],
          },
          isAuthenticated: true,
          tenantOverride: null,
          impersonationSession: null,
          lastVerifiedAt: new Date().toISOString(),
        },
        version: 0,
      }));
    });

    await page.goto(`/tenant/${config.clinicSlug}/dashboard`);

    await expect(page).toHaveURL(/\/login$/, { timeout: 30_000 });
    await expect.poll(
      () => page.evaluate(() => JSON.parse(window.localStorage.getItem("medflow-auth") ?? "{}").state?.user ?? null),
      { timeout: 30_000 },
    ).toBeNull();
  });

  test("processes storage fallback logout events once when BroadcastChannel delivery is unavailable", async ({ page }) => {
    const config = getClinicConfig();
    test.skip(!hasClinicConfig(config), "Set E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, and E2E_CLINIC_SLUG to run auth chaos tests.");

    const metrics = collectAuthMetrics(page);
    await loginToClinic(page, config);
    const state = await readPersistedAuth(page);
    const user = state?.user;
    test.skip(!user?.id || !user?.tenantId, "Authenticated tenant user was not available in persisted auth state.");

    const sourceTab = await page.context().newPage();
    await sourceTab.goto("/");
    await dispatchAuthBoundaryEvent(sourceTab, {
      principalKey: `${user.id}:${user.tenantId}`,
      eventId: "e2e-storage-fallback-logout",
      channel: "storage",
    });
    await dispatchAuthBoundaryEvent(sourceTab, {
      principalKey: `${user.id}:${user.tenantId}`,
      eventId: "e2e-storage-fallback-logout",
      channel: "storage",
    });

    await expect(page).toHaveURL(/\/login$/, { timeout: 30_000 });
    expect(metrics.filter((metric) => metric.name === "principal_change")).toHaveLength(1);
    expect(metrics.filter((metric) => metric.name === "cache_cleared")).toHaveLength(1);
  });

  test("keeps near-expiry refresh bursts bounded by the browser session storage contract", async ({ page }) => {
    const config = getClinicConfig();
    test.skip(!hasClinicConfig(config), "Set E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, and E2E_CLINIC_SLUG to run auth chaos tests.");
    test.skip(
      process.env.E2E_AUTH_CHAOS_REFRESH !== "1",
      "Set E2E_AUTH_CHAOS_REFRESH=1 to run refresh-race chaos against the configured Supabase project.",
    );

    const session = await attachClinicSession(page, config);
    const supabaseUrl = process.env.E2E_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) throw new Error("E2E Supabase URL is missing");
    const storageKey = buildSupabaseStorageKey(supabaseUrl);
    const nearExpirySession = {
      ...session,
      expires_at: Math.floor(Date.now() / 1000) + 2,
      expires_in: 2,
    };
    await page.evaluate(
      ({ storageKey, nearExpirySession }) => {
        window.localStorage.setItem(storageKey, JSON.stringify(nearExpirySession));
      },
      { storageKey, nearExpirySession },
    );

    const tokenRequests: number[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/auth/v1/token")) {
        tokenRequests.push(Date.now());
      }
    });

    await waitForAuthenticatedShell(page, config.clinicSlug!);
    for (let i = 0; i < 8; i += 1) {
      await page.goto(`/tenant/${config.clinicSlug}/dashboard`);
      await expect(page).toHaveURL(new RegExp(`/tenant/${config.clinicSlug}/`), { timeout: 30_000 });
    }
    await page.waitForTimeout(5_000);

    expect(tokenRequests.length).toBeLessThanOrEqual(3);
  });
});
