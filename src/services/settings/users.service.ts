import { z } from "zod";
import { profileWithRolesSchema } from "@/domain/settings/profile.schema";
import { toServiceError } from "@/services/supabase/errors";
import { getTenantContext } from "@/services/supabase/tenant";
import { settingsUsersRepository } from "./users.repository";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
  search: z.string().trim().min(1).optional(),
});

const sortSchema = z
  .object({
    column: z.enum(["full_name", "created_at"]),
    direction: z.enum(["asc", "desc"]).optional(),
  })
  .optional();

export const settingsUsersService = {
  async listProfilesWithRolesPaged(input?: {
    page?: number;
    pageSize?: number;
    search?: string;
    sort?: { column: "full_name" | "created_at"; direction?: "asc" | "desc" };
  }) {
    try {
      const parsed = paginationSchema.extend({ sort: sortSchema }).parse(input ?? {});
      const { tenantId } = getTenantContext();
      const { data, count } = await settingsUsersRepository.listProfilesWithRolesPaged(tenantId, {
        limit: parsed.pageSize,
        offset: (parsed.page - 1) * parsed.pageSize,
        search: parsed.search,
        sort: parsed.sort
          ? { column: parsed.sort.column, ascending: parsed.sort.direction === "asc" }
          : undefined,
      });
      return { data: z.array(profileWithRolesSchema).parse(data), total: count };
    } catch (err) {
      throw toServiceError(err, "Failed to load users");
    }
  },
};
