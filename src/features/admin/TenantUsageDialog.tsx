import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/core/i18n/i18nStore";
import { formatNumber } from "@/core/i18n/formatters";
import type { AdminTenant, AdminTenantUsage } from "@/domain/admin/admin.types";

interface TenantUsageDialogProps {
  open: boolean;
  tenant: AdminTenant | null;
  usage: AdminTenantUsage | null;
  loading: boolean;
  onClose: () => void;
}

function formatBytes(bytes: number, locale: "en" | "ar") {
  if (bytes < 1024) return `${formatNumber(bytes, locale)} B`;
  if (bytes < 1024 * 1024) return `${formatNumber(bytes / 1024, locale, { maximumFractionDigits: 1 })} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${formatNumber(bytes / (1024 * 1024), locale, { maximumFractionDigits: 1 })} MB`;
  return `${formatNumber(bytes / (1024 * 1024 * 1024), locale, { maximumFractionDigits: 1 })} GB`;
}

export const TenantUsageDialog = ({ open, tenant, usage, loading, onClose }: TenantUsageDialogProps) => {
  const { t, locale } = useI18n(["admin"]);
  const tenantName = tenant?.name ?? t("admin.tenantUsage.fallbackTenant");

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("admin.tenantUsage.title")}</DialogTitle>
          <DialogDescription>
            {t("admin.tenantUsage.description", { tenantName })}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            {t("admin.tenantUsage.loading")}
          </div>
        ) : usage ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border bg-card p-4">
              <div className="text-xs text-muted-foreground">{t("admin.tenantUsage.patients")}</div>
              <div className="mt-1 text-2xl font-semibold">{formatNumber(usage.patients_count, locale)}</div>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="text-xs text-muted-foreground">{t("admin.tenantUsage.staffUsers")}</div>
              <div className="mt-1 text-2xl font-semibold">{formatNumber(usage.staff_count, locale)}</div>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="text-xs text-muted-foreground">{t("admin.tenantUsage.storedFiles")}</div>
              <div className="mt-1 text-2xl font-semibold">{formatBytes(usage.storage_bytes, locale)}</div>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="text-xs text-muted-foreground">{t("admin.tenantUsage.apiRequests30d")}</div>
              <div className="mt-1 text-2xl font-semibold">{formatNumber(usage.api_requests_30d, locale)}</div>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="text-xs text-muted-foreground">{t("admin.tenantUsage.pendingJobs")}</div>
              <div className="mt-1 text-2xl font-semibold">{formatNumber(usage.jobs_pending_count, locale)}</div>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="text-xs text-muted-foreground">{t("admin.tenantUsage.failedJobs")}</div>
              <div className="mt-1 text-2xl font-semibold">{formatNumber(usage.jobs_failed_count, locale)}</div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            {t("admin.tenantUsage.empty")}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
