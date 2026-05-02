import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/primitives/Button";
import { getIntlLocale } from "@/core/i18n/config";
import { useI18n } from "@/core/i18n/i18nStore";
import { cn } from "@/lib/utils";

export type AppointmentCalendarView = "month" | "week";

export type AppointmentCalendarItem = {
  id: string;
  patient_name: string;
  doctor_name: string;
  appointment_date: string;
  type: string;
  status: string;
};

type Props = {
  appointments: AppointmentCalendarItem[];
  view: AppointmentCalendarView;
  onViewChange: (view: AppointmentCalendarView) => void;
  cursor: Date;
  onCursorChange: (next: Date) => void;
  rescheduleEnabled: boolean;
  onReschedule: (appointmentId: string, newAppointmentDate: string) => Promise<void> | void;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalYMD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseAppointmentDate(raw: string): Date {
  if (!raw) return new Date(NaN);
  if (raw.includes("T")) return new Date(raw);
  if (raw.includes(" ")) return new Date(raw.replace(" ", "T"));
  return new Date(raw);
}

function formatDatetimeLocal(d: Date) {
  return `${toLocalYMD(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
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

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const statusChipClass: Record<string, string> = {
  completed: "bg-success/15 text-success",
  in_progress: "bg-info/15 text-info",
  scheduled: "bg-muted text-foreground",
  cancelled: "bg-destructive/10 text-destructive",
  no_show: "bg-warning/10 text-warning",
};

export function AppointmentCalendar({
  appointments,
  view,
  onViewChange,
  cursor,
  onCursorChange,
  rescheduleEnabled,
  onReschedule,
}: Props) {
  const { dir, t, locale, calendarType } = useI18n(["appointments"]);
  const intlLocale = getIntlLocale(locale, calendarType);
  const calendar = calendarType === "hijri" ? "islamic-umalqura" : "gregory";

  const statusLabel = (status: string) => {
    switch (status) {
      case "scheduled":
        return t("appointments.scheduled");
      case "in_progress":
        return t("appointments.inProgress");
      case "completed":
        return t("appointments.completed");
      case "cancelled":
        return t("appointments.cancelled");
      case "no_show":
        return t("appointments.calendar.noShow");
      default:
        return status;
    }
  };

  const groupedByDay = useMemo(() => {
    const map = new Map<string, AppointmentCalendarItem[]>();

    for (const appointment of appointments) {
      const date = parseAppointmentDate(appointment.appointment_date);
      const key = toLocalYMD(date);
      const list = map.get(key) ?? [];
      list.push(appointment);
      map.set(key, list);
    }

    for (const [key, list] of map.entries()) {
      list.sort((a, b) => {
        const aDate = parseAppointmentDate(a.appointment_date).getTime();
        const bDate = parseAppointmentDate(b.appointment_date).getTime();
        return aDate - bDate;
      });
      map.set(key, list);
    }

    return map;
  }, [appointments]);

  const title = useMemo(() => {
    if (view === "week") {
      const start = startOfWeek(cursor);
      const end = addDays(start, 6);

      return `${start.toLocaleDateString(intlLocale, {
        calendar,
        month: "short",
        day: "numeric",
      })} ${t("appointments.calendar.rangeSeparator")} ${end.toLocaleDateString(
        intlLocale,
        {
          calendar,
          month: "short",
          day: "numeric",
          year: "numeric",
        },
      )}`;
    }

    return cursor.toLocaleDateString(intlLocale, {
      calendar,
      month: "long",
      year: "numeric",
    });
  }, [calendar, cursor, intlLocale, t, view]);

  const weekdayShort = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(intlLocale, {
      calendar,
      weekday: "short",
    });
    const baseSunday = new Date(2024, 0, 7);
    return Array.from({ length: 7 }, (_, index) =>
      formatter.format(addDays(baseSunday, index)),
    );
  }, [calendar, intlLocale]);

  const dayNumber = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(intlLocale, {
      calendar,
      day: "numeric",
    });
    return (date: Date) => formatter.format(date);
  }, [calendar, intlLocale]);

  const rangeDays = useMemo(() => {
    if (view === "week") {
      const start = startOfWeek(cursor);
      return Array.from({ length: 7 }, (_, index) => addDays(start, index));
    }

    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = startOfWeek(first);
    return Array.from({ length: 42 }, (_, index) => addDays(start, index));
  }, [cursor, view]);

  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const handlePrev = () => {
    const next = new Date(cursor);
    if (view === "month") next.setMonth(next.getMonth() - 1);
    else next.setDate(next.getDate() - 7);
    onCursorChange(next);
  };

  const handleNext = () => {
    const next = new Date(cursor);
    if (view === "month") next.setMonth(next.getMonth() + 1);
    else next.setDate(next.getDate() + 7);
    onCursorChange(next);
  };

  const onDropDay = async (day: Date, event: React.DragEvent) => {
    event.preventDefault();
    setDragOverKey(null);

    if (!rescheduleEnabled) return;

    const appointmentId = event.dataTransfer.getData("text/plain");
    if (!appointmentId) return;

    const appointment = appointments.find((item) => item.id === appointmentId);
    if (!appointment) return;

    const current = parseAppointmentDate(appointment.appointment_date);
    if (Number.isNaN(current.getTime())) return;

    const target = new Date(current);
    target.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());

    if (sameDay(current, target)) return;

    await onReschedule(appointmentId, formatDatetimeLocal(target));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrev}
            aria-label={t("common.previous")}
          >
            {dir === "rtl" ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCursorChange(new Date(today))}
          >
            {t("common.today")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            aria-label={t("common.next")}
          >
            {dir === "rtl" ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">{title}</h3>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={view === "month" ? "default" : "outline"}
              onClick={() => onViewChange("month")}
            >
              {t("common.month")}
            </Button>
            <Button
              size="sm"
              variant={view === "week" ? "default" : "outline"}
              onClick={() => onViewChange("week")}
            >
              {t("common.week")}
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className={cn("grid grid-cols-7 border-b bg-muted/30")}>
          {weekdayShort.map((day) => (
            <div
              key={day}
              className="px-3 py-2 text-xs font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        <div className={cn("grid grid-cols-7")}>
          {rangeDays.map((day) => {
            const key = toLocalYMD(day);
            const dayAppointments = groupedByDay.get(key) ?? [];
            const isOutside = view === "month" && day.getMonth() !== cursor.getMonth();
            const isToday = sameDay(day, today);
            const isDragOver = dragOverKey === key;

            return (
              <div
                key={key}
                onDragOver={(event) => {
                  if (!rescheduleEnabled) return;
                  event.preventDefault();
                  setDragOverKey(key);
                }}
                onDragLeave={() =>
                  setDragOverKey((current) => (current === key ? null : current))
                }
                onDrop={(event) => void onDropDay(day, event)}
                className={cn(
                  "border-s border-t p-2 transition-colors min-h-[110px]",
                  isOutside && "bg-muted/20 text-muted-foreground",
                  isToday && "ring-2 ring-inset ring-primary/30",
                  isDragOver && "bg-accent/40",
                )}
                data-testid={`appointment-calendar-day-${key}`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isOutside && "text-muted-foreground",
                    )}
                  >
                    {dayNumber(day)}
                  </span>
                  {dayAppointments.length > 0 ? (
                    <span className="text-[10px] text-muted-foreground">
                      {dayAppointments.length}
                    </span>
                  ) : null}
                </div>

                <div className="space-y-1">
                  {dayAppointments.slice(0, 3).map((appointment) => {
                    const date = parseAppointmentDate(appointment.appointment_date);
                    const time = Number.isNaN(date.getTime())
                      ? ""
                      : date.toLocaleTimeString(intlLocale, {
                        hour: "2-digit",
                        minute: "2-digit",
                      });

                    return (
                      <div
                        key={appointment.id}
                        draggable={rescheduleEnabled}
                        onDragStart={(event) => {
                          if (!rescheduleEnabled) return;
                          event.dataTransfer.setData("text/plain", appointment.id);
                          event.dataTransfer.effectAllowed = "move";
                        }}
                        className={cn(
                          "cursor-default select-none rounded-md px-2 py-1 text-xs leading-tight",
                          rescheduleEnabled && "cursor-grab active:cursor-grabbing",
                          statusChipClass[appointment.status] ?? "bg-muted text-foreground",
                        )}
                        title={`${appointment.patient_name} - ${appointment.doctor_name} - ${statusLabel(appointment.status)}`}
                        data-testid={`appointment-calendar-item-${appointment.id}`}
                        data-appointment-patient={appointment.patient_name}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{appointment.patient_name}</span>
                          <span className="shrink-0 text-[10px] opacity-80">{time}</span>
                        </div>
                      </div>
                    );
                  })}
                  {dayAppointments.length > 3 ? (
                    <div className="px-1 text-[10px] text-muted-foreground">
                      +{dayAppointments.length - 3} {t("appointments.more")}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!rescheduleEnabled ? (
        <p className="text-xs text-muted-foreground">
          {t("appointments.dragToRescheduleHint")}
        </p>
      ) : null}
    </div>
  );
}
