import { useState, useMemo } from "react";
import { useI18n } from "@/core/i18n/i18nStore";
import { StatCard } from "@/shared/components/StatCard";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { Users, CalendarDays, Stethoscope, DollarSign, Activity } from "lucide-react";
import { useSupabaseTable } from "@/hooks/useSupabaseQuery";
import { useAuth } from "@/core/auth/authStore";
import { Tables } from "@/integrations/supabase/types";
import { formatDate, formatCurrency } from "@/shared/utils/formatDate";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

type Appointment = Tables<"appointments"> & {
  patients?: { full_name: string } | null;
  doctors?: { full_name: string } | null;
};

type DateRange = "today" | "week" | "month" | "all";

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

function getDateRangeStart(range: DateRange): Date | null {
  const now = new Date();
  switch (range) {
    case "today": return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "week": { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
    case "month": { const d = new Date(now); d.setMonth(d.getMonth() - 1); return d; }
    case "all": return null;
  }
}

export const DashboardPage = () => {
  const { t, locale, calendarType } = useI18n();
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>("month");

  const { data: patients = [] } = useSupabaseTable<Tables<"patients">>("patients");
  const { data: doctors = [] } = useSupabaseTable<Tables<"doctors">>("doctors");
  const { data: appointments = [] } = useSupabaseTable<Appointment>("appointments", {
    select: "*, patients(full_name), doctors(full_name)",
    orderBy: { column: "appointment_date", ascending: false },
  });
  const { data: invoices = [] } = useSupabaseTable<Tables<"invoices">>("invoices");

  const rangeStart = getDateRangeStart(dateRange);

  const filteredAppointments = useMemo(() => {
    if (!rangeStart) return appointments;
    return appointments.filter((a) => new Date(a.appointment_date) >= rangeStart);
  }, [appointments, rangeStart]);

  const filteredInvoices = useMemo(() => {
    if (!rangeStart) return invoices;
    return invoices.filter((i) => new Date(i.invoice_date) >= rangeStart);
  }, [invoices, rangeStart]);

  const totalPatients = String(patients.length);
  const periodAppointments = String(filteredAppointments.length);
  const activeDoctors = String(doctors.filter((d) => d.status === "available").length);
  const revenue = formatCurrency(
    filteredInvoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0),
    locale,
  );

  const recentList = filteredAppointments.slice(0, 5).map((a) => ({
  id: a.id,
  patient: a.patients?.full_name ?? "-",
  doctor: a.doctors?.full_name ?? "-",
  time: formatDate(a.appointment_date, locale, "time", calendarType),
  status: a.status,
}));
  const revenueTrend = useMemo(() => {    const months: Record<string, number> = {};
    invoices.forEach((inv) => {
      if (inv.status === "paid") {
        const key = new Date(inv.invoice_date).toLocaleString("en", { month: "short" });
        months[key] = (months[key] || 0) + Number(inv.amount);
      }
    });
    return Object.entries(months).map(([month, revenue]) => ({ month, revenue }));
  }, [invoices]);

  const apptTypes = useMemo(() => {    const types: Record<string, number> = {};
    appointments.forEach((a) => { types[a.type] = (types[a.type] || 0) + 1; });
    return Object.entries(types).map(([name, value]) => ({ name: name.replace("_", " "), value }));
  }, [appointments]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">{t("dashboard.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("dashboard.welcomeBack") || "Welcome back"}, {user?.name?.split(" ")[0] ?? ""}</p>
        </div>
        <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">{t("dashboard.rangeToday")}</SelectItem>
            <SelectItem value="week">{t("dashboard.rangeWeek")}</SelectItem>
            <SelectItem value="month">{t("dashboard.rangeMonth")}</SelectItem>
            <SelectItem value="all">{t("dashboard.rangeAll")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t("dashboard.totalPatients")} value={totalPatients} icon={Users} accent="primary" />
        <StatCard title={t("dashboard.periodAppointments")} value={periodAppointments} icon={CalendarDays} accent="info" />
        <StatCard title={t("dashboard.activeDoctors")} value={activeDoctors} icon={Stethoscope} accent="success" />
        <StatCard title={t("dashboard.periodRevenue")} value={revenue} icon={DollarSign} accent="warning" />
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

      {/* Recent Appointments */}
      <div className="bg-card rounded-xl border">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">{t("dashboard.recentAppointments")}</h2>
          <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">{recentList.length} {t("common.appointments").toLowerCase()}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr className="bg-muted/30">
                <th>{t("appointments.patient")}</th>
                <th>{t("appointments.doctor")}</th>
                <th>{t("appointments.dateTime")}</th>
                <th>{t("common.status")}</th>
              </tr>
            </thead>
            <tbody>
              {recentList.map((apt) => (
                <tr key={apt.id} className="hover:bg-muted/20 transition-colors">
                  <td className="font-medium">{apt.patient}</td>
                  <td>{apt.doctor}</td>
                  <td className="text-muted-foreground">{apt.time}</td>
                  <td>
                    <StatusBadge variant={statusVariant[apt.status] ?? "default"}>
                      {apt.status === "completed"
                        ? t("appointments.completed")
                        : apt.status === "in_progress"
                          ? t("appointments.inProgress")
                          : apt.status === "cancelled"
                            ? t("appointments.cancelled")
                            : t("appointments.scheduled")}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
              {recentList.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-muted-foreground">{t("common.noData")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

