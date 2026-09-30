/**
 * Cria uma academia e o primeiro administrador (uso real, sem dados de exemplo).
 * Uso: npm run db:create-admin -- "Nome da Academia" "Seu Nome" email@dominio.com
 * A senha é pedida pela variável ADMIN_PASSWORD (para não ficar no histórico do terminal).
 */
import "./load-env";
import { db } from "../db";
import { academies, users } from "../db/schema";
import { hashPassword } from "../lib/auth/password";

async function main() {
  const [academyName, name, email] = process.argv.slice(2);
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!academyName || !name || !email || password.length < 10) {
    throw new Error('Uso: ADMIN_PASSWORD="senha com 10+ caracteres" npm run db:create-admin -- "Academia" "Nome" email@dominio.com');
  }
  const [academy] = await db.insert(academies).values({ name: academyName }).returning();
  await db.insert(users).values({ academyId: academy.id, role: "ACADEMY_ADMIN", name, email: email.toLowerCase(), passwordHash: await hashPassword(password) });
  console.log(`Academia "${academyName}" criada. Entre com ${email.toLowerCase()}.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
