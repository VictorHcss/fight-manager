/**
 * Testes de ponta a ponta: o navegador usa o build de produção contra um banco
 * próprio (E2E_DATABASE_URL), recriado com os dados de exemplo a cada execução.
 * Antes de rodar: npm run build. Depois: npm run test:e2e.
 */
import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;
/** Os e-mails do servidor de teste viram arquivos aqui (o teste lê o link de recuperação de senha). */
export const OUTBOX = "test-results/outbox";
const E2E_DB = process.env.E2E_DATABASE_URL ?? "postgres://fight:fight@localhost:5432/fight_manager_e2e";
const chromium = process.env.PW_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } } : {};

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1, // os fluxos compartilham o mesmo banco de exemplo
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", locale: "pt-BR", timezoneId: "America/Sao_Paulo", ...chromium },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 900 }, ...chromium }, testIgnore: /celular\.spec\.ts/ },
    { name: "celular", use: { ...devices["Pixel 7"], ...chromium }, testMatch: /celular\.spec\.ts/ },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    env: { DATABASE_URL: E2E_DB, COOKIE_SECURE: "false", APP_TIMEZONE: "America/Sao_Paulo", EMAIL_OUTBOX_DIR: OUTBOX },
    timeout: 60_000,
  },
});
