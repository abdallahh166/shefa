import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/services/**/*.ts"],
      exclude: ["**/__tests__/**", "**/*.d.ts"],
      thresholds: {
        // Keep the global floor honest, but do not turn broad service coverage into
        // a vanity percentage chase. Critical auth orchestration files are pinned
        // separately below for branch/failure-path coverage.
        lines: 60,
        statements: 60,
        functions: 60,
        branches: 55,
        "src/services/auth/authAbortRegistry.ts": {
          lines: 85,
          statements: 85,
          functions: 100,
          branches: 60,
        },
        "src/services/auth/authContextSnapshot.ts": {
          lines: 100,
          statements: 100,
          functions: 100,
          branches: 100,
        },
        "src/services/auth/authRecovery.ts": {
          lines: 90,
          statements: 90,
          functions: 100,
          branches: 85,
        },
        "src/services/auth/authSessionOrchestrator.ts": {
          lines: 85,
          statements: 85,
          functions: 90,
          branches: 60,
        },
        "src/services/auth/authStateMachine.ts": {
          lines: 100,
          statements: 100,
          functions: 100,
          branches: 100,
        },
        "src/services/supabase/supabaseAuthFetch.ts": {
          lines: 90,
          statements: 90,
          functions: 100,
          branches: 60,
        },
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
