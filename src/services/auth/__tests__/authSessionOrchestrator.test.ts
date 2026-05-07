import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  attachAuthSessionOrchestrator,
  runAuthCleanupEvent,
  teardownAuthMultiTabSyncForTests,
} from "../authSessionOrchestrator";

describe("authSessionOrchestrator", () => {
  afterEach(() => {
    teardownAuthMultiTabSyncForTests();
  });

  beforeEach(() => {
    teardownAuthMultiTabSyncForTests();
    let resets = 0;
    attachAuthSessionOrchestrator({
      getTabId: () => "tab-a",
      getPrincipalKey: () => "u1:tenant-1",
      getPrincipalParts: () => ({ userId: "u1", tenantId: "tenant-1" }),
      resetAuthStores: async () => {
        resets++;
        (globalThis as any).__authOrchestratorResetCount = resets;
      },
      setAuthMachineState: () => {},
      getAuthMachineState: () => "authenticated",
      getAuthProjection: () => ({ isAuthenticated: true, userId: "u1" }),
    });
  });

  it("deduplicates identical eventId within TTL", async () => {
    const ev = {
      v: 1 as const,
      eventId: "evt-1",
      originTabId: "tab-a",
      principalKey: "u1:tenant-1",
      type: "LOGOUT" as const,
      occurredAt: Date.now(),
      authTraceId: "trace-1",
    };
    await runAuthCleanupEvent(ev);
    await runAuthCleanupEvent(ev);
    expect((globalThis as any).__authOrchestratorResetCount).toBe(1);
  });

  it("rejects stale replay by occurredAt", async () => {
    let resets = 0;
    attachAuthSessionOrchestrator({
      getTabId: () => "tab-a",
      getPrincipalKey: () => "u1:tenant-1",
      getPrincipalParts: () => ({ userId: "u1", tenantId: "tenant-1" }),
      resetAuthStores: async () => {
        resets++;
      },
      setAuthMachineState: () => {},
      getAuthMachineState: () => "authenticated",
      getAuthProjection: () => ({ isAuthenticated: true, userId: "u1" }),
    });
    const ev = {
      v: 1 as const,
      eventId: "evt-2",
      originTabId: "tab-a",
      principalKey: "u1:tenant-1",
      type: "LOGOUT" as const,
      occurredAt: Date.now() - 120_000,
      authTraceId: "trace-2",
    };
    await runAuthCleanupEvent(ev);
    expect(resets).toBe(0);
  });
});
