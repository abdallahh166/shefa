import type { User } from "@supabase/supabase-js";

/** AAL segment in sessionVersion: bumps when MFA assurance changes for the same login session anchor. */
export type SessionAssuranceTag = "0" | "1" | "2";

export type SessionAssuranceInput = "aal1" | "aal2" | null | undefined;

export function assuranceToTag(level: SessionAssuranceInput): SessionAssuranceTag {
  if (level === "aal2") return "2";
  if (level === "aal1") return "1";
  return "0";
}

/** Stable version for principal + tenant; uses session created time (not rotating expiry). */
export function computeSessionVersion(params: {
  userId: string;
  tenantId: string | null;
  sessionCreatedAtSec: number;
  assurance?: SessionAssuranceTag;
}): string {
  const a = params.assurance ?? "0";
  return `${params.userId}:${params.tenantId ?? "none"}:${params.sessionCreatedAtSec}:${a}`;
}

function sessionCreatedSec(user: User | null, fallbackCreatedAt?: string | null): number {
  const created = (user as { created_at?: string | null } | null)?.created_at ?? fallbackCreatedAt;
  if (!created) return 0;
  const t = new Date(created).getTime();
  return Number.isFinite(t) ? Math.floor(t / 1000) : 0;
}

export function sessionVersionFromSupabaseUser(
  user: User | null,
  tenantId: string | null,
  sessionCreatedAt?: string | null,
  assuranceLevel?: SessionAssuranceInput,
): string | null {
  if (!user?.id) return null;
  const sec = sessionCreatedSec(user, sessionCreatedAt);
  const assurance = assuranceToTag(assuranceLevel);
  return computeSessionVersion({ userId: user.id, tenantId, sessionCreatedAtSec: sec, assurance });
}
