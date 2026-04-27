import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

import type { E2ESuperAdminConfig } from "./superAdmin";

type BrowserlessClient = SupabaseClient<any, "public", any>;

const projectRoot = process.cwd();
let cachedServiceRoleKey: string | null = null;

function resolveSupabaseUrl() {
  const supabaseUrl = process.env.E2E_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("E2E Supabase URL is missing");
  }
  return supabaseUrl;
}

function resolvePublishableKey() {
  const publishableKey = process.env.E2E_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!publishableKey) {
    throw new Error("E2E Supabase publishable key is missing");
  }
  return publishableKey;
}

function readProjectRef() {
  if (process.env.VITE_SUPABASE_PROJECT_ID) {
    return process.env.VITE_SUPABASE_PROJECT_ID.replace(/"/g, "").trim();
  }

  const tempProjectRefPath = path.join(projectRoot, "supabase", ".temp", "project-ref");
  if (fs.existsSync(tempProjectRefPath)) {
    return fs.readFileSync(tempProjectRefPath, "utf8").trim();
  }

  return new URL(resolveSupabaseUrl()).hostname.split(".")[0];
}

function resolveServiceRoleKey() {
  if (cachedServiceRoleKey) return cachedServiceRoleKey;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    cachedServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY.trim();
    return cachedServiceRoleKey;
  }

  const output = execFileSync(
    "supabase",
    ["projects", "api-keys", "--project-ref", readProjectRef(), "--output", "json"],
    { cwd: projectRoot, encoding: "utf8" },
  );
  const keys = JSON.parse(output);
  if (!Array.isArray(keys)) {
    throw new Error("Unexpected response from `supabase projects api-keys`.");
  }

  const key = keys.find((entry) => entry?.name === "service_role")
    ?? keys.find((entry) => entry?.type === "secret" && entry?.secret_jwt_template?.role === "service_role");

  if (!key?.api_key) {
    throw new Error("Could not resolve the service role key from the linked Supabase project.");
  }

  cachedServiceRoleKey = key.api_key;
  return cachedServiceRoleKey;
}

