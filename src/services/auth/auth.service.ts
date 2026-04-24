import { z } from "zod";
import { AuthorizationError, toServiceError } from "@/services/supabase/errors";
import { uuidSchema } from "@/domain/shared/identifiers.schema";
import { authRepository } from "./auth.repository";
import { env } from "@/core/env/env";
import { rateLimitService } from "@/services/security/rateLimit.service";

const emailSchema = z.string().trim().email();
const passwordSchema = z.string().min(8).max(128);
const nonEmptySchema = z.string().trim().min(2).max(120);
const slugSchema = z.string().trim().min(2).max(60);

export const authService = {
  async login(email: string, password: string) {
    try {
      const parsedEmail = emailSchema.parse(email);
      const parsedPassword = z.string().min(1).parse(password);
      await rateLimitService.assertAllowed("login", [parsedEmail]);
      const user = await authRepository.signInWithPassword(parsedEmail, parsedPassword);
      const userConfirmedAt = (user as { email_confirmed_at?: string | null; confirmed_at?: string | null } | null) ?? null;
      const isVerified = Boolean(userConfirmedAt?.email_confirmed_at ?? userConfirmedAt?.confirmed_at);
      if (user && !isVerified) {
        await Promise.resolve(authRepository.signOut()).catch(() => undefined);
        throw new AuthorizationError("Please verify your email before logging in.");
      }
      if (user) {
        const { profile, role } = await authService.loadUserProfile(user.id);
        if (!profile || !role) {
          await Promise.resolve(authRepository.signOut()).catch(() => undefined);
          throw new AuthorizationError("This clinic is suspended or deactivated.");
        }
      }
    } catch (err) {
      throw toServiceError(err, "Login failed");
    }
  },
  async logout() {
    try {
      await authRepository.signOut();
    } catch (err) {
      throw toServiceError(err, "Failed to sign out");
    }
  },
  async getSessionUser() {
    try {
      const result = await authRepository.getSession();
      return result.user ?? null;
    } catch (err) {
      throw toServiceError(err, "Failed to load session");
    }
  },
  onAuthStateChange(handler: (event: string, user?: { id: string; email?: string | null } | null) => void) {
    return authRepository.onAuthStateChange(handler);
  },
  async resetPassword(email: string, redirectTo: string) {
    try {
      const parsedEmail = emailSchema.parse(email);
      await rateLimitService.assertAllowed("password_reset", [parsedEmail]);
      await authRepository.resetPasswordForEmail(parsedEmail, redirectTo);
    } catch (err) {
      throw toServiceError(err, "Failed to send reset email");
    }
  },
  async updatePassword(password: string) {
    try {
      const parsedPassword = passwordSchema.parse(password);
      await authRepository.updatePassword(parsedPassword);
    } catch (err) {
      throw toServiceError(err, "Failed to update password");
    }
  },
  async loadUserProfile(userId: string) {
    try {
      const parsedUserId = uuidSchema.parse(userId);
      const profile = await authRepository.getProfileByUserId(parsedUserId);
      const role = await authRepository.getRoleByUserId(parsedUserId);
      return { profile, role };
    } catch (err) {
      throw toServiceError(err, "Failed to load user profile");
    }
  },
  async registerClinic(input: {
    clinicName: string;
    fullName: string;
    email: string;
    password: string;
    slug: string;
    captchaToken?: string;
  }) {
    try {
      const captchaRequired = Boolean(env.VITE_CAPTCHA_SITE_KEY);
      const token = typeof input.captchaToken === "string" ? input.captchaToken.trim() : "";
      if (captchaRequired && !token) {
        throw new Error("Captcha verification required");
      }
      const payload = {
        clinicName: nonEmptySchema.parse(input.clinicName),
        fullName: nonEmptySchema.parse(input.fullName),
        email: emailSchema.parse(input.email),
        password: passwordSchema.parse(input.password),
        slug: slugSchema.parse(input.slug),
        captchaToken: token || undefined,
      };
      const data = await authRepository.registerClinic(payload);
      const error = (data as any)?.error;
      if (error) {
        throw new Error(error);
      }
      return data;
    } catch (err) {
      throw toServiceError(err, "Failed to create clinic");
    }
  },
};
