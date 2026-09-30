/**
 * Cria o administrador da plataforma (uso real). É ele quem cria as academias, em /plataforma.
 * Uso: ADMIN_PASSWORD="senha com 10+ caracteres" npm run db:create-platform-admin -- "Seu Nome" email@dominio.com
 * A senha vem da variável ADMIN_PASSWORD para não ficar no histórico do terminal.
 */
import "./load-env";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { hashPassword } from "../lib/auth/password";

async function main() {
  const [name, emailArg] = process.argv.slice(2);
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!name || !emailArg || password.length < 10) {
    throw new Error('Uso: ADMIN_PASSWORD="senha com 10+ caracteres" npm run db:create-platform-admin -- "Seu Nome" email@dominio.com');
  }
  const email = emailArg.trim().toLowerCase();
  const [taken] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`);
  if (taken) throw new Error(`Já existe uma conta com ${email}.`);
  await db.insert(users).values({ academyId: null, role: "PLATFORM_ADMIN", name, email, passwordHash: await hashPassword(password) });
  console.log(`Administrador da plataforma criado. Entre com ${email} e crie as academias em /plataforma.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
