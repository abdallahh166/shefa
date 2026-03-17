import { create } from "zustand";
import { authRepository } from "@/services/auth/auth.repository";
import { portalService } from "@/services/portal/portal.service";

export type PortalUser = {
  id: string;
  email: string;
  patientId: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  fullName: string;
};

interface PortalAuthState {
  user: PortalUser | null;
  supabaseUser: { id: string; email?: string | null } | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  initialize: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: PortalUser | null, supabaseUser?: { id: string; email?: string | null } | null) => void;
}

export const usePortalAuth = create<PortalAuthState>((set) => ({
  user: null,
  supabaseUser: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: (user, supabaseUser) =>
    set({
      user,
      supabaseUser: supabaseUser ?? null,
      isAuthenticated: !!user,
      isLoading: false,
    }),
  logout: async () => {
    await authRepository.signOut();
    set({ user: null, supabaseUser: null, isAuthenticated: false });
  },
  initialize: async () => {
    set({ isLoading: true });
    try {
      const session = await authRepository.getSession();
      const supaUser = session.user ?? null;
      if (!supaUser) {
        set({ user: null, supabaseUser: null, isAuthenticated: false, isLoading: false });
        return;
      }

      const account = await portalService.getAccountByAuthUserId(supaUser.id);
      if (!account || account.status !== "active") {
        set({ user: null, supabaseUser: supaUser, isAuthenticated: false, isLoading: false });
        return;
      }

      const tenant = (account as any).tenants ?? null;
      const patient = (account as any).patients ?? null;

      set({
        user: {
          id: supaUser.id,
          email: supaUser.email ?? "",
          patientId: account.patient_id,
          tenantId: account.tenant_id,
          tenantSlug: tenant?.slug ?? "portal",
          tenantName: tenant?.name ?? "Clinic",
          fullName: patient?.full_name ?? supaUser.email ?? "Patient",
        },
        supabaseUser: supaUser,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      set({ user: null, supabaseUser: null, isAuthenticated: false, isLoading: false });
    }
  },
}));

// Listen for auth changes for portal context
authRepository.onAuthStateChange(async (event, sessionUser) => {
  const { setUser, initialize } = usePortalAuth.getState();
  if (event === "SIGNED_OUT") {
    setUser(null, null);
    return;
  }
  if (event === "SIGNED_IN" && sessionUser) {
    await initialize();
  }
});
