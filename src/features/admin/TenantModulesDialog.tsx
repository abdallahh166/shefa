import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/core/i18n/i18nStore";
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

export const TenantModulesDialog = ({
  open,
  tenant,
  flags,
  loading,
  savingFeatureKey,
  onClose,
  onToggle,
}: TenantModulesDialogProps) => {
  const { t } = useI18n(["admin"]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("admin.tenantModules.title")}</DialogTitle>
          <DialogDescription>
            {t("admin.tenantModules.description", {
              tenantName: tenant?.name ?? t("admin.tenantModules.fallbackTenantName"),
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {loading ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              {t("admin.tenantModules.loading")}
            </div>
          ) : (
            flags.map((flag) => {
              const title = t(`admin.tenantModules.features.${flag.feature_key}.title`);
              const description = t(`admin.tenantModules.features.${flag.feature_key}.description`);
              const switchId = `tenant-module-${flag.feature_key}`;
              const disabled = savingFeatureKey === flag.feature_key;

              return (
                <div
                  key={flag.feature_key}
                  className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4"
                >
                  <div className="space-y-1">
                    <Label htmlFor={switchId} className="text-sm font-medium">
                      {title}
                    </Label>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </div>
                  <Switch
                    id={switchId}
                    checked={flag.enabled}
                    disabled={disabled}
                    data-testid={`tenant-module-toggle-${flag.feature_key}`}
                    aria-label={title}
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
};
