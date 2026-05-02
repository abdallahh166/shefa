import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Eye, Trash2, Upload } from "lucide-react";
import { useI18n } from "@/core/i18n/i18nStore";
import { PermissionGuard } from "@/core/auth/PermissionGuard";
import { useAuth } from "@/core/auth/authStore";
import { formatDate } from "@/core/i18n/formatters";
import { PageContainer, SectionHeader } from "@/components/layout/AppLayout";
import { Button } from "@/components/primitives/Button";
import { toast } from "@/hooks/use-toast";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { queryKeys } from "@/services/queryKeys";
import { patientService } from "@/services/patients/patient.service";
import { DataTable, type Column } from "@/shared/components/DataTable";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { StatusFilter } from "@/shared/components/StatusFilter";
import type { Patient } from "@/domain/patient/patient.types";
import { AddPatientModal } from "./AddPatientModal";
import { ImportPatientsModal } from "./ImportPatientsModal";

type PatientRow = Patient;

export const PatientsPage = () => {
  const { locale, t } = useI18n(["patients"]);
  const navigate = useNavigate();
  const { clinicSlug } = useParams();
  const { user, hasPermission, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [sort, setSort] = useState<{ column: string; direction: "asc" | "desc" }>({
    column: "created_at",
    direction: "desc",
  });
  const pageSize = 25;
  const canDelete = hasRole("clinic_admin");

  useRealtimeSubscription(["patients"]);

  const { data: liveResult, isLoading } = useQuery<{ data: PatientRow[]; count: number }>({
    queryKey: queryKeys.patients.list({
      tenantId: user?.tenantId,
      page,
      pageSize,
      search: searchTerm || undefined,
      filters: statusFilter ? { status: statusFilter } : undefined,
      sort: { column: sort.column, ascending: sort.direction === "asc" },
    }),
    queryFn: () =>
      patientService.listPaged({
        page,
        pageSize,
        search: searchTerm || undefined,
        filters: statusFilter ? { status: statusFilter } : undefined,
        sort: { column: sort.column, ascending: sort.direction === "asc" },
      }),
    enabled: !!user?.tenantId,
  });

  const patients = liveResult?.data ?? [];
  const total = liveResult?.count ?? 0;

  useEffect(() => {
    setPage(1);
  }, [statusFilter, searchTerm]);

  const handleBulkDelete = async (selectedIds: string[]) => {
    if (!canDelete) {
      toast({ title: t("settings.noPermission"), variant: "destructive" });
      return;
    }

    try {
      await patientService.deleteBulk(selectedIds);
      toast({
        title: t("patients.form.bulkDeleteSuccess", { count: selectedIds.length }),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.patients.root(user?.tenantId),
      });
    } catch (err: any) {
      toast({
        title: t("common.error"),
        description: err?.message ?? t("patients.form.bulkDeleteFailed"),
        variant: "destructive",
      });
    }
  };

  const columns: Column<PatientRow>[] = [
    {
      key: "patient_code",
      header: t("patients.patientId"),
      searchable: true,
      sortable: true,
    },
    {
      key: "full_name",
      header: t("patients.fullName"),
      searchable: true,
      sortable: true,
      render: (patient) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {patient.full_name.charAt(0)}
          </div>
          <span className="text-sm font-medium">{patient.full_name}</span>
        </div>
      ),
    },
    {
      key: "gender",
      header: t("patients.gender"),
      render: (patient) => (
        <span className="text-muted-foreground">
          {patient.gender ? t(`patients.${patient.gender}`) : t("common.na")}
        </span>
      ),
    },
    {
      key: "blood_type",
      header: t("patients.bloodType"),
      render: (patient) => (
        <span className="text-muted-foreground">
          {patient.blood_type ?? t("common.na")}
        </span>
      ),
    },
    {
      key: "phone",
      header: t("common.phone"),
      searchable: true,
      render: (patient) => (
        <span className="tabular-nums text-muted-foreground">
          {patient.phone ?? t("common.na")}
        </span>
      ),
    },
    {
      key: "status",
      header: t("common.status"),
      sortable: true,
      render: (patient) => (
        <StatusBadge
          variant={patient.status === "active" ? "success" : "default"}
          dot
        >
          {t(`patients.${patient.status}`)}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "",
      searchable: false,
      render: (patient) => (
        <Button
          onClick={() => navigate(`/tenant/${clinicSlug}/patients/${patient.id}`)}
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          aria-label={t("common.view")}
          title={t("common.view")}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <PageContainer>
      <SectionHeader
        title={t("patients.title")}
        subtitle={t("patients.summary.totalPatients", { count: total })}
        actions={(
          <PermissionGuard permission="manage_patients">
            <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
              <Upload className="me-1 h-3.5 w-3.5" /> {t("patients.importCSV")}
            </Button>
            <Button
              size="sm"
              onClick={() => setShowAdd(true)}
              data-testid="patients-add-button"
            >
              <UserPlus className="me-1 h-3.5 w-3.5" />
              {t("patients.addPatient")}
            </Button>
          </PermissionGuard>
        )}
      />

      <DataTable
        columns={columns}
        data={patients}
        keyExtractor={(patient) => patient.id}
        emptyMessage={t("common.noData")}
        searchable
        serverSearch
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        sortColumn={sort.column}
        sortDirection={sort.direction}
        onSortChange={(column, direction) => {
          setSort({ column, direction });
          setPage(1);
        }}
        isLoading={isLoading}
        exportFileName="patients"
        pdfExport={{
          title: t("patients.form.pdfTitle"),
          subtitle: t("patients.form.pdfSubtitle", {
            date: formatDate(new Date(), locale, "date"),
          }),
        }}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        bulkActions={canDelete ? [
          {
            label: t("common.delete"),
            icon: <Trash2 className="me-1 h-3.5 w-3.5" />,
            variant: "danger",
            action: handleBulkDelete,
          },
        ] : undefined}
        filterSlot={(
          <StatusFilter
            options={[
              { value: "active", label: t("patients.active") },
              { value: "inactive", label: t("patients.inactive") },
            ]}
            selected={statusFilter}
            onChange={setStatusFilter}
          />
        )}
      />

      <AddPatientModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={() =>
          queryClient.invalidateQueries({
            queryKey: queryKeys.patients.root(user?.tenantId),
          })
        }
      />
      <ImportPatientsModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onSuccess={() =>
          queryClient.invalidateQueries({
            queryKey: queryKeys.patients.root(user?.tenantId),
          })
        }
      />
    </PageContainer>
  );
};
