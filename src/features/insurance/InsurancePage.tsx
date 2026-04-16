import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/core/i18n/i18nStore";
import { StatCard } from "@/shared/components/StatCard";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { StatusFilter } from "@/shared/components/StatusFilter";
import { DataTable, Column } from "@/shared/components/DataTable";
import {
  CheckCircle,
  Clock3,
  Plus,
  RefreshCcw,
  Send,
  Shield,
  TimerReset,
  UserRound,
  Wallet,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/primitives/Button";
import { Input, Textarea } from "@/components/primitives/Inputs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PageContainer, SectionHeader } from "@/components/layout/AppLayout";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useAuth } from "@/core/auth/authStore";
import { NewClaimModal } from "./NewClaimModal";
import { ClaimFollowUpDialog } from "./ClaimFollowUpDialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { formatDate, formatCurrency } from "@/shared/utils/formatDate";
import { insuranceService } from "@/services/insurance/insurance.service";
import { queryKeys } from "@/services/queryKeys";
import type {
  InsuranceAssignableOwner,
  InsuranceClaimWithPatient,
  InsuranceClaimUpdateInput,
} from "@/domain/insurance/insurance.types";

const statusVariant: Record<string, "success" | "warning" | "destructive" | "info" | "default"> = {
  draft: "default",
  submitted: "info",
  processing: "warning",
  approved: "success",
  denied: "destructive",
  reimbursed: "success",
};

type ClaimAction = "draft" | "submitted" | "processing" | "approved" | "denied" | "reimbursed";
type QueueFilter = "denied_follow_up" | "aged_open" | "stalled_processing" | "follow_up_due" | "unassigned_open";

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
  if (action === "draft") return { title: "Reopen claim for correction", cta: "Reopen claim" };
  if (action === "submitted") return { title: "Submit claim", cta: "Submit claim" };
  if (action === "processing") return { title: "Move to processing", cta: "Mark processing" };
  if (action === "approved") return { title: "Approve claim", cta: "Approve claim" };
  if (action === "denied") return { title: "Deny claim", cta: "Deny claim" };
  return { title: "Record reimbursement", cta: "Mark reimbursed" };
};

const getClaimAgeDays = (claim: InsuranceClaimWithPatient) => {
  const anchor = claim.submitted_at ?? `${claim.claim_date}T00:00:00`;
  const start = new Date(anchor);
  if (Number.isNaN(start.getTime())) return 0;
  const diff = Date.now() - start.getTime();
  return Math.max(0, Math.floor(diff / 86400000));
};

const queueMeta: Record<QueueFilter, { title: string; subtitle: string }> = {
  denied_follow_up: {
    title: "Denied queue",
    subtitle: "Claims waiting for correction, appeal, or resubmission.",
  },
  aged_open: {
    title: "15+ day open claims",
    subtitle: "Claims that are aging beyond the first normal billing window.",
  },
  stalled_processing: {
    title: "Stalled processing",
    subtitle: "Claims sitting in payer processing for more than 7 days.",
  },
  follow_up_due: {
    title: "Follow-up due",
    subtitle: "Claims with a scheduled payer touchpoint that is due now.",
  },
  unassigned_open: {
    title: "Unassigned open",
    subtitle: "Claims with no accountable owner yet.",
  },
};

interface WorkQueueCardProps {
  title: string;
  subtitle: string;
  count: number;
  claims: InsuranceClaimWithPatient[];
  isLoading?: boolean;
  onViewQueue: () => void;
  onOpenFollowUp: (claim: InsuranceClaimWithPatient) => void;
  onOpenAction: (claim: InsuranceClaimWithPatient, action: ClaimAction) => void;
}

