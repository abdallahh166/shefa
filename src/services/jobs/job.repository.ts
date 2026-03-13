import { supabase } from "@/services/supabase/client";
import { ServiceError } from "@/services/supabase/errors";

export interface JobRepository {
  invoke(functionName: string, payload: Record<string, unknown>): Promise<void>;
}

export const jobRepository: JobRepository = {
  async invoke(functionName, payload) {
    const { error } = await supabase.functions.invoke(functionName, {
      body: payload,
    });

    if (error) {
      throw new ServiceError(error.message ?? "Failed to invoke job", { code: error.code, details: error });
    }
  },
};
