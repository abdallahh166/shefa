import { beforeEach, describe, expect, it, vi } from "vitest";

const authHarness = vi.hoisted(() => ({
  state: {
    isAuthenticated: true,
    user: { id: "u-logged-in", tenantId: "t-1" } as { id: string; tenantId: string | null } | null,
    tenantOverride: null as null | { id: string },
    authMachineState: "authenticated" as const,
  },
}));

vi.mock("@/core/auth/authStore", () => ({
  useAuth: { getState: () => authHarness.state },
}));

vi.mock("@/services/auth/auth.repository", () => ({
  authRepository: {
    getSession: vi.fn(async () => ({ user: { id: "u-logged-in" } })),
  },
}));

vi.mock("@/services/auth/authMetrics", () => ({
  emitAuthMetric: vi.fn(),
}));

import { assertAuthRuntimeInvariants } from "../authRuntimeInvariants";
import { emitAuthMetric } from "@/services/auth/authMetrics";

describe("authRuntimeInvariants", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    vi.clearAllMocks();
    store.clear();
    const ls = {
      get length() {
        return store.size;
      },
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => store.clear(),
    };
    Object.defineProperty(window, "localStorage", { value: ls, configurable: true });
    Object.defineProperty(window, "location", { value: { pathname: "/" }, configurable: true });
  });

  it("does not flag pre-auth lang:public:anon when authenticated", async () => {
    store.set("lang:public:anon", "en");
    store.set("lang:t-1:u-logged-in", "en");

    await assertAuthRuntimeInvariants("report");

    const crossPrincipal = vi.mocked(emitAuthMetric).mock.calls.find(
      (c) => c[0] === "auth_runtime_invariant_failed" && (c[1] as { invariant?: string })?.invariant === "cross_principal_scoped_storage",
    );
    expect(crossPrincipal).toBeUndefined();
  });

  it("flags a different principal lang key", async () => {
    store.set("lang:t-other:u-other", "en");

    await assertAuthRuntimeInvariants("report");

    expect(vi.mocked(emitAuthMetric)).toHaveBeenCalledWith(
      "auth_runtime_invariant_failed",
      expect.objectContaining({
        invariant: "cross_principal_scoped_storage",
        sample: "lang:t-other:u-other",
      }),
    );
  });
});
