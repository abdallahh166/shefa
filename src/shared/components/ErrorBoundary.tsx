import { Component, ReactNode } from "react";
import { Button } from "@/components/primitives/Button";
import { useAuth } from "@/core/auth/authStore";
import { translatePath } from "@/core/i18n/config";
import { clientErrorLogService } from "@/services/observability/clientErrorLog.service";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };
  private reported = false;

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error("Unhandled error:", error, info);
    if (this.reported) return;
    this.reported = true;
    void this.reportError(error, info);
  }

  private async reportError(error: unknown, info: unknown) {
    const { user } = useAuth.getState();
    if (!user) return;

    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack ?? null : null;
    const componentStack =
      typeof info === "object" && info && "componentStack" in info
        ? String((info as { componentStack?: string }).componentStack ?? "")
        : null;

    try {
      await clientErrorLogService.log({
        tenant_id: user.tenantId,
        user_id: user.id,
        message,
        stack,
        component_stack: componentStack,
        url: window.location.href,
        user_agent: navigator.userAgent,
      });
    } catch {
      // Swallow errors to avoid cascading failures in the boundary.
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="max-w-md space-y-3 text-center">
            <h1 className="text-xl font-semibold">
              {translatePath("common.errorBoundaryTitle")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {translatePath("common.errorBoundaryDescription")}
            </p>
            <Button onClick={this.handleReload}>
              {translatePath("common.reload")}
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
