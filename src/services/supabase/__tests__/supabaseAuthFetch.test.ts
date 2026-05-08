import { afterEach, describe, expect, it, vi } from "vitest";

type LoadedFetchHarness = {
  authFetch: typeof fetch;
  fetchMock: ReturnType<typeof vi.fn>;
  handleUnauthorized: ReturnType<typeof vi.fn>;
  handleForbidden: ReturnType<typeof vi.fn>;
  mod: typeof import("../supabaseAuthFetch");
};

async function loadFetchHarness(
  responses: Response[],
  handleUnauthorizedImpl: () => Promise<void> = async () => undefined,
  handleForbiddenImpl: () => Promise<void> = async () => undefined,
): Promise<LoadedFetchHarness> {
  vi.resetModules();
  const queue = [...responses];
  const fetchMock = vi.fn(async () => queue.shift() ?? new Response("fallback", { status: 200 }));
  const handleUnauthorized = vi.fn(handleUnauthorizedImpl);
  const handleForbidden = vi.fn(handleForbiddenImpl);

  vi.stubGlobal("fetch", fetchMock);
  vi.doMock("@/services/auth/auth.service", () => ({
    authService: { handleUnauthorized, handleForbidden },
  }));

  const mod = await import("../supabaseAuthFetch");
  return {
    authFetch: mod.createSupabaseAuthFetch(),
    fetchMock,
    handleUnauthorized,
    handleForbidden,
    mod,
  };
}

describe("createSupabaseAuthFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.doUnmock("@/services/auth/auth.service");
  });

  it("returns successful protected responses without triggering recovery", async () => {
    const { authFetch, fetchMock, handleUnauthorized } = await loadFetchHarness([
      new Response("ok", { status: 200 }),
    ]);

    await expect(authFetch("https://api.example.test/rest/v1/patients")).resolves.toMatchObject({
      status: 200,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(handleUnauthorized).not.toHaveBeenCalled();
  });

  it("recovers once on protected 401 and replays the original request exactly once", async () => {
    const signal = new AbortController().signal;
    const { authFetch, fetchMock, handleUnauthorized } = await loadFetchHarness([
      new Response("expired", { status: 401 }),
      new Response("fresh", { status: 200 }),
    ]);

    const response = await authFetch("https://api.example.test/rest/v1/patients?select=id", {
      method: "POST",
      body: "{}",
      signal,
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("fresh");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://api.example.test/rest/v1/patients?select=id", expect.objectContaining({ signal }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://api.example.test/rest/v1/patients?select=id", expect.objectContaining({ signal }));
    expect(handleUnauthorized).toHaveBeenCalledTimes(1);
    expect(handleUnauthorized).toHaveBeenCalledWith(expect.objectContaining({
      source: "http",
      endpoint: "https://api.example.test/rest/v1/patients",
      authTraceId: expect.any(String),
    }));
  });

  it("does not recurse or retry forever when the replay also returns 401", async () => {
    const { authFetch, fetchMock, handleUnauthorized } = await loadFetchHarness([
      new Response("expired", { status: 401 }),
      new Response("still expired", { status: 401 }),
      new Response("should not be consumed", { status: 200 }),
    ]);

    const response = await authFetch("https://api.example.test/rest/v1/billing");

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("still expired");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(handleUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("routes protected 403s through the central non-refreshing forbidden handler", async () => {
    const { authFetch, fetchMock, handleUnauthorized, handleForbidden } = await loadFetchHarness([
      new Response("forbidden", { status: 403 }),
      new Response("should not replay", { status: 200 }),
    ]);

    const response = await authFetch("https://api.example.test/rest/v1/reports");

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("forbidden");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(handleUnauthorized).not.toHaveBeenCalled();
    expect(handleForbidden).toHaveBeenCalledTimes(1);
    expect(handleForbidden).toHaveBeenCalledWith(expect.objectContaining({
      source: "http",
      endpoint: "https://api.example.test/rest/v1/reports",
      authTraceId: expect.any(String),
    }));
  });

  it("does not trigger recovery for Supabase auth token or logout endpoints", async () => {
    const { authFetch, fetchMock, handleUnauthorized, handleForbidden } = await loadFetchHarness([
      new Response("token failure", { status: 401 }),
      new Response("logout failure", { status: 401 }),
      new Response("logout forbidden", { status: 403 }),
    ]);

    await expect(authFetch("http://localhost/auth/v1/token?grant_type=refresh_token")).resolves.toMatchObject({
      status: 401,
    });
    await expect(authFetch("http://localhost/auth/v1/logout")).resolves.toMatchObject({
      status: 401,
    });
    await expect(authFetch("http://localhost/auth/v1/logout")).resolves.toMatchObject({
      status: 403,
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(handleUnauthorized).not.toHaveBeenCalled();
    expect(handleForbidden).not.toHaveBeenCalled();
  });

  it("returns the original 401 when recovery fails or times out", async () => {
    const { authFetch, fetchMock, handleUnauthorized } = await loadFetchHarness(
      [
        new Response("expired", { status: 401 }),
        new Response("should not replay", { status: 200 }),
      ],
      async () => {
        throw new Error("RECOVERY_TIMEOUT");
      },
    );

    const response = await authFetch("https://api.example.test/rest/v1/reports");

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("expired");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(handleUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("tracks latency samples and derives the preemptive refresh threshold", async () => {
    const { mod } = await loadFetchHarness([]);

    mod.recordHttpLatencyMs(100);
    mod.recordHttpLatencyMs(20_000);

    expect(mod.getHttpLatencyP95Ms()).toBe(20_000);
    expect(mod.getPreemptiveRefreshThresholdSec()).toBe(40);
  });
});
