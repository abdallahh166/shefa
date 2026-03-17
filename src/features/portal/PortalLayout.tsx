import { Link, Outlet, useParams } from "react-router-dom";
import { usePortalAuth } from "@/core/auth/portalAuthStore";
import { Button } from "@/components/primitives/Button";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "appointments", label: "Appointments" },
  { key: "prescriptions", label: "Prescriptions" },
  { key: "lab-results", label: "Lab Results" },
  { key: "documents", label: "Documents" },
  { key: "invoices", label: "Invoices" },
];

export const PortalLayout = () => {
  const { clinicSlug } = useParams();
  const { user, logout } = usePortalAuth();

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Patient Portal</p>
            <h1 className="text-lg font-semibold">{user?.tenantName ?? "Clinic"}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium">{user?.fullName ?? "Patient"}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => logout()}>Sign out</Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 grid gap-6 md:grid-cols-[200px,1fr]">
        <nav className="space-y-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.key}
              to={`/portal/${clinicSlug}/${item.key}`}
              className="block rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="bg-background border rounded-lg p-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
