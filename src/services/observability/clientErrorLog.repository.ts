import type { ClientErrorLogCreateInput } from "@/domain/settings/clientErrorLog.types";
import { supabase } from "@/services/supabase/client";
import { ServiceError } from "@/services/supabase/errors";

export interface ClientErrorLogRepository {
  insert(input: ClientErrorLogCreateInput): Promise<void>;
}

export const clientErrorLogRepository: ClientErrorLogRepository = {
  async insert(input) {
    const { error } = await supabase.from("client_error_logs").insert({
      tenant_id: input.tenant_id,
      user_id: input.user_id,
      message: input.message,
      stack: input.stack ?? null,
      component_stack: input.component_stack ?? null,
      url: input.url ?? null,
      user_agent: input.user_agent ?? null,
    });
    if (error) {
      throw new ServiceError(error.message ?? "Failed to log client error", { code: error.code, details: error });
    }
  },
};
