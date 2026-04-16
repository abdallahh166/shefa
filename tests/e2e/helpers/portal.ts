import { expect, type Page } from "@playwright/test";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { prepareEnglishSession } from "./clinic";

export type E2EPortalConfig = {
  clinicSlug: string;
  email: string;
  uninvitedEmail: string;
  password?: string;
  accessToken?: string;
  refreshToken?: string;
  supabaseUrl?: string;
  publishableKey?: string;
  adminEmail?: string;
  adminPassword?: string;
  foreignPatientId?: string;
};

type PortalScopeProbe = {
  ownPatientId: string;
  foreignPatientId: string;
  ownPatientRows: Array<{ id: string; full_name: string | null }>;
  foreignPatientRows: Array<{ id: string; full_name: string | null }>;
};

function fallbackUninvitedEmail() {
  return `portal-blocked-${Date.now()}@example.com`;
}

export function getPortalConfig(): E2EPortalConfig {
  return {
    clinicSlug: process.env.E2E_PORTAL_CLINIC_SLUG ?? process.env.E2E_CLINIC_SLUG ?? "",
    email: process.env.E2E_PORTAL_EMAIL ?? "",
    uninvitedEmail: process.env.E2E_PORTAL_UNINVITED_EMAIL ?? fallbackUninvitedEmail(),
    password: process.env.E2E_PORTAL_PASSWORD,
    accessToken: process.env.E2E_PORTAL_ACCESS_TOKEN,
    refreshToken: process.env.E2E_PORTAL_REFRESH_TOKEN,
    supabaseUrl: process.env.E2E_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL,
    publishableKey: process.env.E2E_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    adminEmail: process.env.E2E_ADMIN_EMAIL,
    adminPassword: process.env.E2E_ADMIN_PASSWORD,
    foreignPatientId: process.env.E2E_PORTAL_FOREIGN_PATIENT_ID,
  };
}

export function hasPortalInviteConfig(config = getPortalConfig()) {
  return Boolean(config.clinicSlug && config.email);
}

export function hasPortalSessionConfig(config = getPortalConfig()) {
  return Boolean(
    hasPortalInviteConfig(config)
      && config.supabaseUrl
      && config.publishableKey
      && ((config.email && config.password) || (config.accessToken && config.refreshToken)),
  );
}

export function hasPortalScopeProbeConfig(config = getPortalConfig()) {
  return Boolean(
    hasPortalSessionConfig(config)
      && (config.foreignPatientId || (config.adminEmail && config.adminPassword)),
  );
}

export function buildSupabaseStorageKey(supabaseUrl: string) {
  const hostname = new URL(supabaseUrl).hostname;
  return `sb-${hostname.split(".")[0]}-auth-token`;
}

function createBrowserlessClient(config: E2EPortalConfig) {
  if (!config.supabaseUrl || !config.publishableKey) {
    throw new Error("Missing E2E_SUPABASE_URL or E2E_SUPABASE_PUBLISHABLE_KEY");
  }

  return createClient(config.supabaseUrl, config.publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function resolveSessionFromConfig(config: E2EPortalConfig) {
  const client = createBrowserlessClient(config);

  if (config.accessToken && config.refreshToken) {
    const { data, error } = await client.auth.setSession({
      access_token: config.accessToken,
      refresh_token: config.refreshToken,
    });
    if (error || !data.session) {
      throw new Error(error?.message ?? "Failed to restore portal session from tokens");
    }
    return { client, session: data.session };
  }

  if (config.email && config.password) {
    const { data, error } = await client.auth.signInWithPassword({
      email: config.email,
      password: config.password,
    });
    if (error || !data.session) {
      throw new Error(error?.message ?? "Failed to sign in portal user");
    }
    return { client, session: data.session };
  }

  throw new Error("Missing portal session credentials");
}

export async function attachPortalSession(page: Page, config: E2EPortalConfig) {
  const { session } = await resolveSessionFromConfig(config);
  const storageKey = buildSupabaseStorageKey(config.supabaseUrl!);

  await prepareEnglishSession(page);
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
    },
    {
      key: storageKey,
      value: JSON.stringify(session),
    },
  );

  return session;
}

