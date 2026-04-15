import { create } from "zustand";
import { persist } from "zustand/middleware";
import { profileStorage } from "@/services/settings/profile.storage";
import { authService } from "@/services/auth/auth.service";

export type Role = "super_admin" | "clinic_admin" | "doctor" | "receptionist" | "nurse" | "accountant";

type SupaUser = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
};

export type Permission =
  | "manage_clinic" | "manage_users" | "view_dashboard"
  | "manage_patients" | "view_patients"
  | "manage_appointments" | "view_appointments"
  | "manage_medical_records" | "view_medical_records"
  | "manage_billing" | "view_billing"
  | "manage_pharmacy" | "manage_laboratory" | "view_reports"
  | "super_admin";

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: [
    "super_admin",
    "manage_clinic", "manage_users", "view_dashboard",
    "manage_patients", "view_patients", "manage_appointments", "view_appointments",
    "manage_medical_records", "view_medical_records",
    "manage_billing", "view_billing",
    "manage_pharmacy", "manage_laboratory", "view_reports",
  ],
  clinic_admin: [
    "manage_clinic", "manage_users", "view_dashboard",
    "manage_patients", "view_patients", "manage_appointments", "view_appointments",
    "manage_medical_records", "view_medical_records",
    "manage_billing", "view_billing",
    "manage_pharmacy", "manage_laboratory", "view_reports",
  ],
  doctor: [
    "view_dashboard", "view_patients", "manage_medical_records", "view_medical_records",
    "view_appointments", "manage_appointments",
  ],
  receptionist: [
    "view_dashboard", "view_patients", "manage_patients",
    "manage_appointments", "view_appointments",
  ],
  nurse: [
    "view_dashboard", "view_patients", "view_medical_records", "view_appointments",
  ],
  accountant: [
    "view_dashboard", "manage_billing", "view_billing", "view_reports",
  ],
};

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  avatar?: string;
}

export type TenantOverride = {
  id: string;
  slug: string;
  name: string;
} | null;

export type ImpersonationSession = {
  requestId: string;
  startedAt: string;
  actor: Pick<AppUser, "id" | "name" | "email" | "role">;
  targetTenant: Exclude<TenantOverride, null>;
} | null;

interface AuthState {
  user: AppUser | null;
  supabaseUser: SupaUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  tenantOverride: TenantOverride;
  impersonationSession: ImpersonationSession;
  lastVerifiedAt: string | null;
  setUser: (user: AppUser | null, supabaseUser?: SupaUser | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
  hasRole: (role: Role) => boolean;
  setTenantOverride: (tenant: TenantOverride) => void;
  clearTenantOverride: () => void;
  startImpersonation: (tenant: Exclude<TenantOverride, null>, session: Exclude<ImpersonationSession, null>) => void;
  stopImpersonation: () => void;
  markSessionVerified: (verifiedAt?: string) => void;
  initialize: () => Promise<void>;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      supabaseUser: null,
      isAuthenticated: false,
      isLoading: true,
      tenantOverride: null,
      impersonationSession: null,
      lastVerifiedAt: null,
      setUser: (user, supabaseUser) => set({
        user,
        supabaseUser: supabaseUser ?? null,
        isAuthenticated: !!user,
        isLoading: false,
        tenantOverride: user?.role === "super_admin" ? get().tenantOverride : null,
        impersonationSession: user?.role === "super_admin" ? get().impersonationSession : null,
        lastVerifiedAt: user ? get().lastVerifiedAt : null,
      }),
      setLoading: (isLoading) => set({ isLoading }),
      logout: async () => {
        await authService.logout();
        set({
          user: null,
          supabaseUser: null,
          isAuthenticated: false,
          tenantOverride: null,
          impersonationSession: null,
          lastVerifiedAt: null,
        });
      },
      hasPermission: (permission) => {
        const { user } = get();
        if (!user) return false;
        return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
      },
      hasRole: (role) => get().user?.role === role,
      setTenantOverride: (tenant) => {
        set({
          tenantOverride: tenant,
          impersonationSession: null,
        });
      },
      clearTenantOverride: () => {
        set({ tenantOverride: null, impersonationSession: null });
      },
      startImpersonation: (tenant, session) => {
        set({ tenantOverride: tenant, impersonationSession: session });
      },
      stopImpersonation: () => {
        set({ tenantOverride: null, impersonationSession: null });
      },
      markSessionVerified: (verifiedAt) => {
        set({ lastVerifiedAt: verifiedAt ?? new Date().toISOString() });
      },
      initialize: async () => {
        set({ isLoading: true });
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Auth timeout")), 8000)
        );
        try {
          const sessionResult = await Promise.race([
            authService.getSessionUser(),
            timeout,
          ]);
          const supaUser = sessionResult as SupaUser | null;
          if (supaUser) {
            await Promise.race([
              loadUserProfile(supaUser, set),
              timeout,
            ]);
            const { user, lastVerifiedAt } = get();
            if (!user || user.role !== "super_admin") {
              set({ tenantOverride: null, impersonationSession: null });
            }
            if (user && !lastVerifiedAt) {
              set({ lastVerifiedAt: new Date().toISOString() });
            }
          } else {
            set({
              user: null,
              supabaseUser: null,
              isAuthenticated: false,
              tenantOverride: null,
              impersonationSession: null,
              lastVerifiedAt: null,
            });
          }
        } catch {
          set({
            user: null,
            supabaseUser: null,
            isAuthenticated: false,
            tenantOverride: null,
            impersonationSession: null,
            lastVerifiedAt: null,
          });
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: "medflow-auth",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        tenantOverride: state.tenantOverride,
        impersonationSession: state.impersonationSession,
        lastVerifiedAt: state.lastVerifiedAt,
      }),
    }
  )
);

