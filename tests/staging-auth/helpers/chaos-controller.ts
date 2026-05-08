import type { Page } from "@playwright/test";

export type ChaosController = {
  delayRefreshEndpoint(ms: number): Promise<void>;
  delayProtectedRequests(ms: number, pathPattern?: RegExp): Promise<void>;
  suspendBroadcastChannel(): Promise<void>;
  duplicateAuthBoundaryEvent(principalKey: string, eventId: string): Promise<void>;
  freezeMainThread(ms: number): Promise<void>;
  crashLeaderLease(): Promise<void>;
  pauseRealtimeWebsocket(): Promise<void>;
};

export function createChaosController(page: Page): ChaosController {
  return {
    async delayRefreshEndpoint(ms: number) {
      await page.route(/\/auth\/v1\/token/, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, ms));
        await route.continue();
      });
    },

    async delayProtectedRequests(ms: number, pathPattern = /\/rest\/v1\//) {
      await page.route(pathPattern, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, ms));
        await route.continue();
      });
    },

    async suspendBroadcastChannel() {
      await page.addInitScript(() => {
        class SuspendedBroadcastChannel {
          name: string;
          onmessage: ((event: MessageEvent) => void) | null = null;

          constructor(name: string) {
            this.name = name;
          }

          postMessage() {
            /* Deliberately dropped for staging auth chaos. */
          }

          addEventListener() {
            /* Deliberately dropped for staging auth chaos. */
          }

          removeEventListener() {
            /* Deliberately dropped for staging auth chaos. */
          }

          close() {
            /* noop */
          }
        }

        Object.defineProperty(window, "BroadcastChannel", {
          configurable: true,
          value: SuspendedBroadcastChannel,
        });
      });
    },

    async duplicateAuthBoundaryEvent(principalKey: string, eventId: string) {
      await page.evaluate(({ principalKey, eventId }) => {
        const event = {
          v: 1,
          eventId,
          originTabId: "staging-chaos-controller",
          principalKey,
          type: "LOGOUT",
          occurredAt: Date.now(),
          authTraceId: `staging-chaos-${eventId}`,
        };
        const payload = JSON.stringify(event);
        window.localStorage.setItem("shefaa-auth-sync-fallback", payload);
        window.localStorage.removeItem("shefaa-auth-sync-fallback");
        window.localStorage.setItem("shefaa-auth-sync-fallback", payload);
        window.localStorage.removeItem("shefaa-auth-sync-fallback");
      }, { principalKey, eventId });
    },

    async freezeMainThread(ms: number) {
      await page.evaluate((durationMs) => {
        const started = performance.now();
        while (performance.now() - started < durationMs) {
          // Busy loop intentionally simulates a suspended or frozen tab resuming late.
        }
      }, ms);
    },

    async crashLeaderLease() {
      await page.evaluate(() => {
        window.localStorage.setItem("shefaa_auth_leader_lease", JSON.stringify({
          tabId: "staging-crashed-leader",
          until: Date.now() - 60_000,
        }));
      });
    },

    async pauseRealtimeWebsocket() {
      await page.route(/\/realtime\/v1\/websocket/, async (route) => {
        await route.abort("failed");
      });
    },
  };
}
