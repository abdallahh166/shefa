import { z } from "zod";

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  VITE_SUPABASE_PROJECT_ID: z.string().min(1).optional().or(z.literal("")),
  VITE_CAPTCHA_SITE_KEY: z.string().min(1).optional().or(z.literal("")),
  VITE_SENTRY_DSN: z.string().url().optional().or(z.literal("")),
  VITE_APP_VERSION: z.string().min(1).optional().or(z.literal("")),
  VITE_AUTH_KILL_SWITCH: z.string().optional().or(z.literal("")),
});

const isTest =
  typeof process !== "undefined" &&
  (process.env.VITEST || process.env.NODE_ENV === "test");

const getEnv = (key: keyof z.infer<typeof envSchema>) => {
  const metaEnv = typeof import.meta !== "undefined" ? (import.meta as any).env : undefined;
  const processEnv = typeof process !== "undefined" ? process.env : undefined;
  return metaEnv?.[key] ?? processEnv?.[key];
};

let parsed = envSchema.safeParse({
  VITE_SUPABASE_URL: getEnv("VITE_SUPABASE_URL"),
  VITE_SUPABASE_PUBLISHABLE_KEY: getEnv("VITE_SUPABASE_PUBLISHABLE_KEY"),
  VITE_SUPABASE_PROJECT_ID: getEnv("VITE_SUPABASE_PROJECT_ID"),
  VITE_CAPTCHA_SITE_KEY: getEnv("VITE_CAPTCHA_SITE_KEY"),
  VITE_SENTRY_DSN: getEnv("VITE_SENTRY_DSN"),
  VITE_APP_VERSION: getEnv("VITE_APP_VERSION"),
  VITE_AUTH_KILL_SWITCH: getEnv("VITE_AUTH_KILL_SWITCH"),
});

if (!parsed.success && isTest) {
  parsed = envSchema.safeParse({
    VITE_SUPABASE_URL: "http://localhost",
    VITE_SUPABASE_PUBLISHABLE_KEY: "test-key",
    VITE_SUPABASE_PROJECT_ID: "",
    VITE_CAPTCHA_SITE_KEY: "",
    VITE_SENTRY_DSN: "",
    VITE_APP_VERSION: "",
    VITE_AUTH_KILL_SWITCH: "",
  });
}

if (!parsed.success) {
  const message =
    "Invalid environment configuration. Check .env values for required VITE_ variables.";
  console.error(message, parsed.error.flatten().fieldErrors);
  throw new Error(message);
}

export const env = {
  ...parsed.data,
  VITE_SUPABASE_PROJECT_ID:
    parsed.data.VITE_SUPABASE_PROJECT_ID || undefined,
  VITE_CAPTCHA_SITE_KEY:
    parsed.data.VITE_CAPTCHA_SITE_KEY || undefined,
  VITE_SENTRY_DSN:
    parsed.data.VITE_SENTRY_DSN || undefined,
  VITE_APP_VERSION:
    parsed.data.VITE_APP_VERSION || undefined,
  VITE_AUTH_KILL_SWITCH:
    parsed.data.VITE_AUTH_KILL_SWITCH || undefined,
};
