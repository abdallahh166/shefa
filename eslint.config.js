import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/integrations/supabase/client",
              message: "Supabase client imports are restricted. Use repositories/services instead.",
            },
            {
              name: "@/services/supabase/client",
              message: "Supabase client imports are restricted. Use repositories/services instead.",
            },
            {
              name: "@supabase/supabase-js",
              message: "Supabase SDK should only be instantiated in services/supabase/client.ts.",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "src/services/**/*repository.{ts,tsx}",
      "src/services/supabase/**/*.{ts,tsx}",
      "src/integrations/supabase/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
);
