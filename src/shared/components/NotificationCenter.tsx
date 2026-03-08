import { useState, useRef, useEffect } from "react";
import { Bell, CalendarDays, FlaskConical, DollarSign, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/core/i18n/i18nStore";

interface Notification {
  id: string;
  type: "appointment" | "lab" | "billing" | "alert";
  title: string;
  message: string;
  time: string;
  read: boolean;
}

const DEMO_NOTIFICATIONS: Notification[] = [
  { id: "1", type: "appointment", title: "Upcoming Appointment", message: "Mohammed Al-Rashid at 2:00 PM with Dr. Sarah Ahmed", time: "5 min ago", read: false },
  { id: "2", type: "lab", title: "Lab Results Ready", message: "CBC results for Fatima Hassan are now available", time: "15 min ago", read: false },
  { id: "3", type: "billing", title: "Payment Received", message: "INV-005 payment of $480 confirmed", time: "1 hour ago", read: true },
  { id: "4", type: "alert", title: "Low Stock Alert", message: "Amoxicillin 500mg is running low (25 remaining)", time: "2 hours ago", read: false },
  { id: "5", type: "appointment", title: "Cancelled Appointment", message: "Khalid Omar cancelled his 3:30 PM appointment", time: "3 hours ago", read: true },
];

const typeIcon = {
  appointment: CalendarDays,
  lab: FlaskConical,
  billing: DollarSign,
  alert: AlertTriangle,
};

const typeColor = {
  appointment: "text-primary",
  lab: "text-success",
  billing: "text-warning",
  alert: "text-destructive",
};

export const NotificationCenter = () => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(DEMO_NOTIFICATIONS);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const dismiss = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-md hover:bg-muted relative"
      >
        <Bell className="h-5 w-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute top-1 end-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-full mt-2 w-80 sm:w-96 bg-card rounded-lg border shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold text-sm">{t("common.notifications")}</h3>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-primary hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                No notifications
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = typeIcon[n.type];
                return (
                  <div
                    key={n.id}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 border-b last:border-0 transition-colors",
                      !n.read && "bg-primary/5"
                    )}
                  >
                    <div className={cn("mt-0.5 shrink-0", typeColor[n.type])}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm", !n.read && "font-medium")}>{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">{n.time}</p>
                    </div>
                    <button onClick={() => dismiss(n.id)} className="shrink-0 p-1 rounded hover:bg-muted text-muted-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
