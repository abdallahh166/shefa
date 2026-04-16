import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/core/i18n/i18nStore";
import { StatCard } from "@/shared/components/StatCard";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { StatusFilter } from "@/shared/components/StatusFilter";
import { DataTable, Column } from "@/shared/components/DataTable";
import { Shield, Plus, CheckCircle, XCircle, Send, Wallet } from "lucide-react";
import { Button } from "@/components/primitives/Button";
import { Input, Textarea } from "@/components/primitives/Inputs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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

type ClaimAction = "submitted" | "processing" | "approved" | "denied" | "reimbursed";

const getClaimStatusLabel = (status: string) => {
  if (status === "approved") return "Approved";
  if (status === "denied") return "Denied";
  if (status === "reimbursed") return "Reimbursed";
  if (status === "submitted") return "Submitted";
  if (status === "processing") return "Processing";
  if (status === "draft") return "Draft";
  return status;
};

const getActionCopy = (action: ClaimAction) => {
  if (action === "submitted") return { title: "Submit claim", cta: "Submit claim" };
  if (action === "processing") return { title: "Move to processing", cta: "Mark processing" };
  if (action === "approved") return { title: "Approve claim", cta: "Approve claim" };
  if (action === "denied") return { title: "Deny claim", cta: "Deny claim" };
  return { title: "Record reimbursement", cta: "Mark reimbursed" };
};

