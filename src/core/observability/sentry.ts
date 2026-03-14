import * as Sentry from "@sentry/react";
import { env } from "@/core/env/env";

let initialized = false;

export function initSentry() {
  if (initialized || !env.VITE_SENTRY_DSN) return;

  Sentry.init({
    dsn: env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    release: env.VITE_APP_VERSION,
    tracesSampleRate: 0.1,
  });

  initialized = true;
}

export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (!env.VITE_SENTRY_DSN) return;
  Sentry.captureException(error, {
    extra: context,
  });
}
