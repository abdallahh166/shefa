import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

function safeOrigin(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseOrigin = safeOrigin(env.VITE_SUPABASE_URL);
  const supabaseWs = supabaseOrigin.replace(/^https:/i, "wss:").replace(/^http:/i, "ws:");
  const sentryOrigin = env.VITE_SENTRY_DSN ? safeOrigin(env.VITE_SENTRY_DSN) : "";

  const connectParts = [
    "'self'",
    supabaseOrigin,
    supabaseWs,
    sentryOrigin,
    "https://fonts.googleapis.com",
    "https://fonts.gstatic.com",
  ].filter(Boolean);

  const productionCsp = [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    `connect-src ${connectParts.join(" ")}`,
    "frame-ancestors 'self'",
  ].join("; ");

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      mode === "production" && {
        name: "shefaa-html-csp",
        transformIndexHtml(html: string) {
          if (!html.includes("<head>")) return html;
          const tag = `    <meta http-equiv="Content-Security-Policy" content="${productionCsp}" />\n`;
          return html.replace("<head>", `<head>\n${tag}`);
        },
      },
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@/components": path.resolve(__dirname, "./src/components"),
        "@/design-system": path.resolve(__dirname, "./src/design-system"),
      },
      dedupe: ["react", "react-dom"],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom", "react-router-dom"],
            data: ["@supabase/supabase-js", "@tanstack/react-query", "zustand"],
            charts: ["recharts"],
            pdf: ["jspdf", "jspdf-autotable", "html2canvas", "dompurify"],
          },
        },
      },
      chunkSizeWarningLimit: 800,
    },
  };
});
