import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import postgres from "postgres";

/** Recria o banco de ponta a ponta do zero: migrations + dados de exemplo. */
export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL ?? "postgres://fight:fight@localhost:5432/fight_manager_e2e";
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql.unsafe("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
  await sql.end();
  rmSync("test-results/outbox", { recursive: true, force: true });
  const env = { ...process.env, DATABASE_URL: url };
  execSync("node scripts/migrate.mjs", { env, stdio: "pipe" });
  execSync("npx tsx scripts/seed.ts", { env, stdio: "pipe" });
}
