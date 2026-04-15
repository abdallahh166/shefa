import { useState } from "react";
import { useI18n } from "@/core/i18n/i18nStore";
import { useAuth } from "@/core/auth/authStore";
import { formatDate } from "@/shared/utils/formatDate";
import { Loader2, ShieldCheck, UserPlus, Building, LogIn, LogOut } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { auditLogService } from "@/services/settings/audit.service";
import { queryKeys } from "@/services/queryKeys";
import type { AuditLog } from "@/domain/settings/audit.types";
import { Button } from "@/components/primitives/Button";

const ACTION_ICONS: Record<string, typeof ShieldCheck> = {
  clinic_created: Building,
  staff_invited: UserPlus,
  tenant_impersonation_started: LogIn,
  tenant_impersonation_ended: LogOut,
};

export const AuditLogTab = () => {
  const { t, locale, calendarType } = useI18n();
  const { user, hasPermission } = useAuth();
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const canViewAudit = hasPermission("manage_clinic") || hasPermission("manage_users") || hasPermission("super_admin");

  const { data: logsResponse, isLoading } = useQuery({
    queryKey: queryKeys.settings.audit({ tenantId: user?.tenantId, page, pageSize }),
    enabled: !!user?.tenantId && canViewAudit,
    queryFn: () => auditLogService.listPaged({ page, pageSize }),
  });

  const entries: AuditLog[] = logsResponse?.data ?? [];
  const total = logsResponse?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageStart = total ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = total ? Math.min(total, page * pageSize) : 0;

  const formatAction = (action: string) =>
    action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-lg">{t("settings.auditLog")}</h3>
        <p className="text-sm text-muted-foreground">{t("settings.auditLogDesc")}</p>
      </div>

      {!canViewAudit ? (
        <p className="text-muted-foreground text-sm py-8 text-center">{t("settings.noPermission")}</p>
      ) : isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">{t("settings.noAuditLogs")}</p>
      ) : (
        <>
          <div className="space-y-2">
            {entries.map((log) => {
              const Icon = ACTION_ICONS[log.action] ?? ShieldCheck;
              return (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{formatAction(log.action)}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.entity_type} - {formatDate(log.created_at, locale, "datetime", calendarType)}
                    </p>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <div className="mt-1 text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded truncate">
                        {Object.entries(log.details)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(" - ")}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
              <span>{pageStart}â€“{pageEnd} of {total}</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                >
                  {t("common.previous")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                >
                  {t("common.next")}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

