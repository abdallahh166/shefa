import { render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { AuthMachineState } from "@/services/auth/authStateMachine";
import { ProtectedRoute } from "./ProtectedRoute";

const routeHarness = vi.hoisted(() => ({
  auth: {
    isAuthenticated: true,
    isLoading: false,
    authMachineState: "authenticated" as AuthMachineState,
    user: {
      id: "u1",
      tenantId: "tenant-1",
      tenantStatus: "active",
      tenantRoles: ["clinic_admin"],
      globalRoles: [] as string[],
    },
    lastVerifiedAt: new Date().toISOString(),
    privilegedAuth: {
      currentLevel: "aal2",
      nextLevel: "aal2",
      verifiedFactorCount: 1,
      unverifiedFactorCount: 0,
      loadedAt: new Date().toISOString(),
    },
    hasPermission: vi.fn(() => true),
  },
  feature: {
    hasFeature: vi.fn(() => true),
    requiredPlan: vi.fn(() => "pro"),
    isLoading: false,
  },
}));

vi.mock("./authStore", () => ({
  useAuth: () => routeHarness.auth,
  isSuperAdmin: (user: { globalRoles?: string[] } | null) => Boolean(user?.globalRoles?.includes("super_admin")),
  buildPrivilegedSession: ({ user, privilegedAuth }: any) => {
    const roleTier = user?.globalRoles?.includes("super_admin")
      ? "super_admin"
      : user?.tenantRoles?.includes("clinic_admin")
        ? "clinic_admin"
        : null;
    return {
      roleTier,
      requiresMfaEnrollment: roleTier !== null && privilegedAuth.verifiedFactorCount === 0,
      aal: privilegedAuth.currentLevel,
    };
  },
}));

vi.mock("@/core/subscription/useFeatureAccess", () => ({
  useFeatureAccess: () => routeHarness.feature,
}));

vi.mock("@/core/i18n/i18nStore", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: (props: { className?: string }) => <div data-testid="skeleton" className={props.className} />,
}));

vi.mock("@/components/primitives/Button", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderProtected(element: React.ReactNode, initialPath = "/protected") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <LocationProbe />
      <Routes>
        <Route path="/login" element={<div>login page</div>} />
        <Route path="/mfa" element={<div>mfa page</div>} />
        <Route path="/security/privileged" element={<div>privileged page</div>} />
        <Route
          path="/protected"
          element={element}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    routeHarness.auth.isAuthenticated = true;
    routeHarness.auth.isLoading = false;
    routeHarness.auth.authMachineState = "authenticated";
    routeHarness.auth.user = {
      id: "u1",
      tenantId: "tenant-1",
      tenantStatus: "active",
      tenantRoles: ["clinic_admin"],
      globalRoles: [],
    };
    routeHarness.auth.privilegedAuth = {
      currentLevel: "aal2",
      nextLevel: "aal2",
      verifiedFactorCount: 1,
      unverifiedFactorCount: 0,
      loadedAt: new Date().toISOString(),
    };
    routeHarness.auth.hasPermission.mockReturnValue(true);
    routeHarness.feature.hasFeature.mockReturnValue(true);
    routeHarness.feature.requiredPlan.mockReturnValue("pro");
    routeHarness.feature.isLoading = false;
  });

  it("blocks protected content while auth is refreshing", () => {
    routeHarness.auth.authMachineState = "refreshing";

    renderProtected(<ProtectedRoute><div>private content</div></ProtectedRoute>);

    expect(screen.queryByText("private content")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
  });

  it("redirects safe-mode auth states to login", () => {
    routeHarness.auth.authMachineState = "reauth_required";

    renderProtected(<ProtectedRoute><div>private content</div></ProtectedRoute>);

    expect(screen.getByTestId("location")).toHaveTextContent("/login");
  });

  it("redirects authenticated sessions requiring MFA to the MFA challenge flow", () => {
    routeHarness.auth.authMachineState = "mfa_required";

    renderProtected(<ProtectedRoute><div>private content</div></ProtectedRoute>);

    expect(screen.getByTestId("location")).toHaveTextContent("/mfa");
    expect(screen.queryByText("private content")).not.toBeInTheDocument();
  });

  it("redirects unauthenticated users to login", () => {
    routeHarness.auth.isAuthenticated = false;

    renderProtected(<ProtectedRoute><div>private content</div></ProtectedRoute>);

    expect(screen.getByTestId("location")).toHaveTextContent("/login");
  });

  it("gates missing permissions without rendering protected content", () => {
    routeHarness.auth.hasPermission.mockReturnValue(false);

    renderProtected(<ProtectedRoute requiredPermission="manage_users"><div>private content</div></ProtectedRoute>);

    expect(screen.queryByText("private content")).not.toBeInTheDocument();
    expect(screen.getByText("auth.access.deniedTitle")).toBeInTheDocument();
  });

  it("redirects privileged routes until MFA has elevated the session to aal2", () => {
    routeHarness.auth.user = {
      ...routeHarness.auth.user,
      globalRoles: ["super_admin"],
      tenantRoles: [],
    };
    routeHarness.auth.privilegedAuth = {
      ...routeHarness.auth.privilegedAuth,
      currentLevel: "aal1",
    };

    renderProtected(
      <ProtectedRoute requiredPermission="super_admin" requiredPrivilegedRole="super_admin">
        <div>admin content</div>
      </ProtectedRoute>,
    );

    expect(screen.getByTestId("location")).toHaveTextContent("/security/privileged");
    expect(screen.queryByText("admin content")).not.toBeInTheDocument();
  });
});
