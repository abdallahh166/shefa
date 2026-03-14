import { beforeEach, describe, expect, it, vi } from "vitest";
import { authService } from "@/services/auth/auth.service";
import { authRepository } from "@/services/auth/auth.repository";
import { rateLimitService } from "@/services/security/rateLimit.service";

vi.mock("@/services/auth/auth.repository", () => ({
  authRepository: {
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updatePassword: vi.fn(),
    getProfileByUserId: vi.fn(),
    getRoleByUserId: vi.fn(),
    registerClinic: vi.fn(),
  },
}));

vi.mock("@/services/security/rateLimit.service", () => ({
  rateLimitService: {
    assertAllowed: vi.fn(),
  },
}));

const repo = vi.mocked(authRepository, true);
const limiter = vi.mocked(rateLimitService, true);

describe("authService.login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects login when email is not verified", async () => {
    repo.signInWithPassword.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      email_confirmed_at: null,
    } as any);

    await expect(authService.login("user@example.com", "password")).rejects.toThrow(
      "Please verify your email"
    );
    expect(repo.signOut).toHaveBeenCalled();
  });

  it("allows login when email is verified", async () => {
    repo.signInWithPassword.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      email_confirmed_at: new Date().toISOString(),
    } as any);

    await expect(authService.login("user@example.com", "password")).resolves.toBeUndefined();
    expect(repo.signOut).not.toHaveBeenCalled();
    expect(limiter.assertAllowed).toHaveBeenCalledWith("login", ["user@example.com"]);
  });
});

describe("authService.resetPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enforces rate limits for password reset", async () => {
    await authService.resetPassword("reset@example.com", "http://localhost/reset");
    expect(limiter.assertAllowed).toHaveBeenCalledWith("password_reset", ["reset@example.com"]);
  });
});
