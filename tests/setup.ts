// Os testes usam um banco PostgreSQL de verdade (TEST_DATABASE_URL), recriado do zero.
import { execSync } from "node:child_process";

const url = process.env.TEST_DATABASE_URL ?? "postgres://fight:fight@localhost:5432/fight_manager_test";
process.env.DATABASE_URL = url;
process.env.APP_TIMEZONE = "America/Sao_Paulo";

const globalState = globalThis as unknown as { __migrated?: boolean };
if (!globalState.__migrated) {
  const postgres = (await import("postgres")).default;
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql.unsafe("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
  await sql.end();
  execSync("node scripts/migrate.mjs", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
  globalState.__migrated = true;
}
