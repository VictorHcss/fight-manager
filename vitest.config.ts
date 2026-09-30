import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"], // os testes de ponta a ponta (tests/e2e) rodam com o Playwright
    setupFiles: ["./tests/setup.ts"],
    fileParallelism: false, // os testes de integração compartilham o mesmo banco de testes
    testTimeout: 20000,
  },
});
