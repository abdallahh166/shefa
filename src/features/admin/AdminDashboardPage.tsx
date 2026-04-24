import { useEffect, useState } from "react";
import { useI18n } from "@/core/i18n/i18nStore";
import { useAuth } from "@/core/auth/authStore";
import { useNavigate } from "react-router-dom";
import { StatCard } from "@/shared/components/StatCard";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { Button } from "@/components/primitives/Button";
import { DataTable, Column } from "@/shared/components/DataTable";
import { StatusFilter } from "@/shared/components/StatusFilter";
import { LanguageSwitcher } from "@/shared/components/LanguageSwitcher";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { PricingPlanDialog } from "@/features/admin/PricingPlanDialog";
import {
  Building2, Users, CreditCard, TrendingUp,
  BarChart3, LogOut, Eye, ChevronRight, Crown, HeartPulse,
  Activity, AlertTriangle, Server, Plus, Pencil, Trash2,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { formatDate } from "@/shared/utils/formatDate";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/primitives/Inputs";
import { adminService } from "@/services/admin/admin.service";
import { adminImpersonationService } from "@/services/admin/adminImpersonation.service";
import { isFreshAuthRequiredError } from "@/services/auth/recentAuth.service";
import { queryKeys } from "@/services/queryKeys";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { requestReauthentication } from "@/features/auth/reauthPrompt";
import type {
  AdminClientErrorTrendPoint,
  AdminPricingPlan,
  AdminRecentJobActivity,
  AdminRecentSystemError,
} from "@/domain/admin/admin.types";

type AdminTab = "overview" | "operations" | "clinics" | "users" | "subscriptions" | "pricing";

const PLAN_OPTIONS = ["free", "starter", "pro", "enterprise"] as const;
const STATUS_OPTIONS = ["active", "trialing", "expired", "canceled"] as const;
const BILLING_CYCLE_OPTIONS = ["monthly", "annual"] as const;

function updatePayloadFromAction(action: { field: "plan" | "status" | "billing_cycle"; value: string }) {
  if (action.field === "plan") {
    return { plan: action.value as "enterprise" | "free" | "pro" | "starter" };
  }
  if (action.field === "billing_cycle") {
    return { billing_cycle: action.value as "monthly" | "annual" };
  }
  return { status: action.value as "active" | "canceled" | "expired" | "trialing" };
}

function formatTrendBucketLabel(bucketStart: string, locale: "en" | "ar") {
  return formatDate(bucketStart, locale, "time");
}

export const AdminDashboardPage = () => {
  const { locale, t } = useI18n();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [clinicFilter, setClinicFilter] = useState<string | null>(null);
  const [subFilter, setSubFilter] = useState<string | null>(null);
  const [clinicPage, setClinicPage] = useState(1);
  const [userPage, setUserPage] = useState(1);
  const [subPage, setSubPage] = useState(1);
  const [clinicSearch, setClinicSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [subSearch, setSubSearch] = useState("");
  const [impersonatingTenantId, setImpersonatingTenantId] = useState<string | null>(null);
  const [clinicSort, setClinicSort] = useState<{ column: "name" | "created_at"; direction: "asc" | "desc" }>({
    column: "created_at",
    direction: "desc",
  });
  const [userSort, setUserSort] = useState<{ column: "full_name" | "created_at"; direction: "asc" | "desc" }>({
    column: "created_at",
    direction: "desc",
  });
  const [subSort, setSubSort] = useState<{
    column: "plan" | "status" | "amount" | "expires_at" | "created_at";
    direction: "asc" | "desc";
  }>({
    column: "created_at",
    direction: "desc",
  });
  const debouncedClinicSearch = useDebouncedValue(clinicSearch, 300);
  const debouncedUserSearch = useDebouncedValue(userSearch, 300);
  const debouncedSubSearch = useDebouncedValue(subSearch, 300);
  const [confirmAction, setConfirmAction] = useState<{ id: string; field: "plan" | "status" | "billing_cycle"; value: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [pricingDialogMode, setPricingDialogMode] = useState<"create" | "edit">("create");
  const [editingPricingPlan, setEditingPricingPlan] = useState<AdminPricingPlan | null>(null);
  const [pricingDeletePlan, setPricingDeletePlan] = useState<AdminPricingPlan | null>(null);
  const [pricingDialogOpen, setPricingDialogOpen] = useState(false);
  const [pricingSaveLoading, setPricingSaveLoading] = useState(false);
  const [pricingDeleteLoading, setPricingDeleteLoading] = useState(false);
  const pageSize = 20;

  useEffect(() => {
    setClinicPage(1);
  }, [debouncedClinicSearch, clinicFilter, clinicSort]);

  useEffect(() => {
    setUserPage(1);
  }, [debouncedUserSearch, userSort]);

  useEffect(() => {
    setSubPage(1);
  }, [debouncedSubSearch, subFilter, subSort]);

  const { data: tenantsResponse, isLoading: loadingTenants } = useQuery({
    queryKey: queryKeys.admin.tenants({
      page: clinicPage,
      pageSize,
      search: debouncedClinicSearch.trim() || undefined,
      plan: clinicFilter ?? undefined,
      sort: clinicSort,
    }),
    queryFn: () =>
      adminService.listTenantsPaged({
        page: clinicPage,
        pageSize,
        search: debouncedClinicSearch.trim() || undefined,
        plan: clinicFilter ?? undefined,
        sort: clinicSort,
      }),
  });

  const { data: profilesResponse, isLoading: loadingProfiles } = useQuery({
    queryKey: queryKeys.admin.profiles({
      page: userPage,
      pageSize,
      search: debouncedUserSearch.trim() || undefined,
      sort: userSort,
    }),
    queryFn: () =>
      adminService.listProfilesWithRolesPaged({
        page: userPage,
        pageSize,
        search: debouncedUserSearch.trim() || undefined,
        sort: userSort,
      }),
  });

  const { data: subscriptionsResponse, isLoading: loadingSubs } = useQuery({
    queryKey: queryKeys.admin.subscriptions({
      page: subPage,
      pageSize,
      search: debouncedSubSearch.trim() || undefined,
      plan: subFilter ?? undefined,
      sort: subSort,
    }),
    queryFn: () =>
      adminService.listSubscriptionsPaged({
        page: subPage,
        pageSize,
        search: debouncedSubSearch.trim() || undefined,
        plan: subFilter ?? undefined,
        sort: subSort,
      }),
  });

  const { data: subscriptionStats } = useQuery({
    queryKey: queryKeys.admin.subscriptionStats(),
    queryFn: () => adminService.getSubscriptionStats(),
  });

  const {
    data: operationsDashboard,
    isLoading: loadingOperationsDashboard,
  } = useQuery({
    queryKey: queryKeys.admin.operationsDashboard(),
    queryFn: () => adminService.getOperationsDashboard(),
    enabled: activeTab === "overview" || activeTab === "operations",
  });

  const { data: pricingPlans = [], isLoading: loadingPricingPlans } = useQuery({
    queryKey: queryKeys.admin.pricingPlans(),
    queryFn: () => adminService.listPricingPlans(),
    enabled: activeTab === "pricing",
  });

  const { data: recentTenantsResponse } = useQuery({
    queryKey: queryKeys.admin.tenants({ page: 1, pageSize: 5 }),
    queryFn: () => adminService.listTenantsPaged({ page: 1, pageSize: 5 }),
  });

  const tenants = tenantsResponse?.data ?? [];
  const profiles = profilesResponse?.data ?? [];
  const subscriptions = subscriptionsResponse?.data ?? [];
  const recentTenants = recentTenantsResponse?.data ?? [];

  const totalClinics = tenantsResponse?.total ?? 0;
  const totalUsers = profilesResponse?.total ?? 0;
  const activeSubs = subscriptionStats?.active_count ?? 0;
  const totalRevenue = subscriptionStats?.total_revenue ?? 0;
  const operationsSummary = operationsDashboard?.summary;
  const operationsSeverityVariant =
    operationsDashboard?.overall_severity === "critical"
      ? "destructive"
      : operationsDashboard?.overall_severity === "warning"
        ? "warning"
        : "success";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const requestFreshAuth = async () => {
    await requestReauthentication({
      title: t("auth.reauthTitle"),
      description: t("auth.reauthAdminActionDesc"),
      actionLabel: t("auth.reauthAction"),
      cancelLabel: t("common.cancel"),
    });
  };

  const handleImpersonateTenant = async (
    tenant: { id: string; slug: string; name: string },
    allowRetry = true,
  ) => {
    setImpersonatingTenantId(tenant.id);
    try {
      await adminImpersonationService.start(tenant);
      toast({
        title: "Impersonation started",
        description: `You are now viewing ${tenant.name} as a super admin.`,
      });
      navigate(`/tenant/${tenant.slug}/dashboard`);
    } catch (err: any) {
      if (allowRetry && isFreshAuthRequiredError(err)) {
        try {
          await requestFreshAuth();
          await handleImpersonateTenant(tenant, false);
        } catch {
          return;
        }
        return;
      }
      toast({
        title: "Unable to open clinic",
        description: err?.message || "Failed to start impersonation",
        variant: "destructive",
      });
    } finally {
      setImpersonatingTenantId(null);
    }
  };

  const handleSubUpdate = async () => {
    if (!confirmAction) return;
    const action = confirmAction;
    setActionLoading(true);
    try {
      const updatePayload = updatePayloadFromAction(action);
      await adminService.updateSubscription(action.id, updatePayload);
      toast({ title: "Updated", description: `Subscription ${action.field} changed to ${action.value}` });
      queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.subscriptionStats() });
    } catch (err: any) {
      if (isFreshAuthRequiredError(err)) {
        try {
          await requestFreshAuth();
          await adminService.updateSubscription(action.id, updatePayloadFromAction(action));
          toast({ title: "Updated", description: `Subscription ${action.field} changed to ${action.value}` });
          queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
          queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
          queryClient.invalidateQueries({ queryKey: queryKeys.admin.subscriptionStats() });
        } catch {
          return;
        }
        return;
      }
      toast({ title: "Error", description: err?.message || "Failed to update", variant: "destructive" });
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };

  const availablePlanCodes = PLAN_OPTIONS.filter(
    (planCode) => !pricingPlans.some((plan) => plan.plan_code === planCode),
  );

  const openCreatePricingPlan = () => {
    setPricingDialogMode("create");
    setEditingPricingPlan(null);
    setPricingDialogOpen(true);
  };

  const openEditPricingPlan = (plan: AdminPricingPlan) => {
    setPricingDialogMode("edit");
    setEditingPricingPlan(plan);
    setPricingDialogOpen(true);
  };

  const handlePricingPlanSubmit = async (input: any) => {
    setPricingSaveLoading(true);
    try {
      if (pricingDialogMode === "create") {
        await adminService.createPricingPlan(input);
        toast({ title: "Pricing plan created", description: "The new plan is now available to the platform." });
      } else if (editingPricingPlan) {
        await adminService.updatePricingPlan(editingPricingPlan.id, input);
        toast({
          title: "Pricing updated",
          description: "Tenant-facing pricing and billing defaults have been refreshed.",
        });
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.pricingPlans() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.pricing.public() }),
        queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.subscriptionStats() }),
      ]);

      setPricingDialogOpen(false);
      setEditingPricingPlan(null);
    } catch (err: any) {
      if (isFreshAuthRequiredError(err)) {
        try {
          await requestFreshAuth();
          if (pricingDialogMode === "create") {
            await adminService.createPricingPlan(input);
          } else if (editingPricingPlan) {
            await adminService.updatePricingPlan(editingPricingPlan.id, input);
          }

          await Promise.all([
            queryClient.invalidateQueries({ queryKey: queryKeys.admin.pricingPlans() }),
            queryClient.invalidateQueries({ queryKey: queryKeys.pricing.public() }),
            queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] }),
            queryClient.invalidateQueries({ queryKey: queryKeys.admin.subscriptionStats() }),
          ]);

          toast({ title: "Pricing updated", description: "The pricing catalog changes were saved successfully." });
          setPricingDialogOpen(false);
          setEditingPricingPlan(null);
        } catch {
          return;
        }
        return;
      }

      toast({
        title: "Unable to save pricing plan",
        description: err?.message || "The pricing plan could not be saved.",
        variant: "destructive",
      });
    } finally {
      setPricingSaveLoading(false);
    }
  };

  const handleDeletePricingPlan = async () => {
    if (!pricingDeletePlan) return;

    setPricingDeleteLoading(true);
    try {
      await adminService.deletePricingPlan(pricingDeletePlan.id);
      toast({
        title: "Pricing plan deleted",
        description: `${pricingDeletePlan.name} was removed from the catalog.`,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.pricingPlans() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.pricing.public() }),
      ]);
      setPricingDeletePlan(null);
    } catch (err: any) {
      if (isFreshAuthRequiredError(err)) {
        try {
          await requestFreshAuth();
          await adminService.deletePricingPlan(pricingDeletePlan.id);
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: queryKeys.admin.pricingPlans() }),
            queryClient.invalidateQueries({ queryKey: queryKeys.pricing.public() }),
          ]);
          toast({
            title: "Pricing plan deleted",
            description: `${pricingDeletePlan.name} was removed from the catalog.`,
          });
          setPricingDeletePlan(null);
        } catch {
          return;
        }
        return;
      }

      toast({
        title: "Unable to delete pricing plan",
        description: err?.message || "This plan may still be assigned to active tenants.",
        variant: "destructive",
      });
    } finally {
      setPricingDeleteLoading(false);
    }
  };

  const tabs: { key: AdminTab; icon: any; label: string }[] = [
    { key: "overview", icon: BarChart3, label: "Overview" },
    { key: "operations", icon: Server, label: "Operations" },
    { key: "clinics", icon: Building2, label: "Clinics" },
    { key: "users", icon: Users, label: "Users" },
    { key: "subscriptions", icon: CreditCard, label: "Subscriptions" },
    { key: "pricing", icon: TrendingUp, label: "Pricing" },
  ];

  const clinicColumns: Column<any>[] = [
    { key: "name", header: "Clinic Name", searchable: true, sortable: true, render: (c) => (
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">{c.name?.charAt(0)}</div>
        <div>
          <p className="font-medium">{c.name}</p>
          <p className="text-xs text-muted-foreground">{c.slug}</p>
        </div>
      </div>
    )},
    { key: "email", header: "Email", searchable: true, render: (c) => c.email || "-" },
    { key: "phone", header: "Phone", render: (c) => c.phone || "-" },
    {
      key: "plan",
      header: "Plan",
      render: (c) => {
        const plan = c.plan ?? "free";
        const variant = plan === "pro" ? "success" : plan === "enterprise" ? "info" : "default";
        return <StatusBadge variant={variant as any}>{plan}</StatusBadge>;
      },
    },
    { key: "created_at", header: "Created", sortable: true, render: (c) => formatDate(c.created_at, locale, "date") },
    { key: "actions", header: "", render: (c) => (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="View clinic"
          title="View clinic"
          disabled={impersonatingTenantId === c.id}
          onClick={() => void handleImpersonateTenant({ id: c.id, slug: c.slug, name: c.name })}
        >
          <Eye className="h-4 w-4" />
        </Button>
    )},
  ];

  const recentClinicColumns: Column<any>[] = [
    {
      key: "name",
      header: "Clinic",
      render: (t) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">{t.name?.charAt(0)}</div>
          <div>
            <p className="font-medium">{t.name}</p>
            <p className="text-xs text-muted-foreground">{t.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: "plan",
      header: "Plan",
      render: (t) => {
        const plan = t.plan ?? "free";
        const variant = plan === "pro" ? "success" : plan === "enterprise" ? "info" : "default";
        return <StatusBadge variant={variant as any}>{plan}</StatusBadge>;
      },
    },
    {
      key: "created_at",
      header: "Created",
      render: (t) => <span className="text-muted-foreground">{formatDate(t.created_at, locale, "date")}</span>,
    },
  ];

  const userColumns: Column<any>[] = [
    { key: "full_name", header: "Name", searchable: true, sortable: true, render: (p) => (
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
          {p.full_name?.charAt(0) || "U"}
        </div>
        <span className="font-medium">{p.full_name}</span>
      </div>
    )},
    { key: "role", header: "Role", render: (p) => {
      const role = (p.user_roles as any)?.[0]?.role || "-";
      const variant = role === "clinic_admin" ? "info" : role === "super_admin" ? "destructive" : "default";
      return <StatusBadge variant={variant as any}>{role.replace("_", " ")}</StatusBadge>;
    }},
    { key: "tenant_id", header: "Clinic", render: (p) => p.tenants?.name || "-" },
    { key: "created_at", header: "Joined", sortable: true, render: (p) => formatDate(p.created_at, locale, "date") },
  ];

  const subColumns: Column<any>[] = [
    { key: "tenant", header: "Clinic", searchable: true, render: (s) => (
      <div className="flex items-center gap-3">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="font-medium">{(s.tenants as any)?.name || "-"}</p>
          <p className="text-xs text-muted-foreground">{(s.tenants as any)?.slug || ""}</p>
        </div>
      </div>
    )},
    { key: "plan", header: "Plan", sortable: true, render: (s) => (
      <Select
        value={s.plan}
        onValueChange={(val) => setConfirmAction({ id: s.id, field: "plan", value: val })}
      >
        <SelectTrigger size="sm" className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PLAN_OPTIONS.map((p) => (
            <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )},
    { key: "amount", header: "Amount", sortable: true, render: (s) => s.amount > 0 ? `${s.currency} ${Number(s.amount).toLocaleString()}` : "Free" },
    { key: "billing_cycle", header: "Cycle", render: (s) => (
      <Select
        value={s.billing_cycle}
        onValueChange={(val) => setConfirmAction({ id: s.id, field: "billing_cycle", value: val })}
      >
        <SelectTrigger size="sm" className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {BILLING_CYCLE_OPTIONS.map((cycle) => (
            <SelectItem key={cycle} value={cycle}>{cycle.charAt(0).toUpperCase() + cycle.slice(1)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )},
    { key: "status", header: "Status", sortable: true, render: (s) => (
      <Select
        value={s.status}
        onValueChange={(val) => setConfirmAction({ id: s.id, field: "status", value: val })}
      >
        <SelectTrigger size="sm" className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((st) => (
            <SelectItem key={st} value={st}>{st.charAt(0).toUpperCase() + st.slice(1)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )},
    { key: "expires_at", header: "Expires", sortable: true, render: (s) => s.expires_at ? formatDate(s.expires_at, locale, "date") : "-" },
  ];

  const jobActivityColumns: Column<AdminRecentJobActivity>[] = [
    {
      key: "type",
      header: "Job",
      render: (job) => (
        <div>
          <p className="font-medium">{job.type}</p>
          <p className="text-xs text-muted-foreground">{job.tenant_name || "Unknown tenant"}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (job) => (
        <StatusBadge
          variant={
            job.status === "dead_letter"
              ? "destructive"
              : job.status === "failed"
                ? "warning"
                : "info"
          }
        >
          {job.status}
        </StatusBadge>
      ),
    },
    {
      key: "attempts",
      header: "Attempts",
      render: (job) => `${job.attempts}/${job.max_attempts}`,
    },
    {
      key: "last_error",
      header: "Last Error",
      render: (job) => (
        <span className="line-clamp-2 max-w-[320px] text-sm text-muted-foreground">
          {job.last_error || "No error message"}
        </span>
      ),
    },
    {
      key: "updated_at",
      header: "Updated",
      render: (job) => formatDate(job.updated_at, locale, "datetime"),
    },
  ];

  const systemErrorColumns: Column<AdminRecentSystemError>[] = [
    {
      key: "service",
      header: "Service",
      render: (log) => (
        <div>
          <p className="font-medium">{log.service}</p>
          <p className="text-xs text-muted-foreground">{log.tenant_name || "Platform-wide"}</p>
        </div>
      ),
    },
    {
      key: "level",
      header: "Level",
      render: (log) => (
        <StatusBadge variant={log.level === "error" ? "destructive" : "warning"}>
          {log.level}
        </StatusBadge>
      ),
    },
    {
      key: "message",
      header: "Message",
      render: (log) => (
        <span className="line-clamp-2 max-w-[360px] text-sm text-muted-foreground">
          {log.message}
        </span>
      ),
    },
    {
      key: "created_at",
      header: "Created",
      render: (log) => formatDate(log.created_at, locale, "datetime"),
    },
  ];

  const planCounts = subscriptionStats?.plan_counts ?? {};
  const totalPlanCount = PLAN_OPTIONS.reduce((sum, plan) => sum + Number((planCounts as any)[plan] ?? 0), 0);

  const planBreakdown = PLAN_OPTIONS.map((plan) => {
    const count = Number((planCounts as any)[plan] ?? 0);
    const pct = totalPlanCount ? Math.round((count / totalPlanCount) * 100) : 0;
    const variant = plan === "pro" ? "success" : plan === "enterprise" ? "info" : plan === "starter" ? "warning" : "default";
    return { plan, count, pct, variant };
  });

  const trendPoints = operationsDashboard?.client_error_trend ?? [];
  const trendMax = trendPoints.reduce((max, point) => Math.max(max, point.error_count), 0);

  return (
    <div className="min-h-screen bg-background" dir={locale === "ar" ? "rtl" : "ltr"}>
      {/* Top Nav */}
      <nav className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
              <HeartPulse className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-foreground">MedFlow Admin</h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Crown className="h-3 w-3" /> Super Admin</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted">
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                {user?.name?.charAt(0) || "A"}
              </div>
              <span className="text-sm font-medium">{user?.name}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Log out" title="Log out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        {/* Tabs */}
        <div className="border-b flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <Button
              key={tab.key}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab(tab.key)}
              aria-pressed={activeTab === tab.key}
              className={cn(
                "h-auto rounded-none flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Overview */}
        {activeTab === "overview" && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Total Clinics" value={String(totalClinics)} icon={Building2} accent="primary" />
              <StatCard title="Total Users" value={String(totalUsers)} icon={Users} accent="info" />
              <StatCard title="Active Subscriptions" value={String(activeSubs)} icon={CreditCard} accent="success" />
              <StatCard title="Monthly Revenue" value={`EGP ${totalRevenue.toLocaleString()}`} icon={TrendingUp} accent="warning" />
            </div>

            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">Operations Alerts</h3>
                    <StatusBadge variant={operationsSeverityVariant as "success" | "warning" | "destructive"}>
                      {operationsDashboard?.overall_severity ?? "healthy"}
                    </StatusBadge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Job backlog, worker failures, edge-function failures, and recent client-side error spikes.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Alert window: last 15 minutes
                </p>
              </div>

              {loadingOperationsDashboard ? (
                <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                  Loading operations telemetry...
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <StatCard
                      title="Pending Jobs"
                      value={String(operationsSummary?.pending_jobs_count ?? 0)}
                      icon={Activity}
                      accent={(operationsSummary?.pending_jobs_count ?? 0) >= 20 ? "warning" : "info"}
                      subtitle={`${operationsSummary?.processing_jobs_count ?? 0} processing`}
                    />
                    <StatCard
                      title="Retrying Jobs"
                      value={String(operationsSummary?.retrying_jobs_count ?? 0)}
                      icon={AlertTriangle}
                      accent={(operationsSummary?.retrying_jobs_count ?? 0) > 0 ? "warning" : "success"}
                      subtitle={`${operationsSummary?.recent_job_failures_count ?? 0} worker failures in 15m`}
                    />
                    <StatCard
                      title="Dead Letters"
                      value={String(operationsSummary?.dead_letter_jobs_count ?? 0)}
                      icon={Server}
                      accent={(operationsSummary?.dead_letter_jobs_count ?? 0) > 0 ? "destructive" : "success"}
                      subtitle={`${operationsSummary?.stale_processing_jobs_count ?? 0} stuck processing`}
                    />
                    <StatCard
                      title="Edge Failures"
                      value={String(operationsSummary?.recent_edge_failures_count ?? 0)}
                      icon={BarChart3}
                      accent={(operationsSummary?.recent_edge_failures_count ?? 0) > 0 ? "destructive" : "success"}
                      subtitle={`${operationsSummary?.recent_client_errors_count ?? 0} client errors in 15m`}
                    />
                  </div>

                  <div className="rounded-xl border bg-muted/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-sm font-medium">Active Signals</h4>
                      {operationsDashboard?.active_alerts.length ? (
                        <span className="text-xs text-muted-foreground">
                          {operationsDashboard.active_alerts.length} active
                        </span>
                      ) : null}
                    </div>

                    {operationsDashboard?.active_alerts.length ? (
                      <div className="mt-3 space-y-3">
                        {operationsDashboard.active_alerts.map((alert) => (
                          <div key={alert.key} className="flex flex-col gap-2 rounded-lg border bg-background p-3 md:flex-row md:items-start md:justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{alert.title}</span>
                                <StatusBadge
                                  variant={
                                    alert.severity === "critical"
                                      ? "destructive"
                                      : alert.severity === "warning"
                                        ? "warning"
                                        : "success"
                                  }
                                  dot
                                >
                                  {alert.severity}
                                </StatusBadge>
                              </div>
                              <p className="text-sm text-muted-foreground">{alert.description}</p>
                            </div>
                            <div className="text-sm font-semibold">{alert.count}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">
                        No active production alerts right now. The queue and edge functions are currently healthy.
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Recent clinics */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Recent Clinics</h3>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab("clinics")}>
                  View All <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <DataTable
                columns={recentClinicColumns}
                data={recentTenants}
                keyExtractor={(t) => t.id}
                emptyMessage="No clinics yet"
                tableLabel="Recent clinics"
                onRowClick={(t) => void handleImpersonateTenant({ id: t.id, slug: t.slug, name: t.name })}
              />
            </div>

            {/* Subscription breakdown - all 4 plans */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {planBreakdown.map(({ plan, count, pct, variant }) => (
                <div key={plan} className="bg-card rounded-xl border p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium capitalize">{plan} Plan</span>
                    <StatusBadge variant={variant as any}>{count}</StatusBadge>
                  </div>
                  <div className="h-2 bg-muted rounded-full">
                    <div className="h-2 bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{pct}% of total</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "operations" && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard
                title="Pending Jobs"
                value={String(operationsSummary?.pending_jobs_count ?? 0)}
                icon={Activity}
                accent={(operationsSummary?.pending_jobs_count ?? 0) >= 20 ? "warning" : "info"}
                subtitle={`${operationsSummary?.processing_jobs_count ?? 0} processing`}
              />
              <StatCard
                title="Retrying Jobs"
                value={String(operationsSummary?.retrying_jobs_count ?? 0)}
                icon={AlertTriangle}
                accent={(operationsSummary?.retrying_jobs_count ?? 0) > 0 ? "warning" : "success"}
                subtitle={`${operationsSummary?.recent_job_failures_count ?? 0} worker failures in 15m`}
              />
              <StatCard
                title="Recent Edge Failures"
                value={String(operationsSummary?.recent_edge_failures_count ?? 0)}
                icon={Server}
                accent={(operationsSummary?.recent_edge_failures_count ?? 0) > 0 ? "destructive" : "success"}
                subtitle={operationsSummary?.last_edge_failure_at ? formatDate(operationsSummary.last_edge_failure_at, locale, "datetime") : "No recent failures"}
              />
              <StatCard
                title="Recent Client Errors"
                value={String(operationsSummary?.recent_client_errors_count ?? 0)}
                icon={BarChart3}
                accent={(operationsSummary?.recent_client_errors_count ?? 0) >= 5 ? "warning" : "info"}
                subtitle={operationsSummary?.last_client_error_at ? formatDate(operationsSummary.last_client_error_at, locale, "datetime") : "No recent client errors"}
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 rounded-2xl border bg-card p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">Recent Job Failures</h3>
                    <p className="text-sm text-muted-foreground">
                      Latest retrying, failed, and dead-letter jobs across all tenants.
                    </p>
                  </div>
                  <StatusBadge variant={operationsSeverityVariant as "success" | "warning" | "destructive"}>
                    {operationsDashboard?.overall_severity ?? "healthy"}
                  </StatusBadge>
                </div>

                <DataTable
                  columns={jobActivityColumns}
                  data={operationsDashboard?.recent_job_activity ?? []}
                  keyExtractor={(job) => job.id}
                  emptyMessage="No recent job failures or retries."
                  tableLabel="Recent job failures"
                />
              </div>

              <div className="rounded-2xl border bg-card p-5 space-y-4">
                <div>
                  <h3 className="font-semibold">Client Error Trend</h3>
                  <p className="text-sm text-muted-foreground">
                    Browser-side error volume across the last six 15-minute buckets.
                  </p>
                </div>

                <div className="space-y-3">
                  {trendPoints.length ? (
                    trendPoints.map((point: AdminClientErrorTrendPoint) => {
                      const width = trendMax > 0 ? Math.max(8, Math.round((point.error_count / trendMax) * 100)) : 8;
                      return (
                        <div key={point.bucket_start} className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{formatTrendBucketLabel(point.bucket_start, locale)}</span>
                            <span>{point.error_count} errors / {point.affected_tenants_count} tenants</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full bg-primary transition-all"
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">No client error trend data available yet.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <div>
                <h3 className="font-semibold">Recent System Errors</h3>
                <p className="text-sm text-muted-foreground">
                  Latest warning and error logs captured by workers and edge functions.
                </p>
              </div>

              <DataTable
                columns={systemErrorColumns}
                data={operationsDashboard?.recent_system_errors ?? []}
                keyExtractor={(log) => log.id}
                emptyMessage="No recent system errors."
                tableLabel="Recent system errors"
              />
            </div>
          </div>
        )}

        {/* Clinics Tab */}
        {activeTab === "clinics" && (
          <div className="animate-fade-in">
            <DataTable
              columns={clinicColumns}
              data={tenants}
              keyExtractor={(c) => c.id}
              searchable
              serverSearch
              searchValue={clinicSearch}
              onSearchChange={setClinicSearch}
              isLoading={loadingTenants}
              exportFileName="clinics"
              page={clinicPage}
              pageSize={pageSize}
              total={tenantsResponse?.total}
              onPageChange={setClinicPage}
              sortColumn={clinicSort.column}
              sortDirection={clinicSort.direction}
              onSortChange={(column, direction) => setClinicSort({ column: column as "name" | "created_at", direction })}
              filterSlot={
                <StatusFilter
                  options={PLAN_OPTIONS.map((p) => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))}
                  selected={clinicFilter}
                  onChange={setClinicFilter}
                />
              }
            />
          </div>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <div className="animate-fade-in">
            <DataTable
              columns={userColumns}
              data={profiles}
              keyExtractor={(p) => p.id}
              searchable
              serverSearch
              searchValue={userSearch}
              onSearchChange={setUserSearch}
              isLoading={loadingProfiles}
              exportFileName="users"
              page={userPage}
              pageSize={pageSize}
              total={profilesResponse?.total}
              onPageChange={setUserPage}
              sortColumn={userSort.column}
              sortDirection={userSort.direction}
              onSortChange={(column, direction) => setUserSort({ column: column as "full_name" | "created_at", direction })}
            />
          </div>
        )}

        {/* Subscriptions Tab */}
        {activeTab === "subscriptions" && (
          <div className="animate-fade-in">
            <DataTable
              columns={subColumns}
              data={subscriptions}
              keyExtractor={(s) => s.id}
              searchable
              serverSearch
              searchValue={subSearch}
              onSearchChange={setSubSearch}
              isLoading={loadingSubs}
              exportFileName="subscriptions"
              page={subPage}
              pageSize={pageSize}
              total={subscriptionsResponse?.total}
              onPageChange={setSubPage}
              sortColumn={subSort.column}
              sortDirection={subSort.direction}
              onSortChange={(column, direction) => setSubSort({ column: column as typeof subSort.column, direction })}
              filterSlot={
                <StatusFilter
                  options={PLAN_OPTIONS.map((p) => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))}
                  selected={subFilter}
                  onChange={setSubFilter}
                />
              }
            />
          </div>
        )}

        {activeTab === "pricing" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <h3 className="font-semibold">Pricing Catalog</h3>
                <p className="text-sm text-muted-foreground">
                  Manage the public SaaS plans, billing defaults, and the catalog that subscriptions map to.
                </p>
              </div>
              <Button
                onClick={openCreatePricingPlan}
                disabled={availablePlanCodes.length === 0}
                className="shrink-0"
              >
                <Plus className="h-4 w-4" />
                Create plan
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Catalog Plans"
                value={String(pricingPlans.length)}
                icon={CreditCard}
                accent="info"
                subtitle={`${pricingPlans.filter((plan) => plan.is_public).length} public`}
              />
              <StatCard
                title="Popular Plans"
                value={String(pricingPlans.filter((plan) => plan.is_popular).length)}
                icon={TrendingUp}
                accent="warning"
                subtitle="Highlighted in public pricing"
              />
              <StatCard
                title="Enterprise CTA"
                value={String(pricingPlans.filter((plan) => plan.is_enterprise_contact).length)}
                icon={Crown}
                accent="success"
                subtitle="Contact-sales plan cards"
              />
              <StatCard
                title="Missing Slots"
                value={String(availablePlanCodes.length)}
                icon={AlertTriangle}
                accent={availablePlanCodes.length > 0 ? "warning" : "success"}
                subtitle={availablePlanCodes.length > 0 ? "Canonical plan code available" : "Catalog complete"}
              />
            </div>

            {loadingPricingPlans ? (
              <div className="rounded-2xl border border-dashed bg-card p-6 text-sm text-muted-foreground">
                Loading pricing catalog...
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {pricingPlans.map((plan) => (
                  <div key={plan.id} className="rounded-2xl border bg-card p-5 space-y-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{plan.name}</h3>
                          <StatusBadge variant="default">{plan.plan_code}</StatusBadge>
                          {plan.is_popular ? <StatusBadge variant="warning">popular</StatusBadge> : null}
                          {!plan.is_public ? <StatusBadge variant="destructive">hidden</StatusBadge> : null}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {plan.description || "No description configured for the public pricing page yet."}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditPricingPlan(plan)}>
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setPricingDeletePlan(plan)}>
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2">
                      <div>
                        <div className="text-xs text-muted-foreground">Monthly</div>
                        <div className="font-medium">{plan.currency} {Number(plan.monthly_price).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Annual</div>
                        <div className="font-medium">{plan.currency} {Number(plan.annual_price).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Default cycle</div>
                        <div className="font-medium capitalize">{plan.default_billing_cycle}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Doctor limit label</div>
                        <div className="font-medium">{plan.doctor_limit_label}</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium">Features</h4>
                        <span className="text-xs text-muted-foreground">
                          order {plan.display_order} • {plan.features.length} items
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {plan.features.map((feature) => (
                          <span key={feature} className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                {pricingPlans.length === 0 ? (
                  <div className="rounded-2xl border border-dashed bg-card p-6 text-sm text-muted-foreground">
                    No pricing plans are configured yet.
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirm dialog for subscription changes */}
      <ConfirmDialog
        open={!!confirmAction}
        title="Confirm Subscription Change"
        message={`Are you sure you want to change ${confirmAction?.field} to "${confirmAction?.value}"?`}
        confirmLabel="Update"
        cancelLabel="Cancel"
        variant="warning"
        loading={actionLoading}
        onConfirm={handleSubUpdate}
        onCancel={() => setConfirmAction(null)}
      />

      <PricingPlanDialog
        open={pricingDialogOpen}
        mode={pricingDialogMode}
        plan={editingPricingPlan}
        availablePlanCodes={availablePlanCodes}
        saving={pricingSaveLoading}
        onClose={() => {
          setPricingDialogOpen(false);
          setEditingPricingPlan(null);
        }}
        onSubmit={handlePricingPlanSubmit}
      />

      <ConfirmDialog
        open={!!pricingDeletePlan}
        title="Delete Pricing Plan"
        message={`Delete "${pricingDeletePlan?.name}" from the catalog? This will fail if tenants still depend on the plan.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={pricingDeleteLoading}
        onConfirm={handleDeletePricingPlan}
        onCancel={() => setPricingDeletePlan(null)}
      />
    </div>
  );
};


