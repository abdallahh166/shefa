import type { User } from "@supabase/supabase-js";

/** Stable version for principal + tenant; uses session created time (not rotating expiry). */
export function computeSessionVersion(params: {
  userId: string;
  tenantId: string | null;
  sessionCreatedAtSec: number;
}): string {
  return `${params.userId}:${params.tenantId ?? "none"}:${params.sessionCreatedAtSec}`;
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
): string | null {
  if (!user?.id) return null;
  const sec = sessionCreatedSec(user, sessionCreatedAt);
  return computeSessionVersion({ userId: user.id, tenantId, sessionCreatedAtSec: sec });
}
