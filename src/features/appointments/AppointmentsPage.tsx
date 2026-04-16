import { useMemo, useState, useEffect } from "react";
import { useI18n } from "@/core/i18n/i18nStore";
import { DataTable, Column } from "@/shared/components/DataTable";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { StatusFilter } from "@/shared/components/StatusFilter";
import { Button } from "@/components/primitives/Button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PermissionGuard } from "@/core/auth/PermissionGuard";
import { PageContainer, SectionHeader } from "@/components/layout/AppLayout";
import { CalendarPlus, CheckCircle, CalendarDays, List, Video } from "lucide-react";
import { formatDate } from "@/shared/utils/formatDate";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useAuth } from "@/core/auth/authStore";
import { NewAppointmentModal } from "./NewAppointmentModal";
import { WaitingRoomPanel } from "./WaitingRoomPanel";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { AppointmentCalendar, AppointmentCalendarItem, AppointmentCalendarView } from "./AppointmentCalendar";
import { appointmentService } from "@/services/appointments/appointment.service";
import { appointmentQueueService } from "@/services/appointments/appointmentQueue.service";
import { queryKeys } from "@/services/queryKeys";
import type { AppointmentQueueStatus, AppointmentQueueWithRelations } from "@/domain/appointmentQueue/appointmentQueue.types";
import type { AppointmentWithPatientDoctor } from "@/domain/appointment/appointment.types";

type AppointmentRow = AppointmentWithPatientDoctor;
type ViewMode = "list" | "calendar";
type WorkflowTab = "schedule" | "waitingRoom";

const statusVariant = {
  completed: "success",
  in_progress: "info",
  scheduled: "default",
  cancelled: "destructive",
  no_show: "warning",
} as const;

function queueStatusLabel(status: AppointmentQueueStatus) {
  switch (status) {
    case "waiting":
      return "Waiting";
    case "called":
      return "Called";
    case "in_service":
      return "In service";
    case "done":
      return "Done";
    case "no_show":
      return "No-show";
    default:
      return status;
  }
}

function localDayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfWeek(d: Date) {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const day = out.getDay();
  out.setDate(out.getDate() - day);
  return out;
}

