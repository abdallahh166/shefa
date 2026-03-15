import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/primitives/Button";
import { Input } from "@/components/primitives/Inputs";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useI18n } from "@/core/i18n/i18nStore";
import { LanguageSwitcher } from "@/shared/components/LanguageSwitcher";
import { authService } from "@/services/auth/auth.service";

export const ResetPasswordPage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    // Check for recovery token in URL hash
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    // Listen for PASSWORD_RECOVERY event
    const unsubscribe = authService.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: t("common.passwordTooShort"), description: t("common.mustBeAtLeast6"), variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: t("common.passwordsDontMatch"), variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await authService.updatePassword(password);
      toast({ title: t("auth.passwordUpdated"), description: t("auth.passwordUpdatedDesc") });
      navigate("/login");
    } catch (err) {
      toast({
        title: t("common.error"),
        description: err instanceof Error ? err.message : t("common.error"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="bg-card rounded-lg border p-8 max-w-md w-full text-center">
          <div className="flex justify-end mb-6">
            <LanguageSwitcher />
          </div>
          <h1 className="text-xl font-bold mb-4">{t("common.invalidResetLink")}</h1>
          <p className="text-muted-foreground text-sm mb-6">{t("common.invalidResetLinkDesc")}</p>
          <Button onClick={() => navigate("/forgot-password")}>{t("common.requestNewLink")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-6">
          <LanguageSwitcher />
        </div>
        <div className="bg-card rounded-lg border p-8">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm mb-6">M</div>
          <h1 className="text-xl font-bold mb-2">{t("auth.resetPasswordTitle")}</h1>
          <p className="text-muted-foreground text-sm mb-6">{t("auth.resetPasswordDesc")}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("settings.newPassword")}</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.confirmPassword")}</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("common.loading") : t("settings.updatePassword")}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};


