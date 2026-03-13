import { useEffect, useState } from "react";
import { useI18n } from "@/core/i18n/i18nStore";
import { useAuth } from "@/core/auth/authStore";
import { useNavigate } from "react-router-dom";
import { StatCard } from "@/shared/components/StatCard";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { DataTable, Column } from "@/shared/components/DataTable";
import { StatusFilter } from "@/shared/components/StatusFilter";
import { LanguageSwitcher } from "@/shared/components/LanguageSwitcher";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import {
  Building2, Users, CreditCard, TrendingUp,
  BarChart3, LogOut, Eye, ChevronRight, Crown, HeartPulse,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { formatDate } from "@/shared/utils/formatDate";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminService } from "@/services/admin/admin.service";
import { queryKeys } from "@/services/queryKeys";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";

type AdminTab = "overview" | "clinics" | "users" | "subscriptions";

const PLAN_OPTIONS = ["free", "starter", "pro", "enterprise"] as const;
const STATUS_OPTIONS = ["active", "trialing", "expired", "canceled"] as const;

export const AdminDashboardPage = () => {
  const { locale } = useI18n();
  const { user, logout, setTenantOverride } = useAuth();
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
  const debouncedClinicSearch = useDebouncedValue(clinicSearch, 300);
  const debouncedUserSearch = useDebouncedValue(userSearch, 300);
  const debouncedSubSearch = useDebouncedValue(subSearch, 300);
  const [confirmAction, setConfirmAction] = useState<{ id: string; field: "plan" | "status"; value: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const pageSize = 20;

  useEffect(() => {
    setClinicPage(1);
  }, [debouncedClinicSearch, clinicFilter]);

  useEffect(() => {
    setUserPage(1);
  }, [debouncedUserSearch]);

  useEffect(() => {
    setSubPage(1);
  }, [debouncedSubSearch, subFilter]);

  const { data: tenantsResponse, isLoading: loadingTenants } = useQuery({
    queryKey: queryKeys.admin.tenants({
      page: clinicPage,
      pageSize,
      search: debouncedClinicSearch.trim() || undefined,
      plan: clinicFilter ?? undefined,
    }),
    queryFn: () =>
      adminService.listTenantsPaged({
        page: clinicPage,
        pageSize,
        search: debouncedClinicSearch.trim() || undefined,
        plan: clinicFilter ?? undefined,
      }),
  });

  const { data: profilesResponse, isLoading: loadingProfiles } = useQuery({
    queryKey: queryKeys.admin.profiles({
      page: userPage,
      pageSize,
      search: debouncedUserSearch.trim() || undefined,
    }),
    queryFn: () =>
      adminService.listProfilesWithRolesPaged({
        page: userPage,
        pageSize,
        search: debouncedUserSearch.trim() || undefined,
      }),
  });

  const { data: subscriptionsResponse, isLoading: loadingSubs } = useQuery({
    queryKey: queryKeys.admin.subscriptions({
      page: subPage,
      pageSize,
      search: debouncedSubSearch.trim() || undefined,
      plan: subFilter ?? undefined,
    }),
    queryFn: () =>
      adminService.listSubscriptionsPaged({
        page: subPage,
        pageSize,
        search: debouncedSubSearch.trim() || undefined,
        plan: subFilter ?? undefined,
      }),
  });

  const { data: subscriptionStats } = useQuery({
    queryKey: queryKeys.admin.subscriptionStats(),
    queryFn: () => adminService.getSubscriptionStats(),
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

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleSubUpdate = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      const updatePayload =
        confirmAction.field === "plan"
          ? { plan: confirmAction.value as "enterprise" | "free" | "pro" | "starter" }
          : { status: confirmAction.value as "active" | "canceled" | "expired" | "trialing" };
      await adminService.updateSubscription(confirmAction.id, updatePayload);
      toast({ title: "Updated", description: `Subscription ${confirmAction.field} changed to ${confirmAction.value}` });
      queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.subscriptionStats() });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to update", variant: "destructive" });
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };

  const tabs: { key: AdminTab; icon: any; label: string }[] = [
    { key: "overview", icon: BarChart3, label: "Overview" },
    { key: "clinics", icon: Building2, label: "Clinics" },
    { key: "users", icon: Users, label: "Users" },
    { key: "subscriptions", icon: CreditCard, label: "Subscriptions" },
  ];

  const clinicColumns: Column<any>[] = [
    { key: "name", header: "Clinic Name", searchable: true, render: (c) => (
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">{c.name?.charAt(0)}</div>
        <div>
          <p className="font-medium">{c.name}</p>
          <p className="text-xs text-muted-foreground">{c.slug}</p>
        </div>
      </div>
    )},
    { key: "email", header: "Email", searchable: true, render: (c) => c.email || "—" },
    { key: "phone", header: "Phone", render: (c) => c.phone || "—" },
    {
      key: "plan",
      header: "Plan",
      render: (c) => {
        const plan = c.plan ?? "free";
        const variant = plan === "pro" ? "success" : plan === "enterprise" ? "info" : "default";
        return <StatusBadge variant={variant as any}>{plan}</StatusBadge>;
      },
    },
    { key: "created_at", header: "Created", render: (c) => formatDate(c.created_at, locale, "date") },
    { key: "actions", header: "", render: (c) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setTenantOverride({ id: c.id, slug: c.slug, name: c.name });
          navigate(`/tenant/${c.slug}/dashboard`);
        }}
      >
        <Eye className="h-4 w-4" />
      </Button>
    )},
  ];

  const userColumns: Column<any>[] = [
    { key: "full_name", header: "Name", searchable: true, render: (p) => (
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
          {p.full_name?.charAt(0) || "U"}
        </div>
        <span className="font-medium">{p.full_name}</span>
      </div>
    )},
    { key: "role", header: "Role", render: (p) => {
      const role = (p.user_roles as any)?.[0]?.role || "—";
      const variant = role === "clinic_admin" ? "info" : role === "super_admin" ? "destructive" : "default";
      return <StatusBadge variant={variant as any}>{role.replace("_", " ")}</StatusBadge>;
    }},
    { key: "tenant_id", header: "Clinic", render: (p) => p.tenants?.name || "—" },
    { key: "created_at", header: "Joined", render: (p) => formatDate(p.created_at, locale, "date") },
  ];

  const subColumns: Column<any>[] = [
    { key: "tenant", header: "Clinic", searchable: true, render: (s) => (
      <div className="flex items-center gap-3">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="font-medium">{(s.tenants as any)?.name || "—"}</p>
          <p className="text-xs text-muted-foreground">{(s.tenants as any)?.slug || ""}</p>
        </div>
      </div>
    )},
    { key: "plan", header: "Plan", render: (s) => (
      <Select
        value={s.plan}
        onValueChange={(val) => setConfirmAction({ id: s.id, field: "plan", value: val })}
      >
        <SelectTrigger className="h-8 w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PLAN_OPTIONS.map((p) => (
            <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )},
    { key: "amount", header: "Amount", render: (s) => s.amount > 0 ? `${s.currency} ${Number(s.amount).toLocaleString()}` : "Free" },
    { key: "billing_cycle", header: "Cycle", render: (s) => s.billing_cycle },
    { key: "status", header: "Status", render: (s) => (
      <Select
        value={s.status}
        onValueChange={(val) => setConfirmAction({ id: s.id, field: "status", value: val })}
      >
        <SelectTrigger className="h-8 w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((st) => (
            <SelectItem key={st} value={st}>{st.charAt(0).toUpperCase() + st.slice(1)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )},
    { key: "expires_at", header: "Expires", render: (s) => s.expires_at ? formatDate(s.expires_at, locale, "date") : "—" },
  ];

  const planCounts = subscriptionStats?.plan_counts ?? {};
  const totalPlanCount = PLAN_OPTIONS.reduce((sum, plan) => sum + Number((planCounts as any)[plan] ?? 0), 0);

  const planBreakdown = PLAN_OPTIONS.map((plan) => {
    const count = Number((planCounts as any)[plan] ?? 0);
    const pct = totalPlanCount ? Math.round((count / totalPlanCount) * 100) : 0;
    const variant = plan === "pro" ? "success" : plan === "enterprise" ? "info" : plan === "starter" ? "warning" : "default";
    return { plan, count, pct, variant };
  });

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
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        {/* Tabs */}
        <div className="border-b flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
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

            {/* Recent clinics */}
            <div className="bg-card rounded-xl border">
              <div className="px-5 py-4 border-b flex items-center justify-between">
                <h3 className="font-semibold">Recent Clinics</h3>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab("clinics")}>
                  View All <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr className="bg-muted/30">
                    <th>Clinic</th><th>Plan</th><th>Created</th>
                  </tr></thead>
                  <tbody>
                    {recentTenants.map((t: any) => {
                      const plan = t.plan ?? "free";
                      const variant = plan === "pro" ? "success" : plan === "enterprise" ? "info" : "default";
                      return (
                        <tr
                          key={t.id}
                          className="hover:bg-muted/20 transition-colors cursor-pointer"
                          onClick={() => {
                            setTenantOverride({ id: t.id, slug: t.slug, name: t.name });
                            navigate(`/tenant/${t.slug}/dashboard`);
                          }}
                        >
                          <td>
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">{t.name?.charAt(0)}</div>
                              <div>
                                <p className="font-medium">{t.name}</p>
                                <p className="text-xs text-muted-foreground">{t.slug}</p>
                              </div>
                            </div>
                          </td>
                          <td><StatusBadge variant={variant as any}>{plan}</StatusBadge></td>
                          <td className="text-muted-foreground">{formatDate(t.created_at, locale, "date")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
    </div>
  );
};

