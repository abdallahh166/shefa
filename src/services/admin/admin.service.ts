import { z } from "zod";
import {
  adminSubscriptionSchema,
  adminSubscriptionUpdateSchema,
  adminSubscriptionStatsSchema,
  adminTenantSchema,
  subscriptionPlanEnum,
  subscriptionStatusEnum,
} from "@/domain/admin/admin.schema";
import type { AdminSubscriptionUpdateInput } from "@/domain/admin/admin.types";
import { profileWithRolesSchema } from "@/domain/settings/profile.schema";
import { uuidSchema } from "@/domain/shared/identifiers.schema";
import { toServiceError } from "@/services/supabase/errors";
import { useAuth } from "@/core/auth/authStore";
import { auditLogService } from "@/services/settings/audit.service";
import { adminRepository } from "./admin.repository";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  plan: subscriptionPlanEnum.optional(),
  status: subscriptionStatusEnum.optional(),
});

const sortDirectionSchema = z.enum(["asc", "desc"]);
const tenantSortSchema = z
  .object({ column: z.enum(["name", "created_at"]), direction: sortDirectionSchema.optional() })
  .optional();
const profileSortSchema = z
  .object({ column: z.enum(["full_name", "created_at"]), direction: sortDirectionSchema.optional() })
  .optional();
const subscriptionSortSchema = z
  .object({
    column: z.enum(["plan", "status", "amount", "expires_at", "created_at"]),
    direction: sortDirectionSchema.optional(),
  })
  .optional();

export const adminService = {
  async listTenantsPaged(input?: {
    page?: number;
    pageSize?: number;
    search?: string;
    plan?: string;
    sort?: { column: "name" | "created_at"; direction?: "asc" | "desc" };
  }) {
    try {
      const parsed = paginationSchema
        .pick({ page: true, pageSize: true, search: true, plan: true })
        .extend({ sort: tenantSortSchema })
        .parse(input ?? {});
      const { data, count } = await adminRepository.listTenantsPaged({
        limit: parsed.pageSize,
        offset: (parsed.page - 1) * parsed.pageSize,
        search: parsed.search,
        plan: parsed.plan,
        sort: parsed.sort
          ? { column: parsed.sort.column, ascending: parsed.sort.direction === "asc" }
          : undefined,
      });
      return { data: z.array(adminTenantSchema).parse(data), total: count };
    } catch (err) {
      throw toServiceError(err, "Failed to load tenants");
    }
  },
  async listProfilesWithRolesPaged(input?: {
    page?: number;
    pageSize?: number;
    search?: string;
    sort?: { column: "full_name" | "created_at"; direction?: "asc" | "desc" };
  }) {
    try {
      const parsed = paginationSchema
        .pick({ page: true, pageSize: true, search: true })
        .extend({ sort: profileSortSchema })
        .parse(input ?? {});
      const { data, count } = await adminRepository.listProfilesWithRolesPaged({
        limit: parsed.pageSize,
        offset: (parsed.page - 1) * parsed.pageSize,
        search: parsed.search,
        sort: parsed.sort
          ? { column: parsed.sort.column, ascending: parsed.sort.direction === "asc" }
          : undefined,
      });
      return { data: z.array(profileWithRolesSchema).parse(data), total: count };
    } catch (err) {
      throw toServiceError(err, "Failed to load profiles");
    }
  },
  async listSubscriptionsPaged(input?: {
    page?: number;
    pageSize?: number;
    search?: string;
    plan?: string;
    status?: string;
    sort?: { column: "plan" | "status" | "amount" | "expires_at" | "created_at"; direction?: "asc" | "desc" };
  }) {
    try {
      const parsed = paginationSchema
        .pick({ page: true, pageSize: true, search: true, plan: true, status: true })
        .extend({ sort: subscriptionSortSchema })
        .parse(input ?? {});
      const { data, count } = await adminRepository.listSubscriptionsPaged({
        limit: parsed.pageSize,
        offset: (parsed.page - 1) * parsed.pageSize,
        search: parsed.search,
        plan: parsed.plan,
        status: parsed.status,
        sort: parsed.sort
          ? { column: parsed.sort.column, ascending: parsed.sort.direction === "asc" }
          : undefined,
      });
      return { data: z.array(adminSubscriptionSchema).parse(data), total: count };
    } catch (err) {
      throw toServiceError(err, "Failed to load subscriptions");
    }
  },
  async getSubscriptionStats() {
    try {
      const result = await adminRepository.getSubscriptionStats();
      return adminSubscriptionStatsSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to load subscription stats");
    }
  },
  async updateSubscription(id: string, input: AdminSubscriptionUpdateInput) {
    try {
      const parsedId = uuidSchema.parse(id);
      const parsed = adminSubscriptionUpdateSchema.parse(input);
      const result = await adminRepository.updateSubscription(parsedId, parsed);
      const currentUser = useAuth.getState().user;
      if (currentUser) {
        await auditLogService.logEvent({
          tenant_id: result.tenant_id,
          user_id: currentUser.id,
          action: "admin_subscription_updated",
          action_type: "subscription_update",
          entity_type: "subscription",
          entity_id: result.id,
          details: { changes: parsed, actor_role: currentUser.role },
        });
      }
      return adminSubscriptionSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to update subscription");
    }
  },
};
