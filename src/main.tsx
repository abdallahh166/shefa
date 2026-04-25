import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./design-system/styles/globals.css";
import { useAuth } from "./core/auth/authStore";
import { initTheme } from "./hooks/useDarkMode";
import { initEventHandlers } from "./core/events";
import { initSentry } from "./core/observability/sentry";
import { initializeI18nStore } from "./core/i18n/i18nStore";

// Apply theme class before anything renders (prevents flash)
initTheme();
void initializeI18nStore();

// Initialize auth state on app load
useAuth.getState().initialize();
void initEventHandlers();
initSentry();

createRoot(document.getElementById("root")!).render(<App />);