export const InsurancePage = () => {
  const { t, locale, calendarType } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<InsuranceClaimWithPatient | null>(null);
  const [selectedAction, setSelectedAction] = useState<ClaimAction | null>(null);
  const [actionSaving, setActionSaving] = useState(false);
  const [actionForm, setActionForm] = useState({
    payer_reference: "",
    denial_reason: "",
  });
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [sort, setSort] = useState<{ column: string; direction: "asc" | "desc" }>({
    column: "claim_date",
    direction: "desc",
  });
  const pageSize = 25;

  useRealtimeSubscription(["insurance_claims"]);

  const listArgs = useMemo(() => ({
    tenantId: user?.tenantId,
    page,
    pageSize,
    search: searchTerm.trim() || undefined,
    filters: statusFilter ? { status: statusFilter } : undefined,
    sort: { column: sort.column, ascending: sort.direction === "asc" },
  }), [page, pageSize, searchTerm, sort.column, sort.direction, statusFilter, user?.tenantId]);

  const { data: listPage, isLoading } = useQuery({
    queryKey: queryKeys.insurance.list(listArgs),
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

  const claims: InsuranceClaimWithPatient[] = listPage?.data ?? [];
  const totalClaims = listPage?.count ?? 0;
  const total = totalClaims;
  const inFlight = insuranceSummary.submitted_count + insuranceSummary.processing_count;
  const providerCount = insuranceSummary.providers_count;
  const dispositionBase = insuranceSummary.approved_count + insuranceSummary.denied_count;
  const approvalRate = dispositionBase ? Math.round((insuranceSummary.approved_count / dispositionBase) * 100) : 0;

  const invalidateClaims = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.insurance.root(user?.tenantId) });
  };

  const openActionDialog = (claim: InsuranceClaimWithPatient, action: ClaimAction) => {
    setSelectedClaim(claim);
    setSelectedAction(action);
    setActionForm({
      payer_reference: claim.payer_reference ?? "",
      denial_reason: claim.denial_reason ?? "",
    });
  };

  const closeActionDialog = () => {
    setSelectedClaim(null);
    setSelectedAction(null);
    setActionForm({ payer_reference: "", denial_reason: "" });
  };

  const handleConfirmAction = async () => {
    if (!selectedClaim || !selectedAction) return;

    setActionSaving(true);
    try {
      await insuranceService.update(selectedClaim.id, {
        status: selectedAction,
        payer_reference: actionForm.payer_reference || null,
        denial_reason: actionForm.denial_reason || null,
      });
      toast({ title: `${getClaimStatusLabel(selectedAction)} updated` });
      closeActionDialog();
      invalidateClaims();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.error");
      toast({ title: t("common.error"), description: message, variant: "destructive" });
    } finally {
      setActionSaving(false);
    }
  };

  const columns: Column<InsuranceClaimWithPatient>[] = [
    { key: "patient_name", header: t("appointments.patient"), searchable: true, render: (claim) => claim.patients?.full_name ?? "-" },
    { key: "provider", header: t("common.provider"), searchable: true, render: (claim) => claim.provider },
    { key: "service", header: t("common.service"), searchable: true, render: (claim) => claim.service },
    { key: "amount", header: t("common.amount"), render: (claim) => formatCurrency(Number(claim.amount), locale) },
    {
      key: "claim_date",
      header: t("common.date"),
      sortable: true,
      render: (claim) => formatDate(claim.claim_date, locale, "date", calendarType),
    },
    {
      key: "payer_reference",
      header: "Payer Ref",
      render: (claim) => claim.payer_reference ?? <span className="text-muted-foreground">-</span>,
    },
    {
      key: "status",
      header: t("common.status"),
      sortable: true,
      render: (claim) => (
        <StatusBadge variant={statusVariant[claim.status] ?? "default"}>
          {getClaimStatusLabel(claim.status)}
        </StatusBadge>
      ),
    },
    {
      key: "notes",
      header: "Outcome",
      render: (claim) => (
        claim.denial_reason
          ? <span className="max-w-xs truncate text-sm text-muted-foreground">{claim.denial_reason}</span>
          : <span className="text-muted-foreground">-</span>
      ),
    },
    {
      key: "actions",
      header: t("common.actions"),
      render: (claim) => (
        <div className="flex flex-wrap justify-end gap-2">
          {claim.status === "draft" ? (
            <Button variant="outline" size="sm" className="gap-1" onClick={() => openActionDialog(claim, "submitted")}>
              <Send className="h-4 w-4" />
              Submit
            </Button>
          ) : null}
          {claim.status === "submitted" ? (
            <>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => openActionDialog(claim, "processing")}>
                <CheckCircle className="h-4 w-4" />
                Process
              </Button>
              <Button variant="ghost" size="sm" className="gap-1 text-destructive hover:bg-destructive/10" onClick={() => openActionDialog(claim, "denied")}>
                <XCircle className="h-4 w-4" />
                Deny
              </Button>
            </>
          ) : null}
          {claim.status === "processing" ? (
            <>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => openActionDialog(claim, "approved")}>
                <CheckCircle className="h-4 w-4" />
                Approve
              </Button>
              <Button variant="ghost" size="sm" className="gap-1 text-destructive hover:bg-destructive/10" onClick={() => openActionDialog(claim, "denied")}>
                <XCircle className="h-4 w-4" />
                Deny
              </Button>
            </>
          ) : null}
          {claim.status === "approved" ? (
            <Button variant="outline" size="sm" className="gap-1" onClick={() => openActionDialog(claim, "reimbursed")}>
              <Wallet className="h-4 w-4" />
              Reimburse
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const actionCopy = selectedAction ? getActionCopy(selectedAction) : null;
  const needsPayerReference = selectedAction === "submitted" || selectedAction === "approved" || selectedAction === "reimbursed";
  const needsDenialReason = selectedAction === "denied";

  return (
    <PageContainer className="space-y-6">
      <SectionHeader
        title={t("insurance.title")}
        actions={(
          <Button onClick={() => setShowModal(true)}><Plus className="h-4 w-4" /> {t("insurance.newClaim")}</Button>
        )}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title={t("insurance.activeProviders")} value={String(providerCount)} icon={Shield} />
        <StatCard title={t("insurance.pendingClaims")} value={String(inFlight)} icon={Shield} />
        <StatCard title={t("insurance.approvalRate")} value={`${approvalRate}%`} icon={Shield} />
      </div>

      <DataTable
        columns={columns}
        data={claims}
        keyExtractor={(claim) => claim.id}
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
        filterSlot={(
          <StatusFilter
            options={[
              { value: "draft", label: "Draft" },
              { value: "submitted", label: "Submitted" },
              { value: "processing", label: "Processing" },
              { value: "approved", label: "Approved" },
              { value: "denied", label: "Denied" },
              { value: "reimbursed", label: "Reimbursed" },
            ]}
            selected={statusFilter}
            onChange={setStatusFilter}
          />
        )}
      />

      <NewClaimModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => {
          invalidateClaims();
        }}
      />

      <Dialog open={!!selectedClaim && !!selectedAction} onOpenChange={(next) => !next && closeActionDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{actionCopy?.title ?? "Update claim"}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {selectedClaim ? `${selectedClaim.provider} · ${selectedClaim.patients?.full_name ?? "-"}` : "Update the claim with the payer outcome details."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {needsPayerReference ? (
              <div className="space-y-2">
                <Label>Payer reference{selectedAction === "reimbursed" ? " *" : ""}</Label>
                <Input
                  value={actionForm.payer_reference}
                  onChange={(event) => setActionForm((prev) => ({ ...prev, payer_reference: event.target.value }))}
                  placeholder="Claim control number, EOB reference, remittance ID"
                />
              </div>
            ) : null}
            {needsDenialReason ? (
              <div className="space-y-2">
                <Label>Denial reason *</Label>
                <Textarea
                  rows={4}
                  value={actionForm.denial_reason}
                  onChange={(event) => setActionForm((prev) => ({ ...prev, denial_reason: event.target.value }))}
                  placeholder="Missing prior authorization, uncovered service, member eligibility issue, etc."
                />
              </div>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={closeActionDialog}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void handleConfirmAction()} disabled={actionSaving}>
              {actionSaving ? t("common.loading") : actionCopy?.cta ?? "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
};
