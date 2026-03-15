import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/primitives/Button";
import { Input } from "@/components/primitives/Inputs";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { LanguageSwitcher } from "@/shared/components/LanguageSwitcher";
import { useI18n } from "@/core/i18n/i18nStore";
import { authService } from "@/services/auth/auth.service";

export const ForgotPasswordPage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await authService.resetPassword(email, `${window.location.origin}/reset-password`);
      setSent(true);
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

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-8">
          <LanguageSwitcher />
        </div>

        <div className="bg-card rounded-lg border p-8">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm mb-6">M</div>

          {sent ? (
            <div className="space-y-4">
              <h1 className="text-xl font-bold">{t("auth.checkEmail")}</h1>
              <p className="text-muted-foreground text-sm">
                {t("auth.resetEmailSentTo")} <strong>{email}</strong>. {t("auth.resetEmailSentInstructions")}
              </p>
              <Button variant="outline" className="w-full" onClick={() => navigate("/login")}
              >
                {t("tutorial.backToLogin")}
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold mb-2">{t("auth.forgotPassword")}</h1>
              <p className="text-muted-foreground text-sm mb-6">{t("auth.forgotPasswordDesc")}</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("common.email")}</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t("common.loading") : t("auth.sendResetLink")}
                </Button>
              </form>
              <div className="mt-4 text-center">
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => navigate("/login")}
                  className="text-sm"
                >
                  {t("tutorial.backToLogin")}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};


