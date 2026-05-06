import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/core/i18n/i18nStore";
import { useAuth } from "@/core/auth/authStore";
import { DataTable, Column } from "@/shared/components/DataTable";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { Button } from "@/components/primitives/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/components/primitives/Inputs";
import { Label } from "@/components/ui/label";
import { Printer, Plus } from "lucide-react";
import { formatDate } from "@/shared/utils/formatDate";
import {
  formatPrescriptionQuantity,
  formatPrescriptionSig,
} from "@/shared/utils/prescription";
import { generatePrescriptionsListPDF } from "@/shared/utils/pdfGenerator";
import { toast } from "@/hooks/use-toast";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { doctorService } from "@/services/doctors/doctor.service";
import { prescriptionService } from "@/services/prescriptions/prescription.service";
import { queryKeys } from "@/services/queryKeys";
import type {
  PrescriptionCreateInput,
  PrescriptionWithDoctor,
} from "@/domain/prescription/prescription.types";

interface PrescriptionManagementSectionProps {
  patientId: string;
  patientName: string;
  prescriptions: PrescriptionWithDoctor[];
  canManageRecords: boolean;
}

const defaultForm = () => ({
  doctor_id: "",
  medication: "",
  dosage: "",
  route: "",
  frequency: "",
  quantity: 30,
  refills: 0,
  instructions: "",
  prescribed_date: new Date().toISOString().slice(0, 10),
  end_date: "",
});

const todayIsoDate = () => new Date().toISOString().slice(0, 10);

