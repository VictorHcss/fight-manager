// Aplica as migrations da pasta drizzle/ (usado localmente e no Docker).
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { fileURLToPath } from "node:url";

// carrega o .env quando existir (fora do Docker); variáveis já definidas têm prioridade
try {
  process.loadEnvFile(".env");
} catch {
  /* sem .env */
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não configurada.");
  process.exit(1);
}

const client = postgres(url, { max: 1 });

try {
  const migrationsFolder = fileURLToPath(
    new URL("../drizzle", import.meta.url),
  );

  await migrate(drizzle(client), { migrationsFolder });

  console.log("Migrations aplicadas.");
} catch (error) {
  console.error("Falha nas migrations:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
