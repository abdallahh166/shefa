import { useSubscription } from "@/core/subscription/SubscriptionContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/primitives/Button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, Calendar, CreditCard, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useI18n } from "@/core/i18n/i18nStore";
import { formatDate, formatCurrency } from "@/shared/utils/formatDate";

const planLabelKeyMap: Record<string, string> = {
  free: "landing.planFree",
  starter: "landing.planFree",
  pro: "landing.planPro",
  enterprise: "landing.planEnterprise",
};

const statusLabelKeyMap: Record<string, { key: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { key: "billing.paid", variant: "default" },
  trialing: { key: "settings.subscription.trialing", variant: "secondary" },
  expired: { key: "billing.overdue", variant: "destructive" },
  canceled: { key: "appointments.cancelled", variant: "outline" },
};

export const SubscriptionTab = () => {
  const { t, locale, calendarType } = useI18n(["settings", "landing", "billing", "appointments"]);
  const { plan, status, amount, currency, billingCycle, isExpired, daysRemaining, isTrialing, expiresAt, isLoading } = useSubscription();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statusInfo = statusLabelKeyMap[status] || statusLabelKeyMap.active;
  const billingCycleLabel = billingCycle === "annual" ? t("common.annual") : t("common.monthly");
  const priceLabel = plan === "enterprise"
    ? t("common.contactUs")
    : formatCurrency(amount ?? 0, locale, currency || (locale === "ar" ? "EGP" : "USD"));
  const planLabel = t(planLabelKeyMap[plan] || "common.currentPlan");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t("settings.subscription.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("settings.subscription.subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Crown className="h-5 w-5 text-primary" />
              {t("settings.subscription.currentPlanCard")}
            </CardTitle>
            <Badge variant={statusInfo.variant}>{t(statusInfo.key)}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
            <div>
              <p className="text-2xl font-bold text-foreground" data-testid="subscription-current-plan">
                {t("common.currentPlan")}: {planLabel}
              </p>
              <p className="mt-1 text-sm text-muted-foreground" data-testid="subscription-current-price">
                {plan === "enterprise" ? priceLabel : `${priceLabel}/${billingCycleLabel}`}
              </p>
            </div>
            {plan !== "enterprise" && (
              <Button onClick={() => navigate("/pricing")} size="sm">
                {t("common.requestUpgrade")}
              </Button>
            )}
          </div>

          <div className="grid gap-3">
            {expiresAt && (
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t("common.expiresAt")}:</span>
                <span className="font-medium">{formatDate(expiresAt, locale, "date", calendarType)}</span>
              </div>
            )}

            {daysRemaining > 0 && !isExpired && (
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">{t("common.daysRemaining")}:</span>
                <span className="font-medium">{daysRemaining}</span>
              </div>
            )}

            {isTrialing && (
              <div className="flex items-center gap-3 text-sm">
                <CreditCard className="h-4 w-4 text-primary" />
                <span className="font-medium text-primary">{t("settings.subscription.trialing")}</span>
              </div>
            )}

            <div className="flex items-center gap-3 text-sm">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{t("common.billingCycle")}:</span>
              <span className="font-medium">{billingCycleLabel}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {isExpired && (
        <Card className="border-destructive">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="font-semibold text-destructive">{t("settings.subscription.expiredTitle")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("settings.subscription.expiredDescription")}
              </p>
              <Button onClick={() => navigate("/pricing")} variant="danger" size="sm" className="mt-3">
                {t("common.renewNow")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={() => navigate("/pricing")}>
          {t("common.viewAllPlans")}
        </Button>
      </div>
    </div>
  );
};
