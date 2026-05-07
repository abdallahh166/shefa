import { env } from "@/core/env/env";

export function isAuthKillSwitchActive(): boolean {
  const v = env.VITE_AUTH_KILL_SWITCH ?? (typeof import.meta !== "undefined" ? (import.meta as any).env?.VITE_AUTH_KILL_SWITCH : undefined);
  return v === "true" || v === "1" || v === true;
}
