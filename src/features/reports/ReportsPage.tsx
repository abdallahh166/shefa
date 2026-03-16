import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/core/i18n/i18nStore";
import { useAuth } from "@/core/auth/authStore";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area,
} from "recharts";
import {
  TrendingUp, Users, CalendarDays, DollarSign, Download, Printer,
  Activity, FileBarChart, Star, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { StatCard } from "@/shared/components/StatCard";
import { DataTable, Column } from "@/shared/components/DataTable";
import { Button } from "@/components/primitives/Button";
import { PageContainer, SectionHeader } from "@/components/layout/AppLayout";
import { generatePDF } from "@/shared/utils/pdfGenerator";
import { useQuery } from "@tanstack/react-query";
import { reportService } from "@/services/reports/report.service";
import { queryKeys } from "@/services/queryKeys";
import { useChartColors } from "@/shared/hooks/useChartColors";
import { toast } from "@/hooks/use-toast";

type Tab = "revenue" | "patients" | "doctors" | "appointments";

export const ReportsPage = () => {
  const { t } = useI18n();
  const { user, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("revenue");
  const canViewReports = hasPermission("view_reports") || hasPermission("super_admin");
  const colors = useChartColors();
  const chartPalette = [colors.primary, colors.info, colors.success, colors.warning, colors.violet, colors.destructive];
  const reportErrorShownRef = useRef(false);

  useEffect(() => {
    reportErrorShownRef.current = false;
  }, [user?.tenantId]);

  const notifyReportError = useCallback(() => {
    if (reportErrorShownRef.current) return;
    reportErrorShownRef.current = true;
    toast({
      title: t("reports.loadError"),
      description: t("reports.loadErrorDesc"),
      variant: "destructive",
    });
  }, [t]);

  const { data: canViewReportsServer = true } = useQuery({
    queryKey: queryKeys.reports.access(user?.tenantId),
    enabled: !!user?.tenantId && canViewReports,
    queryFn: () => reportService.canViewReports(),
    retry: false,
    staleTime: 1000 * 60 * 5,
    onError: notifyReportError,
  });

  const canRenderReports = canViewReports && canViewReportsServer;

  const { data: overview } = useQuery({
    queryKey: queryKeys.reports.overview(user?.tenantId),
    enabled: !!user?.tenantId && canRenderReports,
    queryFn: () => reportService.getOverview(),
    staleTime: 1000 * 60 * 5,
    retry: false,
    onError: notifyReportError,
  });

  const { data: revenueData = [] } = useQuery({
    queryKey: queryKeys.reports.revenueByMonth(user?.tenantId),
    enabled: !!user?.tenantId && canRenderReports,
    queryFn: () => reportService.getRevenueByMonth(6),
    staleTime: 1000 * 60 * 5,
    retry: false,
    onError: notifyReportError,
  });

  const { data: patientGrowth = [] } = useQuery({
    queryKey: queryKeys.reports.patientGrowth(user?.tenantId),
    enabled: !!user?.tenantId && canRenderReports,
    queryFn: () => reportService.getPatientGrowth(6),
    staleTime: 1000 * 60 * 5,
    retry: false,
    onError: notifyReportError,
  });

  const { data: appointmentTypes = [] } = useQuery({
    queryKey: queryKeys.reports.appointmentTypes(user?.tenantId),
    enabled: !!user?.tenantId && canRenderReports,
    queryFn: () => reportService.getAppointmentTypes(),
    staleTime: 1000 * 60 * 5,
    retry: false,
    onError: notifyReportError,
  });

  const { data: revenueByService = [] } = useQuery({
    queryKey: queryKeys.reports.revenueByService(user?.tenantId),
    enabled: !!user?.tenantId && canRenderReports,
    queryFn: () => reportService.getRevenueByService(6),
    staleTime: 1000 * 60 * 5,
    retry: false,
    onError: notifyReportError,
  });

  const { data: doctorPerformance = [] } = useQuery({
    queryKey: queryKeys.reports.doctorPerformance(user?.tenantId),
    enabled: !!user?.tenantId && canRenderReports,
    queryFn: () => reportService.getDoctorPerformance(),
    staleTime: 1000 * 60 * 5,
    retry: false,
    onError: notifyReportError,
  });

  const { data: appointmentStatusCounts = { scheduled: 0, in_progress: 0, completed: 0, cancelled: 0 } } = useQuery({
    queryKey: queryKeys.reports.appointmentStatuses(user?.tenantId),
    enabled: !!user?.tenantId && canRenderReports,
    queryFn: () => reportService.getAppointmentStatusCounts(),
    staleTime: 1000 * 60 * 5,
    retry: false,
    onError: notifyReportError,
  });

  if (!canRenderReports) {
    return (
      <PageContainer className="space-y-4">
        <SectionHeader
          title={t("reports.title")}
          subtitle={t("reports.subtitle") || "Analytics and insights for your clinic"}
          icon={FileBarChart}
        />
        <p className="text-sm text-muted-foreground">{t("reports.noPermission")}</p>
      </PageContainer>
    );
  }

  const totalRevenue = overview?.total_revenue ?? 0;
  const totalPatients = overview?.total_patients ?? 0;
  const totalAppointments = overview?.total_appointments ?? 0;
  const avgRating = overview?.avg_doctor_rating ?? 0;

  const tabItems: { key: Tab; icon: any; label: string }[] = [
    { key: "revenue", icon: DollarSign, label: t("reports.revenue") },
    { key: "patients", icon: Users, label: t("common.patients") },
    { key: "appointments", icon: CalendarDays, label: t("common.appointments") },
    { key: "doctors", icon: Star, label: t("reports.doctorPerformance") },
  ];

  const exportReportCsv = () => {
    let csv = "";
    if (activeTab === "revenue") {
      csv = "Month,Revenue,Pending/Overdue\n" + revenueData.map((r) => `${r.month},${r.revenue},${r.expenses}`).join("\n");
    } else if (activeTab === "patients") {
      csv = "Month,Patients\n" + patientGrowth.map((p) => `${p.month},${p.patients}`).join("\n");
    } else if (activeTab === "appointments") {
      csv = "Type,Count\n" + appointmentTypes.map((a) => `${a.name},${a.value}`).join("\n");
    } else if (activeTab === "doctors") {
      csv = "Doctor,Appointments,Completion Rate,Rating\n" + doctorPerformance.map((d) => `${d.name},${d.appointments},${d.completedRate},${d.rating}`).join("\n");
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportReportPdf = () => {
    if (activeTab === "revenue") {
      generatePDF({
        title: t("reports.revenue"),
        subtitle: `Total: $${totalRevenue.toLocaleString()}`,
        columns: [
          { header: "Month", dataKey: "month" },
          { header: "Revenue", dataKey: "revenue" },
          { header: "Pending/Overdue", dataKey: "expenses" },
        ],
        data: revenueData.map((r) => ({ ...r, revenue: `$${r.revenue.toLocaleString()}`, expenses: `$${r.expenses.toLocaleString()}` })),
        filename: `revenue-report-${new Date().toISOString().slice(0, 10)}.pdf`,
      });
    } else if (activeTab === "doctors") {
      generatePDF({
        title: t("reports.doctorPerformance"),
        columns: [
          { header: "Doctor", dataKey: "name" },
          { header: "Appointments", dataKey: "appointments" },
          { header: "Completion Rate", dataKey: "completedRate" },
          { header: "Rating", dataKey: "rating" },
        ],
        data: doctorPerformance,
        filename: `doctor-report-${new Date().toISOString().slice(0, 10)}.pdf`,
      });
    } else if (activeTab === "patients") {
      generatePDF({
        title: t("reports.patientGrowth"),
        columns: [
          { header: "Month", dataKey: "month" },
          { header: "Total Patients", dataKey: "patients" },
        ],
        data: patientGrowth,
        filename: `patient-growth-${new Date().toISOString().slice(0, 10)}.pdf`,
      });
    } else {
      generatePDF({
        title: t("reports.byType"),
        columns: [
          { header: "Type", dataKey: "name" },
          { header: "Count", dataKey: "value" },
        ],
        data: appointmentTypes,
        filename: `appointment-types-${new Date().toISOString().slice(0, 10)}.pdf`,
      });
    }
  };

  const doctorColumns: Column<any>[] = [
    {
      key: "name",
      header: t("reports.doctor"),
      render: (doc) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
            {doc.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
          </div>
          <span className="font-medium">{doc.name}</span>
        </div>
      ),
    },
    {
      key: "appointments",
      header: t("reports.appointments"),
      render: (doc) => <span className="font-semibold">{doc.appointments}</span>,
    },
    {
      key: "completedRate",
      header: t("reports.completionRate"),
      render: (doc) => (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-muted rounded-full max-w-[100px]">
            <div
              className="h-2 bg-success rounded-full transition-all"
              style={{ width: doc.completedRate === "-" ? "0%" : doc.completedRate }}
            />
          </div>
          <span className="text-sm font-medium">{doc.completedRate}</span>
        </div>
      ),
    },
    {
      key: "rating",
      header: t("reports.rating"),
      render: (doc) => (
        <span className="inline-flex items-center gap-1 text-warning">
          <Star className="h-3.5 w-3.5 fill-warning" /> {doc.rating}
        </span>
      ),
    },
    {
      key: "trend",
      header: t("reports.trend") || "Trend",
      render: (doc) => (
        doc.trend
          ? <span className="inline-flex items-center gap-1 text-xs text-success"><ArrowUpRight className="h-3.5 w-3.5" /> Up</span>
          : <span className="inline-flex items-center gap-1 text-xs text-destructive"><ArrowDownRight className="h-3.5 w-3.5" /> Down</span>
      ),
    },
  ];

  return (
    <PageContainer className="space-y-6">
      <SectionHeader
        title={t("reports.title")}
        subtitle={t("reports.subtitle") || "Analytics and insights for your clinic"}
        icon={FileBarChart}
        actions={(
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportReportCsv}>
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportReportPdf}>
              <Printer className="h-4 w-4" /> PDF
            </Button>
          </div>
        )}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t("billing.totalRevenue")} value={`$${totalRevenue.toLocaleString()}`} icon={DollarSign} accent="warning" />
        <StatCard title={t("dashboard.totalPatients")} value={String(totalPatients)} icon={Users} accent="primary" />
        <StatCard title={t("reports.totalAppointments")} value={String(totalAppointments)} icon={CalendarDays} accent="info" />
        <StatCard title={t("reports.avgDoctorRating")} value={`${avgRating.toFixed(1)} *`} icon={TrendingUp} accent="success" />
      </div>

      <div className="border-b flex gap-1 overflow-x-auto">
        {tabItems.map((tab) => (
          <Button
            key={tab.key}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab(tab.key)}
            aria-pressed={activeTab === tab.key}
            className={cn(
              "h-auto rounded-none px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === "revenue" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-card rounded-xl border p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                {t("reports.revenueVsExpenses")}
              </h3>
            </div>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={revenueData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: any) => `$${Number(v).toLocaleString()}`}
                  contentStyle={{ borderRadius: 8, border: `1px solid ${colors.border}`, backgroundColor: colors.card, color: colors.fg }}
                />
                <Legend />
                <Bar dataKey="revenue" fill={colors.primary} radius={[6, 6, 0, 0]} name={t("reports.revenue")} />
                <Bar dataKey="expenses" fill={colors.warning} radius={[6, 6, 0, 0]} name={t("reports.pendingOverdue")} opacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-card rounded-xl border p-6">
            <h3 className="font-semibold mb-6">{t("reports.revenueByDepartment") || "Revenue by Service"}</h3>
            <ResponsiveContainer width="100%" height={340}>
              <PieChart>
                <Pie data={revenueByService} cx="50%" cy="50%" innerRadius={60} outerRadius={95} dataKey="value" paddingAngle={3}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}>
                  {revenueByService.map((_, i) => <Cell key={i} fill={chartPalette[i % chartPalette.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: colors.card, border: `1px solid ${colors.border}`, color: colors.fg }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === "patients" && (
        <div className="bg-card rounded-xl border p-6">
          <h3 className="font-semibold mb-6 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            {t("reports.patientGrowth")}
          </h3>
          <ResponsiveContainer width="100%" height={380}>
            <AreaChart data={patientGrowth}>
              <defs>
                <linearGradient id="patientGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colors.success} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={colors.success} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${colors.border}`, backgroundColor: colors.card, color: colors.fg }} />
              <Area type="monotone" dataKey="patients" stroke={colors.success} fill="url(#patientGrad)" strokeWidth={2.5} dot={{ fill: colors.success, r: 5, strokeWidth: 2, stroke: colors.card }} name={t("common.patients")} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {activeTab === "appointments" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-card rounded-xl border p-6">
            <h3 className="font-semibold mb-6">{t("reports.appointmentStatusDistribution")}</h3>
            {(() => {
              const statuses = ["scheduled", "in_progress", "completed", "cancelled"];
              const statusColors = [colors.warning, colors.info, colors.success, colors.destructive];
              const statusLabels: Record<string, string> = {
                scheduled: t("appointments.scheduled"),
                in_progress: t("appointments.inProgress"),
                completed: t("appointments.completed"),
                cancelled: t("appointments.cancelled"),
              };
              const data = statuses.map((s, i) => ({
                name: statusLabels[s] ?? s,
                value: appointmentStatusCounts[s as keyof typeof appointmentStatusCounts] ?? 0,
                fill: statusColors[i],
              }));
              return (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={data} layout="vertical" barSize={24}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.border} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={95} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${colors.border}`, backgroundColor: colors.card, color: colors.fg }} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} name={t("reports.count")}>
                      {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              );
            })()}
          </div>
          <div className="bg-card rounded-xl border p-6">
            <h3 className="font-semibold mb-6">{t("reports.byType")}</h3>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie data={appointmentTypes} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" paddingAngle={3}>
                  {appointmentTypes.map((_, i) => <Cell key={i} fill={chartPalette[i % chartPalette.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: colors.card, border: `1px solid ${colors.border}`, color: colors.fg }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === "doctors" && (
        <div className="space-y-3">
          <h3 className="font-semibold">{t("reports.doctorPerformance")}</h3>
          <DataTable
            columns={doctorColumns}
            data={doctorPerformance}
            keyExtractor={(doc) => doc.name}
            emptyMessage={t("common.noData")}
            tableLabel={t("reports.doctorPerformance")}
          />
        </div>
      )}
    </PageContainer>
  );
};
