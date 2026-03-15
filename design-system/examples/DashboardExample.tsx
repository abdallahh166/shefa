/**
 * Dashboard Page — Design System Example
 *
 * Demonstrates:
 *  - PageContainer + SectionHeader for layout
 *  - StatCard with trend indicators
 *  - StatusBadge semantic variants
 *  - Card / CardHeader / CardContent for panels
 *  - FilterBar for period selection
 *  - DataTable for recent appointments
 *  - Chart colors via CSS variables (no hardcoding)
 *
 * Drop-in replacement for src/features/dashboard/DashboardPage.tsx
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// Design System imports
import { PageContainer, SectionHeader } from "@/design-system/components/layout/AppLayout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/design-system/components/primitives/Display";
import { StatCard, StatusBadge, FilterBar, DataTable, Column } from "@/design-system/components/data-display/DataDisplay";

import { useAuth } from "@/core/auth/authStore";
import { useI18n } from "@/core/i18n/i18nStore";
import { reportService } from "@/services";
import { queryKeys } from "@/services/queryKeys";
import { formatCurrency, formatDate } from "@/shared/utils/formatDate";
import {
  Users, CalendarDays, Stethoscope, DollarSign, TrendingUp, Activity,
} from "lucide-react";

// ── Period filter ─────────────────────────────────────────────────────────────
type Period = "today" | "week" | "month" | "all";

const PERIOD_OPTIONS = [
  { value: "today",  label: "Today"      },
  { value: "week",   label: "Last 7 days"},
  { value: "month",  label: "Last 30 days"},
  { value: "all",    label: "All time"   },
] as const;

// ── Status mapping ────────────────────────────────────────────────────────────
const apptStatusVariant: Record<string, "success" | "info" | "default" | "danger"> = {
  completed:   "success",
  in_progress: "info",
  scheduled:   "default",
  cancelled:   "danger",
};

// ── Chart colors — read from CSS variables, never hardcode ───────────────────
function useCssVar(name: string): string {
  if (typeof getComputedStyle === "undefined") return "hsl(221, 83%, 53%)";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function useChartColors() {
  return useMemo(() => ({
    chart1: `hsl(${document.documentElement.style.getPropertyValue("--chart-1") || "221 83% 53%"})`,
    chart2: `hsl(${document.documentElement.style.getPropertyValue("--chart-2") || "160 84% 39%"})`,
    chart3: `hsl(${document.documentElement.style.getPropertyValue("--chart-3") || "38 92% 50%"})`,
    chart4: `hsl(${document.documentElement.style.getPropertyValue("--chart-4") || "199 89% 48%"})`,
    chart5: `hsl(${document.documentElement.style.getPropertyValue("--chart-5") || "262 83% 58%"})`,
  }), []);
}

// ── Recent appointments table columns ─────────────────────────────────────────
type RecentAppt = {
  id: string;
  patient: string;
  doctor: string;
  type: string;
  date: string;
  status: string;
};

const apptColumns: Column<RecentAppt>[] = [
  { key: "patient",   header: "Patient",     sortable: true,  searchable: true  },
  { key: "doctor",    header: "Doctor",      sortable: true                     },
  { key: "type",      header: "Type",        render: (r) => <span className="capitalize text-sm">{r.type?.replace("_", " ")}</span> },
  { key: "date",      header: "Date / Time", sortable: true,  render: (r) => <span className="tabular text-sm text-muted-foreground">{r.date}</span> },
  {
    key: "status",
    header: "Status",
    render: (r) => (
      <StatusBadge variant={apptStatusVariant[r.status] ?? "default"} dot>
        {r.status.replace("_", " ")}
      </StatusBadge>
    ),
  },
];

// ── Component ─────────────────────────────────────────────────────────────────
export const DashboardPage = () => {
  const { t, locale, calendarType } = useI18n();
  const { user } = useAuth();
  const tenantId = user?.tenantId;
  const chartColors = useChartColors();

  const [period, setPeriod] = useState<Period>("month");
  const [apptSort, setApptSort] = useState<{ col: string; dir: "asc" | "desc" | null }>({ col: "date", dir: "desc" });
  const [apptPage, setApptPage] = useState(1);

  // ── Queries ──
  const { data: overview, isLoading: overviewLoading } = useQuery({
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

  // ── Derived values ──
  const totalPatients    = overview?.total_patients    ?? 0;
  const totalAppts       = overview?.total_appointments ?? 0;
  const avgRating        = overview?.avg_doctor_rating  ?? 0;
  const totalRevenue     = overview?.total_revenue      ?? 0;

  const statusRows = useMemo(() => [
    { key: "scheduled",   label: t("appointments.scheduled"),   count: statusCounts.scheduled,   variant: "default"  as const },
    { key: "in_progress", label: t("appointments.inProgress"),  count: statusCounts.in_progress, variant: "info"     as const },
    { key: "completed",   label: t("appointments.completed"),   count: statusCounts.completed,   variant: "success"  as const },
    { key: "cancelled",   label: t("appointments.cancelled"),   count: statusCounts.cancelled,   variant: "danger"   as const },
  ], [statusCounts, t]);

  const totalStatusCount = statusRows.reduce((s, r) => s + r.count, 0);

  // ── Chart tooltip styling — uses CSS variables ──
  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    fontSize: "12px",
    color: "hsl(var(--foreground))",
  };

  return (
    <PageContainer>
      {/* ── Header ── */}
      <SectionHeader
        title={t("dashboard.title")}
        subtitle={`Welcome back, ${user?.name?.split(" ")[0] ?? ""}. Here's what's happening today.`}
      />

      {/* ── Period filter ── */}
      <FilterBar
        options={PERIOD_OPTIONS.map((o) => ({ ...o, value: o.value }))}
        value={period}
        onChange={(v) => setPeriod((v as Period) ?? "month")}
      />

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t("dashboard.totalPatients")}
          value={totalPatients.toLocaleString()}
          icon={Users}
          accent="primary"
          trend={{ value: 8, positive: true, label: "vs last month" }}
          loading={overviewLoading}
        />
        <StatCard
          title={t("reports.totalAppointments")}
          value={totalAppts.toLocaleString()}
          icon={CalendarDays}
          accent="info"
          loading={overviewLoading}
        />
        <StatCard
          title={t("reports.avgDoctorRating")}
          value={avgRating ? `${Number(avgRating).toFixed(1)} ★` : "—"}
          icon={Stethoscope}
          accent="success"
          loading={overviewLoading}
        />
        <StatCard
          title={t("dashboard.periodRevenue")}
          value={formatCurrency(Number(totalRevenue), locale)}
          icon={DollarSign}
          accent="warning"
          trend={{ value: 12, positive: true, label: "vs last month" }}
          loading={overviewLoading}
        />
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue trend */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t("reports.revenue")}</CardTitle>
                <CardDescription>Last 6 months</CardDescription>
              </div>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-primary" aria-hidden />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueTrend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={chartColors.chart1} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={chartColors.chart1} stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }} />
                <Area type="monotone" dataKey="revenue" stroke={chartColors.chart1} strokeWidth={2} fill="url(#revGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Appointment types pie */}
        <Card>
          <CardHeader>
            <CardTitle>{t("reports.byType")}</CardTitle>
            <CardDescription>Appointment breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={apptTypes}
                  dataKey="count"
                  nameKey="name"
                  cx="50%" cy="50%"
                  innerRadius={50}
                  outerRadius={72}
                  strokeWidth={2}
                  stroke="hsl(var(--card))"
                  aria-label="Appointment types distribution"
                >
                  {apptTypes.map((_, i) => (
                    <Cell key={i} fill={Object.values(chartColors)[i % 5]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
              {apptTypes.map((item, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: Object.values(chartColors)[i % 5] }} aria-hidden />
                  <span className="text-muted-foreground capitalize">{item.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Appointment Status Distribution ── */}
      <Card>
        <CardHeader>
          <CardTitle>{t("reports.appointmentStatusDistribution")}</CardTitle>
          <CardDescription>{totalStatusCount.toLocaleString()} total</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {statusRows.map((row) => (
              <div key={row.key} className="flex items-center gap-3">
                <StatusBadge variant={row.variant} dot className="w-28 justify-start">
                  {row.label}
                </StatusBadge>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden" role="progressbar"
                  aria-valuenow={row.count} aria-valuemax={totalStatusCount} aria-label={`${row.label}: ${row.count}`}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: totalStatusCount > 0 ? `${(row.count / totalStatusCount) * 100}%` : "0%",
                      backgroundColor: row.variant === "success" ? "hsl(var(--success))"
                        : row.variant === "info"    ? "hsl(var(--info))"
                        : row.variant === "danger"  ? "hsl(var(--destructive))"
                        : "hsl(var(--muted-foreground))",
                    }}
                  />
                </div>
                <span className="text-sm font-medium tabular w-8 text-end">{row.count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
};
