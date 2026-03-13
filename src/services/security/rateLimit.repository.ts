import { supabase } from "@/services/supabase/client";
import { ServiceError } from "@/services/supabase/errors";

export interface RateLimitRepository {
  check(key: string, maxHits: number, windowSeconds: number): Promise<boolean>;
}

export const rateLimitRepository: RateLimitRepository = {
  async check(key, maxHits, windowSeconds) {
    const { data, error } = await (supabase.rpc as any)("check_rate_limit", {
      _key: key,
      _max_hits: maxHits,
      _window_seconds: windowSeconds,
    });
    if (error) {
      throw new ServiceError(error.message ?? "Rate limiter unavailable", {
        code: error.code,
        details: error,
      });
    }
    return Boolean(data);
  },
};
