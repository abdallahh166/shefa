import { z } from "zod";

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  VITE_SUPABASE_PROJECT_ID: z.string().min(1).optional().or(z.literal("")),
  VITE_CAPTCHA_SITE_KEY: z.string().min(1).optional().or(z.literal("")),
});

const parsed = envSchema.safeParse({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  VITE_SUPABASE_PROJECT_ID: import.meta.env.VITE_SUPABASE_PROJECT_ID,
  VITE_CAPTCHA_SITE_KEY: import.meta.env.VITE_CAPTCHA_SITE_KEY,
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
};
