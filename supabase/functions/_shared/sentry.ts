import * as Sentry from "npm:@sentry/deno";

let initialized = false;

export function initSentry() {
  const dsn = Deno.env.get("SENTRY_DSN");
  if (!dsn || initialized) return;

  Sentry.init({
    dsn,
    environment: Deno.env.get("SUPABASE_ENV") ?? "development",
    release: Deno.env.get("APP_VERSION") ?? undefined,
  });

  initialized = true;
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!Deno.env.get("SENTRY_DSN")) return;
  Sentry.captureException(error, {
    extra: context,
  });
}
