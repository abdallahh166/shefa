import type {
  AdminClientErrorTrendPoint,
  AdminOperationsAlertSummary,
  AdminPricingPlan,
  AdminRecentJobActivity,
  AdminRecentSystemError,
  AdminSubscription,
  AdminTenant,
  AdminSubscriptionStats,
} from "@/domain/admin/admin.types";
import type { ProfileWithRoles } from "@/domain/settings/profile.types";
import { supabase } from "@/services/supabase/client";
import { ServiceError } from "@/services/supabase/errors";

const TENANT_COLUMNS = "id, name, slug, email, phone, created_at, subscriptions(plan, status)";
const SUBSCRIPTION_COLUMNS =
  "id, tenant_id, plan, status, amount, currency, billing_cycle, expires_at, created_at, tenants(name, slug)";
const PROFILE_COLUMNS = "id, user_id, tenant_id, full_name, avatar_url, created_at, updated_at, tenants(name, slug)";
const PRICING_PLAN_COLUMNS =
  "id, plan_code, name, description, doctor_limit_label, features, monthly_price, annual_price, currency, default_billing_cycle, is_popular, is_public, is_enterprise_contact, display_order, created_at, updated_at, deleted_at";

type TenantSort = { column: "name" | "created_at"; ascending?: boolean };
type ProfileSort = { column: "full_name" | "created_at"; ascending?: boolean };
type SubscriptionSort = { column: "plan" | "status" | "amount" | "expires_at" | "created_at"; ascending?: boolean };

export interface AdminRepository {
  listTenantsPaged(params: {
    limit: number;
    offset: number;
    search?: string;
    plan?: AdminSubscription["plan"];
    sort?: TenantSort;
  }): Promise<{ data: AdminTenant[]; count: number }>;
  listProfilesWithRolesPaged(params: {
    limit: number;
    offset: number;
    search?: string;
    sort?: ProfileSort;
  }): Promise<{ data: ProfileWithRoles[]; count: number }>;
  listSubscriptionsPaged(params: {
    limit: number;
    offset: number;
    search?: string;
    plan?: AdminSubscription["plan"];
    status?: AdminSubscription["status"];
    sort?: SubscriptionSort;
  }): Promise<{ data: AdminSubscription[]; count: number }>;
  listPricingPlans(): Promise<AdminPricingPlan[]>;
  createPricingPlan(input: Omit<AdminPricingPlan, "id" | "created_at" | "updated_at" | "deleted_at">): Promise<AdminPricingPlan>;
  updatePricingPlan(
    id: string,
    input: Partial<Omit<AdminPricingPlan, "id" | "created_at" | "updated_at" | "deleted_at">>,
  ): Promise<AdminPricingPlan>;
  deletePricingPlan(id: string): Promise<void>;
  updateSubscription(
    id: string,
    input: Partial<Pick<AdminSubscription, "plan" | "status" | "billing_cycle">>,
  ): Promise<AdminSubscription>;
  getSubscriptionStats(): Promise<AdminSubscriptionStats>;
  getOperationsAlertSummary(): Promise<AdminOperationsAlertSummary>;
  getRecentJobActivity(limit?: number): Promise<AdminRecentJobActivity[]>;
  getRecentSystemErrors(limit?: number): Promise<AdminRecentSystemError[]>;
  getClientErrorTrend(bucketMinutes?: number, bucketCount?: number): Promise<AdminClientErrorTrendPoint[]>;
}

