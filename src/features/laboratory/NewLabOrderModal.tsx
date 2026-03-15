import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/core/i18n/i18nStore";
import { useAuth } from "@/core/auth/authStore";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/primitives/Button";
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/primitives/Inputs";
import { toast } from "@/hooks/use-toast";
import { labService } from "@/services/laboratory/lab.service";
import { patientService } from "@/services/patients/patient.service";
import { doctorService } from "@/services/doctors/doctor.service";
import { queryKeys } from "@/services/queryKeys";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import type { LabResultCreateInput } from "@/domain/lab/lab.types";

interface NewLabOrderModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const TEST_OPTIONS = [
  "Complete Blood Count (CBC)",
  "HbA1c",
  "Lipid Panel",
  "Thyroid Panel",
  "Basic Metabolic Panel",
  "Comprehensive Metabolic Panel",
  "Liver Function Test",
  "Kidney Function Test",
  "Urinalysis",
  "Blood Glucose",
  "Hemoglobin",
];

export const NewLabOrderModal = ({ open, onClose, onSuccess }: NewLabOrderModalProps) => {
  const { t } = useI18n();
  const { user } = useAuth();
  const tenantId = user?.tenantId;
  const [loading, setLoading] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [doctorSearch, setDoctorSearch] = useState("");
  const debouncedPatientSearch = useDebouncedValue(patientSearch, 300);
  const debouncedDoctorSearch = useDebouncedValue(doctorSearch, 300);
  const [form, setForm] = useState({
    patient_id: "",
    doctor_id: "",
    test_name: "Complete Blood Count (CBC)",
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

  const { data: doctorPage } = useQuery({
    queryKey: queryKeys.doctors.list({
      tenantId,
      page: 1,
      pageSize: 10,
      search: debouncedDoctorSearch.trim() || undefined,
    }),
    queryFn: async () =>
      doctorService.listPaged({
        page: 1,
        pageSize: 10,
        search: debouncedDoctorSearch.trim() || undefined,
      }),
    enabled: open && !!tenantId,
  });

  const patients = patientPage?.data ?? [];
  const doctors = doctorPage?.data ?? [];

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patient_id || !form.doctor_id || !form.test_name) {
      toast({ title: t("common.missingFields"), description: t("common.pleaseFillAllRequiredFields"), variant: "destructive" });
      return;
    }
    setLoading(true);

    try {
      await labService.create({
        patient_id: form.patient_id,
        doctor_id: form.doctor_id,
        test_name: form.test_name,
        status: "pending",
      } as LabResultCreateInput);
      toast({ title: t("laboratory.labOrderCreated") });
      onSuccess();
      onClose();
      setForm({ patient_id: "", doctor_id: "", test_name: "Complete Blood Count (CBC)" });
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
          <DialogTitle>{t("laboratory.newLabOrder")}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t("laboratory.newLabOrder")}
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
            <Label>{t("laboratory.orderedBy")} *</Label>
            <Input
              value={doctorSearch}
              onChange={(e) => setDoctorSearch(e.target.value)}
              placeholder={t("common.search")}
            />
            <Select value={form.doctor_id} onValueChange={(value) => setForm({ ...form, doctor_id: value })}>
              <SelectTrigger>
                <SelectValue placeholder={t("appointments.selectDoctor")} />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("laboratory.test")} *</Label>
            <Select value={form.test_name} onValueChange={(value) => setForm({ ...form, test_name: value })}>
              <SelectTrigger>
                <SelectValue placeholder={t("laboratory.test")} />
              </SelectTrigger>
              <SelectContent>
                {TEST_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

