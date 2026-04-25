import { useEffect, useState } from "react";
import { Button } from "@/components/primitives/Button";
import { Input, Textarea } from "@/components/primitives/Inputs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/core/i18n/i18nStore";
import type { AdminTenant, AdminTenantCreateInput, AdminTenantUpdateInput } from "@/domain/admin/admin.types";

interface TenantFormDialogProps {
  open: boolean;
  mode: "create" | "edit";
  tenant: AdminTenant | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (value: AdminTenantCreateInput | AdminTenantUpdateInput) => Promise<void> | void;
}

interface TenantFormState {
  name: string;
  slug: string;
  email: string;
  phone: string;
  address: string;
  pending_owner_email: string;
}

const defaultForm: TenantFormState = {
  name: "",
  slug: "",
  email: "",
  phone: "",
  address: "",
  pending_owner_email: "",
};

function toFormState(tenant: AdminTenant | null): TenantFormState {
  if (!tenant) return defaultForm;
  return {
    name: tenant.name,
    slug: tenant.slug,
    email: tenant.email ?? "",
    phone: tenant.phone ?? "",
    address: tenant.address ?? "",
    pending_owner_email: tenant.pending_owner_email ?? "",
  };
}

export const TenantFormDialog = ({ open, mode, tenant, saving, onClose, onSubmit }: TenantFormDialogProps) => {
  const { t } = useI18n(["admin"]);
  const [form, setForm] = useState<TenantFormState>(defaultForm);

  useEffect(() => {
    if (!open) return;
    setForm(toFormState(tenant));
  }, [open, tenant]);

  const handleSubmit = async () => {
    await onSubmit({
      name: form.name,
      slug: form.slug,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      pending_owner_email: form.pending_owner_email.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? t("admin.tenantForm.createTitle")
              : t("admin.tenantForm.editTitle", {
                name: tenant?.name ?? t("admin.tenantForm.editFallbackName"),
              })}
          </DialogTitle>
          <DialogDescription>
            {t("admin.tenantForm.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tenant-name">{t("admin.tenantForm.clinicName")}</Label>
            <Input
              id="tenant-name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder={t("admin.tenantForm.clinicNamePlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tenant-slug">{t("admin.tenantForm.slug")}</Label>
            <Input
              id="tenant-slug"
              value={form.slug}
              onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
              placeholder={t("admin.tenantForm.slugPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tenant-email">{t("admin.tenantForm.clinicEmail")}</Label>
            <Input
              id="tenant-email"
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder={t("admin.tenantForm.clinicEmailPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tenant-phone">{t("admin.tenantForm.phone")}</Label>
            <Input
              id="tenant-phone"
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              placeholder={t("admin.tenantForm.phonePlaceholder")}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="tenant-address">{t("admin.tenantForm.address")}</Label>
            <Textarea
              id="tenant-address"
              rows={3}
              value={form.address}
              onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
              placeholder={t("admin.tenantForm.addressPlaceholder")}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="tenant-owner-email">{t("admin.tenantForm.pendingOwnerEmail")}</Label>
            <Input
              id="tenant-owner-email"
              type="email"
              value={form.pending_owner_email}
              onChange={(event) => setForm((current) => ({ ...current, pending_owner_email: event.target.value }))}
              placeholder={t("admin.tenantForm.pendingOwnerEmailPlaceholder")}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={saving}>
            {saving
              ? t("admin.tenantForm.saving")
              : mode === "create"
                ? t("admin.tenantForm.createAction")
                : t("admin.tenantForm.saveChanges")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