export const adminRepository: AdminRepository = {
  async listTenantsPaged({ limit, offset, search, plan, sort }) {
    const to = Math.max(0, offset + limit - 1);
    const sortColumn = sort?.column ?? "created_at";
    const ascending = sort?.ascending ?? false;

    if (plan) {
      let planQuery = supabase
        .from("subscriptions")
        .select("plan, status, tenants(id, name, slug, email, phone, created_at)", { count: "exact" })
        .eq("plan", plan)
        .range(offset, to);

      if (search && search.trim().length > 0) {
        const q = `%${search.trim()}%`;
        planQuery = planQuery.or(`tenants.name.ilike.${q},tenants.slug.ilike.${q},tenants.email.ilike.${q}`);
      }

      planQuery = planQuery.order(sortColumn === "name" ? "name" : "created_at", {
        ascending,
        foreignTable: "tenants",
      });

      const { data, error, count } = await planQuery;
      if (error) {
        throw new ServiceError(error.message ?? "Failed to load tenants", {
          code: error.code,
          details: error,
        });
      }

      const mapped = (data ?? [])
        .map((row: any) => {
          if (!row?.tenants) return null;
          return {
            ...row.tenants,
            plan: row.plan ?? null,
            status: row.status ?? null,
          };
        })
        .filter(Boolean) as AdminTenant[];

      return { data: mapped, count: count ?? 0 };
    }

    let query = supabase
      .from("tenants")
      .select(TENANT_COLUMNS, { count: "exact" })
      .range(offset, to);

    if (search && search.trim().length > 0) {
      const q = `%${search.trim()}%`;
      query = query.or(`name.ilike.${q},slug.ilike.${q},email.ilike.${q}`);
    }

    query = query.order(sortColumn === "name" ? "name" : "created_at", { ascending });

    const { data, error, count } = await query;

    if (error) {
      throw new ServiceError(error.message ?? "Failed to load tenants", {
        code: error.code,
        details: error,
      });
    }

    const mapped = (data ?? []).map((row: any) => {
      const subscription = Array.isArray(row.subscriptions) ? row.subscriptions[0] : row.subscriptions;
      return {
        ...row,
        plan: subscription?.plan ?? null,
        status: subscription?.status ?? null,
      } as AdminTenant;
    });

    return { data: mapped, count: count ?? 0 };
  },
  async listProfilesWithRolesPaged({ limit, offset, search, sort }) {
    const to = Math.max(0, offset + limit - 1);
    const sortColumn = sort?.column ?? "created_at";
    const ascending = sort?.ascending ?? false;
    let profilesQuery = supabase
      .from("profiles")
      .select(PROFILE_COLUMNS, { count: "exact" })
      .range(offset, to);
    profilesQuery = profilesQuery.order(sortColumn, { ascending });

    if (search && search.trim().length > 0) {
      const q = `%${search.trim()}%`;
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
      ...profile,
      user_roles: rolesByUserId.get(profile.user_id) ?? [],
    })) as ProfileWithRoles[];

    return { data, count: count ?? 0 };
  },
  async listSubscriptionsPaged({ limit, offset, search, plan, status, sort }) {
    const to = Math.max(0, offset + limit - 1);
    const sortColumn = sort?.column ?? "created_at";
    const ascending = sort?.ascending ?? false;
    let query = supabase
      .from("subscriptions")
      .select(SUBSCRIPTION_COLUMNS, { count: "exact" })
      .range(offset, to);

    if (plan) {
      query = query.eq("plan", plan);
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (search && search.trim().length > 0) {
      const q = `%${search.trim()}%`;
      query = query.or(`tenants.name.ilike.${q},tenants.slug.ilike.${q}`);
    }

    query = query.order(sortColumn, { ascending });

    const { data, error, count } = await query;

    if (error) {
      throw new ServiceError(error.message ?? "Failed to load subscriptions", {
        code: error.code,
        details: error,
      });
    }

    return { data: (data ?? []) as AdminSubscription[], count: count ?? 0 };
  },
  async listPricingPlans() {
    const { data, error } = await supabase
      .from("pricing_plans")
      .select(PRICING_PLAN_COLUMNS)
      .is("deleted_at", null)
      .order("display_order", { ascending: true })
      .order("plan_code", { ascending: true });

    if (error) {
      throw new ServiceError(error.message ?? "Failed to load pricing plans", {
        code: error.code,
        details: error,
      });
    }

    return (data ?? []) as AdminPricingPlan[];
  },
  async createPricingPlan(input) {
    const { data, error } = await supabase
      .from("pricing_plans")
      .insert(input as never)
      .select(PRICING_PLAN_COLUMNS)
      .single();

    if (error) {
      throw new ServiceError(error.message ?? "Failed to create pricing plan", {
        code: error.code,
        details: error,
      });
    }

    return data as AdminPricingPlan;
  },
  async updatePricingPlan(id, input) {
    if (Object.keys(input).length === 0) {
      const { data, error } = await supabase
        .from("pricing_plans")
        .select(PRICING_PLAN_COLUMNS)
        .eq("id", id)
        .single();

      if (error) {
        throw new ServiceError(error.message ?? "Failed to load pricing plan", {
          code: error.code,
          details: error,
        });
      }

      return data as AdminPricingPlan;
    }

    const { data, error } = await supabase
      .from("pricing_plans")
      .update(input)
      .eq("id", id)
      .select(PRICING_PLAN_COLUMNS)
      .single();

    if (error) {
      throw new ServiceError(error.message ?? "Failed to update pricing plan", {
        code: error.code,
        details: error,
      });
    }

    return data as AdminPricingPlan;
  },
  async deletePricingPlan(id) {
    const { error } = await supabase
      .from("pricing_plans")
      .delete()
      .eq("id", id);

    if (error) {
      throw new ServiceError(error.message ?? "Failed to delete pricing plan", {
        code: error.code,
        details: error,
      });
    }
  },
  async getSubscriptionStats() {
    const { data, error } = await supabase.rpc("admin_subscription_stats");
    if (error) {
      throw new ServiceError(error.message ?? "Failed to load subscription stats", {
        code: error.code,
        details: error,
      });
    }

    return (data ?? {}) as AdminSubscriptionStats;
  },
  async getOperationsAlertSummary() {
    const { data, error } = await supabase.rpc("admin_operations_alert_summary");
    if (error) {
      throw new ServiceError(error.message ?? "Failed to load operations alert summary", {
        code: error.code,
        details: error,
      });
    }

    if (Array.isArray(data)) {
      return ((data[0] ?? {}) as AdminOperationsAlertSummary);
    }

    return ((data ?? {}) as AdminOperationsAlertSummary);
  },
  async getRecentJobActivity(limit = 10) {
    const { data, error } = await supabase.rpc("admin_recent_job_activity", { _limit: limit });
    if (error) {
      throw new ServiceError(error.message ?? "Failed to load recent job activity", {
        code: error.code,
        details: error,
      });
    }

    return (Array.isArray(data) ? data : []) as AdminRecentJobActivity[];
  },
  async getRecentSystemErrors(limit = 10) {
    const { data, error } = await supabase.rpc("admin_recent_system_errors", { _limit: limit });
    if (error) {
      throw new ServiceError(error.message ?? "Failed to load recent system errors", {
        code: error.code,
        details: error,
      });
    }

    return (Array.isArray(data) ? data : []) as AdminRecentSystemError[];
  },
  async getClientErrorTrend(bucketMinutes = 15, bucketCount = 6) {
    const { data, error } = await supabase.rpc("admin_client_error_trend", {
      _bucket_minutes: bucketMinutes,
      _bucket_count: bucketCount,
    });
    if (error) {
      throw new ServiceError(error.message ?? "Failed to load client error trend", {
        code: error.code,
        details: error,
      });
    }

    return (Array.isArray(data) ? data : []) as AdminClientErrorTrendPoint[];
  },
  async updateSubscription(id, input) {
    const payload: Record<string, unknown> = {};
    if (input.plan !== undefined) payload.plan = input.plan;
    if (input.status !== undefined) payload.status = input.status;
    if (input.billing_cycle !== undefined) payload.billing_cycle = input.billing_cycle;

    if (Object.keys(payload).length === 0) {
      const { data, error } = await supabase
        .from("subscriptions")
        .select(SUBSCRIPTION_COLUMNS)
        .eq("id", id)
        .single();

      if (error) {
        throw new ServiceError(error.message ?? "Failed to load subscription", {
          code: error.code,
          details: error,
        });
      }

      return data as AdminSubscription;
    }

    const { data, error } = await supabase
      .from("subscriptions")
      .update(payload)
      .eq("id", id)
      .select(SUBSCRIPTION_COLUMNS)
      .single();

    if (error) {
      throw new ServiceError(error.message ?? "Failed to update subscription", {
        code: error.code,
        details: error,
      });
    }

    return data as AdminSubscription;
  },
};