const WorkQueueCard = ({
  title,
  subtitle,
  count,
  claims,
  isLoading = false,
  onViewQueue,
  onOpenFollowUp,
  onOpenAction,
}: WorkQueueCardProps) => (
  <section className="rounded-xl border bg-card p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <StatusBadge variant={count > 0 ? "warning" : "default"}>{count}</StatusBadge>
    </div>
    <div className="mt-4 space-y-3">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading queue...</p>
      ) : claims.length === 0 ? (
        <p className="text-sm text-muted-foreground">No claims in this queue.</p>
      ) : (
        claims.map((claim) => (
          <div key={claim.id} className="rounded-lg border border-border/60 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{claim.patients?.full_name ?? "-"}</p>
                <p className="text-xs text-muted-foreground">
                  {claim.provider} - {claim.service}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{getClaimAgeDays(claim)}d</p>
                <p className="text-xs text-muted-foreground">
                  {claim.assigned_profile?.full_name ?? "Unassigned"}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenFollowUp(claim)}>
                Follow up
              </Button>
              {claim.status === "denied" ? (
                <Button variant="ghost" size="sm" onClick={() => onOpenAction(claim, "draft")}>
                  <RefreshCcw className="h-4 w-4" />
                  Reopen
                </Button>
              ) : null}
            </div>
          </div>
        ))
      )}
    </div>
    <Button variant="ghost" size="sm" className="mt-4" onClick={onViewQueue}>
      View queue
    </Button>
  </section>
);