export const PrescriptionManagementSection = ({
  patientId,
  patientName,
  prescriptions,
  canManageRecords,
}: PrescriptionManagementSectionProps) => {
  const { t, locale, calendarType } = useI18n([
    "patients",
    "appointments",
    "pharmacy",
    "common",
  ]);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [doctorSearch, setDoctorSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [discontinueTarget, setDiscontinueTarget] =
    useState<PrescriptionWithDoctor | null>(null);
  const [discontinueReason, setDiscontinueReason] = useState("");
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const debouncedDoctorSearch = useDebouncedValue(doctorSearch, 300);

  const { data: doctorPage } = useQuery({
    queryKey: queryKeys.doctors.list({
      tenantId: user?.tenantId,
      page: 1,
      pageSize: 10,
      search: debouncedDoctorSearch.trim() || undefined,
    }),
    queryFn: async () =>
      doctorService.listForMedicalRecords({
        page: 1,
        pageSize: 10,
        search: debouncedDoctorSearch.trim() || undefined,
      }),
    enabled: dialogOpen && !!user?.tenantId,
  });

  const doctors = useMemo(() => doctorPage?.data ?? [], [doctorPage?.data]);

  useEffect(() => {
    if (!dialogOpen || form.doctor_id || !user?.id) return;

    const match = doctors.find((doctor: any) => doctor.user_id === user.id);
    if (match?.id) {
      setForm((prev) => ({ ...prev, doctor_id: match.id }));
    }
  }, [dialogOpen, form.doctor_id, doctors, user?.id]);

  const invalidatePrescriptions = () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.prescriptions.root(user?.tenantId),
    });
  };

  const handleCreate = async () => {
    if (
      !patientId ||
      !form.doctor_id ||
      !form.medication ||
      !form.dosage ||
      !form.route ||
      !form.frequency ||
      !form.quantity
    ) {
      toast({
        title: t("common.missingFields"),
        description: t("common.pleaseFillAllRequiredFields"),
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      await prescriptionService.create({
        patient_id: patientId,
        doctor_id: form.doctor_id,
        medication: form.medication,
        dosage: form.dosage,
        route: form.route,
        frequency: form.frequency,
        quantity: form.quantity,
        refills: form.refills,
        instructions: form.instructions || null,
        prescribed_date: form.prescribed_date,
        end_date: form.end_date || null,
      } as PrescriptionCreateInput);
      toast({ title: t("patients.prescriptionsSection.created") });
      setDialogOpen(false);
      setForm(defaultForm());
      setDoctorSearch("");
      invalidatePrescriptions();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.error");
      toast({
        title: t("common.error"),
        description: message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (prescriptionId: string) => {
    setUpdatingStatusId(prescriptionId);
    try {
      await prescriptionService.update(prescriptionId, {
        status: "completed",
        end_date: todayIsoDate(),
      });
      toast({ title: t("patients.prescriptionsSection.completed") });
      invalidatePrescriptions();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.error");
      toast({
        title: t("common.error"),
        description: message,
        variant: "destructive",
      });
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleDiscontinue = async () => {
    if (!discontinueTarget) return;

    setUpdatingStatusId(discontinueTarget.id);
    try {
      await prescriptionService.update(discontinueTarget.id, {
        status: "discontinued",
        discontinued_reason: discontinueReason,
        end_date: todayIsoDate(),
      });
      toast({ title: t("patients.prescriptionsSection.discontinued") });
      setDiscontinueTarget(null);
      setDiscontinueReason("");
      invalidatePrescriptions();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.error");
      toast({
        title: t("common.error"),
        description: message,
        variant: "destructive",
      });
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const getStatusLabel = (status: string) => {
    if (status === "active") return t("patients.active");
    if (status === "completed") return t("appointments.completed");
    if (status === "discontinued") {
      return t("patients.prescriptionsSection.statusDiscontinued");
    }
    return status;
  };

  const getStatusVariant = (status: string) => {
    if (status === "active") return "success" as const;
    if (status === "completed") return "default" as const;
    if (status === "discontinued") return "warning" as const;
    return "default" as const;
  };

  const prescriptionColumns: Column<PrescriptionWithDoctor>[] = [
    {
      key: "medication",
      header: t("pharmacy.medication"),
      render: (prescription) => (
        <div className="space-y-1">
          <div className="font-medium">{prescription.medication}</div>
          <div className="text-xs text-muted-foreground">
            {formatPrescriptionSig(prescription) || prescription.dosage}
          </div>
          {prescription.instructions ? (
            <div className="text-xs text-muted-foreground">
              {prescription.instructions}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: "quantity",
      header: t("patients.prescriptionsSection.supply"),
      render: (prescription) => formatPrescriptionQuantity(prescription) || "-",
    },
    {
      key: "doctor",
      header: t("appointments.doctor"),
      render: (prescription) => prescription.doctors?.full_name ?? "-",
    },
    {
      key: "prescribed_date",
      header: t("common.date"),
      render: (prescription) => (
        <div className="space-y-1 text-sm">
          <div className="text-muted-foreground">
            {formatDate(prescription.prescribed_date, locale, "date", calendarType)}
          </div>
          {prescription.end_date ? (
            <div className="text-xs text-muted-foreground">
              {t("patients.prescriptionsSection.endsOn", {
                date: formatDate(
                  prescription.end_date,
                  locale,
                  "date",
                  calendarType,
                ),
              })}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: "status",
      header: t("common.status"),
      render: (prescription) => (
        <div className="space-y-1">
          <StatusBadge variant={getStatusVariant(prescription.status)}>
            {getStatusLabel(prescription.status)}
          </StatusBadge>
          {prescription.discontinued_reason ? (
            <div className="max-w-xs text-xs text-muted-foreground">
              {prescription.discontinued_reason}
            </div>
          ) : null}
        </div>
      ),
    },
  ];

  if (canManageRecords) {
    prescriptionColumns.push({
      key: "actions",
      header: t("common.actions"),
      render: (prescription) =>
        prescription.status === "active" ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleComplete(prescription.id)}
              disabled={updatingStatusId === prescription.id}
            >
              {t("patients.prescriptionsSection.completeAction")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setDiscontinueTarget(prescription);
                setDiscontinueReason("");
              }}
              disabled={updatingStatusId === prescription.id}
            >
              {t("patients.prescriptionsSection.discontinueAction")}
            </Button>
          </div>
        ) : null,
    });
  }

  return (
    <div className="space-y-4">
      {prescriptions.length > 0 ? (
        <div className="flex justify-between gap-2">
          {canManageRecords ? (
            <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              {t("patients.prescriptionsSection.addAction")}
            </Button>
          ) : (
            <div />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              generatePrescriptionsListPDF(
                prescriptions as any,
                { full_name: patientName },
                locale === "ar" ? "ar" : "en",
              );
            }}
          >
            <Printer className="h-4 w-4" />
            {t("common.print")}
          </Button>
        </div>
      ) : null}

      {prescriptions.length === 0 ? (
        <div className="space-y-3 py-12 text-center text-muted-foreground">
          <p>{t("patients.noPrescriptionsFound")}</p>
          {canManageRecords ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              {t("patients.prescriptionsSection.addAction")}
            </Button>
          ) : null}
        </div>
      ) : (
        <DataTable
          columns={prescriptionColumns}
          data={prescriptions}
          keyExtractor={(prescription) => prescription.id}
          tableLabel={t("patients.prescriptions")}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && setDialogOpen(false)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("patients.prescriptionsSection.dialogTitle")}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {t("patients.prescriptionsSection.dialogDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>{t("appointments.doctor")} *</Label>
              <Input
                value={doctorSearch}
                onChange={(e) => setDoctorSearch(e.target.value)}
                placeholder={t("common.search")}
              />
              <Select
                value={form.doctor_id}
                onValueChange={(value) => setForm((prev) => ({ ...prev, doctor_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("appointments.selectDoctor")} />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((doctor: any) => (
                    <SelectItem key={doctor.id} value={doctor.id}>
                      {doctor.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("patients.prescriptionsSection.medicationLabel")}</Label>
              <Input
                value={form.medication}
                onChange={(e) => setForm((prev) => ({ ...prev, medication: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("patients.prescriptionsSection.dosageLabel")}</Label>
              <Input
                value={form.dosage}
                onChange={(e) => setForm((prev) => ({ ...prev, dosage: e.target.value }))}
                placeholder={t("patients.prescriptionsSection.dosagePlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("patients.prescriptionsSection.routeLabel")}</Label>
              <Input
                value={form.route}
                onChange={(e) => setForm((prev) => ({ ...prev, route: e.target.value }))}
                placeholder={t("patients.prescriptionsSection.routePlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("patients.prescriptionsSection.frequencyLabel")}</Label>
              <Input
                value={form.frequency}
                onChange={(e) => setForm((prev) => ({ ...prev, frequency: e.target.value }))}
                placeholder={t("patients.prescriptionsSection.frequencyPlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("patients.prescriptionsSection.quantityLabel")}</Label>
              <Input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    quantity: Number.parseInt(e.target.value, 10) || 0,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>{t("patients.prescriptionsSection.refillsLabel")}</Label>
              <Input
                type="number"
                min={0}
                value={form.refills}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    refills: Number.parseInt(e.target.value, 10) || 0,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>{t("common.date")}</Label>
              <Input
                type="date"
                value={form.prescribed_date}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, prescribed_date: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>{t("patients.prescriptionsSection.endDateLabel")}</Label>
              <Input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm((prev) => ({ ...prev, end_date: e.target.value }))}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>{t("patients.prescriptionsSection.instructionsLabel")}</Label>
              <Textarea
                rows={4}
                value={form.instructions}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, instructions: e.target.value }))
                }
                placeholder={t("patients.prescriptionsSection.instructionsPlaceholder")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void handleCreate()} disabled={saving}>
              {saving
                ? t("common.loading")
                : t("patients.prescriptionsSection.saveAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!discontinueTarget}
        onOpenChange={(open) => !open && setDiscontinueTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("patients.prescriptionsSection.discontinueDialogTitle")}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {t("patients.prescriptionsSection.discontinueDialogDescription", {
                medication:
                  discontinueTarget?.medication ??
                  t("patients.prescriptionsSection.thisMedication"),
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t("patients.prescriptionsSection.reasonLabel")}</Label>
            <Textarea
              rows={4}
              value={discontinueReason}
              onChange={(e) => setDiscontinueReason(e.target.value)}
              placeholder={t("patients.prescriptionsSection.reasonPlaceholder")}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscontinueTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              onClick={() => void handleDiscontinue()}
              disabled={
                !discontinueReason.trim() ||
                updatingStatusId === discontinueTarget?.id
              }
            >
              {t("patients.prescriptionsSection.discontinueAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
