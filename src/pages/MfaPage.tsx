import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Loader2 } from "lucide-react";
import { useAuth, isSuperAdmin } from "@/core/auth/authStore";
import { useI18n } from "@/core/i18n/i18nStore";
import { authService } from "@/services/auth/auth.service";
import { privilegedSessionService } from "@/services/auth/privilegedSession.service";
import { emitAuthMetric } from "@/services/auth/authMetrics";
import { Button } from "@/components/primitives/Button";
import { Input } from "@/components/primitives/Inputs";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

export const MfaPage = () => {
  const { t } = useI18n(["auth", "common"]);
  const navigate = useNavigate();
  const { isAuthenticated, user, authMachineState, setAuthMachineState, markSessionVerified } = useAuth();
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);

  const targetPath = useMemo(() => {
    if (!user) return "/login";
    return isSuperAdmin(user) ? "/admin" : `/tenant/${user.tenantSlug}/dashboard`;
  }, [user]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate("/login", { replace: true });
      return;
    }
    if (authMachineState !== "mfa_required" && authMachineState !== "mfa_verifying") {
      navigate(targetPath, { replace: true });
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const refreshed = await privilegedSessionService.refreshNow();
        const firstVerified = refreshed.factors.verified[0];
        if (!firstVerified?.id) {
          // No verified factor → nothing to verify. Fail open to avoid lockouts.
          setAuthMachineState("authenticated");
          navigate(targetPath, { replace: true });
          return;
        }
        if (!cancelled) setFactorId(firstVerified.id);
      } catch {
        // If we can't load factors, fail open to avoid lockouts.
        setAuthMachineState("authenticated");
        navigate(targetPath, { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authMachineState, isAuthenticated, navigate, setAuthMachineState, targetPath, user]);

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!factorId) return;
    setLoading(true);
    setAuthMachineState("mfa_verifying");
    emitAuthMetric("mfa_challenge_started", { reason: "login" });
    try {
      await authService.verifyTotpFactor({ factorId, code: code.trim() });
      await privilegedSessionService.refreshNow();
      markSessionVerified();
      emitAuthMetric("mfa_challenge_succeeded", { reason: "login" });
      setAuthMachineState("authenticated");
      navigate(targetPath, { replace: true });
    } catch (err) {
      emitAuthMetric("mfa_challenge_failed", { reason: "login" });
      setAuthMachineState("mfa_required");
      const message = err instanceof Error ? err.message : t("common.error");
      toast({ title: t("auth.mfa.loginFailedTitle"), description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background px-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">{t("auth.mfa.loginTitle")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("auth.mfa.loginDescription")}</p>
          </div>
        </div>

        <form onSubmit={handleVerify} className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mfa-code">{t("auth.mfa.oneTimeCode")}</Label>
            <Input
              id="mfa-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\s+/g, ""))}
              placeholder={t("auth.mfa.oneTimeCodePlaceholder")}
              inputMode="numeric"
              autoFocus
              disabled={loading}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading || !factorId || code.trim().length < 6}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("auth.mfa.verifyAndContinue")}
          </Button>
        </form>
      </div>
    </div>
  );
};

