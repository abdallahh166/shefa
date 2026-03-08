import { useI18n } from "@/core/i18n/i18nStore";
import { DataTable, Column } from "@/shared/components/DataTable";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { PermissionGuard } from "@/core/auth/PermissionGuard";
import { CalendarPlus } from "lucide-react";

interface Appointment {
  id: string;
  patient: string;
  doctor: string;
  dateTime: string;
  type: "checkup" | "followUp" | "consultation" | "emergency";
  status: "scheduled" | "completed" | "cancelled" | "inProgress";
}

const DEMO_APPOINTMENTS: Appointment[] = [
  { id: "1", patient: "Mohammed Al-Rashid", doctor: "Dr. Sarah Ahmed", dateTime: "2026-03-08 09:00", type: "checkup", status: "completed" },
  { id: "2", patient: "Fatima Hassan", doctor: "Dr. John Smith", dateTime: "2026-03-08 10:30", type: "followUp", status: "inProgress" },
  { id: "3", patient: "Ali Mansour", doctor: "Dr. Sarah Ahmed", dateTime: "2026-03-08 11:00", type: "consultation", status: "scheduled" },
  { id: "4", patient: "Noor Ibrahim", doctor: "Dr. Layla Khalid", dateTime: "2026-03-08 14:00", type: "checkup", status: "scheduled" },
  { id: "5", patient: "Khalid Omar", doctor: "Dr. John Smith", dateTime: "2026-03-08 15:30", type: "emergency", status: "cancelled" },
  { id: "6", patient: "Sara Al-Fahad", doctor: "Dr. Sarah Ahmed", dateTime: "2026-03-09 09:00", type: "followUp", status: "scheduled" },
];

const statusVariant = { completed: "success", inProgress: "info", scheduled: "default", cancelled: "destructive" } as const;
const typeVariant = { checkup: "default", followUp: "info", consultation: "success", emergency: "warning" } as const;

export const AppointmentsPage = () => {
  const { t } = useI18n();

  const columns: Column<Appointment>[] = [
    { key: "patient", header: t("appointments.patient"), render: (a) => <span className="font-medium">{a.patient}</span> },
    { key: "doctor", header: t("appointments.doctor") },
    { key: "dateTime", header: t("appointments.dateTime") },
    { key: "type", header: t("appointments.type"), render: (a) => <StatusBadge variant={typeVariant[a.type]}>{t(`appointments.${a.type}`)}</StatusBadge> },
    { key: "status", header: t("common.status"), render: (a) => <StatusBadge variant={statusVariant[a.status]}>{t(`appointments.${a.status}`)}</StatusBadge> },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">{t("appointments.title")}</h1>
        <PermissionGuard permission="manage_appointments">
          <Button>
            <CalendarPlus className="h-4 w-4" />
            {t("appointments.newAppointment")}
          </Button>
        </PermissionGuard>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(["scheduled", "inProgress", "completed", "cancelled"] as const).map((status) => {
          const count = DEMO_APPOINTMENTS.filter((a) => a.status === status).length;
          return (
            <div key={status} className="stat-card text-center">
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-sm text-muted-foreground">{t(`appointments.${status}`)}</p>
            </div>
          );
        })}
      </div>

      <DataTable columns={columns} data={DEMO_APPOINTMENTS} keyExtractor={(a) => a.id} />
    </div>
  );
};
