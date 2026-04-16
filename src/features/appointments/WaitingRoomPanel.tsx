import { useMemo, useState } from "react";
import { useI18n } from "@/core/i18n/i18nStore";
import { Button } from "@/components/primitives/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { formatDate } from "@/shared/utils/formatDate";
import type { AppointmentQueueStatus, AppointmentQueueWithRelations } from "@/domain/appointmentQueue/appointmentQueue.types";

interface WaitingRoomPanelProps {
  entries: AppointmentQueueWithRelations[];
  isLoading: boolean;
  onUpdateStatus: (queueId: string, status: AppointmentQueueStatus) => Promise<void> | void;
}

const STATUS_ORDER: Record<AppointmentQueueStatus, number> = {
  waiting: 0,
  called: 1,
  in_service: 2,
  done: 3,
  no_show: 4,
};

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

function queueStatusVariant(status: AppointmentQueueStatus) {
  switch (status) {
    case "done":
      return "success" as const;
    case "called":
    case "in_service":
      return "info" as const;
    case "no_show":
      return "warning" as const;
    default:
      return "default" as const;
  }
}

export const WaitingRoomPanel = ({ entries, isLoading, onUpdateStatus }: WaitingRoomPanelProps) => {
  const { locale, calendarType } = useI18n();
  const [statusFilter, setStatusFilter] = useState<AppointmentQueueStatus | "all">("all");

  const counts = useMemo(() => (
    entries.reduce<Record<AppointmentQueueStatus, number>>((acc, entry) => {
      acc[entry.status] += 1;
      return acc;
    }, {
      waiting: 0,
      called: 0,
      in_service: 0,
      done: 0,
      no_show: 0,
    })
  ), [entries]);

  const visibleEntries = useMemo(() => {
    const filtered = statusFilter === "all"
      ? entries
      : entries.filter((entry) => entry.status === statusFilter);

    return [...filtered].sort((left, right) => {
      const statusDelta = STATUS_ORDER[left.status] - STATUS_ORDER[right.status];
      if (statusDelta !== 0) return statusDelta;
      return new Date(left.check_in_at).getTime() - new Date(right.check_in_at).getTime();
    });
  }, [entries, statusFilter]);

  const filters: Array<{ value: AppointmentQueueStatus | "all"; label: string; count: number }> = [
    { value: "all", label: "All", count: entries.length },
    { value: "waiting", label: "Waiting", count: counts.waiting },
    { value: "called", label: "Called", count: counts.called },
    { value: "in_service", label: "In service", count: counts.in_service },
    { value: "done", label: "Done", count: counts.done },
    { value: "no_show", label: "No-show", count: counts.no_show },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <Button
            key={filter.value}
            type="button"
            size="sm"
            variant={statusFilter === filter.value ? "default" : "outline"}
            onClick={() => setStatusFilter(filter.value)}
          >
            {filter.label} ({filter.count})
          </Button>
        ))}
      </div>

      {isLoading ? (
        <Card>
          <CardHeader>
            <CardTitle>Waiting room</CardTitle>
            <CardDescription>Loading today&apos;s arrivals.</CardDescription>
          </CardHeader>
        </Card>
      ) : visibleEntries.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Waiting room</CardTitle>
            <CardDescription>No checked-in patients for the selected filter.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3">
          {visibleEntries.map((entry) => (
            <Card key={entry.id}>
              <CardHeader className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {entry.appointments?.patients?.full_name ?? "Unknown patient"}
                    </CardTitle>
                    <CardDescription>
                      {entry.appointments?.doctors?.full_name ?? "Unassigned doctor"} · Appointment{" "}
                      {entry.appointments ? formatDate(entry.appointments.appointment_date, locale, "datetime", calendarType) : "time unavailable"}
                    </CardDescription>
                  </div>
                  <StatusBadge variant={queueStatusVariant(entry.status)} dot>
                    {queueStatusLabel(entry.status)}
                  </StatusBadge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                  <div>
                    Checked in: {formatDate(entry.check_in_at, locale, "time", calendarType)}
                  </div>
                  <div>
                    Called: {entry.called_at ? formatDate(entry.called_at, locale, "time", calendarType) : "Not yet"}
                  </div>
                  <div>
                    Completed: {entry.completed_at ? formatDate(entry.completed_at, locale, "time", calendarType) : "Not yet"}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {entry.status === "waiting" && (
                    <>
                      <Button size="sm" onClick={() => void onUpdateStatus(entry.id, "called")}>
                        Call patient
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void onUpdateStatus(entry.id, "no_show")}>
                        Mark no-show
                      </Button>
                    </>
                  )}

                  {entry.status === "called" && (
                    <>
                      <Button size="sm" onClick={() => void onUpdateStatus(entry.id, "in_service")}>
                        Start visit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void onUpdateStatus(entry.id, "waiting")}>
                        Back to waiting
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void onUpdateStatus(entry.id, "no_show")}>
                        Mark no-show
                      </Button>
                    </>
                  )}

                  {entry.status === "in_service" && (
                    <Button size="sm" variant="success" onClick={() => void onUpdateStatus(entry.id, "done")}>
                      Complete visit
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
