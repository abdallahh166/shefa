import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { AdminTenant, AdminTenantFeatureFlag } from "@/domain/admin/admin.types";
import type { FeatureFlagKey } from "@/domain/featureFlags/featureFlag.types";

interface TenantModulesDialogProps {
  open: boolean;
  tenant: AdminTenant | null;
  flags: AdminTenantFeatureFlag[];
  loading: boolean;
  savingFeatureKey: FeatureFlagKey | null;
  onClose: () => void;
  onToggle: (featureKey: FeatureFlagKey, enabled: boolean) => Promise<void> | void;
}

const featureCopy: Record<FeatureFlagKey, { title: string; description: string }> = {
  advanced_reports: {
    title: "Reports & Analytics",
    description: "Controls advanced reporting, dashboards, and analytics views.",
  },
  lab_module: {
    title: "Laboratory",
    description: "Controls lab orders, structured results, and laboratory operations.",
  },
  pharmacy_module: {
    title: "Pharmacy",
    description: "Controls pharmacy inventory, medication stock, and dispensing workflows.",
  },
  insurance_module: {
    title: "Insurance",
    description: "Controls claims, follow-up queues, and insurance operations.",
  },
};

export const TenantModulesDialog = ({
  open,
  tenant,
  flags,
  loading,
  savingFeatureKey,
  onClose,
  onToggle,
}: TenantModulesDialogProps) => (
  <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Tenant modules</DialogTitle>
        <DialogDescription>
          Enable or disable tenant-level modules for {tenant?.name ?? "this clinic"}. Changes apply immediately.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            Loading module access...
          </div>
        ) : (
          flags.map((flag) => {
            const copy = featureCopy[flag.feature_key];
            const switchId = `tenant-module-${flag.feature_key}`;
            const disabled = savingFeatureKey === flag.feature_key;

            return (
              <div
                key={flag.feature_key}
                className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4"
              >
                <div className="space-y-1">
                  <Label htmlFor={switchId} className="text-sm font-medium">
                    {copy.title}
                  </Label>
                  <p className="text-sm text-muted-foreground">{copy.description}</p>
                </div>
                <Switch
                  id={switchId}
                  checked={flag.enabled}
                  disabled={disabled}
                  data-testid={`tenant-module-toggle-${flag.feature_key}`}
                  aria-label={copy.title}
                  onCheckedChange={(checked) => void onToggle(flag.feature_key, Boolean(checked))}
                />
              </div>
            );
          })
        )}
      </div>
    </DialogContent>
  </Dialog>
);
