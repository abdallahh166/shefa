import { clientErrorLogCreateSchema } from "@/domain/settings/clientErrorLog.schema";
import { toServiceError } from "@/services/supabase/errors";
import { clientErrorLogRepository } from "./clientErrorLog.repository";

export const clientErrorLogService = {
  async log(input: {
    tenant_id: string;
    user_id: string;
    request_id?: string | null;
    action_type?: string | null;
    resource_type?: string | null;
    message: string;
    stack?: string | null;
    component_stack?: string | null;
    url?: string | null;
    user_agent?: string | null;
  }) {
    try {
      const parsed = clientErrorLogCreateSchema.parse(input);
      await clientErrorLogRepository.insert(parsed);
    } catch (err) {
      throw toServiceError(err, "Failed to log client error");
    }
  },
};
