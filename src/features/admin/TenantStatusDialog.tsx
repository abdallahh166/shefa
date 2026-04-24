import { useEffect, useState } from "react";
import { Button } from "@/components/primitives/Button";
import { Textarea } from "@/components/primitives/Inputs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { AdminTenant } from "@/domain/admin/admin.types";

interface TenantStatusDialogProps {
  open: boolean;
  tenant: AdminTenant | null;
  targetStatus: "active" | "suspended" | "deactivated" | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (value: { status: "active" | "suspended" | "deactivated"; status_reason: string | null }) => Promise<void> | void;
}

const copyByStatus = {
  active: {
    title: "Reactivate tenant",
    description: "Restore clinic access for staff and patient-facing workflows.",
    action: "Reactivate tenant",
  },
  suspended: {
    title: "Suspend tenant",
    description: "Pause clinic access without treating the tenant as permanently shut down.",
    action: "Suspend tenant",
  },
  deactivated: {
    title: "Deactivate tenant",
    description: "Block clinic access for this tenant until a super admin reactivates it.",
    action: "Deactivate tenant",
  },
} as const;

export const TenantStatusDialog = ({
  open,
  tenant,
  targetStatus,
  saving,
  onClose,
  onSubmit,
}: TenantStatusDialogProps) => {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) return;
    setReason("");
  }, [open, targetStatus, tenant?.id]);

  if (!targetStatus) return null;
  const copy = copyByStatus[targetStatus];

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            {copy.description} {tenant ? `Tenant: ${tenant.name}.` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="tenant-status-reason">Reason</Label>
          <Textarea
            id="tenant-status-reason"
            rows={4}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Billing hold, compliance review, contract termination, ownership transfer, etc."
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant={targetStatus === "deactivated" ? "danger" : "default"}
            onClick={() => void onSubmit({ status: targetStatus, status_reason: reason.trim() || null })}
            disabled={saving}
          >
            {saving ? "Saving..." : copy.action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
