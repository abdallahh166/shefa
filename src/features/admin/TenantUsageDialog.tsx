import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AdminTenant, AdminTenantUsage } from "@/domain/admin/admin.types";

interface TenantUsageDialogProps {
  open: boolean;
  tenant: AdminTenant | null;
  usage: AdminTenantUsage | null;
  loading: boolean;
  onClose: () => void;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export const TenantUsageDialog = ({ open, tenant, usage, loading, onClose }: TenantUsageDialogProps) => (
  <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Tenant usage</DialogTitle>
        <DialogDescription>
          Review storage, activity, and workload before making platform-level changes for {tenant?.name ?? "this tenant"}.
        </DialogDescription>
      </DialogHeader>

      {loading ? (
        <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          Loading tenant usage...
        </div>
      ) : usage ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">Patients</div>
            <div className="mt-1 text-2xl font-semibold">{usage.patients_count}</div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">Staff users</div>
            <div className="mt-1 text-2xl font-semibold">{usage.staff_count}</div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">Stored files</div>
            <div className="mt-1 text-2xl font-semibold">{formatBytes(usage.storage_bytes)}</div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">API requests, 30 days</div>
            <div className="mt-1 text-2xl font-semibold">{usage.api_requests_30d}</div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">Pending jobs</div>
            <div className="mt-1 text-2xl font-semibold">{usage.jobs_pending_count}</div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">Failed jobs</div>
            <div className="mt-1 text-2xl font-semibold">{usage.jobs_failed_count}</div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          No usage data is available for this tenant yet.
        </div>
      )}
    </DialogContent>
  </Dialog>
);