function createBrowserlessClient() {
  return createClient(resolveSupabaseUrl(), resolvePublishableKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function createAdminClient() {
  return createClient(resolveSupabaseUrl(), resolveServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function getSuperAdminAuthUser(config: E2ESuperAdminConfig) {
  if (!config.email) {
    throw new Error("E2E super admin email is missing");
  }

  const adminClient = createAdminClient();
  const targetEmail = config.email.toLowerCase();
  const perPage = 200;

  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const user = data?.users?.find((candidate) => String(candidate?.email ?? "").toLowerCase() === targetEmail);
    if (user) return user;
    if (!data?.users?.length || data.users.length < perPage) break;
  }

  throw new Error(`Could not resolve super admin auth user for ${config.email}`);
}

async function ensureSuperAdminAccount(config: E2ESuperAdminConfig) {
  if (!config.email || !config.password) {
    throw new Error("E2E super admin credentials are missing");
  }

  const adminClient = createAdminClient();
  const existingUser = await getSuperAdminAuthUser(config).catch(() => null);
  let userId = existingUser?.id ?? null;

  if (!userId) {
    const { data, error } = await adminClient.auth.admin.createUser({
      email: config.email,
      password: config.password,
      email_confirm: true,
      user_metadata: {
        full_name: "E2E Super Admin",
        tenant_id: null,
      },
    });

    if (error || !data.user?.id) {
      throw error ?? new Error("Failed to recreate the E2E super admin account");
    }

    userId = data.user.id;
  } else {
    const { data, error } = await adminClient.auth.admin.updateUserById(userId, {
      password: config.password,
      email_confirm: true,
      user_metadata: {
        ...(existingUser?.user_metadata ?? {}),
        full_name: "E2E Super Admin",
        tenant_id: null,
      },
    });

    if (error || !data.user?.id) {
      throw error ?? new Error("Failed to update the E2E super admin account");
    }
  }

  if (!userId) {
    throw new Error("Failed to resolve a super admin user id");
  }

  const { error: profileError } = await adminClient
    .from("profiles")
    .upsert(
      {
        user_id: userId,
        tenant_id: null,
        full_name: "E2E Super Admin",
      },
      { onConflict: "user_id" },
    );
  if (profileError) throw profileError;

  const { error: cleanupRoleError } = await adminClient
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("role", "super_admin");
  if (cleanupRoleError) throw cleanupRoleError;

  const { error: globalRoleError } = await adminClient
    .from("user_global_roles")
    .upsert(
      {
        user_id: userId,
        role: "super_admin",
        granted_by: null,
        is_break_glass: false,
        break_glass_reason: null,
        requires_mfa: true,
      },
      { onConflict: "user_id,role" },
    );
  if (globalRoleError) throw globalRoleError;

  return userId;
}

function base32Decode(input: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const sanitized = input.toUpperCase().replace(/=+$/g, "").replace(/[^A-Z2-7]/g, "");
  let bits = "";

  for (const char of sanitized) {
    const index = alphabet.indexOf(char);
    if (index === -1) {
      throw new Error("Invalid base32 secret");
    }
    bits += index.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }

  return Buffer.from(bytes);
}

function generateTotpAt(secret: string, epochMs: number) {
  const counter = Math.floor(epochMs / 30_000);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const digest = crypto.createHmac("sha1", base32Decode(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = (
    ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff)
  );

  return String(binary % 1_000_000).padStart(6, "0");
}

export async function generateStableTotp(secret: string) {
  const stepMs = 30_000;
  const now = Date.now();
  const msIntoStep = now % stepMs;

  if (msIntoStep > stepMs - 3_000) {
    await new Promise((resolve) => setTimeout(resolve, stepMs - msIntoStep + 250));
  }

  return generateTotpAt(secret, Date.now());
}

export async function signInSuperAdminClient(config: E2ESuperAdminConfig): Promise<{ client: BrowserlessClient; session: Session }> {
  if (!config.email || !config.password) {
    throw new Error("E2E super admin credentials are missing");
  }

  const client = createBrowserlessClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: config.email,
    password: config.password,
  });

  if (error || !data.session) {
    throw error ?? new Error("Failed to sign in the E2E super admin");
  }

  return { client, session: data.session };
}

export async function clearSuperAdminPrivilegedState(config: E2ESuperAdminConfig) {
  const userId = await ensureSuperAdminAccount(config);
  const adminClient = createAdminClient();

  const { data: factorData, error: factorListError } = await (adminClient.auth.admin.mfa as any).listFactors({ userId });
  if (factorListError) throw factorListError;

  const factors = Array.isArray(factorData?.factors) ? factorData.factors : [];
  for (const factor of factors) {
    const { error } = await (adminClient.auth.admin.mfa as any).deleteFactor({
      userId,
      id: factor.id,
    });
    if (error) throw error;
  }

  const { error: grantDeleteError } = await adminClient
    .from("privileged_step_up_grants")
    .delete()
    .eq("actor_id", userId);
  if (grantDeleteError) throw grantDeleteError;

  const { error: sessionEndError } = await adminClient
    .from("admin_impersonation_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("actor_id", userId)
    .is("ended_at", null);
  if (sessionEndError) throw sessionEndError;
}

export async function prepareVerifiedSuperAdminMfa(config: E2ESuperAdminConfig) {
  await clearSuperAdminPrivilegedState(config);
  const { client } = await signInSuperAdminClient(config);

  const enrollResult = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "E2E Privileged MFA",
    issuer: "MedFlow",
  });

  if (enrollResult.error || !enrollResult.data) {
    throw enrollResult.error ?? new Error("Failed to enroll the E2E privileged MFA factor");
  }

  const factorId = enrollResult.data.id;
  const secret = enrollResult.data.totp.secret;
  const challengeResult = await client.auth.mfa.challenge({ factorId });
  if (challengeResult.error || !challengeResult.data?.id) {
    throw challengeResult.error ?? new Error("Failed to challenge the E2E privileged MFA factor");
  }

  const verifyResult = await client.auth.mfa.verify({
    factorId,
    challengeId: challengeResult.data.id,
    code: await generateStableTotp(secret),
  });

  if (verifyResult.error) {
    throw verifyResult.error;
  }

  await client.auth.signOut();
  return { factorId, secret };
}

export async function createAal2SuperAdminClient(config: E2ESuperAdminConfig) {
  const { factorId, secret } = await prepareVerifiedSuperAdminMfa(config);
  const { client } = await signInSuperAdminClient(config);

  const challengeResult = await client.auth.mfa.challenge({ factorId });
  if (challengeResult.error || !challengeResult.data?.id) {
    throw challengeResult.error ?? new Error("Failed to challenge the verified MFA factor");
  }

  const verifyResult = await client.auth.mfa.verify({
    factorId,
    challengeId: challengeResult.data.id,
    code: await generateStableTotp(secret),
  });
  if (verifyResult.error) {
    throw verifyResult.error;
  }

  return { client, factorId, secret };
}

export async function getTenantBySlug(clinicSlug: string) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("tenants")
    .select("id, slug, name")
    .eq("slug", clinicSlug)
    .single();

  if (error || !data) {
    throw error ?? new Error(`Failed to resolve tenant for slug ${clinicSlug}`);
  }

  return data;
}

export async function issueSuperAdminGrant(
  client: BrowserlessClient,
  input: {
    actionKey: string;
    tenantId?: string | null;
    resourceId?: string | null;
    requestId?: string | null;
  },
) {
  const { data, error } = await (client.rpc as any)("issue_privileged_step_up_grant", {
    _role_tier: "super_admin",
    _action_key: input.actionKey,
    _tenant_id: input.tenantId ?? null,
    _resource_id: input.resourceId ?? null,
    _request_id: input.requestId ?? null,
  });

  if (error || !data) {
    throw error ?? new Error("Failed to issue privileged step-up grant");
  }

  return String(data);
}

export async function startImpersonationRpc(
  client: BrowserlessClient,
  input: {
    tenantId: string;
    requestId?: string;
    stepUpGrantId?: string | null;
  },
) {
  return (client.rpc as any)("admin_start_tenant_impersonation", {
    _target_tenant_id: input.tenantId,
    _request_id: input.requestId ?? crypto.randomUUID(),
    _step_up_grant_id: input.stepUpGrantId ?? null,
  });
}

export async function stopImpersonationRpc(
  client: BrowserlessClient,
  input: {
    requestId: string;
    stepUpGrantId?: string | null;
  },
) {
  return (client.rpc as any)("admin_stop_tenant_impersonation", {
    _request_id: input.requestId,
    _step_up_grant_id: input.stepUpGrantId ?? null,
  });
}

export async function expireStepUpGrant(grantId: string) {
  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("privileged_step_up_grants")
    .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
    .eq("id", grantId);

  if (error) throw error;
}

export async function randomUnusedStepUpGrantId() {
  return crypto.randomUUID();
}
