import { supabase } from "@/services/supabase/client";

export type RealtimeTable =
  | "patients"
  | "appointments"
  | "doctors"
  | "invoices"
  | "medications"
  | "lab_orders"
  | "insurance_claims";

export interface RealtimeRepository {
  subscribeToTenantTables(
    tenantId: string,
    tables: RealtimeTable[],
    onChange: () => void,
  ): { unsubscribe: () => void };
}

export const realtimeRepository: RealtimeRepository = {
  subscribeToTenantTables(tenantId, tables, onChange) {
    const tablesKey = [...new Set(tables)].sort().join("|");
    const channel = supabase.channel(`realtime:${tenantId}:${tablesKey}`);

    for (const table of tables) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `tenant_id=eq.${tenantId}`,
        },
        onChange,
      );
    }

    channel.subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  },
};
