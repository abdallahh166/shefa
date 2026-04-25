import { useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/primitives/Button";
import { Input } from "@/components/primitives/Inputs";
import { portalService } from "@/services/portal/portal.service";
import { useI18n } from "@/core/i18n/i18nStore";

export const PortalLoginPage = () => {
  const { clinicSlug } = useParams();
  const { t } = useI18n(["portal"]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    setError(null);
    setLoading(true);
    try {
      if (!clinicSlug) {
        throw new Error(t("portal.layout.invalidClinicLink"));
      }
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) {
        throw new Error(t("portal.layout.emailRequired"));
      }

      await portalService.sendMagicLink({
        clinicSlug,
        email: normalizedEmail,
        redirectTo: `${window.location.origin}/portal/${clinicSlug}`,
      });
      setSent(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("portal.layout.magicLinkFailed");
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-muted/20" data-testid="portal-login-page">
      <div className="w-full max-w-md space-y-4 rounded-xl border bg-background p-6">
        <div>
          <h1 className="text-xl font-semibold">{t("portal.layout.magicLinkTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("portal.layout.magicLinkDescription")}</p>
        </div>

        {sent ? (
          <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground" data-testid="portal-login-success">
            {t("portal.layout.magicLinkSuccess")}
          </div>
        ) : (
          <>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              placeholder={t("portal.layout.magicLinkPlaceholder")}
              aria-label={t("portal.layout.magicLinkEmail")}
              data-testid="portal-login-email"
            />
            {error ? <p className="text-sm text-destructive" data-testid="portal-login-error">{error}</p> : null}
            <Button
              onClick={handleSend}
              disabled={!email || loading}
              className="w-full"
              data-testid="portal-login-submit"
            >
              {loading ? t("portal.layout.magicLinkSending") : t("portal.layout.magicLinkSubmit")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default PortalLoginPage;
