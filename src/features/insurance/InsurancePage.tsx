import { useEffect, useState } from "react";
import { useI18n } from "@/core/i18n/i18nStore";
import { StatCard } from "@/shared/components/StatCard";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { StatusFilter } from "@/shared/components/StatusFilter";
import { DataTable, Column } from "@/shared/components/DataTable";
import { Shield, Plus, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/primitives/Button";
import { PageContainer, SectionHeader } from "@/components/layout/AppLayout";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useAuth } from "@/core/auth/authStore";
import { NewClaimModal } from "./NewClaimModal";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { formatDate, formatCurrency } from "@/shared/utils/formatDate";
import { insuranceService } from "@/services/insurance/insurance.service";
import { queryKeys } from "@/services/queryKeys";
import type { InsuranceClaimWithPatient } from "@/domain/insurance/insurance.types";

const statusVariant: Record<string, "success" | "warning" | "destructive" | "info" | "default"> = {
  draft: "default",
  submitted: "info",
  processing: "warning",
  approved: "success",
  denied: "destructive",
  reimbursed: "success",
};

type ClaimRow = InsuranceClaimWithPatient;

type ClaimDisplayRow = {
  id: string;
  patient_name: string;
  provider: string;
  service: string;
  amount: number;
  claim_date: string;
  status: "draft" | "submitted" | "processing" | "approved" | "denied" | "reimbursed";
};

