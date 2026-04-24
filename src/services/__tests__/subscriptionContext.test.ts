import { describe, expect, it } from "vitest";

import { deriveSubscriptionState } from "@/core/subscription/SubscriptionContext";

describe("deriveSubscriptionState", () => {
  const now = new Date("2026-04-24T12:00:00.000Z");

  it("keeps trialing subscriptions active until their expiry date", () => {
    const state = deriveSubscriptionState(
      {
        plan: "starter",
        status: "trialing",
        amount: 99,
        currency: "EGP",
        billing_cycle: "monthly",
        expires_at: "2026-05-01T00:00:00.000Z",
      },
      now,
    );

    expect(state.isTrialing).toBe(true);
    expect(state.isExpired).toBe(false);
    expect(state.daysRemaining).toBeGreaterThan(0);
  });

  it("marks trialing subscriptions as expired after the expiry date passes", () => {
    const state = deriveSubscriptionState(
      {
        plan: "starter",
        status: "trialing",
        amount: 99,
        currency: "EGP",
        billing_cycle: "monthly",
        expires_at: "2026-04-20T00:00:00.000Z",
      },
      now,
    );

    expect(state.isTrialing).toBe(true);
    expect(state.isExpired).toBe(true);
    expect(state.daysRemaining).toBe(0);
  });
});