export const InsurancePage = () => {
  const { t, locale, calendarType } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [queueFilter, setQueueFilter] = useState<QueueFilter | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<InsuranceClaimWithPatient | null>(null);
  const [selectedAction, setSelectedAction] = useState<ClaimAction | null>(null);
  const [followUpClaim, setFollowUpClaim] = useState<InsuranceClaimWithPatient | null>(null);
  const [actionSaving, setActionSaving] = useState(false);
  const [followUpSaving, setFollowUpSaving] = useState(false);
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
    filters: {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(queueFilter ? { queue: queueFilter } : {}),
    },
    sort: { column: sort.column, ascending: sort.direction === "asc" },
  }), [page, pageSize, queueFilter, searchTerm, sort.column, sort.direction, statusFilter, user?.tenantId]);

  const { data: listPage, isLoading } = useQuery({
    queryKey: queryKeys.insurance.list(listArgs),
    queryFn: async () => insuranceService.listPagedWithRelations({
      page,
      pageSize,
      search: searchTerm.trim() || undefined,
      filters: {
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(queueFilter ? { queue: queueFilter } : {}),
      },
      sort: { column: sort.column, ascending: sort.direction === "asc" },
    }),
    enabled: !!user?.tenantId,
  });

  useEffect(() => {
    setPage(1);
  }, [queueFilter, statusFilter, searchTerm]);

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

  const { data: operationsSummary = {
    open_claims_count: 0,
    aged_0_7_count: 0,
    aged_8_14_count: 0,
    aged_15_plus_count: 0,
    oldest_open_claim_days: 0,
    denied_follow_up_count: 0,
    follow_up_due_count: 0,
    unassigned_open_count: 0,
    stalled_processing_count: 0,
  } } = useQuery({
    queryKey: queryKeys.insurance.operations(user?.tenantId),
    enabled: !!user?.tenantId,
    queryFn: async () => insuranceService.getOperationsSummary(),
  });

  const { data: assignableOwners = [] } = useQuery({
    queryKey: queryKeys.insurance.owners(user?.tenantId),
    enabled: !!user?.tenantId,
    queryFn: async () => insuranceService.listAssignableOwners(),
  });

  const deniedQueueArgs = useMemo(() => ({
    tenantId: user?.tenantId,
    page: 1,
    pageSize: 5,
    filters: { queue: "denied_follow_up" },
    sort: { column: "updated_at", ascending: false },
  }), [user?.tenantId]);

  const agedQueueArgs = useMemo(() => ({
    tenantId: user?.tenantId,
    page: 1,
    pageSize: 5,
    filters: { queue: "aged_open" },
    sort: { column: "claim_date", ascending: true },
  }), [user?.tenantId]);

  const stalledQueueArgs = useMemo(() => ({
    tenantId: user?.tenantId,
    page: 1,
    pageSize: 5,
    filters: { queue: "stalled_processing" },
    sort: { column: "processing_started_at", ascending: true },
  }), [user?.tenantId]);

  const { data: deniedQueue, isLoading: deniedQueueLoading } = useQuery({
    queryKey: queryKeys.insurance.list(deniedQueueArgs),
    enabled: !!user?.tenantId,
    queryFn: async () => insuranceService.listPagedWithRelations({
      page: 1,
      pageSize: 5,
      filters: { queue: "denied_follow_up" },
      sort: { column: "updated_at", ascending: false },
    }),
  });

  const { data: agedQueue, isLoading: agedQueueLoading } = useQuery({
    queryKey: queryKeys.insurance.list(agedQueueArgs),
    enabled: !!user?.tenantId,
    queryFn: async () => insuranceService.listPagedWithRelations({
      page: 1,
      pageSize: 5,
      filters: { queue: "aged_open" },
      sort: { column: "claim_date", ascending: true },
    }),
  });

  const { data: stalledQueue, isLoading: stalledQueueLoading } = useQuery({
    queryKey: queryKeys.insurance.list(stalledQueueArgs),
    enabled: !!user?.tenantId,
    queryFn: async () => insuranceService.listPagedWithRelations({
      page: 1,
      pageSize: 5,
      filters: { queue: "stalled_processing" },
      sort: { column: "processing_started_at", ascending: true },
    }),
  });

  const claims: InsuranceClaimWithPatient[] = listPage?.data ?? [];
  const totalClaims = listPage?.count ?? 0;
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

  const applyQueue = (nextQueue: QueueFilter | null) => {
    setQueueFilter(nextQueue);
    setStatusFilter(null);
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

  const handleSaveFollowUp = async (input: InsuranceClaimUpdateInput) => {
    if (!followUpClaim) return;

    setFollowUpSaving(true);
    try {
      await insuranceService.update(followUpClaim.id, input);
      toast({ title: "Follow-up saved" });
      setFollowUpClaim(null);
      invalidateClaims();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.error");
      toast({ title: t("common.error"), description: message, variant: "destructive" });
    } finally {
      setFollowUpSaving(false);
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
      key: "age_days",
      header: "Age",
      render: (claim) => <span>{getClaimAgeDays(claim)}d</span>,
    },
    {
      key: "owner",
      header: "Owner",
      render: (claim) => claim.assigned_profile?.full_name ?? <span className="text-muted-foreground">Unassigned</span>,
    },
    {
      key: "next_follow_up_at",
      header: "Next follow-up",
      sortable: true,
      render: (claim) => claim.next_follow_up_at
        ? formatDate(claim.next_follow_up_at, locale, "datetime", calendarType)
        : <span className="text-muted-foreground">-</span>,
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
      header: "Follow-up",
      render: (claim) => {
        const summary = claim.denial_reason ?? claim.payer_notes ?? claim.internal_notes;
        return summary
          ? <span className="block max-w-xs truncate text-sm text-muted-foreground">{summary}</span>
          : <span className="text-muted-foreground">-</span>;
      },
    },
    {
      key: "actions",
      header: t("common.actions"),
      render: (claim) => (
        <div className="flex flex-wrap justify-end gap-2">
          {claim.status !== "reimbursed" ? (
            <Button variant="outline" size="sm" onClick={() => setFollowUpClaim(claim)}>
              Follow up
            </Button>
          ) : null}
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
          {claim.status === "denied" ? (
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => openActionDialog(claim, "draft")}>
              <RefreshCcw className="h-4 w-4" />
              Reopen
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const actionCopy = selectedAction ? getActionCopy(selectedAction) : null;
  const needsPayerReference = selectedAction === "submitted" || selectedAction === "approved" || selectedAction === "reimbursed";
  const needsDenialReason = selectedAction === "denied";

  const queueButtons: Array<{ key: QueueFilter; label: string }> = [
    { key: "denied_follow_up", label: "Denied queue" },
    { key: "aged_open", label: "15+ day open" },
    { key: "stalled_processing", label: "Stalled processing" },
    { key: "follow_up_due", label: "Follow-up due" },
    { key: "unassigned_open", label: "Unassigned open" },
  ];

  return (
    <PageContainer className="space-y-6">
      <SectionHeader
        title={t("insurance.title")}
        actions={(
          <Button onClick={() => setShowModal(true)}><Plus className="h-4 w-4" /> {t("insurance.newClaim")}</Button>
        )}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard title="Draft" value={String(insuranceSummary.draft_count)} icon={Shield} accent="primary" />
        <StatCard title="Submitted" value={String(insuranceSummary.submitted_count)} icon={Send} accent="info" />
        <StatCard title="Processing" value={String(insuranceSummary.processing_count)} icon={TimerReset} accent="warning" />
        <StatCard title="Approved" value={String(insuranceSummary.approved_count)} icon={CheckCircle} accent="success" />
        <StatCard title="Denied" value={String(insuranceSummary.denied_count)} icon={XCircle} accent="destructive" />
        <StatCard title="Reimbursed" value={String(insuranceSummary.reimbursed_count)} icon={Wallet} accent="success" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Open Claims"
          value={String(operationsSummary.open_claims_count)}
          icon={Shield}
          accent="warning"
          subtitle={`${providerCount} active payer${providerCount === 1 ? "" : "s"}`}
        />
        <StatCard title="0-7 Days" value={String(operationsSummary.aged_0_7_count)} icon={TimerReset} accent="success" />
        <StatCard title="8-14 Days" value={String(operationsSummary.aged_8_14_count)} icon={TimerReset} accent="warning" />
        <StatCard title="15+ Days" value={String(operationsSummary.aged_15_plus_count)} icon={Clock3} accent="destructive" />
        <StatCard
          title="Oldest Open"
          value={`${operationsSummary.oldest_open_claim_days}d`}
          icon={Shield}
          accent="destructive"
          subtitle={`Approval rate ${approvalRate}%`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Denied Follow-up" value={String(operationsSummary.denied_follow_up_count)} icon={XCircle} accent="destructive" />
        <StatCard title="Follow-up Due" value={String(operationsSummary.follow_up_due_count)} icon={Clock3} accent="warning" />
        <StatCard title="Unassigned Open" value={String(operationsSummary.unassigned_open_count)} icon={UserRound} accent="info" />
        <StatCard title="Stalled Processing" value={String(operationsSummary.stalled_processing_count)} icon={TimerReset} accent="warning" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <WorkQueueCard
          title={queueMeta.denied_follow_up.title}
          subtitle={queueMeta.denied_follow_up.subtitle}
          count={deniedQueue?.count ?? 0}
          claims={deniedQueue?.data ?? []}
          isLoading={deniedQueueLoading}
          onViewQueue={() => applyQueue("denied_follow_up")}
          onOpenFollowUp={setFollowUpClaim}
          onOpenAction={openActionDialog}
        />
        <WorkQueueCard
          title={queueMeta.aged_open.title}
          subtitle={queueMeta.aged_open.subtitle}
          count={agedQueue?.count ?? 0}
          claims={agedQueue?.data ?? []}
          isLoading={agedQueueLoading}
          onViewQueue={() => applyQueue("aged_open")}
          onOpenFollowUp={setFollowUpClaim}
          onOpenAction={openActionDialog}
        />
        <WorkQueueCard
          title={queueMeta.stalled_processing.title}
          subtitle={queueMeta.stalled_processing.subtitle}
          count={stalledQueue?.count ?? 0}
          claims={stalledQueue?.data ?? []}
          isLoading={stalledQueueLoading}
          onViewQueue={() => applyQueue("stalled_processing")}
          onOpenFollowUp={setFollowUpClaim}
          onOpenAction={openActionDialog}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant={queueFilter === null ? "default" : "outline"} size="sm" onClick={() => applyQueue(null)}>
          All claims
        </Button>
        {queueButtons.map((queue) => (
          <Button
            key={queue.key}
            variant={queueFilter === queue.key ? "default" : "outline"}
            size="sm"
            onClick={() => applyQueue(queue.key)}
          >
            {queue.label}
          </Button>
        ))}
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
        total={totalClaims}
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

      <ClaimFollowUpDialog
        open={!!followUpClaim}
        claim={followUpClaim}
        owners={assignableOwners as InsuranceAssignableOwner[]}
        saving={followUpSaving}
        onClose={() => setFollowUpClaim(null)}
        onSave={handleSaveFollowUp}
      />

      <Dialog open={!!selectedClaim && !!selectedAction} onOpenChange={(next) => !next && closeActionDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{actionCopy?.title ?? "Update claim"}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {selectedClaim ? `${selectedClaim.provider} - ${selectedClaim.patients?.full_name ?? "-"}` : "Update the claim with the payer outcome details."}
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
            {selectedAction === "draft" ? (
              <p className="text-sm text-muted-foreground">
                This reopens the denied claim as a corrected draft so billing can update details and resubmit it.
              </p>
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