async function loadUserProfile(
  supaUser: SupaUser,
  set: (partial: Partial<AuthState>) => void
) {
  const isVerified = Boolean(supaUser.email_confirmed_at ?? supaUser.confirmed_at);
  if (!isVerified) {
    await authService.logout().catch(() => undefined);
    set({ user: null, supabaseUser: null, isAuthenticated: false });
    return;
  }
  const { profile, role } = await authService.loadUserProfile(supaUser.id);
  if (profile && role) {
    const tenant = profile.tenants as any;
    let avatarUrl: string | undefined = profile.avatar_url ?? undefined;

    if (avatarUrl && !avatarUrl.startsWith("http")) {
      try {
        avatarUrl = await profileStorage.getSignedAvatarUrl(avatarUrl);
      } catch {
        avatarUrl = undefined;
      }
    }

    set({
      user: {
        id: supaUser.id,
        name: profile.full_name,
        email: supaUser.email ?? "",
        role: role as Role,
        tenantId: profile.tenant_id,
        tenantSlug: tenant?.slug ?? "default",
        tenantName: tenant?.name ?? "Clinic",
        avatar: avatarUrl,
      },
      supabaseUser: supaUser,
      isAuthenticated: true,
      tenantOverride: useAuth.getState().user?.role === "super_admin" ? useAuth.getState().tenantOverride : null,
      impersonationSession: useAuth.getState().user?.role === "super_admin" ? useAuth.getState().impersonationSession : null,
      lastVerifiedAt: useAuth.getState().lastVerifiedAt,
    });
  } else {
    set({
      user: null,
      supabaseUser: null,
      isAuthenticated: false,
      tenantOverride: null,
      impersonationSession: null,
      lastVerifiedAt: null,
    });
  }
}

// Listen for auth changes
authService.onAuthStateChange(async (event, sessionUser) => {
  const { setUser, setLoading, markSessionVerified } = useAuth.getState();
  if (event === "SIGNED_IN" && sessionUser) {
    setLoading(true);
    await loadUserProfile(sessionUser as SupaUser, (partial) => {
      if (partial.user) {
        setUser(partial.user, partial.supabaseUser);
      } else {
        setUser(null);
      }
    });
    markSessionVerified();
    setLoading(false);
  } else if (event === "SIGNED_OUT") {
    setUser(null);
  }
});
