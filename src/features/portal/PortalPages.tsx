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

const getInvoiceStatusLabel = (status?: string) => {
  if (status === "paid") return "Paid";
  if (status === "pending") return "Pending";
  if (status === "overdue") return "Overdue";
  if (status === "partially_paid") return "Partially paid";
  if (status === "void") return "Void";
  return status ?? "-";
};

export const PortalAppointmentsPage = () => {
  const { user } = usePortalAuth();
  const { locale, calendarType } = useI18n();

  const { data: appointments = [] } = useQuery({
    queryKey: ["portal", "appointments", user?.patientId],
    enabled: !!user?.patientId,
    queryFn: () => portalService.listAppointments(user!.patientId),
  });

  return (
    <div className="space-y-4" data-testid="portal-appointments-page">
      <h2 className="text-lg font-semibold">Appointments</h2>
      <div className="divide-y rounded-lg border" data-testid="portal-appointments-list">
        {appointments.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground" data-testid="portal-appointments-empty">No appointments yet.</p>
        ) : (
          appointments.map((appt: any) => (
            <div key={appt.id} className="p-4 flex flex-wrap justify-between gap-2" data-testid={`portal-appointment-${appt.id}`}>
              <div>
                <p className="font-medium">{appt.doctors?.full_name ?? "Doctor"}</p>
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
  const { data: prescriptions = [] } = useQuery({
    queryKey: ["portal", "prescriptions", user?.patientId],
    enabled: !!user?.patientId,
    queryFn: () => portalService.listPrescriptions(user!.patientId),
  });

  return (
    <div className="space-y-4" data-testid="portal-prescriptions-page">
      <h2 className="text-lg font-semibold">Prescriptions</h2>
      <div className="divide-y rounded-lg border" data-testid="portal-prescriptions-list">
        {prescriptions.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground" data-testid="portal-prescriptions-empty">No prescriptions yet.</p>
        ) : (
          prescriptions.map((rx: any) => (
            <div key={rx.id} className="p-4 flex flex-wrap justify-between gap-2" data-testid={`portal-prescription-${rx.id}`}>
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
  const { data: labOrders = [] } = useQuery({
    queryKey: ["portal", "labs", user?.patientId],
    enabled: !!user?.patientId,
    queryFn: () => portalService.listLabOrders(user!.patientId),
  });

  return (
    <div className="space-y-4" data-testid="portal-labs-page">
      <h2 className="text-lg font-semibold">Lab Results</h2>
      <div className="divide-y rounded-lg border" data-testid="portal-labs-list">
        {labOrders.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground" data-testid="portal-labs-empty">No lab results yet.</p>
        ) : (
          labOrders.map((lab: any) => (
            <div key={lab.id} className="p-4" data-testid={`portal-lab-${lab.id}`}>
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-medium">{lab.test_name}</p>
                <p className="text-sm text-muted-foreground">{lab.status}</p>
              </div>
              {lab.result ? <p className="text-xs text-muted-foreground mt-2">{lab.result}</p> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export const PortalDocumentsPage = () => {
  const { user } = usePortalAuth();
  const { locale, calendarType } = useI18n();
  const { data: documents = [] } = useQuery({
    queryKey: ["portal", "documents", user?.patientId],
    enabled: !!user?.patientId,
    queryFn: () => portalService.listDocuments(user!.patientId),
  });

  return (
    <div className="space-y-4" data-testid="portal-documents-page">
      <h2 className="text-lg font-semibold">Documents</h2>
      <div className="divide-y rounded-lg border" data-testid="portal-documents-list">
        {documents.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground" data-testid="portal-documents-empty">No documents yet.</p>
        ) : (
          documents.map((doc: any) => (
            <div key={doc.id} className="p-4 flex flex-wrap justify-between gap-2" data-testid={`portal-document-${doc.id}`}>
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
  const { locale, calendarType } = useI18n();
  const { data: invoices = [] } = useQuery({
    queryKey: ["portal", "invoices", user?.patientId],
    enabled: !!user?.patientId,
    queryFn: () => portalService.listInvoices(user!.patientId),
  });

  return (
    <div className="space-y-4" data-testid="portal-invoices-page">
      <h2 className="text-lg font-semibold">Invoices</h2>
      <div className="divide-y rounded-lg border" data-testid="portal-invoices-list">
        {invoices.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground" data-testid="portal-invoices-empty">No invoices yet.</p>
        ) : (
          invoices.map((inv: any) => (
            <div key={inv.id} className="p-4 flex flex-wrap justify-between gap-4" data-testid={`portal-invoice-${inv.id}`}>
              <div className="space-y-1">
                <p className="font-medium">{inv.invoice_code ?? "Invoice"}</p>
                <p className="text-xs text-muted-foreground">{inv.service}</p>
                <StatusBadge variant={invoiceStatusVariant[inv.status as keyof typeof invoiceStatusVariant] ?? "default"}>
                  {getInvoiceStatusLabel(inv.status)}
                </StatusBadge>
                {inv.due_date ? (
                  <p className="text-xs text-muted-foreground">
                    Due {formatDate(inv.due_date, locale, "date", calendarType)}
                  </p>
                ) : null}
                {inv.status === "void" && inv.void_reason ? (
                  <p className="max-w-sm text-xs text-muted-foreground">
                    Void reason: {inv.void_reason}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1 text-right">
                <p className="text-sm font-medium">Total {formatCurrency(inv.amount, locale)}</p>
                <p className="text-xs text-success">Paid {formatCurrency(inv.amount_paid ?? 0, locale)}</p>
                <p className="text-xs text-muted-foreground">Balance {formatCurrency(inv.balance_due ?? 0, locale)}</p>
                <p className="text-xs text-muted-foreground">{formatDate(inv.invoice_date, locale, "date", calendarType)}</p>
                {inv.paid_at ? (
                  <p className="text-xs text-muted-foreground">
                    Settled {formatDate(inv.paid_at, locale, "datetime", calendarType)}
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
