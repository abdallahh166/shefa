import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/core/auth/authStore";

type TableName = "patients" | "appointments" | "doctors" | "invoices" | "medications" | "lab_orders" | "insurance_claims" | "prescriptions" | "medical_records";

export function useSupabaseTable<T = any>(
  table: TableName,
  options?: {
    select?: string;
    enabled?: boolean;
    orderBy?: { column: string; ascending?: boolean };
  }
) {
  const { user } = useAuth();
  const tenantId = user?.tenantId;

  return useQuery<T[]>({
    queryKey: [table, tenantId],
    queryFn: async () => {
      let query = supabase
        .from(table)
        .select(options?.select ?? "*");

      // Only filter by tenant for real (non-demo) users
      if (tenantId && tenantId !== "demo") {
        query = query.eq("tenant_id", tenantId);
      }

      if (options?.orderBy) {
        query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending ?? false });
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as T[];
    },
    enabled: (options?.enabled ?? true) && !!tenantId && tenantId !== "demo",
  });
}
