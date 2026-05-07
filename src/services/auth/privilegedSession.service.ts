import type { Factor } from "@supabase/supabase-js";
import { useAuth, buildPrivilegedSession, type PrivilegedAuthState, type PrivilegedSession } from "@/core/auth/authStore";
import { authService } from "./auth.service";

type MfaFactorsState = {
  all: Factor[];
  verified: Factor[];
  unverified: Factor[];
};

type PrivilegedRefreshResult = PrivilegedSession & {
  factors: MfaFactorsState;
};

const emptyFactors: MfaFactorsState = {
  all: [],
  verified: [],
  unverified: [],
};

let lastFactors: MfaFactorsState = emptyFactors;
let refreshFlight: Promise<PrivilegedRefreshResult> | null = null;

function normalizePrivilegedAuthState(input: {
  currentLevel: string | null;
  nextLevel: string | null;
  verifiedFactorCount: number;
  unverifiedFactorCount: number;
}): PrivilegedAuthState {
  return {
    currentLevel: input.currentLevel === "aal1" || input.currentLevel === "aal2" ? input.currentLevel : null,
    nextLevel: input.nextLevel === "aal1" || input.nextLevel === "aal2" ? input.nextLevel : null,
    verifiedFactorCount: input.verifiedFactorCount,
    unverifiedFactorCount: input.unverifiedFactorCount,
    loadedAt: new Date().toISOString(),
  };
}

export const privilegedSessionService = {
  getSnapshot() {
    const { user, lastVerifiedAt, privilegedAuth } = useAuth.getState();
    return buildPrivilegedSession({ user, lastVerifiedAt, privilegedAuth });
  },

  getLastFactors() {
    return lastFactors;
  },

  async refresh(): Promise<PrivilegedRefreshResult> {
    if (refreshFlight) {
      return refreshFlight;
    }

    refreshFlight = this.refreshNow().finally(() => {
      refreshFlight = null;
    });
    return refreshFlight;
  },

  async refreshNow(): Promise<PrivilegedRefreshResult> {
    const { user, setPrivilegedAuth, clearPrivilegedAuth } = useAuth.getState();
    if (!user) {
      clearPrivilegedAuth();
      lastFactors = emptyFactors;
      return { ...this.getSnapshot(), factors: lastFactors };
    }

    const assurance = await authService.getMfaAssuranceLevel();
    const factors = await authService.listMfaFactors();
    lastFactors = factors;

    if (useAuth.getState().user?.id !== user.id) {
      return { ...this.getSnapshot(), factors };
    }

    setPrivilegedAuth(normalizePrivilegedAuthState({
      currentLevel: assurance.currentLevel,
      nextLevel: assurance.nextLevel,
      verifiedFactorCount: factors.verified.length,
      unverifiedFactorCount: factors.unverified.length,
    }));

    return { ...this.getSnapshot(), factors };
  },
};
