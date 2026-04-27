import { describe, expect, it } from "vitest";
import { buildPrivilegedSession, type AppUser, type PrivilegedAuthState } from "@/core/auth/authStore";

const basePrivilegedAuth: PrivilegedAuthState = {
  currentLevel: "aal2",
  nextLevel: "aal2",
  verifiedFactorCount: 1,
  unverifiedFactorCount: 0,
  loadedAt: "2026-04-27T00:00:00.000Z",
};

function createUser(overrides?: Partial<AppUser>): AppUser {
  return {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    tenantId: "tenant-1",
    tenantSlug: "tenant-1",
    tenantName: "Tenant 1",
    tenantStatus: "active",
    tenantRoles: [],
    globalRoles: [],
    ...overrides,
  };
}

describe("buildPrivilegedSession", () => {
  it("marks non-privileged users as unrestricted for privileged route gating", () => {
    const session = buildPrivilegedSession({
      user: createUser({ tenantRoles: ["doctor"] }),
      lastVerifiedAt: null,
      privilegedAuth: {
        currentLevel: null,
        nextLevel: null,
        verifiedFactorCount: 0,
        unverifiedFactorCount: 0,
        loadedAt: null,
      },
    });

    expect(session).toMatchObject({
      roleTier: null,
      isPrivileged: false,
      requiresMfaEnrollment: false,
      requiresStepUp: false,
      canAccessPrivilegedRoutes: true,
    });
  });

  it("requires MFA enrollment for clinic admins without a verified factor", () => {
    const session = buildPrivilegedSession({
      user: createUser({ tenantRoles: ["clinic_admin"] }),
      lastVerifiedAt: new Date().toISOString(),
      privilegedAuth: {
        ...basePrivilegedAuth,
        currentLevel: "aal1",
        nextLevel: "aal2",
        verifiedFactorCount: 0,
      },
    });

    expect(session).toMatchObject({
      roleTier: "clinic_admin",
      isPrivileged: true,
      isMfaEnrolled: false,
      requiresMfaEnrollment: true,
      canAccessPrivilegedRoutes: false,
    });
  });

  it("drops privileged route access when a super-admin session falls below aal2", () => {
    const session = buildPrivilegedSession({
      user: createUser({ globalRoles: ["super_admin"] }),
      lastVerifiedAt: new Date().toISOString(),
      privilegedAuth: {
        ...basePrivilegedAuth,
        currentLevel: "aal1",
        nextLevel: "aal2",
      },
    });

    expect(session).toMatchObject({
      roleTier: "super_admin",
      aal: "aal1",
      isMfaEnrolled: true,
      canAccessPrivilegedRoutes: false,
    });
  });

  it("requires step-up when a privileged session is no longer fresh", () => {
    const sixteenMinutesAgo = new Date(Date.now() - 16 * 60 * 1000).toISOString();
    const session = buildPrivilegedSession({
      user: createUser({ tenantRoles: ["clinic_admin"] }),
      lastVerifiedAt: sixteenMinutesAgo,
      privilegedAuth: basePrivilegedAuth,
    });

    expect(session).toMatchObject({
      roleTier: "clinic_admin",
      isRecentAuthValid: false,
      requiresStepUp: true,
      canAccessPrivilegedRoutes: true,
    });
  });
});
