import { useEffect, useState } from "react";
import { Button } from "@/components/primitives/Button";
import { Textarea } from "@/components/primitives/Inputs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/core/i18n/i18nStore";
import type { AdminTenant } from "@/domain/admin/admin.types";

interface TenantStatusDialogProps {
  open: boolean;
  tenant: AdminTenant | null;
  targetStatus: "active" | "suspended" | "deactivated" | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (value: { status: "active" | "suspended" | "deactivated"; status_reason: string | null }) => Promise<void> | void;
}

export const TenantStatusDialog = ({
  open,
  tenant,
  targetStatus,
  saving,
  onClose,
  onSubmit,
}: TenantStatusDialogProps) => {
  const { t } = useI18n(["admin"]);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) return;
    setReason("");
  }, [open, targetStatus, tenant?.id]);

  if (!targetStatus) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t(`admin.tenantStatusDialog.statuses.${targetStatus}.title`)}</DialogTitle>
          <DialogDescription>
            {t(`admin.tenantStatusDialog.statuses.${targetStatus}.description`)}{" "}
            {tenant ? t("admin.tenantStatusDialog.tenantPrefix", { name: tenant.name }) : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="tenant-status-reason">{t("admin.tenantStatusDialog.reason")}</Label>
          <Textarea
            id="tenant-status-reason"
            rows={4}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("admin.tenantStatusDialog.reasonPlaceholder")}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button
            variant={targetStatus === "deactivated" ? "danger" : "default"}
            onClick={() => void onSubmit({ status: targetStatus, status_reason: reason.trim() || null })}
            disabled={saving}
          >
            {saving
              ? t("admin.tenantStatusDialog.saving")
              : t(`admin.tenantStatusDialog.statuses.${targetStatus}.action`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
