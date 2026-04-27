import { authService } from "./auth.service";
import { useAuth } from "@/core/auth/authStore";
import { privilegedSessionService } from "./privilegedSession.service";

let privilegedLifecycleStarted = false;

export function initializePrivilegedSessionLifecycle() {
  if (privilegedLifecycleStarted) return;
  privilegedLifecycleStarted = true;

  if (useAuth.getState().user) {
    void privilegedSessionService.refresh().catch(() => undefined);
  }

  useAuth.subscribe((state, previousState) => {
    if (state.user?.id === previousState.user?.id) return;
    if (!state.user) {
      state.clearPrivilegedAuth();
      return;
    }
    void privilegedSessionService.refresh().catch(() => undefined);
  });

  authService.onAuthStateChange((event, sessionUser) => {
    if (event === "SIGNED_OUT" || !sessionUser) {
      useAuth.getState().clearPrivilegedAuth();
      return;
    }

    if (
      event === "SIGNED_IN" ||
      event === "TOKEN_REFRESHED" ||
      event === "USER_UPDATED" ||
      event === "MFA_CHALLENGE_VERIFIED"
    ) {
      void privilegedSessionService.refresh().catch(() => undefined);
    }
  });
}
