import { beforeEach, describe, expect, it, vi } from "vitest";

const repoHarness = vi.hoisted(() => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      refreshSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn(),
        listFactors: vi.fn(),
        enroll: vi.fn(),
        challenge: vi.fn(),
        verify: vi.fn(),
        unenroll: vi.fn(),
      },
    },
    from: vi.fn(),
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock("@/services/supabase/client", () => ({ supabase: repoHarness.supabase }));

import { authRepository } from "../auth.repository";

describe("authRepository auth contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repoHarness.supabase.auth.signOut.mockResolvedValue({ error: null });
    repoHarness.supabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "u1",
            email: "user@example.com",
            created_at: "2026-03-01T00:00:00.000Z",
          },
          expires_at: 1_800_000_000,
          created_at: "2026-03-01T00:00:00.000Z",
        },
      },
      error: null,
    });
  });

  it("returns the current session metadata used by sessionVersion logic", async () => {
    await expect(authRepository.getSession()).resolves.toEqual({
      user: {
        id: "u1",
        email: "user@example.com",
        created_at: "2026-03-01T00:00:00.000Z",
      },
      expiresAt: 1_800_000_000,
      createdAt: "2026-03-01T00:00:00.000Z",
    });
  });

  it("clears invalid refresh tokens locally and returns an anonymous session", async () => {
    repoHarness.supabase.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: { message: "Invalid refresh token: refresh token not found", code: "bad_jwt" },
    });

    await expect(authRepository.getSession()).resolves.toEqual({ user: null });
    expect(repoHarness.supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("coalesces concurrent refreshSession calls through the repository mutex", async () => {
    let resolveRefresh!: (value: { error: null }) => void;
    repoHarness.supabase.auth.refreshSession.mockReturnValue(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      }),
    );

    const first = authRepository.refreshSessionSingleFlight();
    const second = authRepository.refreshSessionSingleFlight();

    expect(repoHarness.supabase.auth.refreshSession).toHaveBeenCalledTimes(1);

    resolveRefresh({ error: null });
    await expect(Promise.all([first, second])).resolves.toEqual([
      { error: null },
      { error: null },
    ]);

    repoHarness.supabase.auth.refreshSession.mockResolvedValueOnce({
      error: { message: "network", name: "AuthRetryableFetchError" },
    });
    await expect(authRepository.refreshSessionSingleFlight()).resolves.toEqual({
      error: { message: "network", name: "AuthRetryableFetchError" },
    });
    expect(repoHarness.supabase.auth.refreshSession).toHaveBeenCalledTimes(2);
  });

  it("maps auth state events to user-only callbacks and keeps unsubscribe realistic", () => {
    const unsubscribe = vi.fn();
    repoHarness.supabase.auth.onAuthStateChange.mockImplementation((callback) => {
      callback("TOKEN_REFRESHED", { user: { id: "u1" } });
      return { data: { subscription: { unsubscribe } } };
    });
    const handler = vi.fn();

    const stop = authRepository.onAuthStateChange(handler);
    stop();

    expect(handler).toHaveBeenCalledWith("TOKEN_REFRESHED", { id: "u1" });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
