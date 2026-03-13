import { auditLogSchema } from "@/domain/settings/audit.schema";
import { toServiceError } from "@/services/supabase/errors";
import { getTenantContext } from "@/services/supabase/tenant";
import { auditLogRepository } from "./audit.repository";
import { z } from "zod";

export const auditLogService = {
  async listRecent(limit = 50) {
    try {
      const { tenantId } = getTenantContext();
      const result = await auditLogRepository.listRecent(tenantId, limit);
      return z.array(auditLogSchema).parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to load audit logs");
    }
  },
  async logEvent(input: {
    tenant_id: string;
    user_id: string;
    action: string;
    entity_type: string;
    entity_id?: string | null;
    details?: Record<string, unknown> | null;
    request_id?: string | null;
    action_type?: string | null;
    resource_type?: string | null;
  }) {
    try {
      await auditLogRepository.logEvent(input);
    } catch (err) {
      throw toServiceError(err, "Failed to write audit log");
    }
  },
};
