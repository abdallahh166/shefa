import { useQuery } from "@tanstack/react-query";
import { portalService } from "@/services/portal/portal.service";
import { usePortalAuth } from "@/core/auth/portalAuthStore";
import { formatDate, formatCurrency } from "@/shared/utils/formatDate";
import { useI18n } from "@/core/i18n/i18nStore";

export const PortalAppointmentsPage = () => {
  const { user } = usePortalAuth();
  const { locale, calendarType } = useI18n();

  const { data: appointments = [] } = useQuery({
    queryKey: ["portal", "appointments", user?.patientId],
    enabled: !!user?.patientId,
    queryFn: () => portalService.listAppointments(user!.patientId),
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Appointments</h2>
      <div className="divide-y rounded-lg border">
        {appointments.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No appointments yet.</p>
        ) : (
          appointments.map((appt: any) => (
            <div key={appt.id} className="p-4 flex flex-wrap justify-between gap-2">
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
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Prescriptions</h2>
      <div className="divide-y rounded-lg border">
        {prescriptions.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No prescriptions yet.</p>
        ) : (
          prescriptions.map((rx: any) => (
            <div key={rx.id} className="p-4 flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-medium">{rx.medication}</p>
                <p className="text-xs text-muted-foreground">{rx.dosage}</p>
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
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Lab Results</h2>
      <div className="divide-y rounded-lg border">
        {labOrders.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No lab results yet.</p>
        ) : (
          labOrders.map((lab: any) => (
            <div key={lab.id} className="p-4">
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
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Documents</h2>
      <div className="divide-y rounded-lg border">
        {documents.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No documents yet.</p>
        ) : (
          documents.map((doc: any) => (
            <div key={doc.id} className="p-4 flex flex-wrap justify-between gap-2">
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
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Invoices</h2>
      <div className="divide-y rounded-lg border">
        {invoices.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No invoices yet.</p>
        ) : (
          invoices.map((inv: any) => (
            <div key={inv.id} className="p-4 flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-medium">{inv.invoice_code ?? "Invoice"}</p>
                <p className="text-xs text-muted-foreground">{inv.service}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{formatCurrency(inv.amount, locale)}</p>
                <p className="text-xs text-muted-foreground">{formatDate(inv.invoice_date, locale, "date", calendarType)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
