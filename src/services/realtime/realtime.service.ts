import { toServiceError } from "@/services/supabase/errors";
import { realtimeRepository, RealtimeTable } from "./realtime.repository";

export const realtimeService = {
  subscribeToTenantTables(
    tenantId: string,
    tables: RealtimeTable[],
    onChange: () => void,
  ) {
    try {
      return realtimeRepository.subscribeToTenantTables(tenantId, tables, onChange);
    } catch (err) {
      throw toServiceError(err, "Failed to subscribe to realtime updates");
    }
  },
};
