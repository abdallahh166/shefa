import { useState, useRef, useEffect, useCallback } from "react";
import { Bell, CalendarDays, FlaskConical, DollarSign, AlertTriangle, X, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/core/i18n/i18nStore";
import { useAuth } from "@/core/auth/authStore";
import { notificationService } from "@/services/notifications/notification.service";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/primitives/Button";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
}

const typeIcon: Record<string, typeof Bell> = {
  appointment: CalendarDays,
  lab: FlaskConical,
  billing: DollarSign,
  alert: AlertTriangle,
  info: Info,
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export const NotificationCenter = () => {
  const { t } = useI18n();
  const { authMachineState, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pageSize = 20;

  const loadNotifications = useCallback(async () => {
    if (!user?.id) { setNotifications([]); setTotal(0); setPage(1); return; }
    setLoading(true);
    try {
      const result = await notificationService.listPaged(user.id, { page: 1, pageSize });
      setNotifications(result.data as Notification[]);
      setTotal(result.total);
      setPage(1);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.error");
      toast({ title: t("common.error"), description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user?.id, pageSize, t]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  useEffect(() => {
    if (!user?.id || !user.tenantId || authMachineState !== "authenticated") return;

    let subscription: { unsubscribe: () => void } | null = null;
    const timer = window.setTimeout(() => {
      subscription = notificationService.subscribe(user.id, (payload) => {
        setNotifications((prev) => [payload as Notification, ...prev]);
        setTotal((prev) => prev + 1);
      });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      subscription?.unsubscribe();
    };
  }, [authMachineState, user?.id, user?.tenantId]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = async () => {
    if (!user?.id) return;
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    try {
      await notificationService.markAllRead(user.id, unreadIds);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.error");
      toast({ title: t("common.error"), description: message, variant: "destructive" });
    }
  };

  const dismiss = async (id: string) => {
    const prev = notifications;
    setNotifications((current) => current.filter((n) => n.id !== id));
    if (!user?.id) return;
    try {
      await notificationService.markRead(user.id, id);
    } catch (err) {
      setNotifications(prev);
      const message = err instanceof Error ? err.message : t("common.error");
      toast({ title: t("common.error"), description: message, variant: "destructive" });
    }
  };

  const canLoadMore = notifications.length < total;
  const loadMore = async () => {
    if (!user?.id || loadingMore || !canLoadMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await notificationService.listPaged(user.id, { page: nextPage, pageSize });
      setNotifications((prev) => [...prev, ...(result.data as Notification[])]);
      setTotal(result.total);
      setPage(nextPage);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.error");
      toast({ title: t("common.error"), description: message, variant: "destructive" });
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(!open)}
        className="relative"
        aria-label={t("common.notifications")}
        title={t("common.notifications")}
      >
        <Bell className="h-4 w-4 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -end-0.5 h-4 min-w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
            {unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute end-0 top-full mt-2 w-80 bg-card rounded-xl border shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-sm font-semibold">{t("common.notifications")}</h3>
            {unreadCount > 0 && (
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={markAllRead}
                className="text-xs"
              >
                {t("common.markAllRead") ?? "Mark all read"}
              </Button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" />
                {t("common.loading")}
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">{t("common.noData")}</div>
            ) : (
              notifications.map((n) => {
                const Icon = typeIcon[n.type] ?? Info;
                return (
                  <div
                    key={n.id}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 border-b last:border-0 transition-colors",
                      !n.read && "bg-primary/[0.03]",
                    )}
                  >
                    <div className="mt-0.5 h-7 w-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm", !n.read && "font-medium")}>{n.title}</p>
                      {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                      <p className="text-2xs text-muted-foreground mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => dismiss(n.id)}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      aria-label={t("common.dismiss")}
                      title={t("common.dismiss")}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>

          {canLoadMore && (
            <div className="border-t px-4 py-2">
              <Button
                onClick={loadMore}
                disabled={loadingMore}
                variant="link"
                size="sm"
                className="w-full text-xs"
              >
                {loadingMore ? t("common.loading") : t("common.loadMore") ?? "Load more"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
