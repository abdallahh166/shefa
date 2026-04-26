import { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import { isSuperAdmin, useAuth } from "@/core/auth/authStore";
import type { SubscriptionSummary } from "@/domain/subscription/subscription.types";
import { subscriptionService } from "@/services/subscription/subscription.service";

export type PlanType = "free" | "starter" | "pro" | "enterprise";

interface SubscriptionState {
  plan: PlanType;
  status: string;
  amount: number;
  currency: string;
  billingCycle: string;
  isExpired: boolean;
  daysRemaining: number;
  isTrialing: boolean;
  expiresAt: string | null;
  isLoading: boolean;
}

const defaultState: SubscriptionState = {
  plan: "free",
  status: "active",
  amount: 0,
  currency: "EGP",
  billingCycle: "monthly",
  isExpired: false,
  daysRemaining: 0,
  isTrialing: false,
  expiresAt: null,
  isLoading: true,
};

const SubscriptionContext = createContext<SubscriptionState>(defaultState);

export const useSubscription = () => useContext(SubscriptionContext);

export function deriveSubscriptionState(
  data: SubscriptionSummary,
  now = new Date(),
): Omit<SubscriptionState, "isLoading"> {
  const expiresAtDate = data.expires_at ? new Date(data.expires_at) : null;
  const isTrialing = data.status === "trialing";
  const isActiveLike = data.status === "active" || isTrialing;
  const isExpired = !isActiveLike || (expiresAtDate ? expiresAtDate < now : false);
  const daysRemaining = expiresAtDate
    ? Math.max(0, Math.ceil((expiresAtDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  return {
    plan: (data.plan as PlanType) || "free",
    status: data.status,
    amount: data.amount ?? 0,
    currency: data.currency ?? "EGP",
    billingCycle: data.billing_cycle ?? "monthly",
    isExpired,
    daysRemaining,
    isTrialing,
    expiresAt: data.expires_at ?? null,
  };
}

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAuthenticated, isLoading: authLoading, tenantOverride } = useAuth();
  const [state, setState] = useState<SubscriptionState>(defaultState);
  const abortRef = useRef<AbortController | null>(null);
  const hasTenantOverride = Boolean(tenantOverride);
  const tenantOverrideId = tenantOverride?.id;

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated || !user) {
      setState({ ...defaultState, isLoading: false });
      return;
    }

    if (isSuperAdmin(user) && !hasTenantOverride) {
      setState({
        plan: "enterprise",
        status: "active",
        amount: 0,
        currency: "EGP",
        billingCycle: "monthly",
        isExpired: false,
        daysRemaining: 999,
        isTrialing: false,
        expiresAt: null,
        isLoading: false,
      });
      return;
    }

    if (!user.tenantId) {
      setState({ ...defaultState, isLoading: false });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const fetchSubscription = async () => {
      setState((s) => ({ ...s, isLoading: true }));

      try {
        const targetTenantId = tenantOverrideId ?? user.tenantId;
        const data = await subscriptionService.getByTenant(targetTenantId);

        if (controller.signal.aborted) return;

        if (!data) {
          setState({ ...defaultState, isLoading: false });
          return;
        }

        setState({
          ...deriveSubscriptionState(data),
          isLoading: false,
        });
      } catch (err: any) {
        if (err?.name === "AbortError" || controller.signal.aborted) return;
        console.warn("Subscription fetch failed:", err?.message);
        setState({ ...defaultState, isLoading: false });
      }
    };

    fetchSubscription();

    return () => {
      controller.abort();
    };
  }, [isAuthenticated, user?.tenantId, user?.globalRoles, tenantOverrideId, hasTenantOverride, authLoading]);

  return (
    <SubscriptionContext.Provider value={state}>
      {children}
    </SubscriptionContext.Provider>
  );
};
