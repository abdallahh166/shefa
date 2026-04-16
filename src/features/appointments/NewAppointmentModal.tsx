import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/core/i18n/i18nStore";
import { useAuth } from "@/core/auth/authStore";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/primitives/Button";
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/primitives/Inputs";
import { toast } from "@/hooks/use-toast";
import { appointmentService } from "@/services/appointments/appointment.service";
import { patientService } from "@/services/patients/patient.service";
import { doctorService } from "@/services/doctors/doctor.service";
import { queryKeys } from "@/services/queryKeys";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import type { AppointmentCreateInput } from "@/domain/appointment/appointment.types";

interface NewAppointmentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const NewAppointmentModal = ({ open, onClose, onSuccess }: NewAppointmentModalProps) => {
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
    appointment_date: "",
    duration_minutes: 30,
    type: "checkup",
    notes: "",
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
    if (!form.patient_id || !form.doctor_id || !form.appointment_date) {
      toast({
        title: t("common.missingFields"),
        description: t("common.pleaseFillAllRequiredFields"),
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      await appointmentService.create({
        patient_id: form.patient_id,
        doctor_id: form.doctor_id,
        appointment_date: form.appointment_date,
        duration_minutes: form.duration_minutes,
        type: form.type as AppointmentCreateInput["type"],
        notes: form.notes || null,
      });
      toast({ title: t("appointments.appointmentCreated") });
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("appointments.newAppointment")}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t("appointments.newAppointment")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("appointments.patient")} *</Label>
            <Input
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              placeholder={t("common.search")}
              data-testid="appointment-patient-search"
            />
            <Select value={form.patient_id} onValueChange={(value) => setForm({ ...form, patient_id: value })}>
              <SelectTrigger data-testid="appointment-patient-select">
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
            <Label>{t("appointments.doctor")} *</Label>
            <Input
              value={doctorSearch}
              onChange={(e) => setDoctorSearch(e.target.value)}
              placeholder={t("common.search")}
              data-testid="appointment-doctor-search"
            />
            <Select value={form.doctor_id} onValueChange={(value) => setForm({ ...form, doctor_id: value })}>
              <SelectTrigger data-testid="appointment-doctor-select">
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
            <Label>{t("appointments.dateTime")} *</Label>
            <Input
              type="datetime-local"
              value={form.appointment_date}
              onChange={(e) => setForm({ ...form, appointment_date: e.target.value })}
              data-testid="appointment-date"
            />
          </div>
          <div className="space-y-2">
            <Label>Duration (min) *</Label>
            <Input
              type="number"
              min={5}
              step={5}
              value={form.duration_minutes}
              onChange={(e) => setForm({ ...form, duration_minutes: Number.parseInt(e.target.value, 10) || 30 })}
              data-testid="appointment-duration"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("appointments.type")}</Label>
            <Select value={form.type} onValueChange={(value) => setForm({ ...form, type: value })}>
              <SelectTrigger>
                <SelectValue placeholder={t("appointments.type")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="checkup">{t("appointments.checkup")}</SelectItem>
                <SelectItem value="follow_up">{t("appointments.followUp")}</SelectItem>
                <SelectItem value="consultation">{t("appointments.consultation")}</SelectItem>
                <SelectItem value="emergency">{t("appointments.emergency")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("appointments.notes")}</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={loading} data-testid="appointment-save">
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

