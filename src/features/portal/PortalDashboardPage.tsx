import { useQuery } from "@tanstack/react-query";
import { portalService } from "@/services/portal/portal.service";
import { usePortalAuth } from "@/core/auth/portalAuthStore";
import { useI18n } from "@/core/i18n/i18nStore";

export const PortalDashboardPage = () => {
  const { user } = usePortalAuth();
  const { t } = useI18n(["portal"]);

  const { data: appointments = [] } = useQuery({
    queryKey: ["portal", "appointments", user?.patientId],
    enabled: !!user?.patientId,
    queryFn: () => portalService.listAppointments(user!.patientId),
  });

  const { data: prescriptions = [] } = useQuery({
    queryKey: ["portal", "prescriptions", user?.patientId],
    enabled: !!user?.patientId,
    queryFn: () => portalService.listPrescriptions(user!.patientId),
  });

  const { data: labOrders = [] } = useQuery({
    queryKey: ["portal", "labs", user?.patientId],
    enabled: !!user?.patientId,
    queryFn: () => portalService.listLabOrders(user!.patientId),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["portal", "invoices", user?.patientId],
    enabled: !!user?.patientId,
    queryFn: () => portalService.listInvoices(user!.patientId),
  });

  return (
    <div className="space-y-6" data-testid="portal-dashboard-page">
      <div>
        <h2 className="text-xl font-semibold">{t("portal.dashboard.welcomeBack")}</h2>
        <p className="text-sm text-muted-foreground">{t("portal.dashboard.overview")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="portal-dashboard-summary">
        <div className="rounded-lg border p-4" data-testid="portal-summary-appointments">
          <p className="text-xs text-muted-foreground">{t("portal.layout.nav.appointments")}</p>
          <p className="text-2xl font-semibold">{appointments.length}</p>
        </div>
        <div className="rounded-lg border p-4" data-testid="portal-summary-prescriptions">
          <p className="text-xs text-muted-foreground">{t("portal.layout.nav.prescriptions")}</p>
          <p className="text-2xl font-semibold">{prescriptions.length}</p>
        </div>
        <div className="rounded-lg border p-4" data-testid="portal-summary-labs">
          <p className="text-xs text-muted-foreground">{t("portal.layout.nav.lab-results")}</p>
          <p className="text-2xl font-semibold">{labOrders.length}</p>
        </div>
        <div className="rounded-lg border p-4" data-testid="portal-summary-invoices">
          <p className="text-xs text-muted-foreground">{t("portal.layout.nav.invoices")}</p>
          <p className="text-2xl font-semibold">{invoices.length}</p>
        </div>
      </div>
    </div>
  );
};
