import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/core/i18n/i18nStore";
import { useAuth } from "@/core/auth/authStore";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/primitives/Button";
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/primitives/Inputs";
import { toast } from "@/hooks/use-toast";
import { insuranceService } from "@/services/insurance/insurance.service";
import { patientService } from "@/services/patients/patient.service";
import { queryKeys } from "@/services/queryKeys";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import type { InsuranceClaimCreateInput } from "@/domain/insurance/insurance.types";

interface NewClaimModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const NewClaimModal = ({ open, onClose, onSuccess }: NewClaimModalProps) => {
  const { t } = useI18n();
  const { user } = useAuth();
  const tenantId = user?.tenantId;
  const [loading, setLoading] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const debouncedPatientSearch = useDebouncedValue(patientSearch, 300);
  const [form, setForm] = useState({
    patient_id: "",
    provider: "",
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
    if (!form.patient_id || !form.provider || !form.service || !form.amount) {
      toast({ title: t("common.missingFields"), description: t("common.pleaseFillAllRequiredFields"), variant: "destructive" });
      return;
    }
    setLoading(true);

    try {
      await insuranceService.create({
        patient_id: form.patient_id,
        provider: form.provider,
        service: form.service,
        amount: Number.parseFloat(form.amount),
        status: "pending",
      } as InsuranceClaimCreateInput);
      toast({ title: t("insurance.claimSubmitted") });
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
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("insurance.newClaim")}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t("insurance.newClaim")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("appointments.patient")} *</Label>
            <Input
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              placeholder={t("common.search")}
            />
            <Select value={form.patient_id} onValueChange={(value) => setForm({ ...form, patient_id: value })}>
              <SelectTrigger>
                <SelectValue placeholder={t("appointments.selectPatient")} />
              </SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("common.provider")} *</Label>
            <Input
              value={form.provider}
              onChange={(e) => setForm({ ...form, provider: e.target.value })}
              placeholder="National Health Co."
            />
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
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={loading}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

