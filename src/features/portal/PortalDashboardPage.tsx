import { useQuery } from "@tanstack/react-query";
import { portalService } from "@/services/portal/portal.service";
import { usePortalAuth } from "@/core/auth/portalAuthStore";

export const PortalDashboardPage = () => {
  const { user } = usePortalAuth();

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
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Welcome back</h2>
        <p className="text-sm text-muted-foreground">Here is a quick overview of your records.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Appointments</p>
          <p className="text-2xl font-semibold">{appointments.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Prescriptions</p>
          <p className="text-2xl font-semibold">{prescriptions.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Lab Results</p>
          <p className="text-2xl font-semibold">{labOrders.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Invoices</p>
          <p className="text-2xl font-semibold">{invoices.length}</p>
        </div>
      </div>
    </div>
  );
};
