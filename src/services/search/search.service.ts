import { globalSearchInputSchema, searchResultsSchema } from "@/domain/search/search.schema";
import type { GlobalSearchInput } from "@/domain/search/search.types";
import { useAuth } from "@/core/auth/authStore";
import { toServiceError } from "@/services/supabase/errors";
import { getTenantContext } from "@/services/supabase/tenant";
import { searchRepository } from "./search.repository";

export const searchService = {
  async globalSearch(input: GlobalSearchInput) {
    try {
      const parsed = globalSearchInputSchema.parse(input);
      const { tenantId } = getTenantContext();
      const result = await searchRepository.searchGlobal(tenantId, parsed.term, parsed.limit);
      const data = searchResultsSchema.parse(result);
      const { hasPermission } = useAuth.getState();
      const canSeePatients = hasPermission("view_patients") || hasPermission("manage_patients");
      const canSeeBilling = hasPermission("view_billing") || hasPermission("manage_billing");
      const canSeeDoctors =
        hasPermission("view_patients") ||
        hasPermission("manage_patients") ||
        hasPermission("view_appointments") ||
        hasPermission("manage_appointments") ||
        hasPermission("manage_clinic");

      return data.filter((row) => {
        if (row.entity_type === "patient") return canSeePatients;
        if (row.entity_type === "invoice") return canSeeBilling;
        if (row.entity_type === "doctor") return canSeeDoctors;
        return false;
      });
    } catch (err) {
      throw toServiceError(err, "Failed to run global search");
    }
  },
};