export async function requestPortalMagicLink(page: Page, config: E2EPortalConfig, email = config.email) {
  await prepareEnglishSession(page);
  await page.goto(`/portal/${config.clinicSlug}/login`);
  await page.getByTestId("portal-login-email").fill(email);
  await page.getByTestId("portal-login-submit").click();
}

export async function signIntoPortal(page: Page, config: E2EPortalConfig) {
  const session = await attachPortalSession(page, config);
  await page.goto(`/portal/${config.clinicSlug}/dashboard`);
  await expect(page.getByTestId("portal-layout")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/portal/${config.clinicSlug}/dashboard$`));
  return session;
}

async function resolveOwnPortalPatient(client: SupabaseClient, session: Session) {
  const { data, error } = await client
    .from("patient_accounts")
    .select("patient_id")
    .eq("auth_user_id", session.user.id)
    .maybeSingle();

  if (error || !data?.patient_id) {
    throw new Error(error?.message ?? "Failed to resolve portal patient account");
  }

  return data.patient_id as string;
}

async function resolveForeignPatientId(config: E2EPortalConfig, ownPatientId: string, tenantId: string) {
  if (config.foreignPatientId) return config.foreignPatientId;
  if (!config.adminEmail || !config.adminPassword) {
    throw new Error("Missing admin credentials to resolve a foreign patient");
  }

  const adminClient = createBrowserlessClient(config);
  const { data: authData, error: authError } = await adminClient.auth.signInWithPassword({
    email: config.adminEmail,
    password: config.adminPassword,
  });
  if (authError || !authData.session) {
    throw new Error(authError?.message ?? "Failed to sign in admin user for portal scope probe");
  }

  const { data: foreignPatient, error: foreignError } = await adminClient
    .from("patients")
    .select("id")
    .eq("tenant_id", tenantId)
    .neq("id", ownPatientId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (foreignError) {
    throw new Error(foreignError.message ?? "Failed to resolve a foreign patient");
  }

  if (foreignPatient?.id) {
    return foreignPatient.id as string;
  }

  const seededEmail = `portal-foreign-${Date.now()}@example.com`;
  const { data: insertedPatient, error: insertError } = await adminClient
    .from("patients")
    .insert({
      tenant_id: tenantId,
      patient_code: null,
      full_name: "Portal Scope Foreign Patient",
      date_of_birth: "1990-01-01",
      gender: "male",
      blood_type: null,
      phone: null,
      email: seededEmail,
      address: null,
      insurance_provider: null,
      status: "active",
    })
    .select("id")
    .single();

  if (insertError || !insertedPatient?.id) {
    throw new Error(insertError?.message ?? "Failed to create a foreign patient for scope probing");
  }

  return insertedPatient.id as string;
}

export async function probePortalPatientScope(config: E2EPortalConfig): Promise<PortalScopeProbe> {
  const { client, session } = await resolveSessionFromConfig(config);
  const ownPatientId = await resolveOwnPortalPatient(client, session);
  const tenantId = session.user.user_metadata?.tenant_id ?? session.user.app_metadata?.tenant_id;

  if (!tenantId || typeof tenantId !== "string") {
    throw new Error("Portal session is missing tenant metadata");
  }

  const foreignPatientId = await resolveForeignPatientId(config, ownPatientId, tenantId);

  const ownPatientResult = await client
    .from("patients")
    .select("id, full_name")
    .eq("id", ownPatientId);

  if (ownPatientResult.error) {
    throw new Error(ownPatientResult.error.message ?? "Failed to read own patient record");
  }

  const foreignPatientResult = await client
    .from("patients")
    .select("id, full_name")
    .eq("id", foreignPatientId);

  if (foreignPatientResult.error) {
    throw new Error(foreignPatientResult.error.message ?? "Failed to probe foreign patient scope");
  }

  return {
    ownPatientId,
    foreignPatientId,
    ownPatientRows: ownPatientResult.data ?? [],
    foreignPatientRows: foreignPatientResult.data ?? [],
  };
}
