import { Link, Outlet, useParams } from "react-router-dom";
import { usePortalAuth } from "@/core/auth/portalAuthStore";
import { Button } from "@/components/primitives/Button";
import { useI18n } from "@/core/i18n/i18nStore";

const NAV_ITEMS = [
  { key: "dashboard", labelKey: "portal.layout.nav.dashboard" },
  { key: "appointments", labelKey: "portal.layout.nav.appointments" },
  { key: "prescriptions", labelKey: "portal.layout.nav.prescriptions" },
  { key: "lab-results", labelKey: "portal.layout.nav.lab-results" },
  { key: "documents", labelKey: "portal.layout.nav.documents" },
  { key: "invoices", labelKey: "portal.layout.nav.invoices" },
] as const;

export const PortalLayout = () => {
  const { clinicSlug } = useParams();
  const { user, logout } = usePortalAuth();
  const { t } = useI18n(["portal"]);

  return (
    <div className="min-h-screen bg-muted/20" data-testid="portal-layout">
      <header className="border-b bg-background" data-testid="portal-header">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs text-muted-foreground">{t("portal.layout.title")}</p>
            <h1 className="text-lg font-semibold">
              {user?.tenantName ?? t("portal.layout.clinicFallback")}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-start md:text-end" data-testid="portal-user-summary">
              <p className="text-sm font-medium" data-testid="portal-user-name">
                {user?.fullName ?? t("portal.layout.userFallback")}
              </p>
              <p className="text-xs text-muted-foreground" data-testid="portal-user-email">
                {user?.email}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logout()}
              data-testid="portal-signout"
            >
              {t("portal.layout.signOut")}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[200px,1fr]">
        <nav
          className="space-y-2"
          data-testid="portal-nav"
          aria-label={t("portal.layout.navigationLabel")}
        >
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.key}
              to={`/portal/${clinicSlug}/${item.key}`}
              data-testid={`portal-nav-${item.key}`}
              className="block rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              {t(item.labelKey)}
            </Link>
          ))}
        </nav>
        <main className="rounded-lg border bg-background p-5" data-testid="portal-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
