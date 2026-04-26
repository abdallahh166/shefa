import type { User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "@/services/supabase/client";
import { ServiceError } from "@/services/supabase/errors";

const PROFILE_COLUMNS = "id, user_id, tenant_id, full_name, avatar_url, tenants:tenant_id(name, slug, status, status_reason)";

export interface AuthRepository {
  signInWithPassword(email: string, password: string): Promise<SupabaseUser | null>;
  signOut(): Promise<void>;
  getSession(): Promise<{ user?: SupabaseUser | null }>;
  onAuthStateChange(
    handler: (event: string, user?: SupabaseUser | null) => void,
  ): () => void;
  resetPasswordForEmail(email: string, redirectTo: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  getProfileByUserId(userId: string): Promise<any | null>;
  getRolesByUserId(userId: string): Promise<{ tenantRoles: string[]; globalRoles: string[] }>;
  getMfaAssuranceLevel(): Promise<{ currentLevel: string | null; nextLevel: string | null }>;
  registerClinic(payload: Record<string, unknown>): Promise<unknown>;
}

export const authRepository: AuthRepository = {
  async signInWithPassword(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw new ServiceError(error.message ?? "Login failed", { code: error.code, details: error });
    }
    return data.user ?? null;
  },
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new ServiceError(error.message ?? "Failed to sign out", { code: error.code, details: error });
    }
  },
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw new ServiceError(error.message ?? "Failed to load session", { code: error.code, details: error });
    }
    return { user: data.session?.user ?? null };
  },
  onAuthStateChange(handler) {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      handler(event, session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  },
  async resetPasswordForEmail(email, redirectTo) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      throw new ServiceError(error.message ?? "Failed to send reset email", { code: error.code, details: error });
    }
  },
  async updatePassword(password) {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      throw new ServiceError(error.message ?? "Failed to update password", { code: error.code, details: error });
    }
  },
  async getProfileByUserId(userId) {
    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      throw new ServiceError(error.message ?? "Failed to load profile", { code: error.code, details: error });
    }
    return data ?? null;
  },
  async getRolesByUserId(userId) {
    const globalRoleLookup = await (supabase.from as any)("user_global_roles")
      .select("role")
      .eq("user_id", userId)
      .is("revoked_at", null);

    if (globalRoleLookup.error) {
      throw new ServiceError(globalRoleLookup.error.message ?? "Failed to load global role", {
        code: globalRoleLookup.error.code,
        details: globalRoleLookup.error,
      });
    }

    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (error) {
      throw new ServiceError(error.message ?? "Failed to load role", { code: error.code, details: error });
    }

    return {
      tenantRoles: (data ?? []).map((row) => String(row.role)),
      globalRoles: (globalRoleLookup.data ?? []).map((row: { role: string }) => String(row.role)),
    };
  },
  async getMfaAssuranceLevel() {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) {
      throw new ServiceError(error.message ?? "Failed to load MFA assurance level", {
        code: error.code,
        details: error,
      });
    }
    return {
      currentLevel: data.currentLevel ?? null,
      nextLevel: data.nextLevel ?? null,
    };
  },
  async registerClinic(payload) {
    const { data, error } = await supabase.functions.invoke("register-clinic", { body: payload });
    if (error) {
      throw new ServiceError(error.message ?? "Failed to register clinic", { code: error.code, details: error });
    }
    return data;
  },
};
