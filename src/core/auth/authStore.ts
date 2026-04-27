import { create } from "zustand";
import { persist } from "zustand/middleware";
import { profileStorage } from "@/services/settings/profile.storage";
import { authService } from "@/services/auth/auth.service";

export type GlobalRole = "super_admin";
export type TenantRole = "clinic_admin" | "doctor" | "receptionist" | "nurse" | "accountant";
export type Role = GlobalRole | TenantRole;
export type PrivilegedRoleTier = GlobalRole | "clinic_admin";
export type TenantStatus = "active" | "suspended" | "deactivated";
export type AuthenticatorAssuranceLevel = "aal1" | "aal2" | null;

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
  tenantId: string | null;
  tenantSlug: string | null;
  tenantName: string | null;
  tenantStatus: TenantStatus | null;
  tenantRoles: TenantRole[];
  globalRoles: GlobalRole[];
  tenantStatusReason?: string | null;
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
  actor: Pick<AppUser, "id" | "name" | "email" | "tenantRoles" | "globalRoles">;
  targetTenant: Exclude<TenantOverride, null>;
} | null;

export type PrivilegedAuthState = {
  currentLevel: AuthenticatorAssuranceLevel;
  nextLevel: AuthenticatorAssuranceLevel;
  verifiedFactorCount: number;
  unverifiedFactorCount: number;
  loadedAt: string | null;
};

export type PrivilegedSession = {
  roleTier: PrivilegedRoleTier | null;
  isPrivileged: boolean;
  aal: AuthenticatorAssuranceLevel;
  isMfaEnrolled: boolean;
  isRecentAuthValid: boolean;
  requiresMfaEnrollment: boolean;
  requiresStepUp: boolean;
  canAccessPrivilegedRoutes: boolean;
};

