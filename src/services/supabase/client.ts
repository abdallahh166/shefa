import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { env } from "@/core/env/env";

export const supabase = createClient<Database>(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);
