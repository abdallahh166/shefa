import { z } from "zod";

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  VITE_SUPABASE_PROJECT_ID: z.string().min(1).optional().or(z.literal("")),
  VITE_CAPTCHA_SITE_KEY: z.string().min(1).optional().or(z.literal("")),
  VITE_SENTRY_DSN: z.string().url().optional().or(z.literal("")),
  VITE_APP_VERSION: z.string().min(1).optional().or(z.literal("")),
});

const parsed = envSchema.safeParse({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  VITE_SUPABASE_PROJECT_ID: import.meta.env.VITE_SUPABASE_PROJECT_ID,
  VITE_CAPTCHA_SITE_KEY: import.meta.env.VITE_CAPTCHA_SITE_KEY,
  VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
  VITE_APP_VERSION: import.meta.env.VITE_APP_VERSION,
});

if (!parsed.success) {
  const message =
    "Invalid environment configuration. Check .env values for required VITE_ variables.";
  // eslint-disable-next-line no-console
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
};
