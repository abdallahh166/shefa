import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { captureException } from "./sentry.ts";

type LogLevel = "info" | "warn" | "error";

export type LogContext = {
  request_id?: string;
  tenant_id?: string;
  user_id?: string;
  action_type?: string;
  resource_type?: string;
  metadata?: Record<string, unknown>;
};

export function log(level: LogLevel, message: string, context?: LogContext) {
  const payload = {
    level,
    message,
    request_id: context?.request_id ?? null,
    tenant_id: context?.tenant_id ?? null,
    user_id: context?.user_id ?? null,
    action_type: context?.action_type ?? null,
    resource_type: context?.resource_type ?? null,
    metadata: context?.metadata ?? {},
    ts: new Date().toISOString(),
  };
  if (level === "error") {
    captureException(new Error(message), payload);
  }
  console.log(JSON.stringify(payload));
}

export const logInfo = (message: string, context?: LogContext) => log("info", message, context);
export const logWarn = (message: string, context?: LogContext) => log("warn", message, context);
export const logError = (message: string, context?: LogContext) => log("error", message, context);

export async function persistSystemLog(
  adminClient: SupabaseClient,
  service: string,
  level: LogLevel,
  message: string,
  context?: LogContext,
) {
  const metadata = {
    action_type: context?.action_type ?? null,
    resource_type: context?.resource_type ?? null,
    ...(context?.metadata ?? {}),
  };

  const { error } = await adminClient.from("system_logs").insert({
    level,
    service,
    message,
    tenant_id: context?.tenant_id ?? null,
    user_id: context?.user_id ?? null,
    request_id: context?.request_id ?? null,
    metadata,
  });

  if (error) {
    console.log(JSON.stringify({
      level: "warn",
      message: "system_log_persist_failed",
      service,
      request_id: context?.request_id ?? null,
      metadata: {
        original_message: message,
        error: error.message ?? "Unknown system log persistence error",
      },
      ts: new Date().toISOString(),
    }));
  }
}
