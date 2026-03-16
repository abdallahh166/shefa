import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { env } from "@/core/env/env";

const isTestEnv = typeof import.meta !== "undefined" && import.meta.env?.MODE === "test";
const testStorageKey = isTestEnv
  ? `sb-test-${Math.random().toString(36).slice(2)}-auth-token`
  : undefined;
const authStorage = isTestEnv
  ? {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    }
  : localStorage;

export const supabase = createClient<Database>(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: authStorage,
      storageKey: testStorageKey,
      persistSession: !isTestEnv,
      autoRefreshToken: !isTestEnv,
    },
  },
);
