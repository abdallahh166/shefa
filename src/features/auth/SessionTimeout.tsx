import { useEffect, useRef, useCallback, useState } from "react";
import { useAuth } from "@/core/auth/authStore";
import { useI18n } from "@/core/i18n/i18nStore";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll"] as const;

function getSessionPolicy(role?: string) {
  if (role === "super_admin") {
    return { idleTimeoutMs: 10 * 60 * 1000, warningBeforeMs: 45 * 1000 };
  }
  if (role === "clinic_admin") {
    return { idleTimeoutMs: 12 * 60 * 1000, warningBeforeMs: 45 * 1000 };
  }
  return { idleTimeoutMs: 15 * 60 * 1000, warningBeforeMs: 60 * 1000 };
}

export const SessionTimeout = () => {
  const { isAuthenticated, logout, user } = useAuth();
  const { t } = useI18n();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionPolicy = getSessionPolicy(user?.role);

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const handleLogout = useCallback(async () => {
    clearAllTimers();
    setShowWarning(false);
    await logout();
  }, [clearAllTimers, logout]);

  const resetTimers = useCallback(() => {
    if (!isAuthenticated) return;

    clearAllTimers();
    setShowWarning(false);

    // Set warning timer
    warningRef.current = setTimeout(() => {
      setShowWarning(true);
      setCountdown(Math.floor(sessionPolicy.warningBeforeMs / 1000));

      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, sessionPolicy.idleTimeoutMs - sessionPolicy.warningBeforeMs);

    // Set logout timer
    timeoutRef.current = setTimeout(() => {
      handleLogout();
    }, sessionPolicy.idleTimeoutMs);
  }, [isAuthenticated, clearAllTimers, handleLogout, sessionPolicy.idleTimeoutMs, sessionPolicy.warningBeforeMs]);

  const handleContinue = useCallback(() => {
    setShowWarning(false);
    resetTimers();
  }, [resetTimers]);

  useEffect(() => {
    if (!isAuthenticated) return;

    resetTimers();

    const onActivity = () => {
      if (!showWarning) resetTimers();
    };

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));

    return () => {
      clearAllTimers();
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, onActivity));
    };
  }, [isAuthenticated, resetTimers, clearAllTimers, showWarning]);

  if (!isAuthenticated) return null;

  return (
    <AlertDialog open={showWarning}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("auth.sessionExpiring")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("auth.sessionExpiringDesc").replace("{seconds}", String(countdown))}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleLogout}>{t("common.logout")}</AlertDialogCancel>
          <AlertDialogAction onClick={handleContinue}>{t("auth.continueSession")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
