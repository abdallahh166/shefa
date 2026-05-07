import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { env } from "@/core/env/env";
import { createSupabaseAuthFetch } from "@/services/supabase/supabaseAuthFetch";

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
const authOptions = {
  storage: authStorage,
  persistSession: !isTestEnv,
  autoRefreshToken: !isTestEnv,
  detectSessionInUrl: false,
  ...(isTestEnv && testStorageKey ? { storageKey: testStorageKey } : !isTestEnv ? { storageKey: "shefaa-auth" } : {}),
};

const globalFetch = isTestEnv ? globalThis.fetch.bind(globalThis) : createSupabaseAuthFetch();

export const supabase = createClient<Database>(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: authOptions,
    global: { fetch: globalFetch },
  },
);
