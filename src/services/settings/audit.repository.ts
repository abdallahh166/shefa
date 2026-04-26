import type { AuditLog } from "@/domain/settings/audit.types";
import { supabase } from "@/services/supabase/client";
import { ServiceError } from "@/services/supabase/errors";

const AUDIT_COLUMNS =
  "id, tenant_id, user_id, actor_id, action, action_type, request_id, entity_type, resource_type, entity_id, resource_id, details, metadata, ip_address, created_at";

export interface AuditLogRepository {
  listPaged(tenantId: string, limit: number, offset: number): Promise<{ data: AuditLog[]; count: number }>;
  logEvent(input: {
    tenant_id?: string | null;
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
  async listPaged(tenantId, limit, offset) {
    const to = Math.max(0, offset + limit - 1);
    const { data, error, count } = await supabase
      .from("audit_logs")
      .select(AUDIT_COLUMNS, { count: "exact" })
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .range(offset, to);

    if (error) {
      throw new ServiceError(error.message ?? "Failed to load audit logs", {
        code: error.code,
        details: error,
      });
    }

    return { data: (data ?? []) as AuditLog[], count: count ?? 0 };
  },
  async logEvent(input) {
    const { error } = await supabase.rpc("log_audit_event", {
      _tenant_id: input.tenant_id ?? null,
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
