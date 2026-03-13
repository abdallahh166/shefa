import type { AuditLog } from "@/domain/settings/audit.types";
import { supabase } from "@/services/supabase/client";
import { ServiceError } from "@/services/supabase/errors";

const AUDIT_COLUMNS =
  "id, tenant_id, user_id, action, action_type, request_id, entity_type, resource_type, entity_id, details, ip_address, created_at";

export interface AuditLogRepository {
  listRecent(tenantId: string, limit?: number): Promise<AuditLog[]>;
  logEvent(input: {
    tenant_id: string;
    user_id: string;
    action: string;
    entity_type: string;
    entity_id?: string | null;
    details?: Record<string, unknown> | null;
    request_id?: string | null;
    action_type?: string | null;
    resource_type?: string | null;
  }): Promise<void>;
}

export const auditLogRepository: AuditLogRepository = {
  async listRecent(tenantId, limit = 50) {
    const { data, error } = await supabase
      .from("audit_logs")
      .select(AUDIT_COLUMNS)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new ServiceError(error.message ?? "Failed to load audit logs", {
        code: error.code,
        details: error,
      });
    }

    return (data ?? []) as AuditLog[];
  },
  async logEvent(input) {
    const { error } = await supabase.rpc("log_audit_event", {
      _tenant_id: input.tenant_id,
      _user_id: input.user_id,
      _action: input.action,
      _entity_type: input.entity_type,
      _entity_id: input.entity_id ?? null,
      _details: input.details ?? null,
      _request_id: input.request_id ?? null,
      _action_type: input.action_type ?? null,
      _resource_type: input.resource_type ?? null,
    });

    if (error) {
      throw new ServiceError(error.message ?? "Failed to write audit log", { code: error.code, details: error });
    }
  },
};
