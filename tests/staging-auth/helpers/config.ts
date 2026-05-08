import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { test, type Page } from "@playwright/test";

export type StagingAuthConfig = {
  enabled: boolean;
  baseUrl: string;
  supabaseUrl: string;
  publishableKey: string;
  serviceRoleKey?: string;
  clinicSlug: string;
  adminEmail: string;
  adminPassword: string;
  secondaryAdminEmail?: string;
  secondaryAdminPassword?: string;
  secondaryClinicSlug?: string;
  portalEmail?: string;
  portalPassword?: string;
  portalClinicSlug?: string;
  foreignTenantId?: string;
  foreignPatientId?: string;
  storageBucket?: string;
  storageForeignPath?: string;
};

export type StagingSession = {
  client: SupabaseClient;
  session: Session;
};

export const AUTH_STORAGE_KEY = "shefaa-auth";
export const APP_AUTH_STORAGE_KEY = "medflow-auth";

export function getStagingAuthConfig(): StagingAuthConfig {
  return {
    enabled: process.env.STAGING_AUTH_VALIDATE === "1",
    baseUrl: process.env.STAGING_BASE_URL ?? process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173",
    supabaseUrl: process.env.STAGING_SUPABASE_URL ?? process.env.E2E_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "",
    publishableKey:
      process.env.STAGING_SUPABASE_PUBLISHABLE_KEY
      ?? process.env.E2E_SUPABASE_PUBLISHABLE_KEY
      ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY
      ?? "",
    serviceRoleKey: process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
    clinicSlug: process.env.STAGING_CLINIC_SLUG ?? process.env.E2E_CLINIC_SLUG ?? "",
    adminEmail: process.env.STAGING_ADMIN_EMAIL ?? process.env.E2E_ADMIN_EMAIL ?? "",
    adminPassword: process.env.STAGING_ADMIN_PASSWORD ?? process.env.E2E_ADMIN_PASSWORD ?? "",
    secondaryAdminEmail: process.env.STAGING_SECONDARY_ADMIN_EMAIL,
    secondaryAdminPassword: process.env.STAGING_SECONDARY_ADMIN_PASSWORD,
    secondaryClinicSlug: process.env.STAGING_SECONDARY_CLINIC_SLUG,
    portalEmail: process.env.STAGING_PORTAL_EMAIL ?? process.env.E2E_PORTAL_EMAIL,
    portalPassword: process.env.STAGING_PORTAL_PASSWORD ?? process.env.E2E_PORTAL_PASSWORD,
    portalClinicSlug: process.env.STAGING_PORTAL_CLINIC_SLUG ?? process.env.E2E_PORTAL_CLINIC_SLUG,
    foreignTenantId: process.env.STAGING_FOREIGN_TENANT_ID,
    foreignPatientId: process.env.STAGING_FOREIGN_PATIENT_ID ?? process.env.E2E_PORTAL_FOREIGN_PATIENT_ID,
    storageBucket: process.env.STAGING_STORAGE_BUCKET,
    storageForeignPath: process.env.STAGING_STORAGE_FOREIGN_PATH,
  };
}

export function missingRequiredConfig(config = getStagingAuthConfig()) {
  const missing: string[] = [];
  if (!config.enabled) missing.push("STAGING_AUTH_VALIDATE=1");
  if (!config.supabaseUrl) missing.push("STAGING_SUPABASE_URL or E2E_SUPABASE_URL");
  if (!config.publishableKey) missing.push("STAGING_SUPABASE_PUBLISHABLE_KEY or E2E_SUPABASE_PUBLISHABLE_KEY");
  if (!config.clinicSlug) missing.push("STAGING_CLINIC_SLUG or E2E_CLINIC_SLUG");
  if (!config.adminEmail) missing.push("STAGING_ADMIN_EMAIL or E2E_ADMIN_EMAIL");
  if (!config.adminPassword) missing.push("STAGING_ADMIN_PASSWORD or E2E_ADMIN_PASSWORD");
  return missing;
}

export function skipWithoutStagingAuth(config = getStagingAuthConfig()) {
  const missing = missingRequiredConfig(config);
  test.skip(missing.length > 0, `Staging auth validation disabled or incomplete. Missing: ${missing.join(", ")}`);
}

export function createAnonClient(config = getStagingAuthConfig()) {
  if (!config.supabaseUrl || !config.publishableKey) {
    throw new Error("Missing staging Supabase URL or publishable key");
  }

  return createClient(config.supabaseUrl, config.publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createServiceRoleClient(config = getStagingAuthConfig()) {
  if (!config.supabaseUrl || !config.serviceRoleKey) {
    throw new Error("Missing staging Supabase URL or service-role key");
  }

  return createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function signInStagingUser(email: string, password: string, config = getStagingAuthConfig()): Promise<StagingSession> {
  const client = createAnonClient(config);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(error?.message ?? `Failed to sign in staging user ${email}`);
  }
  return { client, session: data.session };
}

export async function attachSession(page: Page, session: Session) {
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
      window.localStorage.setItem(
        "medflow-i18n",
        JSON.stringify({ state: { locale: "en", dir: "ltr", calendarType: "gregorian" }, version: 0 }),
      );
    },
    {
      key: AUTH_STORAGE_KEY,
      value: JSON.stringify(session),
    },
  );
}

export async function attachAdminSession(page: Page, config = getStagingAuthConfig()) {
  const { session } = await signInStagingUser(config.adminEmail, config.adminPassword, config);
  await attachSession(page, session);
  return session;
}

export function tenantUrl(config = getStagingAuthConfig(), path = "dashboard") {
  return `/tenant/${config.clinicSlug}/${path.replace(/^\//, "")}`;
}

export function portalUrl(config = getStagingAuthConfig(), path = "dashboard") {
  const slug = config.portalClinicSlug ?? config.clinicSlug;
  return `/portal/${slug}/${path.replace(/^\//, "")}`;
}

export async function readAppAuthState(page: Page) {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw).state ?? null;
    } catch {
      return null;
    }
  }, APP_AUTH_STORAGE_KEY);
}

export async function collectBrowserAuthMetrics(page: Page) {
  const metrics: Array<{ name: string; text: string }> = [];
  page.on("console", (message) => {
    const text = message.text();
    const match = text.match(/^\[auth-metric\]\s+([a-z0-9_]+)/i);
    if (match) metrics.push({ name: match[1], text });
  });
  return metrics;
}
