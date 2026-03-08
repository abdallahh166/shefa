import { useI18n } from "@/core/i18n/i18nStore";
import { StatCard } from "@/shared/components/StatCard";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { Users, CalendarDays, Stethoscope, DollarSign } from "lucide-react";

const recentAppointments = [
  { id: "1", patient: "Mohammed Al-Rashid", doctor: "Dr. Sarah Ahmed", time: "09:00 AM", status: "completed" as const },
  { id: "2", patient: "Fatima Hassan", doctor: "Dr. John Smith", time: "10:30 AM", status: "inProgress" as const },
  { id: "3", patient: "Ali Mansour", doctor: "Dr. Sarah Ahmed", time: "11:00 AM", status: "scheduled" as const },
  { id: "4", patient: "Noor Ibrahim", doctor: "Dr. Layla Khalid", time: "02:00 PM", status: "scheduled" as const },
  { id: "5", patient: "Khalid Omar", doctor: "Dr. John Smith", time: "03:30 PM", status: "cancelled" as const },
];

const statusVariant = {
  completed: "success",
  inProgress: "info",
  scheduled: "default",
  cancelled: "destructive",
} as const;

export const DashboardPage = () => {
  const { t } = useI18n();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">{t("dashboard.title")}</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t("dashboard.totalPatients")} value="1,284" icon={Users} trend={{ value: 12, positive: true }} />
        <StatCard title={t("dashboard.todayAppointments")} value="24" icon={CalendarDays} trend={{ value: 5, positive: true }} />
        <StatCard title={t("dashboard.activeDoctors")} value="18" icon={Stethoscope} />
        <StatCard title={t("dashboard.monthlyRevenue")} value="$48,250" icon={DollarSign} trend={{ value: 8, positive: true }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card rounded-lg border">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold">{t("dashboard.recentAppointments")}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr className="bg-muted/50">
                  <th>{t("appointments.patient")}</th>
                  <th>{t("appointments.doctor")}</th>
                  <th>{t("appointments.dateTime")}</th>
                  <th>{t("common.status")}</th>
                </tr>
              </thead>
              <tbody>
                {recentAppointments.map((apt) => (
                  <tr key={apt.id} className="hover:bg-muted/30 transition-colors">
                    <td className="font-medium">{apt.patient}</td>
                    <td>{apt.doctor}</td>
                    <td className="text-muted-foreground">{apt.time}</td>
                    <td>
                      <StatusBadge variant={statusVariant[apt.status]}>
                        {t(`appointments.${apt.status}`)}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-card rounded-lg border">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold">{t("dashboard.upcomingSchedule")}</h2>
          </div>
          <div className="p-4 space-y-3">
            {["09:00 - Dr. Sarah Ahmed", "10:30 - Dr. John Smith", "11:00 - Dr. Layla Khalid", "14:00 - Dr. Sarah Ahmed", "15:30 - Dr. John Smith"].map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
