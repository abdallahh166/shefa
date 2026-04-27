import { useEffect, useMemo, useState } from "react";
import type { Factor } from "@supabase/supabase-js";
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
  const { t } = useI18n();
  const { user, lastVerifiedAt, privilegedAuth } = useAuth();
  const privilegedSession = useMemo(
    () => buildPrivilegedSession({ user, lastVerifiedAt, privilegedAuth }),
    [lastVerifiedAt, privilegedAuth, user],
  );
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState("");
  const [enrollment, setEnrollment] = useState<EnrollmentState | null>(null);
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
        <h1 className="text-2xl font-semibold">No privileged security setup needed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This account does not currently hold a privileged role.
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
      toast({ title: "Multi-factor authentication enabled" });
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
      toast({ title: "Multi-factor authentication factor removed" });
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
              <h2 className="text-lg font-semibold">Privileged session security</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {privilegedSession.roleTier === "super_admin"
                ? "Super admins must keep TOTP MFA enrolled and use an aal2 session before they can access privileged pages."
                : "Clinic admins must keep TOTP MFA enrolled before they can use tenant-wide security actions."}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-sm">
            {privilegedSession.canAccessPrivilegedRoutes ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Privileged access ready</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span>Action required</span>
              </>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border p-4">
            <div className="text-sm text-muted-foreground">Role tier</div>
            <div className="mt-1 font-medium capitalize">{privilegedSession.roleTier?.replace("_", " ")}</div>
          </div>
          <div className="rounded-2xl border p-4">
            <div className="text-sm text-muted-foreground">Current assurance</div>
            <div className="mt-1 font-medium uppercase">{privilegedSession.aal ?? "aal1"}</div>
          </div>
          <div className="rounded-2xl border p-4">
            <div className="text-sm text-muted-foreground">Verified factors</div>
            <div className="mt-1 font-medium">{privilegedAuth.verifiedFactorCount}</div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-semibold">TOTP authenticator</h3>
              <p className="text-sm text-muted-foreground">
                Use an authenticator app to scan the QR code and enter the one-time code.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => void reloadState()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Refresh
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            {factors.length === 0 && !enrollment ? (
              <div className="rounded-2xl border border-dashed p-5">
                <p className="text-sm text-muted-foreground">
                  No MFA factor is enrolled yet. Privileged actions stay blocked until TOTP enrollment is complete.
                </p>
                <Button type="button" className="mt-4" onClick={handleStartEnrollment} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  Set up TOTP MFA
                </Button>
              </div>
            ) : null}

            {factors.map((factor) => (
              <div key={factor.id} className="rounded-2xl border p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-medium">{factor.friendly_name || "Authenticator app"}</div>
                    <div className="text-sm text-muted-foreground">
                      {factor.factor_type.toUpperCase()} • {factor.status}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => void handleRemoveFactor(factor.id)}
                    disabled={removingFactorId === factor.id}
                    className="text-destructive"
                  >
                    {removingFactorId === factor.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Remove
                  </Button>
                </div>
              </div>
            ))}

            {enrollment ? (
              <div className="rounded-2xl border bg-background p-5">
                <div className="grid gap-6 lg:grid-cols-[220px,1fr]">
                  <div className="rounded-2xl border bg-white p-3">
                    <img
                      src={toQrCodeDataUrl(enrollment.qrCode)}
                      alt="MFA QR code"
                      className="mx-auto h-48 w-48"
                    />
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Manual secret</div>
                      <code className="mt-1 block rounded-xl bg-muted px-3 py-2 text-sm">{enrollment.secret}</code>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mfa-code">Verification code</Label>
                      <Input
                        id="mfa-code"
                        value={code}
                        onChange={(event) => setCode(event.target.value.replace(/\s+/g, ""))}
                        placeholder="123456"
                        inputMode="numeric"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" onClick={handleVerifyEnrollment} disabled={verifying || code.trim().length < 6}>
                        {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Verify and enable
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setEnrollment(null)} disabled={verifying}>
                        Cancel
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
