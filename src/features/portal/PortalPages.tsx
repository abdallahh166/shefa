import { useQuery } from "@tanstack/react-query";
import { portalService } from "@/services/portal/portal.service";
import { usePortalAuth } from "@/core/auth/portalAuthStore";
import { formatDate, formatCurrency } from "@/shared/utils/formatDate";
import { useI18n } from "@/core/i18n/i18nStore";
import { formatPrescriptionQuantity, formatPrescriptionSig } from "@/shared/utils/prescription";
import { StatusBadge } from "@/shared/components/StatusBadge";

const invoiceStatusVariant = {
  paid: "success",
  pending: "warning",
  overdue: "destructive",
  partially_paid: "warning",
  void: "destructive",
} as const;

const getInvoiceStatusLabel = (
  status: string | undefined,
  t: (path: string) => string,
) => {
  if (status === "paid") return t("portal.status.paid");
  if (status === "pending") return t("portal.status.pending");
  if (status === "overdue") return t("portal.status.overdue");
  if (status === "partially_paid") return t("portal.status.partiallyPaid");
  if (status === "void") return t("portal.status.void");
  return status ?? "-";
};

export const PortalAppointmentsPage = () => {
  const { user } = usePortalAuth();
  const { locale, calendarType, t } = useI18n(["portal"]);

  const { data: appointments = [] } = useQuery({
    queryKey: ["portal", "appointments", user?.patientId],
    enabled: !!user?.patientId,
    queryFn: () => portalService.listAppointments(user!.patientId),
  });

  return (
    <div className="space-y-4" data-testid="portal-appointments-page">
      <h2 className="text-lg font-semibold">{t("portal.layout.nav.appointments")}</h2>
      <div className="divide-y rounded-lg border" data-testid="portal-appointments-list">
        {appointments.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground" data-testid="portal-appointments-empty">
            {t("portal.states.empty.appointments")}
          </p>
        ) : (
          appointments.map((appt: any) => (
            <div key={appt.id} className="flex flex-wrap justify-between gap-2 p-4" data-testid={`portal-appointment-${appt.id}`}>
              <div>
                <p className="font-medium">{appt.doctors?.full_name ?? t("portal.states.doctorFallback")}</p>
                <p className="text-xs text-muted-foreground">{formatDate(appt.appointment_date, locale, "datetime", calendarType)}</p>
              </div>
              <div className="text-sm text-muted-foreground">{appt.status}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export const PortalPrescriptionsPage = () => {
  const { user } = usePortalAuth();
  const { t } = useI18n(["portal"]);
  const { data: prescriptions = [] } = useQuery({
    queryKey: ["portal", "prescriptions", user?.patientId],
    enabled: !!user?.patientId,
    queryFn: () => portalService.listPrescriptions(user!.patientId),
  });

  return (
    <div className="space-y-4" data-testid="portal-prescriptions-page">
      <h2 className="text-lg font-semibold">{t("portal.layout.nav.prescriptions")}</h2>
      <div className="divide-y rounded-lg border" data-testid="portal-prescriptions-list">
        {prescriptions.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground" data-testid="portal-prescriptions-empty">
            {t("portal.states.empty.prescriptions")}
          </p>
        ) : (
          prescriptions.map((rx: any) => (
            <div key={rx.id} className="flex flex-wrap justify-between gap-2 p-4" data-testid={`portal-prescription-${rx.id}`}>
              <div>
                <p className="font-medium">{rx.medication}</p>
                <p className="text-xs text-muted-foreground">{formatPrescriptionSig(rx) || rx.dosage}</p>
                {formatPrescriptionQuantity(rx) ? (
                  <p className="text-xs text-muted-foreground">{formatPrescriptionQuantity(rx)}</p>
                ) : null}
              </div>
              <div className="text-sm text-muted-foreground">{rx.status}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export const PortalLabResultsPage = () => {
  const { user } = usePortalAuth();
  const { t } = useI18n(["portal"]);
  const { data: labOrders = [] } = useQuery({
    queryKey: ["portal", "labs", user?.patientId],
    enabled: !!user?.patientId,
    queryFn: () => portalService.listLabOrders(user!.patientId),
  });

  return (
    <div className="space-y-4" data-testid="portal-labs-page">
      <h2 className="text-lg font-semibold">{t("portal.layout.nav.lab-results")}</h2>
      <div className="divide-y rounded-lg border" data-testid="portal-labs-list">
        {labOrders.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground" data-testid="portal-labs-empty">
            {t("portal.states.empty.labs")}
          </p>
        ) : (
          labOrders.map((lab: any) => (
            <div key={lab.id} className="p-4" data-testid={`portal-lab-${lab.id}`}>
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-medium">{lab.test_name}</p>
                <p className="text-sm text-muted-foreground">{lab.status}</p>
              </div>
              {lab.result ? <p className="mt-2 text-xs text-muted-foreground">{lab.result}</p> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export const PortalDocumentsPage = () => {
  const { user } = usePortalAuth();
  const { locale, calendarType, t } = useI18n(["portal"]);
  const { data: documents = [] } = useQuery({
    queryKey: ["portal", "documents", user?.patientId],
    enabled: !!user?.patientId,
    queryFn: () => portalService.listDocuments(user!.patientId),
  });

  return (
    <div className="space-y-4" data-testid="portal-documents-page">
      <h2 className="text-lg font-semibold">{t("portal.layout.nav.documents")}</h2>
      <div className="divide-y rounded-lg border" data-testid="portal-documents-list">
        {documents.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground" data-testid="portal-documents-empty">
            {t("portal.states.empty.documents")}
          </p>
        ) : (
          documents.map((doc: any) => (
            <div key={doc.id} className="flex flex-wrap justify-between gap-2 p-4" data-testid={`portal-document-${doc.id}`}>
              <div>
                <p className="font-medium">{doc.file_name}</p>
                <p className="text-xs text-muted-foreground">{doc.file_type}</p>
              </div>
              <div className="text-xs text-muted-foreground">{formatDate(doc.created_at, locale, "date", calendarType)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export const PortalInvoicesPage = () => {
  const { user } = usePortalAuth();
  const { locale, calendarType, t } = useI18n(["portal"]);
  const { data: invoices = [] } = useQuery({
    queryKey: ["portal", "invoices", user?.patientId],
    enabled: !!user?.patientId,
    queryFn: () => portalService.listInvoices(user!.patientId),
  });

  return (
    <div className="space-y-4" data-testid="portal-invoices-page">
      <h2 className="text-lg font-semibold">{t("portal.layout.nav.invoices")}</h2>
      <div className="divide-y rounded-lg border" data-testid="portal-invoices-list">
        {invoices.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground" data-testid="portal-invoices-empty">
            {t("portal.states.empty.invoices")}
          </p>
        ) : (
          invoices.map((inv: any) => (
            <div key={inv.id} className="flex flex-wrap justify-between gap-4 p-4" data-testid={`portal-invoice-${inv.id}`}>
              <div className="space-y-1">
                <p className="font-medium">{inv.invoice_code ?? t("portal.states.invoiceFallback")}</p>
                <p className="text-xs text-muted-foreground">{inv.service}</p>
                <StatusBadge variant={invoiceStatusVariant[inv.status as keyof typeof invoiceStatusVariant] ?? "default"}>
                  {getInvoiceStatusLabel(inv.status, t)}
                </StatusBadge>
                {inv.due_date ? (
                  <p className="text-xs text-muted-foreground">
                    {t("portal.pages.due", { date: formatDate(inv.due_date, locale, "date", calendarType) })}
                  </p>
                ) : null}
                {inv.status === "void" && inv.void_reason ? (
                  <p className="max-w-sm text-xs text-muted-foreground">
                    {t("portal.pages.voidReason", { reason: inv.void_reason })}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1 text-start md:text-end">
                <p className="text-sm font-medium">{t("portal.pages.total", { amount: formatCurrency(inv.amount, locale) })}</p>
                <p className="text-xs text-success">{t("portal.pages.paid", { amount: formatCurrency(inv.amount_paid ?? 0, locale) })}</p>
                <p className="text-xs text-muted-foreground">{t("portal.pages.balance", { amount: formatCurrency(inv.balance_due ?? 0, locale) })}</p>
                <p className="text-xs text-muted-foreground">{formatDate(inv.invoice_date, locale, "date", calendarType)}</p>
                {inv.paid_at ? (
                  <p className="text-xs text-muted-foreground">
                    {t("portal.pages.settled", { date: formatDate(inv.paid_at, locale, "datetime", calendarType) })}
                  </p>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
