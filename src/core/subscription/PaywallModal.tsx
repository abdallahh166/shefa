import { useSubscription } from "./SubscriptionContext";
import { isSuperAdmin, useAuth } from "@/core/auth/authStore";
import { useNavigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/primitives/Button";
import { useI18n } from "@/core/i18n/i18nStore";
import { formatDate } from "@/core/i18n/formatters";

export const PaywallModal = () => {
  const { isExpired, plan, expiresAt, isLoading } = useSubscription();
  const { t, locale, calendarType } = useI18n(["common", "billing"]);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Don't show for super_admins or while loading
  if (isLoading || !isExpired || isSuperAdmin(user)) return null;

  const formattedDate = expiresAt ? formatDate(expiresAt, locale, "date", calendarType) : "";

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent hideClose className="max-w-md p-8 text-center space-y-6">
        <DialogHeader className="text-center space-y-3">
          <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <DialogTitle className="text-2xl font-bold text-foreground">{t("billing.paywall.title")}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {t("billing.paywall.currentPlan")}: <span className="font-semibold text-foreground capitalize">{plan}</span>
          </DialogDescription>
        </DialogHeader>
        {formattedDate && (
          <p className="text-sm text-muted-foreground">
            {t("billing.paywall.accessEndsOn", { date: formattedDate })}
          </p>
        )}
        <p className="text-muted-foreground text-sm">
          {t("billing.paywall.description")}
        </p>
        <Button
          size="lg"
          className="w-full text-base"
          onClick={() => navigate("/pricing")}
        >
          {t("common.viewAllPlans")}
        </Button>
      </DialogContent>
    </Dialog>
  );
};
