/**
 * Patients Page + Add Patient Modal — Design System Examples
 *
 * Demonstrates:
 *  - DataTable with sort, pagination, bulk delete, CSV export
 *  - StatusBadge for patient status
 *  - Radix Dialog for accessible modal
 *  - FormSection + FormGroup + FormField + FormError
 *  - Input, Select, Textarea from design system
 *  - Button loading state
 */

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Upload, Eye, Trash2, Users } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

// ── Design system ──
import { PageContainer, SectionHeader } from "@/design-system/components/layout/AppLayout";
import { DataTable, Column, StatusBadge, FilterBar, EmptyState } from "@/design-system/components/data-display/DataDisplay";
import { Button } from "@/design-system/components/primitives/Button";
import { FormSection, FormGroup, FormField, FormActions } from "@/design-system/components/forms/FormSystem";
import { Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/design-system/components/primitives/Inputs";
import { Divider } from "@/design-system/components/primitives/Display";

// ── App imports ──
import { useAuth } from "@/core/auth/authStore";
import { useI18n } from "@/core/i18n/i18nStore";
import { PermissionGuard } from "@/core/auth/PermissionGuard";
import { patientService } from "@/services/patients/patient.service";
import { queryKeys } from "@/services/queryKeys";
import { formatDate } from "@/shared/utils/formatDate";
import { toast } from "@/hooks/use-toast";
import { useNavigate, useParams } from "react-router-dom";

// ─── Patient row type ─────────────────────────────────────────────────────────

type PatientRow = {
  id: string;
  full_name: string;
  gender: string;
  date_of_birth: string;
  blood_type: string;
  phone: string;
  status: "active" | "inactive";
};

// ─── Table columns ────────────────────────────────────────────────────────────

function useColumns(clinicSlug: string, locale: string, calendarType: any): Column<PatientRow>[] {
  const navigate = useNavigate();
  const { t } = useI18n();

  return [
    {
      key: "full_name",
      header: t("patients.fullName"),
      sortable: true,
      searchable: true,
      render: (p) => (
        <button
          onClick={() => navigate(`/tenant/${clinicSlug}/patients/${p.id}`)}
          className="font-medium text-sm hover:text-primary transition-colors text-start"
        >
          {p.full_name}
        </button>
      ),
    },
    {
      key: "gender",
      header: t("patients.gender"),
      render: (p) => <span className="text-sm capitalize">{p.gender ? t(`patients.${p.gender}`) : "—"}</span>,
    },
    {
      key: "date_of_birth",
      header: t("patients.dateOfBirth"),
      sortable: true,
      render: (p) => (
        <span className="text-sm text-muted-foreground tabular">
          {formatDate(p.date_of_birth, locale as any, "date", calendarType)}
        </span>
      ),
    },
    {
      key: "blood_type",
      header: t("patients.bloodType"),
      render: (p) => <span className="text-sm text-muted-foreground">{p.blood_type ?? "—"}</span>,
    },
    {
      key: "phone",
      header: t("common.phone"),
      searchable: true,
      render: (p) => <span className="text-sm tabular text-muted-foreground">{p.phone ?? "—"}</span>,
    },
    {
      key: "status",
      header: t("common.status"),
      render: (p) => (
        <StatusBadge variant={p.status === "active" ? "success" : "default"} dot>
          {t(`patients.${p.status}`)}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-10",
      render: (p) => (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => navigate(`/tenant/${clinicSlug}/patients/${p.id}`)}
          aria-label={`View ${p.full_name}`}
        >
          <Eye className="h-3.5 w-3.5" aria-hidden />
        </Button>
      ),
    },
  ];
}

// ─── PatientsPage ─────────────────────────────────────────────────────────────

export const PatientsPage = () => {
  const { clinicSlug } = useParams<{ clinicSlug: string }>();
  const { user } = useAuth();
  const { t, locale, calendarType } = useI18n();
  const queryClient = useQueryClient();

  const [showAdd, setShowAdd]     = useState(false);
  const [statusFilter, setFilter] = useState<string | null>(null);
  const [searchTerm, setSearch]   = useState("");
  const [page, setPage]           = useState(1);
  const [sort, setSort]           = useState<{ col: string; dir: "asc" | "desc" | null }>({ col: "full_name", dir: "asc" });
  const pageSize = 25;

  const { data: listPage, isLoading } = useQuery({
    queryKey: queryKeys.patients.list({
      tenantId: user?.tenantId,
      page, pageSize,
      search: searchTerm || undefined,
      filters: statusFilter ? { status: statusFilter } : undefined,
      sort: sort.col && sort.dir ? { column: sort.col, ascending: sort.dir === "asc" } : undefined,
    }),
    queryFn: () => patientService.listPaged({
      page, pageSize,
      search: searchTerm || undefined,
      filters: statusFilter ? { status: statusFilter } : undefined,
      sort: sort.col && sort.dir ? { column: sort.col, ascending: sort.dir === "asc" } : undefined,
    }),
    enabled: !!user?.tenantId,
  });

  const patients: PatientRow[] = listPage?.data ?? [];
  const total = listPage?.count ?? 0;

  const handleSort = (col: string, dir: "asc" | "desc" | null) => {
    setSort({ col, dir });
    setPage(1);
  };

  const handleDelete = useCallback(async (ids: string[]) => {
    await Promise.all(ids.map((id) => patientService.delete(id)));
    queryClient.invalidateQueries({ queryKey: queryKeys.patients.all() });
    toast({ title: `${ids.length} patient(s) deleted.` });
  }, [queryClient]);

  const columns = useColumns(clinicSlug ?? "", locale, calendarType);

  const statusOptions = [
    { label: "All",      value: null },
    { label: "Active",   value: "active"   },
    { label: "Inactive", value: "inactive" },
  ];

  return (
    <PageContainer>
      <SectionHeader
        title={t("patients.title")}
        subtitle={`${total.toLocaleString()} ${t("patients.title").toLowerCase()}`}
        icon={Users}
        actions={
          <PermissionGuard permission="manage_patients">
            <Button variant="outline" size="sm">
              <Upload className="h-3.5 w-3.5" aria-hidden />
              {t("patients.importCSV")}
            </Button>
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <UserPlus className="h-3.5 w-3.5" aria-hidden />
              {t("patients.addPatient")}
            </Button>
          </PermissionGuard>
        }
      />

      <FilterBar
        options={statusOptions}
        value={statusFilter}
        onChange={setFilter}
      />

      <DataTable
        columns={columns}
        data={patients}
        keyExtractor={(p) => p.id}
        isLoading={isLoading}
        emptyMessage={t("common.noData")}
        emptyDescription="Add your first patient to get started."
        emptyAction={
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <UserPlus className="h-3.5 w-3.5" /> Add Patient
          </Button>
        }
        searchable
        searchValue={searchTerm}
        searchPlaceholder={t("common.search")}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        sortColumn={sort.col}
        sortDirection={sort.dir}
        onSortChange={handleSort}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        exportFileName="patients"
        bulkActions={[
          {
            label: "Delete",
            icon: <Trash2 className="h-3.5 w-3.5" />,
            variant: "danger",
            action: handleDelete,
          },
        ]}
      />

      {/* ── Add Patient Modal ── */}
      <AddPatientModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={() => {
          setShowAdd(false);
          queryClient.invalidateQueries({ queryKey: queryKeys.patients.all() });
          toast({ title: t("patients.patientAddedSuccessfully") });
        }}
      />
    </PageContainer>
  );
};

// ─── AddPatientModal ─────────────────────────────────────────────────────────
//  Uses Radix Dialog for full accessibility (focus trap, escape key, aria-modal)

interface AddPatientModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type PatientForm = {
  full_name: string;
  date_of_birth: string;
  gender: string;
  blood_type: string;
  phone: string;
  email: string;
  insurance_provider: string;
};

const EMPTY_FORM: PatientForm = {
  full_name: "", date_of_birth: "", gender: "male",
  blood_type: "", phone: "", email: "", insurance_provider: "",
};

function AddPatientModal({ open, onClose, onSuccess }: AddPatientModalProps) {
  const { t } = useI18n();
  const [form, setForm] = useState<PatientForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<PatientForm>>({});
  const [loading, setLoading] = useState(false);

  const set = (key: keyof PatientForm) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const validate = (): boolean => {
    const errs: Partial<PatientForm> = {};
    if (!form.full_name.trim()) errs.full_name = "Full name is required.";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = "Enter a valid email address.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await patientService.create({
        full_name:          form.full_name.trim(),
        date_of_birth:      form.date_of_birth || null,
        gender:             form.gender || null,
        blood_type:         form.blood_type || null,
        phone:              form.phone || null,
        email:              form.email || null,
        insurance_provider: form.insurance_provider || null,
      });
      setForm(EMPTY_FORM);
      setErrors({});
      onSuccess();
    } catch (err: any) {
      toast({ title: "Failed to add patient", description: err?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        {/* Backdrop */}
        <DialogPrimitive.Overlay className="modal-overlay animate-fade-in" />

        {/* Dialog */}
        <DialogPrimitive.Content
          className="fixed inset-0 z-modal flex items-center justify-center p-4"
          aria-labelledby="add-patient-title"
        >
          <div className="bg-card rounded-xl border border-border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <DialogPrimitive.Title id="add-patient-title" className="text-base font-semibold">
                {t("patients.addPatient")}
              </DialogPrimitive.Title>
              <DialogPrimitive.Close asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Close dialog">
                  <X className="h-4 w-4" aria-hidden />
                </Button>
              </DialogPrimitive.Close>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
              <div className="p-5 space-y-5">
                <FormSection title="Personal Information">
                  <FormGroup cols={1}>
                    <FormField
                      name="full_name"
                      label={t("patients.fullName")}
                      required
                      error={errors.full_name}
                    >
                      <Input
                        value={form.full_name}
                        onChange={(e) => set("full_name")(e.target.value)}
                        placeholder="Jane Smith"
                        autoFocus
                        error={!!errors.full_name}
                      />
                    </FormField>
                  </FormGroup>

                  <FormGroup cols={2}>
                    <FormField name="date_of_birth" label={t("patients.dateOfBirth")}>
                      <Input
                        type="date"
                        value={form.date_of_birth}
                        onChange={(e) => set("date_of_birth")(e.target.value)}
                        max={new Date().toISOString().split("T")[0]}
                      />
                    </FormField>

                    <FormField name="gender" label={t("patients.gender")}>
                      <Select value={form.gender} onValueChange={set("gender")}>
                        <SelectTrigger id="gender" aria-label={t("patients.gender")}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">{t("patients.male")}</SelectItem>
                          <SelectItem value="female">{t("patients.female")}</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                          <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormField>

                    <FormField name="blood_type" label={t("patients.bloodType")}>
                      <Select value={form.blood_type} onValueChange={set("blood_type")}>
                        <SelectTrigger id="blood_type" aria-label={t("patients.bloodType")}>
                          <SelectValue placeholder="Select…" />
                        </SelectTrigger>
                        <SelectContent>
                          {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map((bt) => (
                            <SelectItem key={bt} value={bt}>{bt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>
                  </FormGroup>
                </FormSection>

                <Divider />

                <FormSection title="Contact">
                  <FormGroup cols={2}>
                    <FormField name="phone" label={t("common.phone")}>
                      <Input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => set("phone")(e.target.value)}
                        placeholder="+1 555 000 0000"
                      />
                    </FormField>
                    <FormField name="email" label={t("common.email")} error={errors.email}>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={(e) => set("email")(e.target.value)}
                        placeholder="jane@example.com"
                        error={!!errors.email}
                      />
                    </FormField>
                  </FormGroup>
                </FormSection>

                <Divider />

                <FormSection title="Insurance">
                  <FormField name="insurance_provider" label={t("patients.insuranceProvider")}>
                    <Input
                      value={form.insurance_provider}
                      onChange={(e) => set("insurance_provider")(e.target.value)}
                      placeholder="Blue Cross, Aetna…"
                    />
                  </FormField>
                </FormSection>
              </div>

              <FormActions>
                <Button type="button" variant="outline" onClick={onClose}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" loading={loading} loadingText="Saving…">
                  {t("common.save")}
                </Button>
              </FormActions>
            </form>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