function addDays(d: Date, days: number) {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function getCalendarRange(cursor: Date, view: AppointmentCalendarView) {
  if (view === "week") {
    const start = startOfWeek(cursor);
    const end = addDays(start, 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = startOfWeek(first);
  const end = addDays(start, 41);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export const AppointmentsPage = () => {
  const { t, locale, calendarType } = useI18n();
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const canManage = hasPermission("manage_appointments");
  const queueDayKey = localDayKey();

  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [workflowTab, setWorkflowTab] = useState<WorkflowTab>("schedule");
  const [calendarView, setCalendarView] = useState<AppointmentCalendarView>("month");
  const [calendarCursor, setCalendarCursor] = useState(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  });
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [sort, setSort] = useState<{ column: string; direction: "asc" | "desc" }>({
    column: "appointment_date",
    direction: "desc",
  });
  const pageSize = 25;

  useRealtimeSubscription(["appointments", "appointment_queue"]);

  const { data: listPage, isLoading: loadingList } = useQuery({
    queryKey: queryKeys.appointments.list({
      tenantId: user?.tenantId,
      page,
      pageSize,
      search: searchTerm.trim() || undefined,
      filters: statusFilter ? { status: statusFilter } : undefined,
      sort: { column: sort.column, ascending: sort.direction === "asc" },
    }),
    queryFn: async () => appointmentService.listPagedWithRelations({
      page,
      pageSize,
      search: searchTerm.trim() || undefined,
      filters: statusFilter ? { status: statusFilter } : undefined,
      sort: { column: sort.column, ascending: sort.direction === "asc" },
    }),
    enabled: !!user?.tenantId,
  });

  const { start: calendarStart, end: calendarEnd } = getCalendarRange(calendarCursor, calendarView);
  const { data: calendarAppointments = [] } = useQuery({
    queryKey: queryKeys.appointments.calendar({
      tenantId: user?.tenantId,
      start: calendarStart.toISOString(),
      end: calendarEnd.toISOString(),
    }),
    queryFn: async () => appointmentService.listByDateRange(
      calendarStart.toISOString(),
      calendarEnd.toISOString(),
    ),
    enabled: viewMode === "calendar" && !!user?.tenantId,
  });

  const { data: queueEntries = [], isLoading: loadingQueue } = useQuery({
    queryKey: queryKeys.appointments.queue({ tenantId: user?.tenantId, dayKey: queueDayKey }),
    queryFn: async () => appointmentQueueService.listToday(),
    enabled: !!user?.tenantId,
  });

  useEffect(() => {
    setPage(1);
  }, [statusFilter, searchTerm, viewMode]);

  const statusLabel = (s: string) => {
    switch (s) {
      case "scheduled": return t("appointments.scheduled");
      case "in_progress": return t("appointments.inProgress");
      case "completed": return t("appointments.completed");
      case "cancelled": return t("appointments.cancelled");
      case "no_show": return "No-show";
      default: return s;
    }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case "checkup": return t("appointments.checkup");
      case "follow_up": return t("appointments.followUp");
      case "consultation": return t("appointments.consultation");
      case "emergency": return t("appointments.emergency");
      default: return type;
    }
  };

  const listAppointments = listPage?.data ?? [];
  const totalAppointments = listPage?.count ?? 0;

  const listDisplayData: AppointmentCalendarItem[] = listAppointments.map((a) => ({
    id: a.id,
    patient_name: a.patients?.full_name ?? "-",
    doctor_name: a.doctors?.full_name ?? "-",
    appointment_date: a.appointment_date,
    type: a.type,
    status: a.status,
  }));

  const calendarDisplayData: AppointmentCalendarItem[] = calendarAppointments.map((a) => ({
    id: a.id,
    patient_name: a.patients?.full_name ?? "-",
    doctor_name: a.doctors?.full_name ?? "-",
    appointment_date: a.appointment_date,
    type: a.type,
    status: a.status,
  }));

  const calendarFiltered = useMemo(
    () => (statusFilter ? calendarDisplayData.filter((a) => a.status === statusFilter) : calendarDisplayData),
    [calendarDisplayData, statusFilter],
  );

  const { data: statusCounts = { scheduled: 0, in_progress: 0, completed: 0, cancelled: 0, no_show: 0 } } = useQuery({
    queryKey: queryKeys.appointments.statusCounts(user?.tenantId),
    enabled: !!user?.tenantId,
    queryFn: async () => appointmentService.countByStatus(),
  });

  const activeQueueByAppointment = useMemo(() => {
    const map = new Map<string, AppointmentQueueWithRelations>();
    queueEntries
      .filter((entry) => entry.status === "waiting" || entry.status === "called" || entry.status === "in_service")
      .forEach((entry) => {
        map.set(entry.appointment_id, entry);
      });
    return map;
  }, [queueEntries]);

  const invalidateAppointments = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.appointments.root(user?.tenantId) });
  };

  const handleUpdateStatus = async (id: string, newStatus: AppointmentRow["status"]) => {
    try {
      await appointmentService.update(id, { status: newStatus });
      toast({ title: t("appointments.appointmentStatusUpdated"), description: statusLabel(newStatus) });
      invalidateAppointments();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.error");
      toast({ title: t("common.error"), description: message, variant: "destructive" });
    }
  };

  const handleCheckIn = async (appointmentId: string) => {
    try {
      await appointmentQueueService.checkIn(appointmentId);
      toast({ title: "Patient checked in", description: "Added to the waiting room queue." });
      setWorkflowTab("waitingRoom");
      invalidateAppointments();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.error");
      toast({ title: t("common.error"), description: message, variant: "destructive" });
    }
  };

  const handleQueueStatusUpdate = async (queueId: string, nextStatus: AppointmentQueueStatus) => {
    try {
      await appointmentQueueService.updateStatus(queueId, nextStatus);
      toast({ title: "Waiting room updated", description: queueStatusLabel(nextStatus) });
      invalidateAppointments();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.error");
      toast({ title: t("common.error"), description: message, variant: "destructive" });
    }
  };

  const handleReschedule = async (id: string, newAppointmentDate: string) => {
    try {
      await appointmentService.update(id, { appointment_date: newAppointmentDate });
      toast({ title: t("appointments.appointmentRescheduled") });
      invalidateAppointments();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.error");
      toast({ title: t("common.error"), description: message, variant: "destructive" });
    }
  };

  const handleJoinCall = (id: string) => {
    if (!user?.tenantSlug) return;
    navigate(`/tenant/${user.tenantSlug}/appointments/${id}/video`);
  };

  const columns: Column<(typeof listDisplayData)[0]>[] = [
    {
      key: "patient_name",
      header: t("appointments.patient"),
      searchable: true,
      render: (a) => <span className="font-medium text-sm">{a.patient_name}</span>,
    },
    { key: "doctor_name", header: t("appointments.doctor"), searchable: true },
    {
      key: "appointment_date",
      header: t("appointments.dateTime"),
      sortable: true,
      render: (a) => <span className="text-muted-foreground tabular-nums text-sm">{formatDate(a.appointment_date, locale, "datetime", calendarType)}</span>,
    },
    {
      key: "type",
      header: t("appointments.type"),
      render: (a) => <StatusBadge variant="default">{typeLabel(a.type)}</StatusBadge>,
    },
    {
      key: "status",
      header: t("common.status"),
      sortable: true,
      render: (a) => (
        <StatusBadge variant={(statusVariant as Record<string, "success" | "warning" | "destructive" | "info" | "default">)[a.status] ?? "default"} dot>
          {statusLabel(a.status)}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (a) => {
        const queueEntry = activeQueueByAppointment.get(a.id);
        if (a.status === "scheduled") {
          return (
            <div className="flex flex-wrap justify-end gap-1">
              {queueEntry ? (
                <>
                  <StatusBadge variant="info">{queueStatusLabel(queueEntry.status)}</StatusBadge>
                  <Button
                    onClick={() => setWorkflowTab("waitingRoom")}
                    variant="ghost"
                    size="sm"
                    data-testid={`appointment-action-open-queue-${a.id}`}
                  >
                    Waiting room
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={() => void handleCheckIn(a.id)}
                    variant="outline"
                    size="sm"
                    data-testid={`appointment-action-check-in-${a.id}`}
                  >
                    Check in
                  </Button>
                  <Button
                    onClick={() => void handleUpdateStatus(a.id, "no_show")}
                    variant="ghost"
                    size="sm"
                    data-testid={`appointment-action-no-show-${a.id}`}
                  >
                    No-show
                  </Button>
                  <Button
                    onClick={() => void handleUpdateStatus(a.id, "cancelled")}
                    variant="ghost"
                    size="sm"
                    data-testid={`appointment-action-cancel-${a.id}`}
                  >
                    {t("common.cancel")}
                  </Button>
                </>
              )}
            </div>
          );
        }

        if (a.status === "in_progress") {
          return (
            <div className="flex gap-1 justify-end">
              <Button
                onClick={() => handleJoinCall(a.id)}
                variant="ghost"
                size="icon-sm"
                className="text-primary hover:bg-primary/10"
                title={t("common.joinCall") ?? "Join Call"}
                aria-label={t("common.joinCall") ?? "Join Call"}
                data-testid={`appointment-action-join-${a.id}`}
              >
                <Video className="h-3.5 w-3.5" />
              </Button>
              <Button
                onClick={() => void handleUpdateStatus(a.id, "completed")}
                variant="ghost"
                size="icon-sm"
                className="text-success hover:bg-success/10"
                title={t("common.complete")}
                aria-label={t("common.complete")}
                data-testid={`appointment-action-complete-${a.id}`}
              >
                <CheckCircle className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        }

        return null;
      },
    },
  ];

  const statusCards = [
    { key: "scheduled" as const, color: "bg-muted text-muted-foreground" },
    { key: "in_progress" as const, color: "bg-info/10 text-info" },
    { key: "completed" as const, color: "bg-success/10 text-success" },
    { key: "cancelled" as const, color: "bg-destructive/10 text-destructive" },
    { key: "no_show" as const, color: "bg-warning/10 text-warning" },
  ];

  return (
    <PageContainer className="space-y-5">
      <SectionHeader
        title={t("appointments.title")}
        subtitle={`${totalAppointments} appointments`}
        actions={(
          <div className="flex items-center gap-2">
            <PermissionGuard permission="manage_appointments">
              <Button size="sm" onClick={() => setShowModal(true)} data-testid="appointments-add-button">
                <CalendarPlus className="h-3.5 w-3.5 mr-1" />
                {t("appointments.newAppointment")}
              </Button>
            </PermissionGuard>
          </div>
        )}
      />

      <Tabs value={workflowTab} onValueChange={(value) => setWorkflowTab(value as WorkflowTab)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="waitingRoom">Waiting room</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {statusCards.map(({ key }) => (
              <Button
                key={key}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStatusFilter(statusFilter === key ? null : key)}
                className={`stat-card w-full text-center cursor-pointer transition-all flex-col ${statusFilter === key ? "ring-2 ring-primary" : ""}`}
              >
                <p className="text-2xl font-semibold tabular-nums">{statusCounts[key] ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{statusLabel(key)}</p>
              </Button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center bg-muted rounded-lg p-0.5">
              <Button
                onClick={() => setViewMode("list")}
                variant="ghost"
                size="icon-sm"
                className={`text-xs font-medium transition-colors ${viewMode === "list" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                aria-label={t("common.list")}
                aria-pressed={viewMode === "list"}
                data-testid="appointments-view-list"
              >
                <List className="h-3.5 w-3.5" />
              </Button>
              <Button
                onClick={() => setViewMode("calendar")}
                variant="ghost"
                size="icon-sm"
                className={`text-xs font-medium transition-colors ${viewMode === "calendar" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                aria-label={t("common.calendar")}
                aria-pressed={viewMode === "calendar"}
                data-testid="appointments-view-calendar"
              >
                <CalendarDays className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {viewMode === "list" ? (
            <DataTable
              columns={columns}
              data={listDisplayData}
              keyExtractor={(a) => a.id}
              searchable
              serverSearch
              searchValue={searchTerm}
              onSearchChange={setSearchTerm}
              sortColumn={sort.column}
              sortDirection={sort.direction}
              onSortChange={(column, direction) => {
                setSort({ column, direction });
                setPage(1);
              }}
              isLoading={loadingList}
              exportFileName="appointments"
              page={page}
              pageSize={pageSize}
              total={totalAppointments}
              onPageChange={setPage}
              filterSlot={(
                <StatusFilter
                  options={[
                    { value: "scheduled", label: statusLabel("scheduled") },
                    { value: "in_progress", label: statusLabel("in_progress") },
                    { value: "completed", label: statusLabel("completed") },
                    { value: "cancelled", label: statusLabel("cancelled") },
                    { value: "no_show", label: statusLabel("no_show") },
                  ]}
                  selected={statusFilter}
                  onChange={setStatusFilter}
                />
              )}
            />
          ) : (
            <AppointmentCalendar
              appointments={calendarFiltered}
              view={calendarView}
              onViewChange={setCalendarView}
              cursor={calendarCursor}
              onCursorChange={setCalendarCursor}
              rescheduleEnabled={canManage}
              onReschedule={handleReschedule}
            />
          )}
        </TabsContent>

        <TabsContent value="waitingRoom">
          <WaitingRoomPanel
            entries={queueEntries}
            isLoading={loadingQueue}
            onUpdateStatus={handleQueueStatusUpdate}
          />
        </TabsContent>
      </Tabs>

      <NewAppointmentModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: queryKeys.appointments.root(user?.tenantId) })}
      />
    </PageContainer>
  );
};
