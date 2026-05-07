import { describe, expect, it } from "vitest";
import { abortAllAuthBoundary, abortScope, createAbortScope } from "../authAbortRegistry";

describe("authAbortRegistry", () => {
  it("aborts the previous signal when a scope is replaced", () => {
    const first = createAbortScope("patients:list");
    const second = createAbortScope("patients:list");

    expect(first.aborted).toBe(true);
    expect(second.aborted).toBe(false);

    abortScope("patients:list", "cleanup");
    expect(second.aborted).toBe(true);
  });

  it("aborts every in-flight scope exactly once at an auth boundary", () => {
    const a = createAbortScope("old-user:patients");
    const b = createAbortScope("old-user:appointments");

    abortAllAuthBoundary("trace-boundary");
    abortAllAuthBoundary("trace-boundary");

    expect(a.aborted).toBe(true);
    expect(b.aborted).toBe(true);

    const fresh = createAbortScope("new-user:patients");
    expect(fresh.aborted).toBe(false);
    abortAllAuthBoundary("cleanup");
  });
});
