import { useEffect, useMemo, useState } from "react";
import { Shield, KeyRound, Loader2, AlertTriangle, CheckCircle2, RefreshCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/primitives/Button";
import { Input } from "@/components/primitives/Inputs";
import { Label } from "@/components/ui/label";
import { useAuth, buildPrivilegedSession } from "@/core/auth/authStore";
import { useI18n } from "@/core/i18n/i18nStore";
import { toast } from "@/hooks/use-toast";
import { authService } from "@/services/auth/auth.service";
import { auditLogService } from "@/services/settings/audit.service";
import { privilegedSessionService } from "@/services/auth/privilegedSession.service";

type EnrollmentState = {
  factorId: string;
  qrCode: string;
  secret: string;
  uri: string;
};

type MfaFactor = {
  id: string;
  friendly_name?: string | null;
  factor_type: string;
  status: string;
};

interface PrivilegedMfaPanelProps {
  mode?: "embedded" | "page";
}

function toAuditTenantId(user: ReturnType<typeof useAuth.getState>["user"]) {
  return user?.globalRoles.includes("super_admin") ? null : user?.tenantId ?? null;
}

function toQrCodeDataUrl(svgMarkup: string) {
  return `data:image/svg+xml;utf-8,${encodeURIComponent(svgMarkup)}`;
}

export const PrivilegedMfaPanel = ({ mode = "embedded" }: PrivilegedMfaPanelProps) => {
  const { t } = useI18n(["auth"]);
  const { user, lastVerifiedAt, privilegedAuth } = useAuth();
  const privilegedSession = useMemo(
    () => buildPrivilegedSession({ user, lastVerifiedAt, privilegedAuth }),
    [lastVerifiedAt, privilegedAuth, user],
  );
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState("");
  const [sessionCode, setSessionCode] = useState("");
  const [enrollment, setEnrollment] = useState<EnrollmentState | null>(null);
  const [sessionVerificationFactorId, setSessionVerificationFactorId] = useState<string | null>(null);
  const [removingFactorId, setRemovingFactorId] = useState<string | null>(null);

  const reloadState = async () => {
    const [factorState] = await Promise.all([
      authService.listMfaFactors(),
      privilegedSessionService.refresh(),
    ]);
    setFactors(factorState.all);
  };

  useEffect(() => {
    if (!user || !privilegedSession.isPrivileged) return;
    setLoading(true);
    void reloadState()
      .catch((err) => {
        const message = err instanceof Error ? err.message : t("common.error");
        toast({ title: t("common.error"), description: message, variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, [privilegedSession.isPrivileged, t, user]);

  if (!user) return null;

  if (!privilegedSession.isPrivileged) {
    return mode === "page" ? (
      <div className="mx-auto max-w-2xl rounded-2xl border bg-card p-8 text-center shadow-sm">
        <Shield className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">{t("auth.mfa.noSetupTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("auth.mfa.noSetupDescription")}
        </p>
      </div>
    ) : null;
  }

  const handleStartEnrollment = async () => {
    setLoading(true);
    try {
      const data = await authService.enrollTotpFactor({
        friendlyName: `${user.name} ${privilegedSession.roleTier}`,
        issuer: "MedFlow",
      });
      setEnrollment({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
        uri: data.totp.uri,
      });
      await auditLogService.logEvent({
        tenant_id: toAuditTenantId(user),
        user_id: user.id,
        action: "privileged_mfa_enrollment_started",
        action_type: "privileged_mfa_enrollment_started",
        entity_type: "auth_mfa_factor",
        entity_id: data.id,
        resource_type: "auth_mfa_factor",
        details: {
          role_tier: privilegedSession.roleTier,
          factor_type: "totp",
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.error");
      toast({ title: t("common.error"), description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEnrollment = async () => {
    if (!enrollment) return;
    setVerifying(true);
    try {
      await authService.verifyTotpFactor({ factorId: enrollment.factorId, code });
      await privilegedSessionService.refresh();
      await reloadState();
      await auditLogService.logEvent({
        tenant_id: toAuditTenantId(user),
        user_id: user.id,
        action: "privileged_mfa_enrolled",
        action_type: "privileged_mfa_enrolled",
        entity_type: "auth_mfa_factor",
        entity_id: enrollment.factorId,
        resource_type: "auth_mfa_factor",
        details: {
          role_tier: privilegedSession.roleTier,
          factor_type: "totp",
        },
      });
      setEnrollment(null);
      setCode("");
      toast({ title: t("auth.mfa.enabledToast") });
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.error");
      toast({ title: t("common.error"), description: message, variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  };

  const handleVerifyCurrentSession = async () => {
    if (!sessionVerificationFactorId) return;
    setVerifying(true);
    try {
      await authService.verifyTotpFactor({ factorId: sessionVerificationFactorId, code: sessionCode });
      await privilegedSessionService.refresh();
      await reloadState();
      await auditLogService.logEvent({
        tenant_id: toAuditTenantId(user),
        user_id: user.id,
        action: "privileged_mfa_session_verified",
        action_type: "privileged_mfa_session_verified",
        entity_type: "auth_mfa_factor",
        entity_id: sessionVerificationFactorId,
        resource_type: "auth_mfa_factor",
        details: {
          role_tier: privilegedSession.roleTier,
          factor_type: "totp",
          assurance_level: "aal2",
        },
      });
      setSessionCode("");
      setSessionVerificationFactorId(null);
      toast({ title: t("auth.mfa.verifiedToast") });
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.error");
      toast({ title: t("common.error"), description: message, variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  };

  const handleRemoveFactor = async (factorId: string) => {
    setRemovingFactorId(factorId);
    try {
      await authService.removeMfaFactor(factorId);
      await privilegedSessionService.refresh();
      await reloadState();
      await auditLogService.logEvent({
        tenant_id: toAuditTenantId(user),
        user_id: user.id,
        action: "privileged_mfa_reset",
        action_type: "privileged_mfa_reset",
        entity_type: "auth_mfa_factor",
        entity_id: factorId,
        resource_type: "auth_mfa_factor",
        details: {
          role_tier: privilegedSession.roleTier,
        },
      });
      if (sessionVerificationFactorId === factorId) {
        setSessionCode("");
        setSessionVerificationFactorId(null);
      }
      toast({ title: t("auth.mfa.removedToast") });
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.error");
      toast({ title: t("common.error"), description: message, variant: "destructive" });
    } finally {
      setRemovingFactorId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className={mode === "page" ? "mx-auto max-w-3xl rounded-3xl border bg-card p-8 shadow-sm" : ""}>
        <div className="flex flex-col gap-4 rounded-2xl border bg-muted/20 p-5 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">{t("auth.mfa.sessionTitle")}</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {privilegedSession.roleTier === "super_admin"
                ? t("auth.mfa.superAdminDescription")
                : t("auth.mfa.clinicAdminDescription")}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-sm">
            {privilegedSession.canAccessPrivilegedRoutes ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>{t("auth.mfa.sessionReady")}</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span>{t("auth.mfa.sessionActionRequired")}</span>
              </>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border p-4">
            <div className="text-sm text-muted-foreground">{t("auth.mfa.roleTier")}</div>
            <div className="mt-1 font-medium capitalize">{privilegedSession.roleTier?.replace("_", " ")}</div>
          </div>
          <div className="rounded-2xl border p-4">
            <div className="text-sm text-muted-foreground">{t("auth.mfa.currentAssurance")}</div>
            <div className="mt-1 font-medium uppercase">{privilegedSession.aal ?? "aal1"}</div>
          </div>
          <div className="rounded-2xl border p-4">
            <div className="text-sm text-muted-foreground">{t("auth.mfa.verifiedFactors")}</div>
            <div className="mt-1 font-medium">{privilegedAuth.verifiedFactorCount}</div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-semibold">{t("auth.mfa.authenticatorTitle")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("auth.mfa.authenticatorDescription")}
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => void reloadState()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              {t("auth.mfa.refresh")}
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            {factors.length === 0 && !enrollment ? (
              <div className="rounded-2xl border border-dashed p-5">
                <p className="text-sm text-muted-foreground">
                  {t("auth.mfa.notEnrolled")}
                </p>
                <Button
                  type="button"
                  className="mt-4"
                  onClick={handleStartEnrollment}
                  disabled={loading}
                  data-testid="privileged-mfa-start-enrollment"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  {t("auth.mfa.setupTotp")}
                </Button>
              </div>
            ) : null}

            {factors.map((factor) => (
              <div key={factor.id} className="rounded-2xl border p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-medium">{factor.friendly_name || t("auth.mfa.factorFallbackName")}</div>
                    <div className="text-sm text-muted-foreground">
                      {factor.factor_type.toUpperCase()} - {factor.status}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {factor.status === "verified" && privilegedSession.aal !== "aal2" ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setSessionVerificationFactorId(factor.id);
                          setSessionCode("");
                        }}
                        disabled={verifying}
                        data-testid={`privileged-mfa-session-start-${factor.id}`}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {t("auth.mfa.verifyThisSession")}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => void handleRemoveFactor(factor.id)}
                      disabled={removingFactorId === factor.id}
                      className="text-destructive"
                    >
                      {removingFactorId === factor.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      {t("auth.mfa.remove")}
                    </Button>
                  </div>
                </div>
                {sessionVerificationFactorId === factor.id ? (
                  <div className="mt-4 rounded-2xl border border-primary/20 bg-muted/30 p-4">
                    <div className="space-y-2">
                      <Label htmlFor={`mfa-session-code-${factor.id}`}>{t("auth.mfa.oneTimeCode")}</Label>
                      <Input
                        id={`mfa-session-code-${factor.id}`}
                        value={sessionCode}
                        onChange={(event) => setSessionCode(event.target.value.replace(/\s+/g, ""))}
                        placeholder={t("auth.mfa.oneTimeCodePlaceholder")}
                        inputMode="numeric"
                        data-testid="privileged-mfa-session-code"
                      />
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button
                        type="button"
                        onClick={handleVerifyCurrentSession}
                        disabled={verifying || sessionCode.trim().length < 6}
                        data-testid="privileged-mfa-session-verify"
                      >
                        {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        {t("auth.mfa.verifySession")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setSessionCode("");
                          setSessionVerificationFactorId(null);
                        }}
                        disabled={verifying}
                      >
                        {t("common.cancel")}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}

            {enrollment ? (
              <div className="rounded-2xl border bg-background p-5">
                <div className="grid gap-6 lg:grid-cols-[220px,1fr]">
                  <div className="rounded-2xl border bg-white p-3">
                    <img
                      src={toQrCodeDataUrl(enrollment.qrCode)}
                      alt={t("auth.mfa.mfaQrCodeAlt")}
                      className="mx-auto h-48 w-48"
                      data-testid="privileged-mfa-qr"
                    />
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm text-muted-foreground">{t("auth.mfa.manualSecretLabel")}</div>
                      <code
                        className="mt-1 block rounded-xl bg-muted px-3 py-2 text-sm"
                        data-testid="privileged-mfa-secret"
                      >
                        {enrollment.secret}
                      </code>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mfa-code">{t("auth.mfa.verificationCode")}</Label>
                      <Input
                        id="mfa-code"
                        value={code}
                        onChange={(event) => setCode(event.target.value.replace(/\s+/g, ""))}
                        placeholder={t("auth.mfa.oneTimeCodePlaceholder")}
                        inputMode="numeric"
                        data-testid="privileged-mfa-enrollment-code"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={handleVerifyEnrollment}
                        disabled={verifying || code.trim().length < 6}
                        data-testid="privileged-mfa-enrollment-verify"
                      >
                        {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        {t("auth.mfa.verifyAndEnable")}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setEnrollment(null)} disabled={verifying}>
                        {t("common.cancel")}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
