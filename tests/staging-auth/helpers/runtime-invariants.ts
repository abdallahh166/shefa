import { expect, type Page } from "@playwright/test";
import { APP_AUTH_STORAGE_KEY, AUTH_STORAGE_KEY } from "./config";

type BrowserInvariantReport = {
  authenticated: boolean;
  authMachineState: string | null;
  appUserId: string | null;
  appTenantId: string | null;
  supabaseUserId: string | null;
  scopedStorageViolations: string[];
  protectedUiWithoutSession: boolean;
  protectedUiInSafeMode: boolean;
};

export async function readRuntimeInvariantReport(page: Page): Promise<BrowserInvariantReport> {
  return page.evaluate(({ appKey, supabaseKey }) => {
    const parse = (value: string | null) => {
      if (!value) return null;
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    };

    const appState = parse(window.localStorage.getItem(appKey))?.state ?? null;
    const supabaseSession = parse(window.localStorage.getItem(supabaseKey));
    const appUser = appState?.user ?? null;
    const appUserId = typeof appUser?.id === "string" ? appUser.id : null;
    const appTenantId = typeof appUser?.tenantId === "string" ? appUser.tenantId : null;
    const supabaseUserId = typeof supabaseSession?.user?.id === "string" ? supabaseSession.user.id : null;
    const scopedStorageViolations: string[] = [];

    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i) ?? "";
      const cacheMatch = key.match(/^shefaa-cache:([^:]+):([^:]+):/);
      const langMatch = key.match(/^lang:([^:]+):([^:]+)$/);
      const match = cacheMatch ?? langMatch;
      if (!match) continue;

      const [, tenantId, userId] = match;
      if (!appTenantId || !appUserId || tenantId !== appTenantId || userId !== appUserId) {
        scopedStorageViolations.push(key);
      }
    }

    const authenticated = Boolean(appState?.isAuthenticated);
    const authMachineState = typeof appState?.authMachineState === "string" ? appState.authMachineState : null;
    const onProtectedRoute = /^\/tenant\//.test(window.location.pathname) || /^\/admin/.test(window.location.pathname);

    return {
      authenticated,
      authMachineState,
      appUserId,
      appTenantId,
      supabaseUserId,
      scopedStorageViolations,
      protectedUiWithoutSession: onProtectedRoute && authenticated && !supabaseUserId,
      protectedUiInSafeMode: onProtectedRoute && authMachineState === "reauth_required",
    };
  }, { appKey: APP_AUTH_STORAGE_KEY, supabaseKey: AUTH_STORAGE_KEY });
}

export async function assertNoCrossPrincipalCache(page: Page) {
  const report = await readRuntimeInvariantReport(page);
  expect(report.scopedStorageViolations, JSON.stringify(report, null, 2)).toEqual([]);
}

export async function assertNoAuthenticatedUIWithoutSession(page: Page) {
  const report = await readRuntimeInvariantReport(page);
  expect(report.protectedUiWithoutSession, JSON.stringify(report, null, 2)).toBe(false);
}

export async function assertNoProtectedRequestsInSafeMode(page: Page) {
  const report = await readRuntimeInvariantReport(page);
  expect(report.protectedUiInSafeMode, JSON.stringify(report, null, 2)).toBe(false);
}

export async function assertSingleRecoveryInFlight(page: Page) {
  const recoveryEvents = await page.evaluate(() => {
    const w = window as unknown as { __SHEFAA_STAGING_AUTH_EVENTS__?: Array<{ name: string; at: number }> };
    return w.__SHEFAA_STAGING_AUTH_EVENTS__ ?? [];
  });
  const starts = recoveryEvents.filter((event) => event.name === "auth_recovery_started");
  const activeStarts = starts.filter((start) => {
    const nextTerminal = recoveryEvents.find(
      (event) => event.at >= start.at && (event.name === "auth_recovery_succeeded" || event.name === "auth_recovery_failed"),
    );
    return !nextTerminal;
  });
  expect(activeStarts.length, JSON.stringify(recoveryEvents, null, 2)).toBeLessThanOrEqual(1);
}

export async function installAuthMetricRecorder(page: Page) {
  await page.addInitScript(() => {
    const events: Array<{ name: string; at: number }> = [];
    Object.defineProperty(window, "__SHEFAA_STAGING_AUTH_EVENTS__", {
      configurable: true,
      value: events,
    });

    const originalDebug = console.debug.bind(console);
    console.debug = (...args: unknown[]) => {
      const first = String(args[0] ?? "");
      const match = first.match(/^\[auth-metric\]\s+([a-z0-9_]+)/i);
      if (match) events.push({ name: match[1], at: Date.now() });
      originalDebug(...args);
    };
  });
}
