import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./design-system/styles/globals.css";
import { useAuth } from "./core/auth/authStore";
import { initTheme } from "./hooks/useDarkMode";
import { initEventHandlers } from "./core/events";
import { initSentry } from "./core/observability/sentry";
import { initializeI18nStore } from "./core/i18n/i18nStore";
import { initializePrivilegedSessionLifecycle } from "./services/auth/privilegedSession.lifecycle";
import { initAuthMultiTabSync, startAuthDriftWatcher } from "./services/auth/authSessionOrchestrator";
import { authRepository } from "./services/auth/auth.repository";

// Apply theme class before anything renders (prevents flash)
initTheme();
void initializeI18nStore();

initAuthMultiTabSync();
startAuthDriftWatcher({
  getSession: () => authRepository.getSession(),
  refreshSessionSingleFlight: () => authRepository.refreshSessionSingleFlight(),
});
// Initialize auth state on app load
useAuth.getState().initialize();
initializePrivilegedSessionLifecycle();
void initEventHandlers();
initSentry();

createRoot(document.getElementById("root")!).render(<App />);
