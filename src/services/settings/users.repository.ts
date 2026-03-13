import type { ProfileWithRoles } from "@/domain/settings/profile.types";
import { supabase } from "@/services/supabase/client";
import { ServiceError } from "@/services/supabase/errors";

const PROFILE_COLUMNS = "id, user_id, tenant_id, full_name, avatar_url, created_at, updated_at";

export interface SettingsUsersRepository {
  listProfilesWithRolesPaged(tenantId: string, params: { limit: number; offset: number; search?: string }): Promise<{
    data: ProfileWithRoles[];
    count: number;
  }>;
}

export const settingsUsersRepository: SettingsUsersRepository = {
  async listProfilesWithRolesPaged(tenantId, params) {
    const to = Math.max(0, params.offset + params.limit - 1);
    let profilesQuery = supabase
      .from("profiles")
      .select(PROFILE_COLUMNS, { count: "exact" })
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .range(params.offset, to);

    if (params.search && params.search.trim().length > 0) {
      const q = `%${params.search.trim()}%`;
      profilesQuery = profilesQuery.ilike("full_name", q);
    }

    const { data: profiles, error: profilesError, count } = await profilesQuery;

    if (profilesError) {
      throw new ServiceError(profilesError.message ?? "Failed to load profiles", {
        code: profilesError.code,
        details: profilesError,
      });
    }

    if (!profiles?.length) {
      return { data: [], count: count ?? 0 };
    }

    const userIds = profiles.map((profile) => profile.user_id);
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", userIds);

    if (rolesError) {
      throw new ServiceError(rolesError.message ?? "Failed to load user roles", {
        code: rolesError.code,
        details: rolesError,
      });
    }

    const rolesByUserId = new Map<string, ProfileWithRoles["user_roles"]>();
    for (const role of roles ?? []) {
      rolesByUserId.set(role.user_id, [{ role: role.role }]);
    }

    const data = profiles.map((profile) => ({
      ...(profile as any),
      user_roles: rolesByUserId.get(profile.user_id) ?? [],
    })) as ProfileWithRoles[];

    return { data, count: count ?? 0 };
  },
};
