import { clientErrorLogService } from "@/services/observability/clientErrorLog.service";
import { useAuth } from "@/core/auth/authStore";
import { createRequestId } from "./requestId";

export type LogContext = {
  feature?: string;
  action?: string;
  resourceType?: string;
  metadata?: Record<string, unknown>;
};

const serializeError = (error: unknown) => ({
  message: error instanceof Error ? error.message : String(error),
  stack: error instanceof Error ? error.stack ?? null : null,
});

export function logInfo(message: string, context?: LogContext) {
  // eslint-disable-next-line no-console
  console.info("[info]", message, context ?? {});
}

export function logWarn(message: string, context?: LogContext) {
  // eslint-disable-next-line no-console
  console.warn("[warn]", message, context ?? {});
}

export async function reportError(error: unknown, context?: LogContext) {
  const { user } = useAuth.getState();
  const { message, stack } = serializeError(error);

  // eslint-disable-next-line no-console
  console.error("[error]", message, { stack, context });

  if (!user) return;
  try {
    await clientErrorLogService.log({
      tenant_id: user.tenantId,
      user_id: user.id,
      request_id: createRequestId(),
      action_type: context?.action ?? null,
      resource_type: context?.resourceType ?? context?.feature ?? null,
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
