import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/core/i18n/i18nStore";
import { useAuth } from "@/core/auth/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { billingService } from "@/services/billing/billing.service";
import { patientService } from "@/services/patients/patient.service";
import { queryKeys } from "@/services/queryKeys";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import type { InvoiceCreateInput } from "@/domain/billing/billing.types";

interface NewInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const NewInvoiceModal = ({ open, onClose, onSuccess }: NewInvoiceModalProps) => {
  const { t } = useI18n();
  const { user } = useAuth();
  const tenantId = user?.tenantId;
  const [loading, setLoading] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const debouncedPatientSearch = useDebouncedValue(patientSearch, 300);
  const [form, setForm] = useState({
    patient_id: "",
    service: "",
    amount: "",
  });

  const { data: patientPage } = useQuery({
    queryKey: queryKeys.patients.list({
      tenantId,
      page: 1,
      pageSize: 10,
      search: debouncedPatientSearch.trim() || undefined,
    }),
    queryFn: async () =>
      patientService.listPaged({
        page: 1,
        pageSize: 10,
        search: debouncedPatientSearch.trim() || undefined,
      }),
    enabled: open && !!tenantId,
  });

  const patients = patientPage?.data ?? [];

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patient_id || !form.service || !form.amount) {
      toast({ title: t("common.missingFields"), description: t("common.pleaseFillAllRequiredFields"), variant: "destructive" });
      return;
    }
    setLoading(true);
    const code = `INV-${String(Date.now()).slice(-6)}`;
    try {
      await billingService.create({
        patient_id: form.patient_id,
        invoice_code: code,
        service: form.service,
        amount: Number.parseFloat(form.amount),
      } as InvoiceCreateInput);
      toast({ title: t("billing.invoiceCreated") });
      onSuccess();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.error");
      toast({ title: t("common.error"), description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm">
      <div className="bg-card rounded-lg border shadow-lg w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{t("billing.newInvoice")}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-2">
            <Label>{t("appointments.patient")} *</Label>
            <Input
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              placeholder={t("common.search")}
            />
            <select
              value={form.patient_id}
              onChange={(e) => setForm({ ...form, patient_id: e.target.value })}
              className="w-full h-10 px-3 rounded-md border bg-background text-sm"
            >
              <option value="">{t("appointments.selectPatient")}</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>{t("common.service")} *</Label>
            <Input
              value={form.service}
              onChange={(e) => setForm({ ...form, service: e.target.value })}
              placeholder="Cardiology Consultation"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("common.amount")} ($) *</Label>
            <Input
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="350.00"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t("common.loading") : t("common.save")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