export const InsurancePage = () => {
  const { t, locale, calendarType } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [sort, setSort] = useState<{ column: string; direction: "asc" | "desc" }>({
    column: "claim_date",
    direction: "desc",
  });
  const pageSize = 25;

  useRealtimeSubscription(["insurance_claims"]);

  const { data: listPage, isLoading } = useQuery({
    queryKey: queryKeys.insurance.list({
      tenantId: user?.tenantId,
      page,
      pageSize,
      search: searchTerm.trim() || undefined,
      filters: statusFilter ? { status: statusFilter } : undefined,
      sort: { column: sort.column, ascending: sort.direction === "asc" },
    }),
    queryFn: async () => insuranceService.listPagedWithRelations({
      page,
      pageSize,
      search: searchTerm.trim() || undefined,
      filters: statusFilter ? { status: statusFilter } : undefined,
      sort: { column: sort.column, ascending: sort.direction === "asc" },
    }),
    enabled: !!user?.tenantId,
  });

  useEffect(() => {
    setPage(1);
  }, [statusFilter, searchTerm]);

  const { data: insuranceSummary = {
    total_count: 0,
    draft_count: 0,
    submitted_count: 0,
    processing_count: 0,
    approved_count: 0,
    denied_count: 0,
    reimbursed_count: 0,
    providers_count: 0,
  } } = useQuery({
    queryKey: queryKeys.insurance.summary(user?.tenantId),
    enabled: !!user?.tenantId,
    queryFn: async () => insuranceService.getSummary(),
  });

  const liveClaims: ClaimRow[] = listPage?.data ?? [];
  const totalClaims = listPage?.count ?? 0;

  const claims: ClaimDisplayRow[] = liveClaims.map((c) => ({
    id: c.id,
    patient_name: c.patients?.full_name ?? "-",
    provider: c.provider,
    service: c.service,
    amount: Number(c.amount),
    claim_date: c.claim_date,
    status: c.status,
  }));

  const total = totalClaims;
  const pending = insuranceSummary.submitted_count + insuranceSummary.processing_count;
  const approved = insuranceSummary.approved_count;
  const providerCount = insuranceSummary.providers_count;
  const totalCount = insuranceSummary.total_count;
  const rate = totalCount ? Math.round((approved / totalCount) * 100) : 0;

  const invalidateClaims = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.insurance.root(user?.tenantId) });
  };

  const handleUpdateStatus = async (id: string, newStatus: ClaimDisplayRow["status"]) => {
    try {
      await insuranceService.update(id, { status: newStatus });
      const title =
        newStatus === "approved" ? t("insurance.approved") :
        newStatus === "denied" ? t("insurance.denied") :
        newStatus === "reimbursed" ? t("insurance.reimbursed") :
        t("insurance.claimSubmitted");
      toast({ title });
      invalidateClaims();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.error");
      toast({ title: t("common.error"), description: message, variant: "destructive" });
    }
  };

  const getClaimStatusLabel = (status: string) => {
    if (status === "approved") return t("insurance.approved");
    if (status === "denied") return t("insurance.denied");
    if (status === "reimbursed") return t("insurance.reimbursed");
    if (status === "submitted") return t("insurance.submitted");
    if (status === "processing") return t("insurance.processing");
    if (status === "draft") return t("insurance.draft");
    return status;
  };

  const columns: Column<ClaimDisplayRow>[] = [
    { key: "patient_name", header: t("appointments.patient"), searchable: true },
    { key: "provider", header: t("common.provider"), searchable: true },
    { key: "service", header: t("common.service"), searchable: true },
    { key: "amount", header: t("common.amount"), render: (c) => formatCurrency(c.amount, locale) },
    { key: "claim_date", header: t("common.date"), sortable: true, render: (c) => formatDate(c.claim_date, locale, "date", calendarType) },
    { key: "status", header: t("common.status"), sortable: true, render: (c) => <StatusBadge variant={statusVariant[c.status] ?? "default"}>{getClaimStatusLabel(c.status)}</StatusBadge> },
    {
      key: "actions",
      header: t("common.actions"),
      render: (c) => c.status === "draft" ? (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => handleUpdateStatus(c.id, "submitted")}
          className="text-info hover:text-info"
          aria-label={t("insurance.submitted")}
          title={t("insurance.submitted")}
        >
          <CheckCircle className="h-4 w-4" />
        </Button>
      ) : c.status === "submitted" ? (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => handleUpdateStatus(c.id, "processing")}
          className="text-warning hover:text-warning"
          aria-label={t("insurance.processing")}
          title={t("insurance.processing")}
        >
          <CheckCircle className="h-4 w-4" />
        </Button>
      ) : c.status === "processing" ? (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => handleUpdateStatus(c.id, "approved")}
            className="text-success hover:text-success"
            aria-label={t("common.approve")}
            title={t("common.approve")}
          >
            <CheckCircle className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => handleUpdateStatus(c.id, "denied")}
            className="text-destructive hover:text-destructive"
            aria-label={t("common.reject")}
            title={t("common.reject")}
          >
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      ) : c.status === "approved" ? (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => handleUpdateStatus(c.id, "reimbursed")}
          className="text-success hover:text-success"
          aria-label={t("insurance.reimbursed")}
          title={t("insurance.reimbursed")}
        >
          <CheckCircle className="h-4 w-4" />
        </Button>
      ) : null,
    },
  ];

  return (
    <PageContainer className="space-y-6">
      <SectionHeader
        title={t("insurance.title")}
        actions={(
          <Button onClick={() => setShowModal(true)}><Plus className="h-4 w-4" /> {t("insurance.newClaim")}</Button>
        )}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title={t("insurance.activeProviders")} value={String(providerCount)} icon={Shield} />
        <StatCard title={t("insurance.pendingClaims")} value={String(pending)} icon={Shield} />
        <StatCard title={t("insurance.approvalRate")} value={`${rate}%`} icon={Shield} />
      </div>

      <DataTable
        columns={columns}
        data={claims}
        keyExtractor={(c) => c.id}
        searchable
        serverSearch
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        isLoading={isLoading}
        sortColumn={sort.column}
        sortDirection={sort.direction}
        onSortChange={(column, direction) => {
          setSort({ column, direction });
          setPage(1);
        }}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        filterSlot={
          <StatusFilter
            options={[
              { value: "draft", label: t("insurance.draft") },
              { value: "submitted", label: t("insurance.submitted") },
              { value: "processing", label: t("insurance.processing") },
              { value: "approved", label: t("insurance.approved") },
              { value: "denied", label: t("insurance.denied") },
              { value: "reimbursed", label: t("insurance.reimbursed") },
            ]}
            selected={statusFilter}
            onChange={setStatusFilter}
          />
        }
      />

      <NewClaimModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => {
          invalidateClaims();
        }}
      />
    </PageContainer>
  );
};
