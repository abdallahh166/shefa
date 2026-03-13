import type { SearchResult } from "@/domain/search/search.types";
import { supabase } from "@/services/supabase/client";
import { ServiceError } from "@/services/supabase/errors";

export interface SearchRepository {
  searchGlobal(tenantId: string, term: string, limit?: number): Promise<SearchResult[]>;
}

export const searchRepository: SearchRepository = {
  async searchGlobal(_tenantId, term, limit = 8) {
    const { data, error } = await (supabase.rpc as any)("search_global", { _term: term, _limit: limit });
    if (error) {
      throw new ServiceError(error.message ?? "Failed to search", {
        code: error.code,
        details: error,
      });
    }
    return (data ?? []) as SearchResult[];
  },
};
