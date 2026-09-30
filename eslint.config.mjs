// Lint: regras recomendadas do Next.js (React, hooks, acessibilidade básica e Core Web Vitals) + TypeScript.
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "node_modules/**", "drizzle/**", "next-env.d.ts", "playwright-report/**", "test-results/**"]),
  {
    rules: {
      // variáveis começando com _ são descartadas de propósito (ex.: tirar o campo de saúde de um objeto)
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" }],
    },
  },
]);