interface AuthState {
  user: AppUser | null;
  supabaseUser: SupaUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  tenantOverride: TenantOverride;
  impersonationSession: ImpersonationSession;
  lastVerifiedAt: string | null;
  privilegedAuth: PrivilegedAuthState;
  setUser: (user: AppUser | null, supabaseUser?: SupaUser | null) => void;
  setLoading: (loading: boolean) => void;
  setPrivilegedAuth: (state: Partial<PrivilegedAuthState>) => void;
  clearPrivilegedAuth: () => void;
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

export function isSuperAdmin(user?: Pick<AppUser, "globalRoles"> | null) {
  return Boolean(user?.globalRoles?.includes("super_admin"));
}

export function getPrimaryTenantRole(user?: Pick<AppUser, "tenantRoles"> | null): TenantRole | null {
  return user?.tenantRoles?.[0] ?? null;
}

export function getPrimaryRole(user?: Pick<AppUser, "tenantRoles" | "globalRoles"> | null): Role | null {
  if (isSuperAdmin(user as Pick<AppUser, "globalRoles"> | null)) return "super_admin";
  return getPrimaryTenantRole(user as Pick<AppUser, "tenantRoles"> | null);
}

export function getPrivilegedRoleTier(
  user?: Pick<AppUser, "tenantRoles" | "globalRoles"> | null,
): PrivilegedRoleTier | null {
  if (isSuperAdmin(user as Pick<AppUser, "globalRoles"> | null)) return "super_admin";
  return user?.tenantRoles?.includes("clinic_admin") ? "clinic_admin" : null;
}

function getEffectiveRoles(user?: Pick<AppUser, "tenantRoles" | "globalRoles"> | null): Role[] {
  if (!user) return [];
  return [...(user.globalRoles ?? []), ...(user.tenantRoles ?? [])];
}

function getDefaultPrivilegedAuthState(): PrivilegedAuthState {
  return {
    currentLevel: null,
    nextLevel: null,
    verifiedFactorCount: 0,
    unverifiedFactorCount: 0,
    loadedAt: null,
  };
}

function isRecentAuthStillValid(user: AppUser | null, lastVerifiedAt: string | null) {
  if (!user || !lastVerifiedAt) return false;
  const primaryRole = getPrimaryRole(user);
  if (!primaryRole) return false;
  const verifiedAt = new Date(lastVerifiedAt).getTime();
  if (Number.isNaN(verifiedAt)) return false;

  const windowsMs: Record<Role, number> = {
    super_admin: 10 * 60 * 1000,
    clinic_admin: 15 * 60 * 1000,
    doctor: 30 * 60 * 1000,
    receptionist: 30 * 60 * 1000,
    nurse: 30 * 60 * 1000,
    accountant: 30 * 60 * 1000,
  };

  return Date.now() - verifiedAt <= windowsMs[primaryRole];
}

export function buildPrivilegedSession(input: {
  user: AppUser | null;
  lastVerifiedAt: string | null;
  privilegedAuth: PrivilegedAuthState;
}): PrivilegedSession {
  const roleTier = getPrivilegedRoleTier(input.user);
  const isPrivileged = roleTier !== null;
  const isMfaEnrolled = input.privilegedAuth.verifiedFactorCount > 0;
  const aal = input.privilegedAuth.currentLevel;
  const isRecentAuthValid = isRecentAuthStillValid(input.user, input.lastVerifiedAt);
  const requiresMfaEnrollment = isPrivileged && !isMfaEnrolled;
  const canAccessPrivilegedRoutes = !isPrivileged || (isMfaEnrolled && aal === "aal2");

  return {
    roleTier,
    isPrivileged,
    aal,
    isMfaEnrolled,
    isRecentAuthValid,
    requiresMfaEnrollment,
    requiresStepUp: isPrivileged && !isRecentAuthValid,
    canAccessPrivilegedRoutes,
  };
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
      privilegedAuth: getDefaultPrivilegedAuthState(),
      setUser: (user, supabaseUser) => set({
        user,
        supabaseUser: supabaseUser ?? null,
        isAuthenticated: !!user,
        isLoading: false,
        tenantOverride: isSuperAdmin(user) ? get().tenantOverride : null,
        impersonationSession: isSuperAdmin(user) ? get().impersonationSession : null,
        lastVerifiedAt: user ? get().lastVerifiedAt : null,
      }),
      setLoading: (isLoading) => set({ isLoading }),
      setPrivilegedAuth: (state) => set((current) => ({
        privilegedAuth: {
          ...current.privilegedAuth,
          ...state,
        },
      })),
      clearPrivilegedAuth: () => set({ privilegedAuth: getDefaultPrivilegedAuthState() }),
      logout: async () => {
        await authService.logout();
        set({
          user: null,
          supabaseUser: null,
          isAuthenticated: false,
          tenantOverride: null,
          impersonationSession: null,
          lastVerifiedAt: null,
          privilegedAuth: getDefaultPrivilegedAuthState(),
        });
      },
      hasPermission: (permission) => {
        const { user } = get();
        if (!user) return false;
        return getEffectiveRoles(user).some((role) => ROLE_PERMISSIONS[role]?.includes(permission) ?? false);
      },
      hasRole: (role) => {
        const user = get().user;
        if (!user) return false;
        return role === "super_admin"
          ? isSuperAdmin(user)
          : user.tenantRoles.includes(role as TenantRole);
      },
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
            if (!user || !isSuperAdmin(user)) {
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
              privilegedAuth: getDefaultPrivilegedAuthState(),
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
            privilegedAuth: getDefaultPrivilegedAuthState(),
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
  const { profile, roles } = await authService.loadUserProfile(supaUser.id);
  const hasAnyRole = roles.globalRoles.length > 0 || roles.tenantRoles.length > 0;
  if (profile && hasAnyRole) {
    const tenant = profile.tenants as any;
    const superAdmin = roles.globalRoles.includes("super_admin");
    const nextUser: AppUser = {
      id: supaUser.id,
      name: profile.full_name,
      email: supaUser.email ?? "",
      tenantId: profile.tenant_id ?? null,
      tenantSlug: tenant?.slug ?? (superAdmin ? null : "default"),
      tenantName: tenant?.name ?? (superAdmin ? null : "Clinic"),
      tenantStatus: tenant?.status ?? (superAdmin ? null : "active"),
      tenantRoles: roles.tenantRoles as TenantRole[],
      globalRoles: roles.globalRoles as GlobalRole[],
      tenantStatusReason: tenant?.status_reason ?? null,
      avatar: undefined,
    };
    let avatarUrl: string | undefined = profile.avatar_url ?? undefined;

    if (avatarUrl && !avatarUrl.startsWith("http")) {
      try {
        avatarUrl = await profileStorage.getSignedAvatarUrl(avatarUrl);
      } catch {
        avatarUrl = undefined;
      }
    }

    nextUser.avatar = avatarUrl;

    set({
      user: nextUser,
      supabaseUser: supaUser,
      isAuthenticated: true,
      tenantOverride: isSuperAdmin(nextUser) ? useAuth.getState().tenantOverride : null,
      impersonationSession: isSuperAdmin(nextUser) ? useAuth.getState().impersonationSession : null,
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
      privilegedAuth: getDefaultPrivilegedAuthState(),
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
