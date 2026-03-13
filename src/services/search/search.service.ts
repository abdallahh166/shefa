import { globalSearchInputSchema, searchResultsSchema } from "@/domain/search/search.schema";
import type { GlobalSearchInput } from "@/domain/search/search.types";
import { toServiceError } from "@/services/supabase/errors";
import { getTenantContext } from "@/services/supabase/tenant";
import { searchRepository } from "./search.repository";

export const searchService = {
  async globalSearch(input: GlobalSearchInput) {
    try {
      const parsed = globalSearchInputSchema.parse(input);
      const { tenantId } = getTenantContext();
      const result = await searchRepository.searchGlobal(tenantId, parsed.term, parsed.limit);
      return searchResultsSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to run global search");
    }
  },
};
