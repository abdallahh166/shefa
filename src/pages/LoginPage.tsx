import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/core/auth/authStore";
import { useI18n } from "@/core/i18n/i18nStore";
import { LanguageSwitcher } from "@/shared/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { ClinicNameField } from "@/features/auth/ClinicNameField";
import { PasswordStrength } from "@/features/auth/PasswordStrength";
import { authService } from "@/services/auth/auth.service";
import { HCaptcha } from "@/shared/components/HCaptcha";
import { env } from "@/core/env/env";

type AuthMode = "login" | "signup";
type SlugStatus = "idle" | "checking" | "available" | "taken" | "invalid";

export const LoginPage = () => {
  const { isAuthenticated, user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [loading, setLoading] = useState(false);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");
  const [resolvedSlug, setResolvedSlug] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const captchaSiteKey = env.VITE_CAPTCHA_SITE_KEY;
  const captchaRequired = Boolean(captchaSiteKey);

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === "super_admin") {
        navigate("/admin", { replace: true });
      } else {
        navigate(`/tenant/${user.tenantSlug}/dashboard`, { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);

  const handleSlugStatusChange = (status: SlugStatus, slug: string) => {
    setSlugStatus(status);
    setResolvedSlug(slug);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authService.login(email, password);
    } catch (err) {
      toast({
        title: t("auth.loginFailed"),
        description: err instanceof Error ? err.message : t("common.error"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !clinicName) {
      toast({
        title: t("common.missingFields"),
        description: t("common.pleaseFillAllFields"),
        variant: "destructive",
      });
      return;
    }
    if (slugStatus === "taken") {
      toast({
        title: t("auth.signupFailed"),
        description: t("auth.slugTaken"),
        variant: "destructive",
      });
      return;
    }
    if (slugStatus !== "available" || !resolvedSlug) {
      toast({
        title: t("auth.signupFailed"),
        description: t("auth.slugInvalid"),
        variant: "destructive",
      });
      return;
    }
    if (captchaRequired && !captchaToken) {
      toast({
        title: t("auth.signupFailed"),
        description: t("auth.completeCaptcha") || "Please complete the captcha verification.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      await authService.registerClinic({
        clinicName,
        fullName,
        email,
        password,
        slug: resolvedSlug,
        captchaToken,
      });
      toast({ title: t("auth.checkEmail"), description: t("auth.confirmationSent") });
      setCaptchaToken("");
    } catch (err) {
      toast({
        title: t("auth.signupFailed"),
        description: err instanceof Error ? err.message : t("common.error"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isSignupDisabled =
    loading || slugStatus === "taken" || slugStatus === "invalid" || slugStatus === "checking";

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative items-center justify-center">
        <div className="text-primary-foreground text-center px-12">
          <div className="h-16 w-16 rounded-2xl bg-primary-foreground/20 flex items-center justify-center text-3xl font-bold mx-auto mb-6">
            M
          </div>
          <h2 className="text-3xl font-bold mb-4">MedFlow</h2>
          <p className="text-primary-foreground/80 text-lg">{t("auth.heroSubtitle")}</p>
          <div className="mt-12 grid grid-cols-2 gap-4 text-sm text-primary-foreground/70">
            <div className="bg-primary-foreground/10 rounded-lg p-4">{t("auth.featureMultiTenant")}</div>
            <div className="bg-primary-foreground/10 rounded-lg p-4">{t("auth.featureRbac")}</div>
            <div className="bg-primary-foreground/10 rounded-lg p-4">{t("auth.featureEmr")}</div>
            <div className="bg-primary-foreground/10 rounded-lg p-4">{t("auth.featureBilingual")}</div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="flex justify-end mb-8">
            <LanguageSwitcher />
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-2">
              {mode === "login" ? t("auth.loginTitle") : t("auth.createClinic")}
            </h1>
            <p className="text-muted-foreground">
              {mode === "login" ? t("auth.loginSubtitle") : t("auth.setupNewClinic")}
            </p>
          </div>

          <form onSubmit={mode === "login" ? handleLogin : handleSignup} className="space-y-4">
            {mode === "signup" && (
              <>
                <div className="space-y-2">
                  <Label>{t("auth.fullName")}</Label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Dr. John Smith"
                  />
                </div>
                <ClinicNameField
                  clinicName={clinicName}
                  onClinicNameChange={setClinicName}
                  onSlugStatusChange={handleSlugStatusChange}
                  t={t}
                  captchaToken={captchaToken}
                  captchaRequired={captchaRequired}
                />
              </>
            )}
            <div className="space-y-2">
              <Label>{t("auth.emailLabel")}</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                data-testid="login-email"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("auth.passwordLabel")}</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                data-testid="login-password"
              />
              {mode === "signup" && <PasswordStrength password={password} t={t} />}
            </div>
            {mode === "signup" && captchaSiteKey && (
              <div className="pt-2">
                <HCaptcha
                  siteKey={captchaSiteKey}
                  onVerify={(token) => setCaptchaToken(token)}
                  onExpire={() => setCaptchaToken("")}
                />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={mode === "signup" ? isSignupDisabled : loading} data-testid="login-submit">
              {loading ? t("common.loading") : mode === "login" ? t("auth.login") : t("auth.createAccount")}
            </Button>
          </form>

          <div className="mt-3 text-end">
            <button
              onClick={() => navigate("/forgot-password")}
              className="text-xs text-muted-foreground hover:text-primary hover:underline"
            >
              {t("auth.forgotPassword")}
            </button>
          </div>

          <div className="mt-4 text-center text-sm">
            {mode === "login" ? (
              <p className="text-muted-foreground">
                {t("auth.noAccount")}{" "}
                <button onClick={() => setMode("signup")} className="text-primary font-medium hover:underline">
                  {t("auth.register")}
                </button>
              </p>
            ) : (
              <p className="text-muted-foreground">
                {t("auth.alreadyHaveAccount")}{" "}
                <button onClick={() => setMode("login")} className="text-primary font-medium hover:underline">
                  {t("auth.login")}
                </button>
              </p>
            )}
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate("/tutorial")}
              className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
            >
              📖 {t("auth.howToUse")}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};


