import { create } from "zustand";

type ReauthPromptConfig = {
  title: string;
  description: string;
  actionLabel?: string;
  cancelLabel?: string;
};

type ReauthPromptState = {
  request: ReauthPromptConfig | null;
  open: (config: ReauthPromptConfig) => Promise<void>;
  resolve: () => void;
  reject: (reason?: unknown) => void;
};

let pendingResolve: (() => void) | null = null;
let pendingReject: ((reason?: unknown) => void) | null = null;

export const useReauthPromptStore = create<ReauthPromptState>((set) => ({
  request: null,
  open: (config) =>
    new Promise<void>((resolve, reject) => {
      if (pendingReject) {
        pendingReject(new Error("Re-authentication request replaced"));
      }
      pendingResolve = resolve;
      pendingReject = reject;
      set({ request: config });
    }),
  resolve: () => {
    pendingResolve?.();
    pendingResolve = null;
    pendingReject = null;
    set({ request: null });
  },
  reject: (reason) => {
    pendingReject?.(reason);
    pendingResolve = null;
    pendingReject = null;
    set({ request: null });
  },
}));

export function requestReauthentication(config: ReauthPromptConfig) {
  return useReauthPromptStore.getState().open(config);
}
