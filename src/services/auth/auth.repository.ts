import type { User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "@/services/supabase/client";
import { ServiceError } from "@/services/supabase/errors";

const PROFILE_COLUMNS = "id, user_id, tenant_id, full_name, avatar_url, tenants:tenant_id(name, slug)";

export interface AuthRepository {
  signInWithPassword(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  getSession(): Promise<{ user?: SupabaseUser | null }>;
  onAuthStateChange(
    handler: (event: string, user?: SupabaseUser | null) => void,
  ): () => void;
  resetPasswordForEmail(email: string, redirectTo: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  getProfileByUserId(userId: string): Promise<any | null>;
  getRoleByUserId(userId: string): Promise<string | null>;
  registerClinic(payload: Record<string, unknown>): Promise<unknown>;
}

export const authRepository: AuthRepository = {
  async signInWithPassword(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw new ServiceError(error.message ?? "Login failed", { code: error.code, details: error });
    }
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
      .single();
    if (error) {
      throw new ServiceError(error.message ?? "Failed to load profile", { code: error.code, details: error });
    }
    return data ?? null;
  },
  async getRoleByUserId(userId) {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();
    if (error) {
      throw new ServiceError(error.message ?? "Failed to load role", { code: error.code, details: error });
    }
    return data?.role ?? null;
  },
  async registerClinic(payload) {
    const { data, error } = await supabase.functions.invoke("register-clinic", { body: payload });
    if (error) {
      throw new ServiceError(error.message ?? "Failed to register clinic", { code: error.code, details: error });
    }
    return data;
  },
};
