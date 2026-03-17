import { supabase } from "@/services/supabase/client";
import { ServiceError } from "@/services/supabase/errors";

export type DomainEventRecord = {
  event_type: string;
  event_version: number;
  entity_type: string;
  entity_id: string | null;
  tenant_id: string;
  payload: Record<string, unknown>;
  created_at?: string;
  processed_at?: string | null;
};

export const domainEventRepository = {
  async insert(event: DomainEventRecord) {
    const { error } = await supabase.from("domain_events").insert(event as any);
    if (error) {
      throw new ServiceError(error.message ?? "Failed to persist domain event", {
        code: error.code,
        details: error,
      });
    }
  },
};
