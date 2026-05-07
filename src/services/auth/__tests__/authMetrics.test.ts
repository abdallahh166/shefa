import { describe, expect, it, vi } from "vitest";
import { emitAuthMetric, subscribeAuthMetrics } from "../authMetrics";

describe("authMetrics", () => {
  it("notifies subscribers", () => {
    const fn = vi.fn();
    const unsub = subscribeAuthMetrics(fn);
    emitAuthMetric("refresh_attempt", { attempt: 1 });
    expect(fn).toHaveBeenCalledWith("refresh_attempt", { attempt: 1 });
    unsub();
    emitAuthMetric("refresh_attempt", { attempt: 2 });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
