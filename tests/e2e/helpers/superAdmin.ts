import { createClient, type Session } from "@supabase/supabase-js";
import { expect, Page } from "@playwright/test";

import { prepareEnglishSession } from "./clinic";

export type E2ESuperAdminConfig = {
  email?: string;
  password?: string;
};

function createBrowserlessSuperAdminClient() {
  const supabaseUrl = process.env.E2E_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const publishableKey = process.env.E2E_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    throw new Error("E2E Supabase credentials are missing");
  }

  return createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function buildSupabaseStorageKey(supabaseUrl: string) {
  const hostname = new URL(supabaseUrl).hostname;
  return `sb-${hostname.split(".")[0]}-auth-token`;
}

export function getSuperAdminConfig(): E2ESuperAdminConfig {
  return {
    email: process.env.E2E_SUPER_ADMIN_EMAIL,
    password: process.env.E2E_SUPER_ADMIN_PASSWORD,
  };
}

export function hasSuperAdminConfig(config: E2ESuperAdminConfig): boolean {
  return Boolean(config.email && config.password);
}

export async function loginToSuperAdmin(page: Page, config: E2ESuperAdminConfig) {
  if (!config.email || !config.password) {
    throw new Error("E2E super admin credentials are missing");
  }

  await prepareEnglishSession(page);
  await page.goto("/login");
  await page.getByTestId("login-email").fill(config.email);
  await page.getByTestId("login-password").fill(config.password);
  await page.getByTestId("login-submit").click();
  await page.waitForLoadState("networkidle");

  try {
    await expect(page).toHaveURL(/\/admin$/, { timeout: 10_000 });
  } catch {
    await attachSuperAdminSession(page, config);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin$/, { timeout: 30_000 });
  }

  await expect(page.getByTestId("admin-tab-overview")).toBeVisible({ timeout: 30_000 });
}

export async function openAdminTab(page: Page, tab: "overview" | "operations" | "clinics" | "users" | "subscriptions" | "pricing") {
  await page.getByTestId(`admin-tab-${tab}`).click();
}

export async function findAdminTableRow(page: Page, searchText: string, rowText = searchText) {
  const searchBox = page.getByRole("textbox", { name: /search/i }).first();
  await searchBox.fill(searchText);
  const row = page.locator("tbody tr", { hasText: rowText }).first();

  try {
    await expect(row).toBeVisible({ timeout: 15_000 });
    return row;
  } catch {
    await searchBox.clear();
    await expect(row).toBeVisible({ timeout: 30_000 });
    return row;
  }
}

export async function updatePricingPlanViaApi(
  config: E2ESuperAdminConfig,
  planCode: "free" | "starter" | "pro" | "enterprise",
  changes: Record<string, unknown>,
) {
  if (!config.email || !config.password) {
    throw new Error("E2E super admin credentials are missing");
  }

  const client = createBrowserlessSuperAdminClient();
  const signIn = await client.auth.signInWithPassword({
    email: config.email,
    password: config.password,
  });

  if (signIn.error) {
    throw signIn.error;
  }

  const { error } = await client
    .from("pricing_plans")
    .update(changes)
    .eq("plan_code", planCode)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }
}

export async function attachSuperAdminSession(page: Page, config: E2ESuperAdminConfig): Promise<Session> {
  if (!config.email || !config.password) {
    throw new Error("E2E super admin credentials are missing");
  }

  const supabaseUrl = process.env.E2E_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("E2E Supabase URL is missing");
  }

  const client = createBrowserlessSuperAdminClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: config.email,
    password: config.password,
  });

  if (error || !data.session) {
    throw error ?? new Error("Failed to create super admin session");
  }

  await prepareEnglishSession(page);
  await page.goto("/login");
  await page.evaluate(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
    },
    {
      key: buildSupabaseStorageKey(supabaseUrl),
      value: JSON.stringify(data.session),
    },
  );

  return data.session;
}

export async function getTenantSubscriptionBySlug(
  config: E2ESuperAdminConfig,
  clinicSlug: string,
) {
  if (!config.email || !config.password) {
    throw new Error("E2E super admin credentials are missing");
  }

  const client = createBrowserlessSuperAdminClient();
  const signIn = await client.auth.signInWithPassword({
    email: config.email,
    password: config.password,
  });

  if (signIn.error) {
    throw signIn.error;
  }

  const { data, error } = await client
    .from("subscriptions")
    .select("id, plan, status, amount, currency, billing_cycle, tenants!inner(slug)")
    .eq("tenants.slug", clinicSlug)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(`No subscription found for clinic slug ${clinicSlug}`);
  }

  return data;
}
