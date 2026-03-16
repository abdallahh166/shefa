import { clientErrorLogService } from "@/services/observability/clientErrorLog.service";
import { useAuth } from "@/core/auth/authStore";
import { createRequestId } from "./requestId";
import { captureError } from "./sentry";

export type LogContext = {
  feature?: string;
  action?: string;
  actionType?: string;
  resourceType?: string;
  requestId?: string;
  tenantId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
};

const serializeError = (error: unknown) => ({
  message: error instanceof Error ? error.message : String(error),
  stack: error instanceof Error ? error.stack ?? null : null,
});

export function logInfo(message: string, context?: LogContext) {
  const payload = { ...context };
  console.info("[info]", message, payload ?? {});
}

export function logWarn(message: string, context?: LogContext) {
  const payload = { ...context };
  console.warn("[warn]", message, payload ?? {});
}

export async function reportError(error: unknown, context?: LogContext) {
  const { user } = useAuth.getState();
  const requestId = context?.requestId ?? createRequestId();
  const tenantId = context?.tenantId ?? user?.tenantId;
  const userId = context?.userId ?? user?.id;
  const { message, stack } = serializeError(error);
  const actionType = context?.actionType ?? context?.action ?? null;
  const resourceType = context?.resourceType ?? context?.feature ?? null;

  console.error("[error]", message, { stack, context });
  captureError(error, {
    request_id: requestId,
    tenant_id: tenantId ?? null,
    user_id: userId ?? null,
    action_type: actionType,
    resource_type: resourceType,
    metadata: context?.metadata ?? null,
  });

  if (!tenantId || !userId) return;
  try {
    await clientErrorLogService.log({
      tenant_id: tenantId,
      user_id: userId,
      request_id: requestId,
      action_type: actionType,
      resource_type: resourceType,
      message,
      stack,
      component_stack: null,
      url: window.location.href,
      user_agent: navigator.userAgent,
    });
  } catch {
    // Avoid cascading failures
  }
}
