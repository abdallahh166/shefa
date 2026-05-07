import { describe, expect, it } from "vitest";
import { assertAuthTransition, isBlockingProtectedRouteState, isSafeModeState } from "../authStateMachine";

describe("authStateMachine", () => {
  it("allows idempotent transitions", () => {
    expect(() => assertAuthTransition("authenticated", "authenticated")).not.toThrow();
  });

  it("identifies blocking protected-route states", () => {
    expect(isBlockingProtectedRouteState("initializing")).toBe(true);
    expect(isBlockingProtectedRouteState("unauthenticated_pending_cleanup")).toBe(true);
    expect(isBlockingProtectedRouteState("refreshing")).toBe(true);
    expect(isBlockingProtectedRouteState("authenticated")).toBe(false);
  });

  it("identifies safe-mode states", () => {
    expect(isSafeModeState("reauth_required")).toBe(true);
    expect(isSafeModeState("error")).toBe(true);
    expect(isSafeModeState("authenticated")).toBe(false);
  });
});
