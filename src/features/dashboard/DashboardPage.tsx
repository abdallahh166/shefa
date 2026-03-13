import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/core/i18n/i18nStore";
import { StatCard } from "@/shared/components/StatCard";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { Users, CalendarDays, Stethoscope, DollarSign, Activity } from "lucide-react";
import { useAuth } from "@/core/auth/authStore";
import { formatCurrency } from "@/shared/utils/formatDate";
import { reportService } from "@/services";
import { queryKeys } from "@/services/queryKeys";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const statusVariant: Record<string, "success" | "info" | "default" | "destructive"> = {
  completed: "success",
  in_progress: "info",
  scheduled: "default",
  cancelled: "destructive",
};

const COLORS = [
  "hsl(174, 62%, 34%)", "hsl(210, 80%, 52%)", "hsl(152, 60%, 40%)",
  "hsl(38, 92%, 50%)", "hsl(0, 72%, 51%)",
];

export const DashboardPage = () => {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const tenantId = user?.tenantId;
  const { data: overview } = useQuery({
    queryKey: queryKeys.reports.overview(tenantId),
    queryFn: () => reportService.getOverview(),
    enabled: !!tenantId,
  });

  const { data: revenueTrend = [] } = useQuery({
    queryKey: queryKeys.reports.revenueByMonth(tenantId),
    queryFn: () => reportService.getRevenueByMonth(6),
    enabled: !!tenantId,
  });

  const { data: apptTypes = [] } = useQuery({
    queryKey: queryKeys.reports.appointmentTypes(tenantId),
    queryFn: () => reportService.getAppointmentTypes(),
    enabled: !!tenantId,
  });

  const { data: statusCounts = { scheduled: 0, in_progress: 0, completed: 0, cancelled: 0 } } = useQuery({
    queryKey: queryKeys.reports.appointmentStatuses(tenantId),
    queryFn: () => reportService.getAppointmentStatusCounts(),
    enabled: !!tenantId,
  });

  const totalPatients = overview?.total_patients ?? 0;
  const totalAppointments = overview?.total_appointments ?? 0;
  const averageRating = overview?.avg_doctor_rating ?? 0;
  const totalRevenue = overview?.total_revenue ?? 0;

  const statusRows = useMemo(
    () => ([
      { status: "scheduled", label: t("appointments.scheduled"), count: statusCounts.scheduled },
      { status: "in_progress", label: t("appointments.inProgress"), count: statusCounts.in_progress },
      { status: "completed", label: t("appointments.completed"), count: statusCounts.completed },
      { status: "cancelled", label: t("appointments.cancelled"), count: statusCounts.cancelled },
    ]),
    [statusCounts, t],
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">{t("dashboard.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("dashboard.welcomeBack") || "Welcome back"}, {user?.name?.split(" ")[0] ?? ""}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t("dashboard.totalPatients")} value={totalPatients} icon={Users} accent="primary" />
        <StatCard title={t("reports.totalAppointments")} value={String(totalAppointments)} icon={CalendarDays} accent="info" />
        <StatCard title={t("reports.avgDoctorRating")} value={averageRating ? Number(averageRating).toFixed(1) : "0.0"} icon={Stethoscope} accent="success" />
        <StatCard title={t("dashboard.periodRevenue")} value={formatCurrency(Number(totalRevenue), locale)} icon={DollarSign} accent="warning" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trend */}
        <div className="lg:col-span-2 bg-card rounded-xl border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              {t("reports.revenue") || "Revenue"} {t("reports.trend") || "Trend"}
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={revenueTrend}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(174, 62%, 34%)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(174, 62%, 34%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 90%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => `$${Number(v).toLocaleString()}`} />
              <Area type="monotone" dataKey="revenue" stroke="hsl(174, 62%, 34%)" fill="url(#revGrad)" strokeWidth={2.5} dot={{ fill: "hsl(174, 62%, 34%)", r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Appointment Types Pie */}
        <div className="bg-card rounded-xl border p-5">
          <h3 className="font-semibold mb-4">{t("reports.byType") || "By Type"}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={apptTypes} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                {apptTypes.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Appointment Status Summary */}
      <div className="bg-card rounded-xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">{t("reports.appointmentStatusDistribution")}</h2>
          <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
            {String(totalAppointments)} {t("reports.appointments")}
          </span>
        </div>
        <div className="space-y-3">
          {statusRows.map((row) => (
            <div key={row.status} className="flex items-center justify-between">
              <StatusBadge variant={statusVariant[row.status] ?? "default"}>{row.label}</StatusBadge>
              <span className="text-sm font-semibold">{row.count}</span>
            </div>
          ))}
          {statusRows.every((r) => r.count === 0) && (
            <div className="text-sm text-muted-foreground">{t("common.noData")}</div>
          )}
        </div>
      </div>
    </div>
  );
};

