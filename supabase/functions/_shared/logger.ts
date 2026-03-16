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
