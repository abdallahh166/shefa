import { useAuth, buildPrivilegedSession, type PrivilegedAuthState } from "@/core/auth/authStore";
import { authService } from "./auth.service";

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

  async refresh() {
    const { user, setPrivilegedAuth, clearPrivilegedAuth } = useAuth.getState();
    if (!user) {
      clearPrivilegedAuth();
      return this.getSnapshot();
    }

    const [assurance, factors] = await Promise.all([
      authService.getMfaAssuranceLevel(),
      authService.listMfaFactors(),
    ]);

    setPrivilegedAuth(normalizePrivilegedAuthState({
      currentLevel: assurance.currentLevel,
      nextLevel: assurance.nextLevel,
      verifiedFactorCount: factors.verified.length,
      unverifiedFactorCount: factors.unverified.length,
    }));

    return this.getSnapshot();
  },
};
