import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/services/supabase/errors";

const recoveryHarness = vi.hoisted(() => ({
  metrics: [] as Array<{ name: string; payload: Record<string, unknown> }>,
}));

vi.mock("../authMetrics", () => ({
  emitAuthMetric: vi.fn((name: string, payload: Record<string, unknown> = {}) => {
    recoveryHarness.metrics.push({ name, payload });
  }),
}));

import {
  awaitRecoveryWithBackpressure,
  isAuthRecoveryInProgress,
  MAX_AUTH_RECOVERY_MS,
  MAX_QUEUED_RECOVERY_WAITERS,
  MAX_QUEUE_WAIT_MS,
  runAuthRecovery,
} from "../authRecovery";

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("authRecovery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    recoveryHarness.metrics.length = 0;
  });

  afterEach(async () => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("runs recovery single-flight and replays all queued waiters exactly once", async () => {
    const gate = deferred();
    const work = vi.fn(() => gate.promise);

    const owner = runAuthRecovery(work);
    const waiters = [awaitRecoveryWithBackpressure(), awaitRecoveryWithBackpressure()];

    expect(isAuthRecoveryInProgress()).toBe(true);
    expect(work).toHaveBeenCalledTimes(1);

    gate.resolve();
    await Promise.all([owner, ...waiters]);

    expect(isAuthRecoveryInProgress()).toBe(false);
    expect(recoveryHarness.metrics.filter((m) => m.name === "auth_recovery_started")).toHaveLength(1);
  });

  it("returns the same in-flight promise to duplicate recovery owners", async () => {
    const gate = deferred();
    const first = runAuthRecovery(vi.fn(() => gate.promise));
    const secondWork = vi.fn(async () => undefined);
    const second = runAuthRecovery(secondWork);

    gate.resolve();
    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);

    expect(secondWork).not.toHaveBeenCalled();
  });

  it("cleans stale recovery promise after terminal work failure", async () => {
    const failing = runAuthRecovery(async () => {
      throw new Error("invalid refresh token");
    });

    await expect(failing).rejects.toThrow("invalid refresh token");
    expect(isAuthRecoveryInProgress()).toBe(false);

    const retryWork = vi.fn(async () => undefined);
    await expect(runAuthRecovery(retryWork)).resolves.toBeUndefined();
    expect(retryWork).toHaveBeenCalledTimes(1);
    expect(recoveryHarness.metrics).toContainEqual({
      name: "auth_recovery_failed",
      payload: { errorCode: "invalid refresh token" },
    });
  });

  it("enforces recovery timeout and clears the in-flight promise", async () => {
    const never = runAuthRecovery(() => new Promise(() => undefined));
    const assertion = expect(never).rejects.toThrow("RECOVERY_TIMEOUT");

    await vi.advanceTimersByTimeAsync(MAX_AUTH_RECOVERY_MS);
    await assertion;

    expect(isAuthRecoveryInProgress()).toBe(false);
    expect(recoveryHarness.metrics).toContainEqual({
      name: "auth_recovery_failed",
      payload: { errorCode: "RECOVERY_TIMEOUT" },
    });
  });

  it("caps queued recovery waiters with deterministic backpressure", async () => {
    const gate = deferred();
    const owner = runAuthRecovery(() => gate.promise);

    const waiters = Array.from({ length: MAX_QUEUED_RECOVERY_WAITERS }, () => awaitRecoveryWithBackpressure());
    await expect(awaitRecoveryWithBackpressure()).rejects.toMatchObject<ServiceError>({
      code: "REAUTH_REQUIRED",
    });

    gate.resolve();
    await Promise.all([owner, ...waiters]);
    expect(recoveryHarness.metrics).toContainEqual({
      name: "auth_queue_overflow",
      payload: { reason: "max_waiters" },
    });
  });

  it("propagates owner recovery timeout to queued waiters without replacing the owner", async () => {
    const gate = deferred();
    const owner = runAuthRecovery(() => gate.promise);
    const waiter = awaitRecoveryWithBackpressure();
    const ownerAssertion = expect(owner).rejects.toThrow("RECOVERY_TIMEOUT");
    const waiterAssertion = expect(waiter).rejects.toThrow("RECOVERY_TIMEOUT");

    expect(MAX_QUEUE_WAIT_MS).toBe(MAX_AUTH_RECOVERY_MS);

    await vi.advanceTimersByTimeAsync(MAX_QUEUE_WAIT_MS);
    await ownerAssertion;
    await waiterAssertion;
    expect(isAuthRecoveryInProgress()).toBe(false);
    expect(recoveryHarness.metrics).toContainEqual({
      name: "auth_recovery_failed",
      payload: { errorCode: "RECOVERY_TIMEOUT" },
    });
  });
});
